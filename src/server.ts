import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { getAddress } from "viem";
import { AaveV3Reader } from "./adapters/aaveV3.js";
import { loadConfig } from "./config.js";
import { evaluateAlerts } from "./domain/alerts.js";
import { assessHealthFactor } from "./domain/risk.js";
import { simulateScenario } from "./domain/scenario.js";
import type { ScenarioInput } from "./domain/types.js";
import { startMonitorScheduler } from "./monitoring/scheduler.js";

const config = loadConfig();
const monitor = startMonitorScheduler(config);

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  const maxBytes = 64 * 1024;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > maxBytes) throw new Error("request body too large");
    chunks.push(buffer);
  }

  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function routeWallet(pathname: string): string | null {
  const prefix = "/api/v1/aave/account/";
  if (!pathname.startsWith(prefix)) return null;
  const candidate = decodeURIComponent(pathname.slice(prefix.length));

  try {
    return getAddress(candidate);
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  try {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://localhost");

    if (method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, {
        status: "ok",
        service: "defi-risk-monitor",
        version: "0.2.0",
        liveAaveConfigured: Boolean(config.aaveRpcUrl),
        monitoring: {
          configured: monitor.configured,
          running: monitor.running,
          walletCount: config.monitoredWallets.length,
          alertDeliveryConfigured: Boolean(config.alertWebhookUrl),
          intervalSeconds: config.monitorIntervalSeconds,
          lastRun: monitor.lastRun,
        },
      });
    }

    if (method === "GET" && url.pathname === "/api/v1/monitor/status") {
      return sendJson(response, 200, {
        configured: monitor.configured,
        running: monitor.running,
        walletCount: config.monitoredWallets.length,
        intervalSeconds: config.monitorIntervalSeconds,
        alertDeliveryConfigured: Boolean(config.alertWebhookUrl),
        lastRun: monitor.lastRun,
      });
    }

    if (method === "GET" && url.pathname.startsWith("/api/v1/aave/account/")) {
      const wallet = routeWallet(url.pathname);
      if (!wallet) {
        return sendJson(response, 400, { error: "invalid wallet address" });
      }

      if (!config.aaveRpcUrl) {
        return sendJson(response, 503, {
          error: "AAVE_RPC_URL is required for live Aave reads",
        });
      }

      const reader = new AaveV3Reader({
        rpcUrl: config.aaveRpcUrl,
        poolAddress: config.aavePoolAddress,
        baseCurrencyDecimals: config.aaveBaseCurrencyDecimals,
      });

      const snapshot = await reader.getAccountSnapshot(wallet);
      return sendJson(response, 200, {
        snapshot,
        risk: assessHealthFactor(snapshot.healthFactor),
        alerts: evaluateAlerts(snapshot.healthFactor),
      });
    }

    if (method === "POST" && url.pathname === "/api/v1/simulate") {
      const input = (await readJson(request)) as ScenarioInput;
      return sendJson(response, 200, simulateScenario(input));
    }

    if (method === "POST" && url.pathname === "/api/v1/alerts/evaluate") {
      const body = (await readJson(request)) as { healthFactor?: unknown };
      const value = body.healthFactor;

      if (
        value !== null &&
        (typeof value !== "number" || !Number.isFinite(value))
      ) {
        return sendJson(response, 400, {
          error: "healthFactor must be a finite number or null",
        });
      }

      return sendJson(
        response,
        200,
        evaluateAlerts((value ?? null) as number | null),
      );
    }

    return sendJson(response, 404, { error: "not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return sendJson(response, 400, { error: message });
  }
});

server.listen(config.port, () => {
  console.log(`DeFi Risk Monitor listening on port ${config.port}`);
});

function shutdown(): void {
  monitor.stop();
  server.close(() => process.exit(0));
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
