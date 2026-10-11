import { describe, expect, it } from "vitest";
import { evaluateMonitorEvent } from "../src/monitoring/events.js";
import type { MonitorSnapshot } from "../src/monitoring/types.js";

function snapshot(hf: number | null, riskState: MonitorSnapshot["riskState"], observedAt="2026-10-09T00:00:00.000Z"): MonitorSnapshot {
  return {
    wallet: "0x0000000000000000000000000000000000000001",
    healthFactor: hf,
    riskState,
    totalCollateralBase: 10000,
    totalDebtBase: hf === null ? 0 : 5000,
    observedAt,
  };
}

describe("monitor events", () => {
  it("alerts once on worsening risk", () => {
    const event = evaluateMonitorEvent(snapshot(1.6, "SAFE"), snapshot(1.4, "WATCH"), 0.1);
    expect(event?.type).toBe("STATE_WORSENED");
    expect(event?.id).toContain("STATE_WORSENED");
  });

  it("does not spam unchanged healthy positions", () => {
    expect(evaluateMonitorEvent(snapshot(2, "SAFE"), snapshot(1.95, "SAFE"), 0.1)).toBeNull();
  });

  it("alerts on material HF drop within same state", () => {
    expect(evaluateMonitorEvent(snapshot(1.8, "SAFE"), snapshot(1.65, "SAFE"), 0.1)?.type).toBe("HF_DROP");
  });
});
