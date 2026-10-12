import { describe, expect, it } from "vitest";
import { parseGuardOptIn } from "../src/optin/validation.js";

describe("Founding Guard opt-in validation", () => {
  it("accepts a minimal valid opt-in", () => {
    const parsed = parseGuardOptIn({
      email: "Test@Example.com",
      wallet: "0x3c0B05027DDEb16Cfa158F3f29802e31df14fffd",
      alertChannel: "email",
      consent: true,
      source: "X-post_1",
    });

    expect(parsed.email).toBe("test@example.com");
    expect(parsed.wallet).toBe("0x3c0B05027DDEb16Cfa158F3f29802e31df14fffd");
    expect(parsed.alertChannel).toBe("email");
    expect(parsed.source).toBe("x-post_1");
  });

  it("rejects invalid email, wallet, channel or missing consent", () => {
    expect(() =>
      parseGuardOptIn({
        email: "not-an-email",
        wallet: "0x123",
        alertChannel: "sms",
        consent: false,
      }),
    ).toThrow();
  });

  it("sanitizes attribution source", () => {
    const parsed = parseGuardOptIn({
      email: "user@example.com",
      wallet: "0x3c0B05027DDEb16Cfa158F3f29802e31df14fffd",
      alertChannel: "telegram",
      consent: true,
      source: " Farcaster / launch! ",
    });

    expect(parsed.source).toBe("farcasterlaunch");
  });
});
