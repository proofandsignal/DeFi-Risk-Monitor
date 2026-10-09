import type { AaveAccountSnapshot } from "../domain/types.js";
import { classifyHealthFactor } from "../domain/risk.js";
import { evaluateMonitorEvent } from "./events.js";
import type { AlertNotifier, MonitorSnapshot } from "./types.js";
import { JsonMonitorStore } from "./store.js";

export interface AccountSnapshotReader {
  getAccountSnapshot(wallet: string): Promise<AaveAccountSnapshot>;
}

export interface MonitorWalletResult {
  wallet: string;
  ok: boolean;
  eventType?: string;
  delivered?: boolean;
  error?: string;
}

export interface MonitorRunResult {
  startedAt: string;
  finishedAt: string;
  wallets: MonitorWalletResult[];
}

export class MonitorEngine {
  constructor(
    private readonly reader: AccountSnapshotReader,
    private readonly store: JsonMonitorStore,
    private readonly notifier: AlertNotifier,
    private readonly hfDropThreshold: number,
  ) {}

  async runOnce(wallets: readonly string[]): Promise<MonitorRunResult> {
    const startedAt = new Date().toISOString();
    const state = await this.store.load();
    const results: MonitorWalletResult[] = [];

    for (const wallet of wallets) {
      try {
        const account = await this.reader.getAccountSnapshot(wallet);
        const current: MonitorSnapshot = {
          wallet: account.wallet,
          healthFactor: account.healthFactor,
          riskState: classifyHealthFactor(account.healthFactor),
          totalCollateralBase: account.totalCollateralBase,
          totalDebtBase: account.totalDebtBase,
          observedAt: account.observedAt,
        };

        const previous = state.wallets[current.wallet] ?? null;
        const event = evaluateMonitorEvent(
          previous,
          current,
          this.hfDropThreshold,
        );

        let delivered: boolean | undefined;
        if (event) {
          const delivery = await this.notifier.notify(event);
          delivered = delivery.delivered;
        }

        state.wallets[current.wallet] = current;
        results.push({
          wallet: current.wallet,
          ok: true,
          eventType: event?.type,
          delivered,
        });
      } catch (error) {
        results.push({
          wallet,
          ok: false,
          error: error instanceof Error ? error.message : "unknown error",
        });
      }
    }

    await this.store.save(state);

    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      wallets: results,
    };
  }
}
