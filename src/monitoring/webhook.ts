import type {
  AlertNotifier,
  DeliveryResult,
  MonitorAlertEvent,
} from "./types.js";

export class NoopNotifier implements AlertNotifier {
  async notify(): Promise<DeliveryResult> {
    return {
      delivered: false,
      reason: "ALERT_WEBHOOK_URL is not configured",
    };
  }
}

export class WebhookNotifier implements AlertNotifier {
  constructor(
    private readonly url: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async notify(event: MonitorAlertEvent): Promise<DeliveryResult> {
    const response = await this.fetchImpl(this.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "proof-and-signal-defi-risk-monitor",
        event,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`alert webhook returned HTTP ${response.status}`);
    }

    return {
      delivered: true,
      statusCode: response.status,
    };
  }
}
