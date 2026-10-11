import type { AlertNotifier, DeliveryResult, MonitorAlertEvent } from "./types.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class NoopNotifier implements AlertNotifier {
  async notify(): Promise<DeliveryResult> {
    return { delivered: false, attempts: 0, reason: "ALERT_WEBHOOK_URL is not configured" };
  }
}

export class WebhookNotifier implements AlertNotifier {
  constructor(
    private readonly url: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly maxAttempts = 3,
    private readonly retryDelayMs = 250,
  ) {}

  async notify(event: MonitorAlertEvent): Promise<DeliveryResult> {
    let lastStatus: number | undefined;
    let lastReason: string | undefined;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const response = await this.fetchImpl(this.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-idempotency-key": event.id,
          },
          body: JSON.stringify({ source: "proof-and-signal-defi-risk-monitor", event }),
          signal: AbortSignal.timeout(10_000),
        });
        lastStatus = response.status;

        if (response.ok) {
          return { delivered: true, attempts: attempt, statusCode: response.status };
        }

        if (response.status !== 429 && response.status < 500) {
          return {
            delivered: false,
            attempts: attempt,
            statusCode: response.status,
            reason: `non-retryable HTTP ${response.status}`,
          };
        }

        lastReason = `retryable HTTP ${response.status}`;
      } catch (error) {
        lastReason = error instanceof Error ? error.message : "webhook delivery failed";
      }

      if (attempt < this.maxAttempts && this.retryDelayMs > 0) {
        await sleep(this.retryDelayMs * attempt);
      }
    }

    return {
      delivered: false,
      attempts: this.maxAttempts,
      statusCode: lastStatus,
      reason: lastReason,
    };
  }
}
