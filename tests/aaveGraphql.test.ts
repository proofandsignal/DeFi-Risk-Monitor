import { describe, expect, it, vi } from "vitest";
import { getAavePositionSnapshot } from "../src/adapters/aaveGraphql.js";

describe("Aave GraphQL position adapter", () => {
  it("normalizes supply and borrow positions", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            userSupplies: [
              {
                currency: { symbol: "WETH" },
                balance: { amount: { value: "2" }, usd: "7000" },
                apy: { formatted: "1.50" },
                isCollateral: true
              }
            ],
            userBorrows: [
              {
                currency: { symbol: "USDC" },
                debt: { amount: { value: "3000" }, usd: "3000" },
                apy: { formatted: "4.20" }
              }
            ]
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const result = await getAavePositionSnapshot({
      wallet: "0x0000000000000000000000000000000000000001",
      chainId: 1,
      poolAddress: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
      fetchImpl,
    });

    expect(result.supplies).toEqual([
      {
        symbol: "WETH",
        amount: "2",
        valueUsd: 7000,
        apyPct: 1.5,
        isCollateral: true,
      },
    ]);
    expect(result.borrows).toEqual([
      {
        symbol: "USDC",
        amount: "3000",
        valueUsd: 3000,
        apyPct: 4.2,
      },
    ]);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("fails closed when GraphQL reports an error", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({ errors: [{ message: "schema drift" }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    await expect(
      getAavePositionSnapshot({
        wallet: "0x0000000000000000000000000000000000000001",
        chainId: 1,
        poolAddress: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
        fetchImpl,
      }),
    ).rejects.toThrow(/schema drift/);
  });
});
