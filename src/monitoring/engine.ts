import type { AaveAccountSnapshot } from "../domain/types.js";
import { classifyHealthFactor } from "../domain/risk.js";
import { evaluateMonitorEvent } from "./events.js";
import { JsonMonitorStore } from "./store.js";
import type {
  AlertNotifier,
  MonitorAlertEvent,
  MonitorSnapshot,
  MonitorStateFile,
} from "./types.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown error";
  return message
    .replace(/https?:\/\/[^\s"']+/gi, "[redacted-url]")
    .replace(/([?&](?:key|token|apikey|api_key)=)[^&\s]+/gi, "$1[redacted]");
}

export interface AccountSnapshotReader {
  getAccountSnapshot(wallet: string): Promise<AaveAccountSnapshot>;
}

export interface MonitorWalletResult {
  wallet: string;
  ok: boolean;
  eventType?: string;
  delivered?: boolean;
  deliveryAttempts?: number;
  error?: string;
}

export interface MonitorRunResult {
  startedAt: string;
  finishedAt: string;
  successfulWallets: number;
  failedWallets: number;
  recoveredCorruptState: boolean;
  pendingAlerts: number;
  systemError?: string;
  wallets: MonitorWalletResult[];
}

export class MonitorEngine {
  constructor(
    private readonly reader: AccountSnapshotReader,
    private readonly store: JsonMonitorStore,
    private readonly notifier: AlertNotifier,
    private readonly hfDropThreshold: number,
    private readonly rpcRetryAttempts = 3,
    private readonly rpcRetryDelayMs = 250,
  ) {}

  private async readWithRetry(wallet: string): Promise<AaveAccountSnapshot> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.rpcRetryAttempts; attempt += 1) {
      try {
        return await this.reader.getAccountSnapshot(wallet);
      } catch (error) {
        lastError = error;
        if (attempt < this.rpcRetryAttempts && this.rpcRetryDelayMs > 0) {
          await sleep(this.rpcRetryDelayMs * attempt);
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error("RPC read failed");
  }

  private async deliverPending(state: MonitorStateFile): Promise<void> {
    for (const [eventId, event] of Object.entries(state.pendingAlerts)) {
      const delivery = await this.notifier.notify(event);
      if (delivery.delivered) {
        delete state.pendingAlerts[eventId];
        await this.store.save(state);
      }
    }
  }

  private async persistEventBeforeDelivery(
    state: MonitorStateFile,
    current: MonitorSnapshot,
    event: MonitorAlertEvent,
  ): Promise<{ delivered: boolean; attempts: number }> {
    state.wallets[current.wallet] = current;
    state.pendingAlerts[event.id] = event;
    await this.store.save(state);

    const delivery = await this.notifier.notify(event);
    if (delivery.delivered) {
      delete state.pendingAlerts[event.id];
      await this.store.save(state);
    }

    return {
      delivered: delivery.delivered,
      attempts: delivery.attempts,
    };
  }

  async runOnce(wallets: readonly string[]): Promise<MonitorRunResult> {
    const startedAt = new Date().toISOString();
    const state = await this.store.load();
    const recoveredCorruptState = this.store.lastRecoveredCorruptPath !== null;
    const results: MonitorWalletResult[] = [];

    await this.deliverPending(state);

    for (const wallet of wallets) {
      try {
        const account = await this.readWithRetry(wallet);
        const current: MonitorSnapshot = {
          wallet: account.wallet,
          healthFactor: account.healthFactor,
          riskState: classifyHealthFactor(account.healthFactor),
          totalCollateralBase: account.totalCollateralBase,
          totalDebtBase: account.totalDebtBase,
          observedAt: account.observedAt,
        };

        const previous = state.wallets[current.wallet] ?? null;
        const event = evaluateMonitorEvent(previous, current, this.hfDropThreshold);

        let delivered: boolean | undefined;
        let deliveryAttempts: number | undefined;

        if (event) {
          const delivery = await this.persistEventBeforeDelivery(state, current, event);
          delivered = delivery.delivered;
          deliveryAttempts = delivery.attempts;
        } else {
          state.wallets[current.wallet] = current;
        }

        results.push({
          wallet: current.wallet,
          ok: true,
          eventType: event?.type,
          delivered,
          deliveryAttempts,
        });
      } catch (error) {
        results.push({
          wallet,
          ok: false,
          error: safeErrorMessage(error),
        });
      }
    }

    await this.store.save(state);
    const successfulWallets = results.filter((item) => item.ok).length;

    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      successfulWallets,
      failedWallets: results.length - successfulWallets,
      recoveredCorruptState,
      pendingAlerts: Object.keys(state.pendingAlerts).length,
      wallets: results,
    };
  }
}
