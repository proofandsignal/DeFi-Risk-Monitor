import { AaveV3Reader } from "../adapters/aaveV3.js";
import type { AppConfig } from "../config.js";
import { MonitorEngine, type MonitorRunResult } from "./engine.js";
import { JsonMonitorStore } from "./store.js";
import { NoopNotifier, WebhookNotifier } from "./webhook.js";

export interface MonitorRuntime {
  configured: boolean;
  running: boolean;
  lastRun: MonitorRunResult | null;
  stop(): void;
  runNow(): Promise<MonitorRunResult | null>;
}

export function startMonitorScheduler(config: AppConfig): MonitorRuntime {
  let running = false;
  let lastRun: MonitorRunResult | null = null;
  let timer: NodeJS.Timeout | null = null;

  const configured =
    Boolean(config.aaveRpcUrl) && config.monitoredWallets.length > 0;

  if (!configured) {
    return {
      configured: false,
      running: false,
      lastRun,
      stop() {},
      async runNow() {
        return null;
      },
    };
  }

  const reader = new AaveV3Reader({
    rpcUrl: config.aaveRpcUrl!,
    poolAddress: config.aavePoolAddress,
    baseCurrencyDecimals: config.aaveBaseCurrencyDecimals,
  });
  const store = new JsonMonitorStore(config.monitorStatePath);
  const notifier = config.alertWebhookUrl
    ? new WebhookNotifier(config.alertWebhookUrl)
    : new NoopNotifier();
  const engine = new MonitorEngine(
    reader,
    store,
    notifier,
    config.alertHfDropThreshold,
  );

  const runNow = async (): Promise<MonitorRunResult | null> => {
    if (running) return lastRun;
    running = true;
    try {
      lastRun = await engine.runOnce(config.monitoredWallets);
      return lastRun;
    } finally {
      running = false;
    }
  };

  void runNow();
  timer = setInterval(() => void runNow(), config.monitorIntervalSeconds * 1000);
  timer.unref();

  return {
    configured: true,
    get running() {
      return running;
    },
    get lastRun() {
      return lastRun;
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    runNow,
  };
}
