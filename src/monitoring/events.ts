import type { RiskState } from "../domain/types.js";
import type { MonitorAlertEvent, MonitorSnapshot } from "./types.js";

const riskRank: Record<RiskState, number> = {
  NO_DEBT: 0,
  SAFE: 1,
  WATCH: 2,
  DANGER: 3,
  CRITICAL: 4,
};

function severityFor(state: RiskState): "info" | "warning" | "critical" {
  if (state === "CRITICAL" || state === "DANGER") return "critical";
  if (state === "WATCH") return "warning";
  return "info";
}

function risky(state: RiskState): boolean {
  return state === "WATCH" || state === "DANGER" || state === "CRITICAL";
}

export function evaluateMonitorEvent(
  previous: MonitorSnapshot | null,
  current: MonitorSnapshot,
  hfDropThreshold: number,
): MonitorAlertEvent | null {
  if (!Number.isFinite(hfDropThreshold) || hfDropThreshold <= 0) {
    throw new Error("hfDropThreshold must be a positive finite number");
  }

  if (previous === null) {
    if (!risky(current.riskState)) return null;

    return {
      type: "INITIAL_RISK",
      severity: severityFor(current.riskState),
      wallet: current.wallet,
      previousHealthFactor: null,
      currentHealthFactor: current.healthFactor,
      previousState: null,
      currentState: current.riskState,
      observedAt: current.observedAt,
      message: `Initial monitored state is ${current.riskState} (HF ${current.healthFactor ?? "n/a"}).`,
    };
  }

  if (riskRank[current.riskState] > riskRank[previous.riskState]) {
    return {
      type: "STATE_WORSENED",
      severity: severityFor(current.riskState),
      wallet: current.wallet,
      previousHealthFactor: previous.healthFactor,
      currentHealthFactor: current.healthFactor,
      previousState: previous.riskState,
      currentState: current.riskState,
      observedAt: current.observedAt,
      message: `Risk state worsened from ${previous.riskState} to ${current.riskState}.`,
    };
  }

  if (
    previous.healthFactor !== null &&
    current.healthFactor !== null &&
    previous.healthFactor - current.healthFactor >= hfDropThreshold
  ) {
    return {
      type: "HF_DROP",
      severity: severityFor(current.riskState),
      wallet: current.wallet,
      previousHealthFactor: previous.healthFactor,
      currentHealthFactor: current.healthFactor,
      previousState: previous.riskState,
      currentState: current.riskState,
      observedAt: current.observedAt,
      message: `Health Factor dropped by ${(previous.healthFactor - current.healthFactor).toFixed(3)}.`,
    };
  }

  if (risky(previous.riskState) && !risky(current.riskState)) {
    return {
      type: "RECOVERED",
      severity: "info",
      wallet: current.wallet,
      previousHealthFactor: previous.healthFactor,
      currentHealthFactor: current.healthFactor,
      previousState: previous.riskState,
      currentState: current.riskState,
      observedAt: current.observedAt,
      message: `Risk state recovered from ${previous.riskState} to ${current.riskState}.`,
    };
  }

  return null;
}
