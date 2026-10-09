import { getAddress } from "viem";

export function parseRisk20Wallets(raw: string): string[] {
  const tokens = raw
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  const wallets = tokens.map((value) => getAddress(value));
  const unique = [...new Map(wallets.map((wallet) => [wallet.toLowerCase(), wallet])).values()];

  if (unique.length !== wallets.length) {
    throw new Error("RISK20 wallet list contains duplicate addresses");
  }

  if (unique.length !== 20) {
    throw new Error(`DEFI RISK 20 requires exactly 20 unique wallet addresses; received ${unique.length}`);
  }

  return unique;
}
