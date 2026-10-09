import { getAddress, type Address } from "viem";

export interface AppConfig {
  port: number;
  aaveRpcUrl: string | null;
  aavePoolAddress: Address;
  aaveBaseCurrencyDecimals: number;
}

const DEFAULT_AAVE_V3_ETHEREUM_POOL =
  "0x87870Bca3F3fd6335C3F4ce8392D69350B4fa4E2";

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
