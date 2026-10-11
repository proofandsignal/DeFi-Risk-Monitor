import {
  createPublicClient,
  getAddress,
  http,
  parseAbiItem,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";
import { AaveV3Reader } from "../adapters/aaveV3.js";

const borrowEvent = parseAbiItem(
  "event Borrow(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint8 interestRateMode, uint256 borrowRate, uint16 indexed referralCode)",
);

export interface Risk20DiscoveryConfig {
  rpcUrl: string;
  poolAddress: Address;
  baseCurrencyDecimals: number;
}

export interface Risk20DiscoveryResult {
  wallets: string[];
  latestBlock: string;
  oldestScannedBlock: string;
  uniqueBorrowersSeen: number;
  activeBorrowersFound: number;
  selectionMethod: string;
}

interface ActiveBorrower {
  wallet: string;
  healthFactor: number;
}

export async function discoverRisk20Wallets(
  config: Risk20DiscoveryConfig,
): Promise<Risk20DiscoveryResult> {
  const client = createPublicClient({
    chain: mainnet,
    transport: http(config.rpcUrl),
  });

  const reader = new AaveV3Reader({
    rpcUrl: config.rpcUrl,
    poolAddress: config.poolAddress,
    baseCurrencyDecimals: config.baseCurrencyDecimals,
  });

  const latestBlock = await client.getBlockNumber();
  const maxLookbackBlocks = 120_000n;
  const chunkSize = 2_000n;
  const floorBlock =
    latestBlock > maxLookbackBlocks ? latestBlock - maxLookbackBlocks : 0n;

  let toBlock = latestBlock;
  let oldestScannedBlock = latestBlock;

  const seen = new Set<string>();
  const active: ActiveBorrower[] = [];

  while (toBlock >= floorBlock && active.length < 60) {
    let fromBlock =
      toBlock >= chunkSize - 1n ? toBlock - chunkSize + 1n : 0n;

    if (fromBlock < floorBlock) {
      fromBlock = floorBlock;
    }

    const logs = await client.getLogs({
      address: config.poolAddress,
      event: borrowEvent,
      fromBlock,
      toBlock,
    });

    oldestScannedBlock = fromBlock;

    for (const log of [...logs].reverse()) {
      const raw = log.args.onBehalfOf;
      if (!raw) continue;

      const wallet = getAddress(raw);
      const key = wallet.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      try {
        const snapshot = await reader.getAccountSnapshot(wallet);

        if (
          snapshot.totalDebtBase > 0 &&
          snapshot.healthFactor !== null &&
          Number.isFinite(snapshot.healthFactor)
        ) {
          active.push({
            wallet,
            healthFactor: snapshot.healthFactor,
          });
        }
      } catch {
        // Discovery is best-effort. Final validation still treats failures strictly.
      }

      if (active.length >= 60) break;
    }

    if (fromBlock === 0n || fromBlock <= floorBlock) break;
    toBlock = fromBlock - 1n;
  }

  if (active.length < 20) {
    throw new Error(
      `Auto-discovery found only ${active.length} active Aave borrowers after scanning ${seen.size} unique recent borrowers`,
    );
  }

  active.sort((a, b) => a.healthFactor - b.healthFactor);

  const wallets: string[] = [];
  for (let i = 0; i < 20; i += 1) {
    const index = Math.floor((i * (active.length - 1)) / 19);
    wallets.push(active[index]!.wallet);
  }

  return {
    wallets,
    latestBlock: latestBlock.toString(),
    oldestScannedBlock: oldestScannedBlock.toString(),
    uniqueBorrowersSeen: seen.size,
    activeBorrowersFound: active.length,
    selectionMethod:
      "Recent Aave V3 Borrow events; current active-debt wallets sampled across Health Factor quantiles",
  };
}
