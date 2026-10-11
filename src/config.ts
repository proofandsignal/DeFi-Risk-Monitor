import { getAddress, type Address } from "viem";

export interface AppConfig {
  port: number;
  aaveRpcUrl: string | null;
  aavePoolAddress: Address;
  aaveBaseCurrencyDecimals: number;
  monitoredWallets: Address[];
  monitorIntervalSeconds: number;
  monitorStatePath: string;
  alertWebhookUrl: string | null;
  alertHfDropThreshold: number;
  rpcRetryAttempts: number;
  rpcRetryDelayMs: number;
  webhookRetryAttempts: number;
  webhookRetryDelayMs: number;
}

const DEFAULT_AAVE_V3_ETHEREUM_POOL =
  "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2";

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  return value;
}

function positiveNumberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive finite number`);
  return value;
}

function monitoredWallets(): Address[] {
  const raw = process.env.MONITORED_WALLETS?.trim();
  if (!raw) return [];
  return [...new Set(raw.split(",").map((value) => getAddress(value.trim())))];
}

function webhookUrl(): string | null {
  const raw = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!raw) return null;
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("ALERT_WEBHOOK_URL must use http or https");
  return url.toString();
}

export function loadConfig(): AppConfig {
  const monitorIntervalSeconds = intFromEnv("MONITOR_INTERVAL_SECONDS", 300);
  if (monitorIntervalSeconds < 60) throw new Error("MONITOR_INTERVAL_SECONDS must be at least 60");

  return {
    port: intFromEnv("PORT", 3000),
    aaveRpcUrl: process.env.AAVE_RPC_URL?.trim() || null,
    aavePoolAddress: getAddress(process.env.AAVE_POOL_ADDRESS?.trim() || DEFAULT_AAVE_V3_ETHEREUM_POOL),
    aaveBaseCurrencyDecimals: intFromEnv("AAVE_BASE_CURRENCY_DECIMALS", 8),
    monitoredWallets: monitoredWallets(),
    monitorIntervalSeconds,
    monitorStatePath: process.env.MONITOR_STATE_PATH?.trim() || "data/monitor-state.json",
    alertWebhookUrl: webhookUrl(),
    alertHfDropThreshold: positiveNumberFromEnv("ALERT_HF_DROP_THRESHOLD", 0.1),
    rpcRetryAttempts: intFromEnv("RPC_RETRY_ATTEMPTS", 3) || 1,
    rpcRetryDelayMs: intFromEnv("RPC_RETRY_DELAY_MS", 250),
    webhookRetryAttempts: intFromEnv("WEBHOOK_RETRY_ATTEMPTS", 3) || 1,
    webhookRetryDelayMs: intFromEnv("WEBHOOK_RETRY_DELAY_MS", 250),
  };
}
