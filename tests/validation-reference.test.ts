import { describe, expect, it } from "vitest";
import { compareHealthFactorReference } from "../src/validation/reference.js";

describe("Aave Health Factor reference comparison", () => {
  it("matches deterministic collateral/debt math", () => {
    const result = compareHealthFactorReference(100, 50, 0.8, 1.6);
    expect(result.referenceHealthFactor).toBeCloseTo(1.6, 12);
    expect(result.relativeDeltaPct).toBeCloseTo(0, 12);
    expect(result.matchesWithinTolerance).toBe(true);
  });

  it("handles no-debt accounts explicitly", () => {
    const result = compareHealthFactorReference(100, 0, 0.8, null);
    expect(result.referenceHealthFactor).toBeNull();
    expect(result.matchesWithinTolerance).toBe(true);
  });

  it("handles liquidation boundary and dust-debt scale", () => {
    const boundary = compareHealthFactorReference(100, 80, 0.8, 1);
    expect(boundary.referenceHealthFactor).toBeCloseTo(1, 12);
    expect(boundary.matchesWithinTolerance).toBe(true);

    const dust = compareHealthFactorReference(
      177000,
      0.006,
      0.76,
      22420000,
      1,
    );
    expect(dust.referenceHealthFactor).toBeGreaterThan(20_000_000);
    expect(dust.matchesWithinTolerance).toBe(true);
  });
});
