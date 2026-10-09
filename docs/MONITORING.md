# Monitoring & Alert Delivery v0.2

## Goal

Turn the read-only Aave risk engine into an ongoing service rather than a one-off scanner.

## State model

The monitor persists the latest successful snapshot per public wallet:

- wallet
- Health Factor
- risk state
- total collateral base value
- total debt base value
- observation timestamp

No private keys, signatures, RPC URLs, webhook URLs, emails, phone numbers or other credentials are written to the state file.

## Event rules

Priority order per scan:

1. initial risky state,
2. worsening risk band,
3. material absolute Health Factor drop,
4. recovery from a risky band,
5. otherwise no event.

At most one monitoring event is emitted for a wallet in a single scan.

## Delivery

v0.2 uses an environment-configured generic HTTP(S) webhook. This keeps the core independent from Telegram, Discord, Slack, email or SMS providers.

The webhook payload contains:

- source
- event type
- severity
- wallet
- previous/current Health Factor
- previous/current risk state
- timestamp
- human-readable message

## Failure behavior

- One wallet RPC failure does not stop the rest of a monitoring run.
- A failed alert delivery marks that wallet run as failed and does not silently report delivery success.
- State writes use a temporary file followed by rename.
- Monitor intervals below 60 seconds are rejected.
- Healthy unchanged positions are not repeatedly alerted.

## Next product gate

After live validation, the next monetization test is intentionally narrow:

**EUR9/month founding beta**

Offer:
- one monitored Aave wallet,
- Health Factor change alerts,
- risk-band alerts,
- basic history.

Do not add another lending protocol before the first customer feedback unless validation proves Aave coverage itself is the blocker.
