import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";
import type { AaveAccountSnapshot } from "../domain/types.js";

const poolAbi = parseAbi([
  "function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
]);

export interface AaveV3ReaderConfig {
  rpcUrl: string;
  poolAddress: Address;
  baseCurrencyDecimals: number;
}

export class AaveV3Reader {
  private readonly client;
  private readonly config: AaveV3ReaderConfig;

  constructor(config: AaveV3ReaderConfig) {
    this.config = config;
    this.client = createPublicClient({
      chain: mainnet,
      transport: http(config.rpcUrl),
    });
  }

  async getAccountSnapshot(walletInput: string): Promise<AaveAccountSnapshot> {
    const wallet = getAddress(walletInput);

    const result = await this.client.readContract({
      address: this.config.poolAddress,
      abi: poolAbi,
      functionName: "getUserAccountData",
      args: [wallet],
    });

    const [
      totalCollateralBase,
      totalDebtBase,
      availableBorrowsBase,
      currentLiquidationThreshold,
      ltv,
      rawHealthFactor,
    ] = result;

    const hasDebt = totalDebtBase > 0n;

    return {
      wallet,
      chainId: mainnet.id,
      poolAddress: this.config.poolAddress,
      totalCollateralBase: Number(
        formatUnits(totalCollateralBase, this.config.baseCurrencyDecimals),
      ),
      totalDebtBase: Number(
        formatUnits(totalDebtBase, this.config.baseCurrencyDecimals),
      ),
      availableBorrowsBase: Number(
        formatUnits(availableBorrowsBase, this.config.baseCurrencyDecimals),
      ),
      currentLiquidationThreshold: Number(currentLiquidationThreshold) / 10_000,
      ltv: Number(ltv) / 10_000,
      healthFactor: hasDebt ? Number(formatUnits(rawHealthFactor, 18)) : null,
      observedAt: new Date().toISOString(),
    };
  }
}
