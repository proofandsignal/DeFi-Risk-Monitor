# Product Boundary — v0.1

The DeFi Risk Monitor is designed as **read-only risk intelligence software**.

## In scope

- public wallet address input
- on-chain / protocol view calls
- position and account metrics
- Health Factor monitoring
- scenario simulation
- risk-state classification
- informational alerts
- APY/risk history in later v0.x releases
- downloadable diagnostics in later v0.x releases

## Explicitly out of scope

- custody of user assets
- private-key storage
- seed phrase collection
- wallet signing
- transaction broadcasting on behalf of a user
- auto-repay / auto-borrow / auto-swap
- discretionary portfolio management
- personalized instructions to buy, sell, supply, borrow, or move a specific amount

## Language rule

Prefer:

- "Health Factor is 1.18."
- "A 10% uniform collateral decline would reduce the simulated HF to X."
- "Risk state changed from WATCH to DANGER."

Avoid:

- "You should repay EUR500 now."
- "Move EUR15k into Aave."
- "This is the best investment for you."

## Security rule

The service must never ask for a private key or seed phrase.

Any future transaction-builder feature requires a separate product, security, and regulatory review before implementation.
