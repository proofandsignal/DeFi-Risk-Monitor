import { describe, expect, it } from "vitest";
import { simulateScenario } from "../src/domain/scenario.js";

describe("scenario simulator", () => {
  it("reduces health factor when collateral falls", () => {
    const result = simulateScenario({
      collaterals: [
        { symbol: "WETH", valueUsd: 15_000, liquidationThreshold: 0.825 },
        { symbol: "USDC", valueUsd: 5_000, liquidationThreshold: 0.8 },
      ],
      debts: [{ symbol: "USDC", valueUsd: 10_000 }],
      shocksPct: { WETH: -20 },
    });

    expect(result.baseHealthFactor).toBeCloseTo(1.6375, 6);
    expect(result.shockedHealthFactor).toBeCloseTo(1.39, 6);
    expect(result.baseState).toBe("SAFE");
    expect(result.shockedState).toBe("WATCH");
  });

  it("returns NO_DEBT when no debt exists", () => {
    const result = simulateScenario({
      collaterals: [
        { symbol: "WETH", valueUsd: 10_000, liquidationThreshold: 0.825 },
      ],
      debts: [],
      shocksPct: { WETH: -50 },
    });

    expect(result.shockedHealthFactor).toBeNull();
    expect(result.shockedState).toBe("NO_DEBT");
  });

  it("rejects impossible -100% price multipliers", () => {
    expect(() =>
      simulateScenario({
        collaterals: [
          { symbol: "WETH", valueUsd: 10_000, liquidationThreshold: 0.825 },
        ],
        debts: [{ symbol: "USDC", valueUsd: 1_000 }],
        shocksPct: { WETH: -100 },
      }),
    ).toThrow(/greater than -100%/);
  });
});
