import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AaveV3Reader } from "../adapters/aaveV3.js";
import { loadConfig } from "../config.js";
import { assessHealthFactor } from "../domain/risk.js";
import {
  discoverRisk20Wallets,
  type Risk20DiscoveryResult,
} from "./discovery.js";
import { parseRisk20Wallets } from "./input.js";

interface ValidationRow {
  index: number;
  wallet: string;
  observedAt: string | null;
  healthFactor: number | null;
  state: string | null;
  totalCollateralBase: number | null;
  totalDebtBase: number | null;
  currentLiquidationThreshold: number | null;
  ltv: number | null;
  uniformCollateralDropToLiquidationPct: number | null;
  status: "ok" | "error";
  error: string | null;
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/https?:\/\/[^\s"'<>]+/g, "[redacted-url]")
    .replace(/(api[_-]?key|token|secret)=([^&\s]+)/gi, "$1=[redacted]");
}

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

async function main(): Promise<void> {
  const config = loadConfig();
  if (!config.aaveRpcUrl) {
    throw new Error(
      "AAVE_RPC_URL is required; configure it as a repository secret or local environment variable",
    );
  }

  const walletsRaw = process.env.RISK20_WALLETS?.trim();
  let discovery: Risk20DiscoveryResult | null = null;

  const wallets = walletsRaw
    ? parseRisk20Wallets(walletsRaw)
    : (
        (discovery = await discoverRisk20Wallets({
          rpcUrl: config.aaveRpcUrl,
          poolAddress: config.aavePoolAddress,
          baseCurrencyDecimals: config.aaveBaseCurrencyDecimals,
        })),
        discovery.wallets
      );

  if (discovery) {
    console.log(
      `Auto-discovered 20 wallets from ${discovery.activeBorrowersFound} active borrowers after seeing ${discovery.uniqueBorrowersSeen} unique recent borrowers`,
    );
  } else {
    console.log("Using 20 manually supplied public wallet addresses");
  }

  const reader = new AaveV3Reader({
    rpcUrl: config.aaveRpcUrl,
    poolAddress: config.aavePoolAddress,
    baseCurrencyDecimals: config.aaveBaseCurrencyDecimals,
  });

  const rows: ValidationRow[] = [];

  for (const [index, wallet] of wallets.entries()) {
    try {
      const snapshot = await reader.getAccountSnapshot(wallet);
      const risk = assessHealthFactor(snapshot.healthFactor);
      rows.push({
        index: index + 1,
        wallet,
        observedAt: snapshot.observedAt,
        healthFactor: snapshot.healthFactor,
        state: risk.state,
        totalCollateralBase: snapshot.totalCollateralBase,
        totalDebtBase: snapshot.totalDebtBase,
        currentLiquidationThreshold: snapshot.currentLiquidationThreshold,
        ltv: snapshot.ltv,
        uniformCollateralDropToLiquidationPct:
          risk.uniformCollateralDropToLiquidationPct,
        status: "ok",
        error: null,
      });

      console.log(
        `[${index + 1}/20] OK ${wallet.slice(0, 8)}…${wallet.slice(-6)} HF=${snapshot.healthFactor ?? "NO_DEBT"} state=${risk.state}`,
      );
    } catch (error) {
      const clean = sanitizeError(error);
      rows.push({
        index: index + 1,
        wallet,
        observedAt: null,
        healthFactor: null,
        state: null,
        totalCollateralBase: null,
        totalDebtBase: null,
        currentLiquidationThreshold: null,
        ltv: null,
        uniformCollateralDropToLiquidationPct: null,
        status: "error",
        error: clean,
      });
      console.error(
        `[${index + 1}/20] ERROR ${wallet.slice(0, 8)}…${wallet.slice(-6)}: ${clean}`,
      );
    }
  }

  const ok = rows.filter((row) => row.status === "ok");
  const failed = rows.filter((row) => row.status === "error");
  const states = ok.reduce<Record<string, number>>((acc, row) => {
    const key = row.state ?? "UNKNOWN";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const outputDir = resolve(process.env.RISK20_OUTPUT_DIR ?? "artifacts");
  await mkdir(outputDir, { recursive: true });

  const report = {
    benchmark: "DEFI RISK 20",
    chainId: 1,
    protocol: "Aave V3",
    generatedAt: new Date().toISOString(),
    walletSource: discovery ? "auto-discovery" : "manual",
    discovery,
    total: rows.length,
    succeeded: ok.length,
    failed: failed.length,
    stateCounts: states,
    rows,
  };

  await writeFile(
    resolve(outputDir, "defi-risk-20.json"),
    JSON.stringify(report, null, 2) + "\n",
    "utf8",
  );

  const headers: (keyof ValidationRow)[] = [
    "index",
    "wallet",
    "observedAt",
    "healthFactor",
    "state",
    "totalCollateralBase",
    "totalDebtBase",
    "currentLiquidationThreshold",
    "ltv",
    "uniformCollateralDropToLiquidationPct",
    "status",
    "error",
  ];

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) =>
          csvCell(row[header] as string | number | null),
        )
        .join(","),
    ),
  ].join("\n");

  await writeFile(
    resolve(outputDir, "defi-risk-20.csv"),
    csv + "\n",
    "utf8",
  );

  console.log(
    `DEFI RISK 20 complete: ${ok.length}/20 successful; ${failed.length} failed; states=${JSON.stringify(states)}`,
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`DEFI RISK 20 failed: ${sanitizeError(error)}`);
  process.exitCode = 1;
});
