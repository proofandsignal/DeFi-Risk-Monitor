import { getAddress, type Address } from "viem";
import type { AaveBorrowPosition, AaveSupplyPosition } from "../domain/types.js";

const AAVE_GRAPHQL_URL = "https://api.v3.aave.com/graphql";

interface GraphQlResponse {
  data?: {
    userSupplies?: Array<{
      currency: { symbol: string };
      balance: { amount: { value: string }; usd: string };
      apy?: { formatted?: string | null } | null;
      isCollateral: boolean;
    }>;
    userBorrows?: Array<{
      currency: { symbol: string };
      debt: { amount: { value: string }; usd: string };
      apy?: { formatted?: string | null } | null;
    }>;
  };
  errors?: Array<{ message: string }>;
}

export interface AavePositionSnapshot {
  supplies: AaveSupplyPosition[];
  borrows: AaveBorrowPosition[];
  observedAt: string;
  source: typeof AAVE_GRAPHQL_URL;
}

export async function getAavePositionSnapshot(input: {
  wallet: string;
  chainId: number;
  poolAddress: Address;
  fetchImpl?: typeof fetch;
}): Promise<AavePositionSnapshot> {
  const wallet = getAddress(input.wallet);
  const doFetch = input.fetchImpl ?? fetch;

  const query = `
    query UserPositions {
      userSupplies(request: {
        markets: [{ address: "${input.poolAddress}", chainId: ${input.chainId} }],
        user: "${wallet}"
      }) {
        currency { symbol }
        balance { amount { value } usd }
        apy { formatted }
        isCollateral
      }
      userBorrows(request: {
        markets: [{ address: "${input.poolAddress}", chainId: ${input.chainId} }],
        user: "${wallet}"
      }) {
        currency { symbol }
        debt { amount { value } usd }
        apy { formatted }
      }
    }
  `;

  const response = await doFetch(AAVE_GRAPHQL_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Aave GraphQL HTTP ${response.status}`);
  }

  const payload = (await response.json()) as GraphQlResponse;

  if (payload.errors?.length) {
    throw new Error(
      `Aave GraphQL error: ${payload.errors.map((item) => item.message).join("; ")}`,
    );
  }

  const supplies: AaveSupplyPosition[] = (payload.data?.userSupplies ?? []).map(
    (item) => ({
      symbol: item.currency.symbol,
      amount: item.balance.amount.value,
      valueUsd: Number(item.balance.usd),
      apyPct:
        item.apy?.formatted == null ? null : Number(item.apy.formatted),
      isCollateral: item.isCollateral,
    }),
  );

  const borrows: AaveBorrowPosition[] = (payload.data?.userBorrows ?? []).map(
    (item) => ({
      symbol: item.currency.symbol,
      amount: item.debt.amount.value,
      valueUsd: Number(item.debt.usd),
      apyPct:
        item.apy?.formatted == null ? null : Number(item.apy.formatted),
    }),
  );

  for (const position of [...supplies, ...borrows]) {
    if (!Number.isFinite(position.valueUsd)) {
      throw new Error("Aave GraphQL returned an invalid USD position value");
    }
    if (position.apyPct !== null && !Number.isFinite(position.apyPct)) {
      throw new Error("Aave GraphQL returned an invalid APY value");
    }
  }

  return {
    supplies,
    borrows,
    observedAt: new Date().toISOString(),
    source: AAVE_GRAPHQL_URL,
  };
}
