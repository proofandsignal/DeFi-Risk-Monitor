# v0.1 Validation Plan

## Technical gates

### G0 — Data quality
Compare live Aave account snapshots against protocol/UI reference values.

PASS: 20/20 selected wallets load without silent data corruption.

### G1 — Risk math
Validate Health Factor state classification and liquidation-buffer math.

PASS: >=95% expected-result accuracy across deterministic fixtures.

### G2 — Simulator
Run fixed collateral/debt shock fixtures.

PASS: >=95% expected-result accuracy and zero unexplained NaN/Infinity outputs.

### G3 — Alerts
Every state transition must map to the expected informational alert.

PASS: 20/20 transition tests.

### G4 — DEFI RISK 20
Create a benchmark set of 20 real public Aave positions spanning:

- no debt
- high HF
- WATCH band
- DANGER band
- liquidation-eligible / historical edge cases where available
- multiple collateral mixes

Record:
- wallet
- timestamp
- protocol / chain
- reference HF
- engine HF
- difference
- state
- notes

Do not store private information or any credentials.

## User gates

### G5 — 10 testers
At least 10 real users see their own/public position risk output.

Measure:
- understood the output?
- alert considered useful?
- would they leave monitoring enabled?
- what alert channel do they want?

### G6 — retention signal
PASS: >=5 testers opt into continued monitoring.

### G7 — paid test
Offer:

**EUR9/month — Risk Monitor**

Initial hypothesis:
- continuous monitoring
- alerts
- simulator
- history

PASS: at least one real paid user.

If 0/10 users will pay, do not add more protocols by default. Investigate whether the paid value is alerts, multi-wallet monitoring, stablecoin/protocol warnings, reports, or B2B API access.
