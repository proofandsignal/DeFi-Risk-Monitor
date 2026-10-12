import pg from "pg";
import type { GuardOptInInput } from "./validation.js";

const { Pool } = pg;

export interface GuardOptInStore {
  save(input: GuardOptInInput): Promise<void>;
  close(): Promise<void>;
}

export async function createGuardOptInStore(
  databaseUrl: string,
): Promise<GuardOptInStore> {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS founding_guard_optins (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      wallet TEXT NOT NULL,
      alert_channel TEXT NOT NULL,
      source TEXT,
      consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT founding_guard_alert_channel_check
        CHECK (alert_channel IN ('email', 'telegram', 'webhook')),
      CONSTRAINT founding_guard_email_wallet_unique
        UNIQUE (email, wallet)
    )
  `);

  return {
    async save(input) {
      await pool.query(
        `
          INSERT INTO founding_guard_optins
            (email, wallet, alert_channel, source)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (email, wallet)
          DO UPDATE SET
            alert_channel = EXCLUDED.alert_channel,
            source = COALESCE(EXCLUDED.source, founding_guard_optins.source),
            consented_at = NOW()
        `,
        [input.email, input.wallet, input.alertChannel, input.source],
      );
    },
    async close() {
      await pool.end();
    },
  };
}
