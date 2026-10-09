import { describe, expect, it, vi } from "vitest";
import { WebhookNotifier } from "../src/monitoring/webhook.js";

describe("webhook notifier", () => {
  it("delivers a structured monitoring event", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 204 })) as unknown as typeof fetch;
    const notifier = new WebhookNotifier("https://example.com/hook", fetchImpl);

    const result = await notifier.notify({
      type: "STATE_WORSENED",
      severity: "warning",
      wallet: "0x0000000000000000000000000000000000000001",
      previousHealthFactor: 1.6,
      currentHealthFactor: 1.4,
      previousState: "SAFE",
      currentState: "WATCH",
      observedAt: "2026-10-09T00:00:00.000Z",
      message: "Risk state worsened from SAFE to WATCH.",
    });

    expect(result.delivered).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
