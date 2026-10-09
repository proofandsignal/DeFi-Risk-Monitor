export type RiskState =
  | "NO_DEBT"
  | "SAFE"
  | "WATCH"
  | "DANGER"
  | "CRITICAL";

export interface AaveAccountSnapshot {
  wallet: string;
  chainId: number;
  poolAddress: string;
  totalCollateralBase: number;
  totalDebtBase: number;
  availableBorrowsBase: number;
  currentLiquidationThreshold: number;
  ltv: number;
  healthFactor: number | null;
  observedAt: string;
}

export interface RiskAssessment {
  healthFactor: number | null;
  state: RiskState;
  uniformCollateralDropToLiquidationPct: number | null;
  assumptions: string[];
}

export interface CollateralPosition {
  symbol: string;
  valueUsd: number;
  liquidationThreshold: number;
}

export interface DebtPosition {
  symbol: string;
  valueUsd: number;
}

export interface ScenarioInput {
  collaterals: CollateralPosition[];
  debts: DebtPosition[];
  shocksPct: Record<string, number>;
}

export interface ScenarioResult {
  baseHealthFactor: number | null;
  shockedHealthFactor: number | null;
  baseState: RiskState;
  shockedState: RiskState;
  adjustedCollateralUsd: number;
  debtUsd: number;
  assumptions: string[];
}
