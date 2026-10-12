import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { getAddress } from "viem";
import { AaveV3Reader } from "./adapters/aaveV3.js";
import { loadConfig } from "./config.js";
import { evaluateAlerts } from "./domain/alerts.js";
import { assessHealthFactor } from "./domain/risk.js";
import { simulateScenario } from "./domain/scenario.js";
import type { ScenarioInput } from "./domain/types.js";

const config = loadConfig();

interface RateBucket {
  count: number;
  resetAt: number;
}

const scanBuckets = new Map<string, RateBucket>();

function requestIp(request: IncomingMessage): string {
  const forwarded = request.headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value?.split(",")[0]?.trim() || request.socket.remoteAddress || "unknown";
}

function corsHeaders(request: IncomingMessage): Record<string, string> {
  const origin = request.headers.origin;
  if (origin === config.corsAllowedOrigin) {
    return {
      "access-control-allow-origin": config.corsAllowedOrigin,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "accept,content-type",
      vary: "Origin",
    };
  }

  return { vary: "Origin" };
}

function sendJson(
  request: IncomingMessage,
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...corsHeaders(request),
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

function allowScan(request: IncomingMessage): boolean {
  const now = Date.now();
  const key = requestIp(request);
  const existing = scanBuckets.get(key);

  if (!existing || now >= existing.resetAt) {
    scanBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (existing.count >= config.scanRateLimitPerMinute) {
    return false;
  }

  existing.count += 1;
  return true;
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

    if (method === "OPTIONS") {
      if (request.headers.origin !== config.corsAllowedOrigin) {
        return sendJson(request, response, 403, { error: "origin not allowed" });
      }

      response.writeHead(204, {
        ...corsHeaders(request),
        "cache-control": "no-store",
      });
      return response.end();
    }

    if (method === "GET" && url.pathname === "/health") {
      return sendJson(request, response, 200, {
        status: "ok",
        service: "defi-risk-monitor",
        version: "0.2.1",
        liveAaveConfigured: Boolean(config.aaveRpcUrl),
      });
    }

    if (method === "GET" && url.pathname.startsWith("/api/v1/aave/account/")) {
      if (!allowScan(request)) {
        return sendJson(
          request,
          response,
          429,
          { error: "scan rate limit exceeded; try again shortly" },
          { "retry-after": "60" },
        );
      }

      const wallet = routeWallet(url.pathname);
      if (!wallet) {
        return sendJson(request, response, 400, {
          error: "invalid wallet address",
        });
      }

      if (!config.aaveRpcUrl) {
        return sendJson(request, response, 503, {
          error: "live Aave data is temporarily unavailable",
        });
      }

      const reader = new AaveV3Reader({
        rpcUrl: config.aaveRpcUrl,
        poolAddress: config.aavePoolAddress,
        baseCurrencyDecimals: config.aaveBaseCurrencyDecimals,
      });

      try {
        const snapshot = await reader.getAccountSnapshot(wallet);
        return sendJson(request, response, 200, {
          snapshot,
          risk: assessHealthFactor(snapshot.healthFactor),
          alerts: evaluateAlerts(snapshot.healthFactor),
        });
      } catch {
        return sendJson(request, response, 502, {
          error: "live Aave read failed; try again shortly",
        });
      }
    }

    if (method === "POST" && url.pathname === "/api/v1/simulate") {
      const input = (await readJson(request)) as ScenarioInput;
      return sendJson(request, response, 200, simulateScenario(input));
    }

    if (method === "POST" && url.pathname === "/api/v1/alerts/evaluate") {
      const body = (await readJson(request)) as { healthFactor?: unknown };
      const value = body.healthFactor;

      if (
        value !== null &&
        (typeof value !== "number" || !Number.isFinite(value))
      ) {
        return sendJson(request, response, 400, {
          error: "healthFactor must be a finite number or null",
        });
      }

      return sendJson(
        request,
        response,
        200,
        evaluateAlerts((value ?? null) as number | null),
      );
    }

    return sendJson(request, response, 404, { error: "not found" });
  } catch {
    return sendJson(request, response, 400, { error: "invalid request" });
  }
});

server.listen(config.port, () => {
  console.log(`DeFi Risk Monitor listening on port ${config.port}`);
});
