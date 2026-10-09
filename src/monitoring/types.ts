import type { RiskState } from "../domain/types.js";

export interface MonitorSnapshot {
  wallet: string;
  healthFactor: number | null;
  riskState: RiskState;
  totalCollateralBase: number;
  totalDebtBase: number;
  observedAt: string;
}

export type MonitorEventType =
  | "INITIAL_RISK"
  | "STATE_WORSENED"
  | "HF_DROP"
  | "RECOVERED";

export interface MonitorAlertEvent {
  type: MonitorEventType;
  severity: "info" | "warning" | "critical";
  wallet: string;
  previousHealthFactor: number | null;
  currentHealthFactor: number | null;
  previousState: RiskState | null;
  currentState: RiskState;
  observedAt: string;
  message: string;
}

export interface MonitorStateFile {
  version: 1;
  wallets: Record<string, MonitorSnapshot>;
}

export interface DeliveryResult {
  delivered: boolean;
  statusCode?: number;
  reason?: string;
}

export interface AlertNotifier {
  notify(event: MonitorAlertEvent): Promise<DeliveryResult>;
}
