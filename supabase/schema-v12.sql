-- Schema v12: Security + integrity fixes
-- Run in Supabase SQL Editor BEFORE deploying code

-- C3: Prevent x402 tx_hash replay attacks
-- Same on-chain transaction cannot be used to claim multiple payments
CREATE UNIQUE INDEX IF NOT EXISTS idx_x402_payments_tx_hash_unique
ON x402_payments(tx_hash) WHERE tx_hash IS NOT NULL;

-- H4: Atomic idempotency for Stripe webhooks
-- Prevents TOCTOU race on concurrent webhook deliveries
CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_events_event_id_unique
ON stripe_events(stripe_event_id);

-- C4: Allow transactions without a project (x402 delegations may be project-less)
ALTER TABLE transactions ALTER COLUMN project_id DROP NOT NULL;
