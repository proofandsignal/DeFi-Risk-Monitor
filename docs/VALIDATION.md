# v0.1 Validation Plan

## Technical gates

### G0 — Data quality
Compare live Aave account snapshots against protocol reference values.

PASS: 20/20 selected wallets load without silent data corruption.

### G1 — Risk math
Validate Health Factor state classification and liquidation-buffer math.

PASS: >=95% expected-result accuracy across deterministic fixtures.

### G2 — Simulator
Run fixed collateral/debt shock fixtures.

PASS: >=95% expected-result accuracy and zero unexplained NaN/Infinity outputs.

### G3 — Alerts
Every state transition must map to the expected informational alert.

PASS: transition logic is covered by deterministic unit tests.

### G4 — DEFI RISK 20

Live run #2 completed on 2026-10-12 against Aave V3 Ethereum.

Result:
- 20/20 live positions loaded successfully
- 0 failed reads
- 5 DANGER, 5 WATCH, 10 SAFE
- 12/12 existing deterministic tests passed
- independent HF reference formula checked against the live artifact
- 20/20 positions matched within 0.1% relative tolerance
- maximum observed relative HF delta: approximately 0.011%
- no unexplained NaN, Infinity, or overflow behavior

Reference formula:

`reference HF = totalCollateralBase × currentLiquidationThreshold / totalDebtBase`

The adapter's Health Factor is the Aave V3 Pool `getUserAccountData` value. The reference calculation independently recomputes HF from the returned collateral, debt, and weighted liquidation threshold.

Observed edge cases:
- `NO_DEBT` maps to `healthFactor = null` and `NO_DEBT`
- `HF <= 1.0` maps to `CRITICAL`
- a live dust-debt position produced an extremely high but finite HF (~22.4M); this is economically uninformative rather than an overflow, and is retained as a regression case
- product WATCH/DANGER thresholds are heuristics; Aave liquidation logic remains authoritative

The validation harness now records reference HF, absolute/relative delta, and a reference match flag, and fails below 95% reference accuracy.

Do not store private information or credentials.

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

**EUR9/month — Founding Guard**

Initial hypothesis:
- continuous Aave position monitoring
- WATCH / DANGER / CRITICAL alerts
- liquidation-buffer scenarios
- risk history

PASS: at least one real paid user.

If 0/10 users will pay, do not add more protocols by default. Investigate whether paid value is alerts, multi-wallet monitoring, stablecoin/protocol warnings, reports, or B2B API access.
