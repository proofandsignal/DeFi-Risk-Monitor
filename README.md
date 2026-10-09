# DeFi Risk Monitor

Read-only DeFi position risk intelligence.

## v0.1 scope

The first release is intentionally narrow:

- Aave V3 account snapshot from a public RPC endpoint
- Health Factor classification
- approximate liquidation-distance indicator
- deterministic collateral/debt shock simulator
- informational risk alerts
- validation gates for **DEFI RISK 20**

The product is **read-only and non-custodial**. It does not request private keys, hold funds, sign transactions, execute orders, auto-repay debt, or tell a user what asset to buy or sell.

## Architecture

```text
Public wallet address
        |
        v
Aave V3 Pool.getUserAccountData()
        |
        v
Risk Engine
  - Health Factor
  - risk state
  - uniform-collateral liquidation buffer
        |
        +--> Alert Engine
        |
        +--> Scenario Simulator
```

The live Aave adapter uses only the Pool view method `getUserAccountData(address)`.

## Risk states

The labels below are **product heuristics**, not Aave protocol rules:

| State | Health Factor |
| --- | --- |
| NO_DEBT | no active debt |
| SAFE | >= 1.50 |
| WATCH | 1.20 - 1.49 |
| DANGER | 1.00 - 1.19 |
| CRITICAL | <= 1.00 |

Aave liquidation eligibility is determined by the protocol's own Health Factor logic. The only hard protocol boundary represented here is HF <= 1.

## Run locally

Requires Node.js 22+.

```bash
npm install
cp .env.example .env
# set AAVE_RPC_URL in your shell or env loader
npm run build
AAVE_RPC_URL=https://... npm start
```

Health check:

```bash
curl http://localhost:3000/health
```

Live account snapshot:

```bash
curl http://localhost:3000/api/v1/aave/account/0xYOUR_WALLET
```

Scenario simulation:

```bash
curl -X POST http://localhost:3000/api/v1/simulate \
  -H "content-type: application/json" \
  -d '{
    "collaterals":[
      {"symbol":"WETH","valueUsd":15000,"liquidationThreshold":0.825},
      {"symbol":"USDC","valueUsd":5000,"liquidationThreshold":0.80}
    ],
    "debts":[{"symbol":"USDC","valueUsd":10000}],
    "shocksPct":{"WETH":-15}
  }'
```

## API

### `GET /health`
Service health.

### `GET /api/v1/aave/account/:wallet`
Reads Aave V3 aggregate account data and returns the product risk state. Requires `AAVE_RPC_URL`.

### `POST /api/v1/simulate`
Runs a deterministic portfolio shock scenario from supplied collateral/debt values.

### `POST /api/v1/alerts/evaluate`
Evaluates informational alerts for a supplied Health Factor.

## Configuration

See `.env.example`.

The default Pool address is the Ethereum mainnet Aave V3 Pool. The RPC endpoint is never hard-coded.

## Validation before monetization

Technical gate:

`Data Quality -> Risk Math -> Simulator -> Alerts -> DEFI RISK 20`

Commercial gate:

`10 testers -> >=5 monitored users -> first EUR9 paid test`

See `docs/VALIDATION.md`.

## Product boundary

See `docs/PRODUCT_BOUNDARY.md`.

## Status

`v0.1 — BUILD`
