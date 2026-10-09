import { describe, expect, it } from "vitest";
import { parseRisk20Wallets } from "../src/validation/input.js";

function wallet(n: number): string {
  return `0x${n.toString(16).padStart(40, "0")}`;
}

describe("DEFI RISK 20 input", () => {
  it("accepts exactly 20 unique Ethereum addresses", () => {
    const raw = Array.from({ length: 20 }, (_, index) => wallet(index + 1)).join("\n");
    expect(parseRisk20Wallets(raw)).toHaveLength(20);
  });

  it("rejects fewer than 20 addresses", () => {
    const raw = Array.from({ length: 19 }, (_, index) => wallet(index + 1)).join(",");
    expect(() => parseRisk20Wallets(raw)).toThrow(/exactly 20/);
  });

  it("rejects duplicate addresses", () => {
    const values = Array.from({ length: 19 }, (_, index) => wallet(index + 1));
    values.push(wallet(1));
    expect(() => parseRisk20Wallets(values.join(" "))).toThrow(/duplicate/);
  });
});
