import type { RiskState } from "../domain/types.js";

export type MonitorHealth = "HEALTHY" | "DEGRADED" | "OFFLINE" | "VERIFY";

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
  id: string;
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
  version: 2;
  wallets: Record<string, MonitorSnapshot>;
  pendingAlerts: Record<string, MonitorAlertEvent>;
}

export interface DeliveryResult {
  delivered: boolean;
  statusCode?: number;
  attempts: number;
  reason?: string;
}

export interface AlertNotifier {
  notify(event: MonitorAlertEvent): Promise<DeliveryResult>;
}
