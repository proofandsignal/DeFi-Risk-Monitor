import { getAddress, type Address } from "viem";

export interface AppConfig {
  port: number;
  aaveRpcUrl: string | null;
  aavePoolAddress: Address;
  aaveBaseCurrencyDecimals: number;
}

const DEFAULT_AAVE_V3_ETHEREUM_POOL =
  "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2";

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }

  return value;
}

export function loadConfig(): AppConfig {
  return {
    port: intFromEnv("PORT", 3000),
    aaveRpcUrl: process.env.AAVE_RPC_URL?.trim() || null,
    aavePoolAddress: getAddress(
      process.env.AAVE_POOL_ADDRESS?.trim() ||
        DEFAULT_AAVE_V3_ETHEREUM_POOL,
    ),
    aaveBaseCurrencyDecimals: intFromEnv(
      "AAVE_BASE_CURRENCY_DECIMALS",
      8,
    ),
  };
}
