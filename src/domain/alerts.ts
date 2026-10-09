import { classifyHealthFactor } from "./risk.js";
import type { RiskState } from "./types.js";

export interface RiskAlert {
  severity: "info" | "warning" | "critical";
  code: string;
  message: string;
}

export interface AlertEvaluation {
  state: RiskState;
  alerts: RiskAlert[];
}

export function evaluateAlerts(healthFactor: number | null): AlertEvaluation {
  const state = classifyHealthFactor(healthFactor);

  switch (state) {
    case "NO_DEBT":
      return {
        state,
        alerts: [
          {
            severity: "info",
            code: "NO_ACTIVE_DEBT",
            message: "No active debt was supplied to the risk evaluator.",
          },
        ],
      };
    case "CRITICAL":
      return {
        state,
        alerts: [
          {
            severity: "critical",
            code: "HF_AT_OR_BELOW_ONE",
            message:
              "Health Factor is at or below 1. The position may be eligible for liquidation under protocol rules.",
          },
        ],
      };
    case "DANGER":
      return {
        state,
        alerts: [
          {
            severity: "critical",
            code: "HF_DANGER_BAND",
            message: "Health Factor is between 1.00 and 1.20.",
          },
        ],
      };
    case "WATCH":
      return {
        state,
        alerts: [
          {
            severity: "warning",
            code: "HF_WATCH_BAND",
            message: "Health Factor is between 1.20 and 1.50.",
          },
        ],
      };
    case "SAFE":
      return { state, alerts: [] };
  }
}
