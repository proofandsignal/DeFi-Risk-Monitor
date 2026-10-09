# RPC Setup — DEFI RISK 20

The live validation workflow requires an Ethereum Mainnet HTTP JSON-RPC endpoint.

## Secret name

Create one GitHub repository Actions secret:

`AAVE_RPC_URL`

Store the complete HTTPS RPC endpoint as the secret value.

Do **not** commit the endpoint to:

- `.env`
- `.env.example`
- README examples
- workflow YAML
- issues or pull-request comments

The validation workflow reads it only through:

```yaml
env:
  AAVE_RPC_URL: ${{ secrets.AAVE_RPC_URL }}
```

## Recommended setup

Use a dedicated Ethereum Mainnet endpoint created specifically for this repository/environment rather than reusing a production key from another project.

A dedicated endpoint makes it easier to:

- rotate the credential
- inspect usage
- set provider-side restrictions
- revoke the project without affecting another application

## GitHub UI steps

1. Open `proofandsignal/DeFi-Risk-Monitor`.
2. Go to **Settings**.
3. Open **Secrets and variables → Actions**.
4. Choose **New repository secret**.
5. Name it exactly `AAVE_RPC_URL`.
6. Paste the HTTPS Ethereum Mainnet RPC endpoint as the value.
7. Save the secret.

The GitHub connector used to maintain this repository cannot access GitHub's secrets API, so secret creation must be performed by a repository administrator in GitHub's UI.

## Validation run

After the secret exists:

1. Open **Actions**.
2. Select **DEFI RISK 20**.
3. Choose **Run workflow**.
4. Paste exactly 20 unique public Ethereum wallet addresses.
5. Run the workflow.

The workflow:

- verifies that the secret exists
- builds the TypeScript project
- runs unit tests
- performs 20 read-only Aave V3 account queries
- writes JSON and CSV artifacts
- never signs or broadcasts a transaction

## Security

The validation script intentionally avoids printing the RPC endpoint. Error strings are sanitized for URLs and common credential query parameters before they are written to logs or artifacts.
