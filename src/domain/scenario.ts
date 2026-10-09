import { classifyHealthFactor } from "./risk.js";
import type {
  CollateralPosition,
  DebtPosition,
  ScenarioInput,
  ScenarioResult,
} from "./types.js";

function assertFiniteNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a finite non-negative number`);
  }
}

function validateCollateral(position: CollateralPosition): void {
  if (!position.symbol.trim()) throw new Error("collateral symbol is required");
  assertFiniteNonNegative(position.valueUsd, "collateral valueUsd");

  if (
    !Number.isFinite(position.liquidationThreshold) ||
    position.liquidationThreshold < 0 ||
    position.liquidationThreshold > 1
  ) {
    throw new Error("liquidationThreshold must be between 0 and 1");
  }
}

function validateDebt(position: DebtPosition): void {
  if (!position.symbol.trim()) throw new Error("debt symbol is required");
  assertFiniteNonNegative(position.valueUsd, "debt valueUsd");
}

function multiplierFor(symbol: string, shocksPct: Record<string, number>): number {
  const shock = shocksPct[symbol] ?? 0;

  if (!Number.isFinite(shock) || shock <= -100) {
    throw new Error(`shock for ${symbol} must be finite and greater than -100%`);
  }

  return 1 + shock / 100;
}

function healthFactor(
  collaterals: CollateralPosition[],
  debts: DebtPosition[],
  shocksPct: Record<string, number>,
): { healthFactor: number | null; adjustedCollateralUsd: number; debtUsd: number } {
  const adjustedCollateralUsd = collaterals.reduce((sum, position) => {
    validateCollateral(position);
    return (
      sum +
      position.valueUsd *
        multiplierFor(position.symbol, shocksPct) *
        position.liquidationThreshold
    );
  }, 0);

  const debtUsd = debts.reduce((sum, position) => {
    validateDebt(position);
    return sum + position.valueUsd * multiplierFor(position.symbol, shocksPct);
  }, 0);

  return {
    healthFactor: debtUsd === 0 ? null : adjustedCollateralUsd / debtUsd,
    adjustedCollateralUsd,
    debtUsd,
  };
}

export function simulateScenario(input: ScenarioInput): ScenarioResult {
  if (!Array.isArray(input.collaterals) || !Array.isArray(input.debts)) {
    throw new Error("collaterals and debts must be arrays");
  }

  if (!input.shocksPct || typeof input.shocksPct !== "object") {
    throw new Error("shocksPct must be an object");
  }

  const base = healthFactor(input.collaterals, input.debts, {});
  const shocked = healthFactor(input.collaterals, input.debts, input.shocksPct);

  return {
    baseHealthFactor: base.healthFactor,
    shockedHealthFactor: shocked.healthFactor,
    baseState: classifyHealthFactor(base.healthFactor),
    shockedState: classifyHealthFactor(shocked.healthFactor),
    adjustedCollateralUsd: shocked.adjustedCollateralUsd,
    debtUsd: shocked.debtUsd,
    assumptions: [
      "Input values are treated as current USD-equivalent values.",
      "Only explicit price shocks are changed; balances and protocol parameters remain constant.",
      "This simulator is informational and does not predict market prices or liquidation execution.",
    ],
  };
}
