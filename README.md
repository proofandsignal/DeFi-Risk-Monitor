# DeFi Risk Monitor

Read-only DeFi position risk intelligence by **Proof & Signal**.

## v0.2 — Monitoring & Alert Delivery

The product now has two layers:

```text
Public Aave wallet
       |
       v
Aave V3 account snapshot
       |
       v
Health Factor + risk state
       |
       v
Persistent monitor state
       |
       +--> risk-state worsening
       +--> material HF drop
       +--> recovery
       |
       v
Generic webhook delivery
```

v0.2 is designed for the first paid monitoring test: keep watching a public Aave position and deliver a useful alert when risk materially changes.

### Alert rules

A monitoring event is emitted when:

- a wallet first appears in WATCH / DANGER / CRITICAL,
- the risk state worsens,
- Health Factor drops by at least `ALERT_HF_DROP_THRESHOLD` while remaining in the same risk state,
- a previously risky position recovers to SAFE / NO_DEBT.

Healthy unchanged positions do not generate repeated alerts.

## Product boundary

The product is **read-only and non-custodial**. It does not request private keys, hold funds, sign transactions, execute orders, auto-repay debt, or tell a user what asset to buy or sell.

## Risk states

The labels below are **product heuristics**, not Aave protocol rules:

| State | Health Factor |
| --- | --- |
| NO_DEBT | no active debt |
| SAFE | >= 1.50 |
| WATCH | 1.20 - 1.49 |
| DANGER | 1.00 - 1.19 |
| CRITICAL | <= 1.00 |

Aave liquidation eligibility is determined by the protocol's own Health Factor logic. The hard protocol boundary represented here is HF <= 1.

## Run locally

Requires Node.js 22+.

```bash
npm install
cp .env.example .env
npm run check
npm start
```

Configure monitoring:

```bash
AAVE_RPC_URL=https://...
MONITORED_WALLETS=0xWallet1,0xWallet2
MONITOR_INTERVAL_SECONDS=300
ALERT_HF_DROP_THRESHOLD=0.1
ALERT_WEBHOOK_URL=https://your-alert-receiver.example/webhook
```

The scheduler performs an immediate scan at startup and then repeats at the configured interval. State is persisted atomically to `data/monitor-state.json` by default.

## API

### `GET /health`
Service health plus monitor configuration/status.

### `GET /api/v1/monitor/status`
Returns last monitoring run, wallet count, interval and delivery configuration without exposing the webhook URL or RPC URL.

### `GET /api/v1/aave/account/:wallet`
Reads Aave V3 aggregate account data and returns the current risk state.

### `POST /api/v1/simulate`
Runs a deterministic portfolio shock scenario.

### `POST /api/v1/alerts/evaluate`
Evaluates the informational alert for a supplied Health Factor.

## Persistence and privacy

Only public wallet addresses and derived Aave account-risk snapshots are persisted by the monitor. RPC credentials and webhook URLs are configuration secrets and are never written to the monitor state file.

## Validation before monetization

Technical gate:

`Data Quality -> Risk Math -> Monitoring persistence -> Threshold transitions -> Webhook delivery -> DEFI RISK 20`

Commercial gate:

`10 testers -> >=5 keep monitoring enabled -> first EUR9/month paid test`

v0.2 is not considered PASS until a real deployed instance successfully:

1. reads a monitored public Aave wallet repeatedly,
2. persists consecutive snapshots,
3. detects a controlled threshold/state transition,
4. delivers a webhook alert,
5. survives restart without forgetting the previous state.

See `docs/VALIDATION.md`.

## Status

`v0.2 — BUILD / CI + live delivery validation pending`
