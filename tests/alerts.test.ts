import { describe, expect, it } from "vitest";
import { evaluateAlerts } from "../src/domain/alerts.js";

describe("alert engine", () => {
  it("emits no alert in SAFE", () => {
    const result = evaluateAlerts(1.8);
    expect(result.state).toBe("SAFE");
    expect(result.alerts).toHaveLength(0);
  });

  it("emits a warning in WATCH", () => {
    const result = evaluateAlerts(1.3);
    expect(result.state).toBe("WATCH");
    expect(result.alerts[0]?.severity).toBe("warning");
  });

  it("emits critical alert at HF <= 1", () => {
    const result = evaluateAlerts(1);
    expect(result.state).toBe("CRITICAL");
    expect(result.alerts[0]?.code).toBe("HF_AT_OR_BELOW_ONE");
  });
});
