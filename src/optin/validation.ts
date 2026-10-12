import { getAddress } from "viem";

export type AlertChannel = "email" | "telegram" | "webhook";

export interface GuardOptInInput {
  email: string;
  wallet: string;
  alertChannel: AlertChannel;
  consent: true;
  source: string | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_CHANNELS = new Set<AlertChannel>(["email", "telegram", "webhook"]);

function cleanSource(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return cleaned ? cleaned.slice(0, 40) : null;
}

export function parseGuardOptIn(body: unknown): GuardOptInInput {
  if (!body || typeof body !== "object") {
    throw new Error("invalid opt-in request");
  }

  const value = body as Record<string, unknown>;
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const walletRaw = typeof value.wallet === "string" ? value.wallet.trim() : "";
  const channel = value.alertChannel;
  const consent = value.consent;

  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new Error("enter a valid email address");
  }

  let wallet: string;
  try {
    wallet = getAddress(walletRaw);
  } catch {
    throw new Error("enter a valid Ethereum wallet address");
  }

  if (typeof channel !== "string" || !ALLOWED_CHANNELS.has(channel as AlertChannel)) {
    throw new Error("choose a valid alert channel");
  }

  if (consent !== true) {
    throw new Error("consent is required");
  }

  return {
    email,
    wallet,
    alertChannel: channel as AlertChannel,
    consent: true,
    source: cleanSource(value.source),
  };
}
