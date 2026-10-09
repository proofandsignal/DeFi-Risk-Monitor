import type { RiskAssessment, RiskState } from "./types.js";

export function classifyHealthFactor(healthFactor: number | null): RiskState {
  if (healthFactor === null) return "NO_DEBT";
  if (!Number.isFinite(healthFactor) || healthFactor < 0) {
    throw new Error("healthFactor must be a finite non-negative number or null");
  }

  if (healthFactor <= 1) return "CRITICAL";
  if (healthFactor < 1.2) return "DANGER";
  if (healthFactor < 1.5) return "WATCH";
  return "SAFE";
}

export function uniformCollateralDropToLiquidationPct(
  healthFactor: number | null,
): number | null {
  if (healthFactor === null) return null;
  if (!Number.isFinite(healthFactor) || healthFactor < 0) {
    throw new Error("healthFactor must be a finite non-negative number or null");
  }

  if (healthFactor <= 1) return 0;

  return (1 - 1 / healthFactor) * 100;
}

export function assessHealthFactor(
  healthFactor: number | null,
): RiskAssessment {
  return {
    healthFactor,
    state: classifyHealthFactor(healthFactor),
    uniformCollateralDropToLiquidationPct:
      uniformCollateralDropToLiquidationPct(healthFactor),
    assumptions: [
      "Risk bands are product heuristics; Aave liquidation logic remains authoritative.",
      "Liquidation-distance estimate assumes collateral values move proportionally while debt value and protocol parameters remain unchanged.",
    ],
  };
}
