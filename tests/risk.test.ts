import { describe, expect, it } from "vitest";
import {
  assessHealthFactor,
  classifyHealthFactor,
  uniformCollateralDropToLiquidationPct,
} from "../src/domain/risk.js";

describe("risk engine", () => {
  it("classifies the v0.1 risk bands", () => {
    expect(classifyHealthFactor(null)).toBe("NO_DEBT");
    expect(classifyHealthFactor(2)).toBe("SAFE");
    expect(classifyHealthFactor(1.49)).toBe("WATCH");
    expect(classifyHealthFactor(1.19)).toBe("DANGER");
    expect(classifyHealthFactor(1)).toBe("CRITICAL");
    expect(classifyHealthFactor(0.9)).toBe("CRITICAL");
  });

  it("estimates a uniform collateral drop to HF 1", () => {
    expect(uniformCollateralDropToLiquidationPct(2)).toBeCloseTo(50, 8);
    expect(uniformCollateralDropToLiquidationPct(1.25)).toBeCloseTo(20, 8);
    expect(uniformCollateralDropToLiquidationPct(1)).toBe(0);
    expect(uniformCollateralDropToLiquidationPct(null)).toBeNull();
  });

  it("returns assumptions with every assessment", () => {
    const result = assessHealthFactor(1.4);
    expect(result.state).toBe("WATCH");
    expect(result.assumptions.length).toBeGreaterThan(0);
  });
});
