import type { MonitorRunResult } from "./engine.js";
import type { MonitorHealth } from "./types.js";

export function deriveMonitorHealth(input: {
  configured: boolean;
  running: boolean;
  lastRun: MonitorRunResult | null;
  intervalSeconds: number;
  nowMs?: number;
}): MonitorHealth {
  if (!input.configured) return "OFFLINE";
  if (!input.lastRun) return "VERIFY";
  if (input.lastRun.successfulWallets === 0) return "DEGRADED";
  if (input.lastRun.recoveredCorruptState) return "DEGRADED";

  const now = input.nowMs ?? Date.now();
  const ageMs = now - Date.parse(input.lastRun.finishedAt);
  if (!Number.isFinite(ageMs) || ageMs > input.intervalSeconds * 2.5 * 1000) {
    return "DEGRADED";
  }

  return "HEALTHY";
}
