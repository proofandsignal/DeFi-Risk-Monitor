# DeFi Risk Monitor

Read-only DeFi position risk intelligence by **Proof & Signal**.

## BUILD-001 — Aave Position Risk Core

The first build is intentionally narrow:

- Aave V3 aggregate account snapshot from a public Ethereum RPC endpoint
- live supplied and borrowed positions from Aave's public GraphQL API
- Health Factor classification
- approximate liquidation-distance indicator
- deterministic collateral/debt shock simulator
- informational risk alerts
- evidence/provenance in the account response
- validation gates for **DEFI RISK 20**

The product is **read-only and non-custodial**. It does not request private keys, hold funds, sign transactions, execute orders, auto-repay debt, or tell a user what asset to buy or sell.

## Architecture

```text
Public wallet address
        |
        +----> Aave V3 Pool.getUserAccountData() ----+
        |                                           |
        +----> Aave GraphQL userSupplies/borrows ---+
                                                    |
                                                    v
                                               Risk Engine
                                         - Health Factor
                                         - risk state
                                         - liquidation buffer
                                                    |
                         +--------------------------+------------------+
                         |                                             |
                         v                                             v
                    Alert Engine                               Scenario Simulator
                         |
                         v
                 JSON risk response
```

The live account endpoint combines protocol-level on-chain account data with asset-level position discovery. The RPC endpoint is configurable and no wallet signing capability exists in this repository.

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
npm run build
AAVE_RPC_URL=https://... npm start
```

Health check:

```bash
curl http://localhost:3000/health
```

Live account + positions + risk:

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
Returns:

- aggregate Aave V3 account snapshot from `Pool.getUserAccountData`
- live supply positions
- live borrow positions
- Health Factor risk state
- liquidation-distance estimate
- alerts
- on-chain/API evidence metadata

Requires `AAVE_RPC_URL`.

### `POST /api/v1/simulate`
Runs a deterministic portfolio shock scenario from supplied collateral/debt values.

### `POST /api/v1/alerts/evaluate`
Evaluates informational alerts for a supplied Health Factor.

## Validation before monetization

Technical gate:

`Data Quality -> Risk Math -> Simulator -> Alerts -> DEFI RISK 20`

Commercial gate:

`10 testers -> >=5 monitored users -> first EUR9 paid test`

See `docs/VALIDATION.md`.

## Product boundary

See `docs/PRODUCT_BOUNDARY.md`.

## BUILD-001 definition of done

1. Build and unit tests pass in CI.
2. A live known Aave wallet returns both aggregate account data and asset-level positions.
3. Health Factor is cross-checked against an independent Aave view.
4. `DEFI-RISK-TEST-001` is saved as validation evidence.
5. No private keys, signing, custody, or transaction execution exist anywhere in the product.

## Status

`v0.1 — BUILD / CI + live validation pending`
