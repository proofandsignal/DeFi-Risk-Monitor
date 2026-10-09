import { describe, expect, it } from "vitest";
import { evaluateMonitorEvent } from "../src/monitoring/events.js";
import type { MonitorSnapshot } from "../src/monitoring/types.js";

function snapshot(
  healthFactor: number | null,
  riskState: MonitorSnapshot["riskState"],
): MonitorSnapshot {
  return {
    wallet: "0x0000000000000000000000000000000000000001",
    healthFactor,
    riskState,
    totalCollateralBase: 10_000,
    totalDebtBase: healthFactor === null ? 0 : 5_000,
    observedAt: "2026-10-09T00:00:00.000Z",
  };
}

describe("monitor event evaluation", () => {
  it("alerts on an initial risky state", () => {
    const event = evaluateMonitorEvent(null, snapshot(1.4, "WATCH"), 0.1);
    expect(event?.type).toBe("INITIAL_RISK");
  });

  it("alerts when the risk state worsens", () => {
    const event = evaluateMonitorEvent(
      snapshot(1.6, "SAFE"),
      snapshot(1.4, "WATCH"),
      0.1,
    );
    expect(event?.type).toBe("STATE_WORSENED");
  });

  it("alerts on a material HF drop within the same state", () => {
    const event = evaluateMonitorEvent(
      snapshot(1.8, "SAFE"),
      snapshot(1.65, "SAFE"),
      0.1,
    );
    expect(event?.type).toBe("HF_DROP");
  });

  it("emits a recovery event after leaving a risky state", () => {
    const event = evaluateMonitorEvent(
      snapshot(1.4, "WATCH"),
      snapshot(1.6, "SAFE"),
      0.1,
    );
    expect(event?.type).toBe("RECOVERED");
  });

  it("does not spam unchanged healthy positions", () => {
    const event = evaluateMonitorEvent(
      snapshot(2.0, "SAFE"),
      snapshot(1.95, "SAFE"),
      0.1,
    );
    expect(event).toBeNull();
  });
});
