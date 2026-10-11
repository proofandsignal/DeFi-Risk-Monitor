import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { AaveAccountSnapshot } from "../src/domain/types.js";
import { MonitorEngine } from "../src/monitoring/engine.js";
import { deriveMonitorHealth } from "../src/monitoring/health.js";
import { JsonMonitorStore } from "../src/monitoring/store.js";
import type { AlertNotifier } from "../src/monitoring/types.js";
import { WebhookNotifier } from "../src/monitoring/webhook.js";

const wallet = "0x0000000000000000000000000000000000000001";
function account(hf: number): AaveAccountSnapshot {
  return {
    wallet,
    chainId: 1,
    poolAddress: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    totalCollateralBase: 10000,
    totalDebtBase: 5000,
    availableBorrowsBase: 1000,
    currentLiquidationThreshold: 0.8,
    ltv: 0.75,
    healthFactor: hf,
    observedAt: new Date().toISOString(),
  };
}

describe("reliability hardening", () => {
  it("retries transient RPC failures and then succeeds", async () => {
    const dir = await mkdtemp(join(tmpdir(), "risk-monitor-"));
    const reader = {
      getAccountSnapshot: vi.fn()
        .mockRejectedValueOnce(new Error("timeout"))
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValueOnce(account(2)),
    };
    const notifier: AlertNotifier = { notify: vi.fn(async () => ({ delivered: true, attempts: 1 })) };
    const engine = new MonitorEngine(reader, new JsonMonitorStore(join(dir, "state.json")), notifier, 0.1, 3, 0);
    const result = await engine.runOnce([wallet]);
    expect(result.successfulWallets).toBe(1);
    expect(reader.getAccountSnapshot).toHaveBeenCalledTimes(3);
  });

  it("recovers a corrupt state file without trusting it", async () => {
    const dir = await mkdtemp(join(tmpdir(), "risk-monitor-"));
    const path = join(dir, "state.json");
    await writeFile(path, "{broken json", "utf8");
    const store = new JsonMonitorStore(path);
    const state = await store.load();
    expect(state.wallets).toEqual({});
    expect(store.lastRecoveredCorruptPath).toContain(".corrupt-");
  });

  it("marks stale monitoring as degraded", () => {
    const lastRun = {
      startedAt: "2026-10-11T10:00:00.000Z",
      finishedAt: "2026-10-11T10:00:00.000Z",
      successfulWallets: 1,
      failedWallets: 0,
      recoveredCorruptState: false,
      wallets: [],
    };
    expect(deriveMonitorHealth({
      configured: true,
      running: false,
      lastRun,
      intervalSeconds: 300,
      nowMs: Date.parse("2026-10-11T10:20:00.000Z"),
    })).toBe("DEGRADED");
  });

  it("retries webhook 5xx and uses an idempotency key", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 })) as unknown as typeof fetch;
    const notifier = new WebhookNotifier("https://example.com/hook", fetchImpl, 3, 0);
    const result = await notifier.notify({
      id: "event-1",
      type: "STATE_WORSENED",
      severity: "warning",
      wallet,
      previousHealthFactor: 1.6,
      currentHealthFactor: 1.4,
      previousState: "SAFE",
      currentState: "WATCH",
      observedAt: new Date().toISOString(),
      message: "Risk state worsened.",
    });
    expect(result.delivered).toBe(true);
    expect(result.attempts).toBe(2);
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string,string>)["x-idempotency-key"]).toBe("event-1");
  });

  it("persists the newest valid snapshot after a successful scan", async () => {
    const dir = await mkdtemp(join(tmpdir(), "risk-monitor-"));
    const path = join(dir, "state.json");
    const reader = { getAccountSnapshot: vi.fn().mockResolvedValue(account(1.4)) };
    const notifier: AlertNotifier = { notify: vi.fn(async () => ({ delivered: true, attempts: 1 })) };
    const engine = new MonitorEngine(reader, new JsonMonitorStore(path), notifier, 0.1, 1, 0);
    await engine.runOnce([wallet]);
    const persisted = JSON.parse(await readFile(path, "utf8"));
    expect(persisted.wallets[wallet].riskState).toBe("WATCH");
  });
});
