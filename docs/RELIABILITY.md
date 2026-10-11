# BUILD-002.1 — Reliability & Failure Hardening

This build makes monitoring failures explicit instead of silently treating stale or partial data as safe.

## Monitor health

Position risk and monitor health are separate:

- Position risk: NO_DEBT / SAFE / WATCH / DANGER / CRITICAL
- Monitor health: HEALTHY / DEGRADED / OFFLINE / VERIFY

A SAFE position with a DEGRADED monitor must not be presented as continuously protected.

## Failure behavior

| Failure | Required behavior |
| --- | --- |
| transient RPC error | retry before marking scan failed |
| all RPC attempts fail | preserve previous valid snapshot and mark run failure |
| one wallet fails | continue remaining wallets |
| invalid/corrupt state file | quarantine it and rebuild state; monitor becomes DEGRADED |
| stale last successful scan | monitor becomes DEGRADED |
| webhook 5xx / 429 / network error | retry |
| webhook permanent 4xx | stop retrying and report delivery failure |
| duplicate delivery retry | reuse deterministic idempotency key |
| unchanged healthy state | no alert |
| worsening risk state | exactly one transition event |
| material HF drop | alert even within same band |
| recovery | informational recovery event |

## Beta gate

No paid beta until:

1. CI is green.
2. RPC retry behavior is verified.
3. corrupt-state recovery is verified.
4. stale-monitor status is verified.
5. webhook retries and idempotency are verified.
6. a live deployed monitor survives restart.
7. a controlled risk transition produces exactly one delivered alert.
