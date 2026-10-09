import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { AaveAccountSnapshot } from "../src/domain/types.js";
import { MonitorEngine } from "../src/monitoring/engine.js";
import { JsonMonitorStore } from "../src/monitoring/store.js";
import type { AlertNotifier } from "../src/monitoring/types.js";

const wallet = "0x0000000000000000000000000000000000000001";

function account(healthFactor: number): AaveAccountSnapshot {
  return {
    wallet,
    chainId: 1,
    poolAddress: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    totalCollateralBase: 10_000,
    totalDebtBase: 5_000,
    availableBorrowsBase: 1_000,
    currentLiquidationThreshold: 0.8,
    ltv: 0.75,
    healthFactor,
    observedAt: new Date().toISOString(),
  };
}

describe("monitor engine", () => {
  it("persists snapshots and delivers a worsening-state alert", async () => {
    const dir = await mkdtemp(join(tmpdir(), "risk-monitor-"));
    const path = join(dir, "state.json");
    const reader = {
      getAccountSnapshot: vi
        .fn()
        .mockResolvedValueOnce(account(1.6))
        .mockResolvedValueOnce(account(1.4)),
    };
    const notifier: AlertNotifier = {
      notify: vi.fn(async () => ({ delivered: true, statusCode: 200 })),
    };
    const engine = new MonitorEngine(
      reader,
      new JsonMonitorStore(path),
      notifier,
      0.1,
    );

    const first = await engine.runOnce([wallet]);
    expect(first.wallets[0]?.eventType).toBeUndefined();

    const second = await engine.runOnce([wallet]);
    expect(second.wallets[0]?.eventType).toBe("STATE_WORSENED");
    expect(second.wallets[0]?.delivered).toBe(true);
    expect(notifier.notify).toHaveBeenCalledOnce();

    const persisted = JSON.parse(await readFile(path, "utf8"));
    expect(persisted.wallets[wallet].riskState).toBe("WATCH");
  });

  it("isolates one wallet failure from the rest of a run", async () => {
    const dir = await mkdtemp(join(tmpdir(), "risk-monitor-"));
    const reader = {
      getAccountSnapshot: vi
        .fn()
        .mockRejectedValueOnce(new Error("rpc unavailable"))
        .mockResolvedValueOnce(account(2.0)),
    };
    const notifier: AlertNotifier = {
      notify: vi.fn(async () => ({ delivered: true })),
    };
    const engine = new MonitorEngine(
      reader,
      new JsonMonitorStore(join(dir, "state.json")),
      notifier,
      0.1,
    );

    const result = await engine.runOnce([
      "0x0000000000000000000000000000000000000002",
      wallet,
    ]);

    expect(result.wallets[0]?.ok).toBe(false);
    expect(result.wallets[1]?.ok).toBe(true);
  });
});
