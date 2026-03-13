-- Schema v10: Dual Payment System — Stripe Connect + x402 Protocol
-- Deploy via Supabase SQL Editor

-- ==================
-- 1. AGENT REGISTRY — Payment identity fields
-- ==================

ALTER TABLE public.agent_registry ADD COLUMN IF NOT EXISTS stripe_account_id text DEFAULT NULL;
ALTER TABLE public.agent_registry ADD COLUMN IF NOT EXISTS stripe_onboarded boolean NOT NULL DEFAULT false;
ALTER TABLE public.agent_registry ADD COLUMN IF NOT EXISTS wallet_address text DEFAULT NULL;

-- ==================
-- 2. PROJECTS — Escrow tracking
-- ==================

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text DEFAULT NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS escrow_amount_cents integer NOT NULL DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS escrow_status text NOT NULL DEFAULT 'unfunded'
  CHECK (escrow_status IN ('unfunded', 'pending', 'funded', 'partially_released', 'released', 'refunded'));

-- ==================
-- 3. TRANSACTIONS — Settlement tracking
-- ==================

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payment_rail text NOT NULL DEFAULT 'ledger'
  CHECK (payment_rail IN ('ledger', 'stripe', 'x402'));
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS stripe_transfer_id text DEFAULT NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS x402_tx_hash text DEFAULT NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS settled boolean NOT NULL DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS settled_at timestamptz DEFAULT NULL;

-- ==================
-- 4. STRIPE EVENTS — Idempotent webhook event processing
-- ==================

CREATE TABLE public.stripe_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stripe_events_event_id ON public.stripe_events(stripe_event_id);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
-- No user-facing RLS policies — admin/service role only

-- ==================
-- 5. X402 PAYMENTS — Agent-to-agent payment log
-- ==================

CREATE TABLE public.x402_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  payer_agent_id uuid NOT NULL REFERENCES public.agent_registry(id) ON DELETE CASCADE,
  payee_agent_id uuid NOT NULL REFERENCES public.agent_registry(id) ON DELETE CASCADE,
  amount_usdc numeric(12,6) NOT NULL,
  commission_usdc numeric(12,6) NOT NULL DEFAULT 0,
  network text NOT NULL DEFAULT 'base',
  tx_hash text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'settled', 'failed', 'refunded')),
  description text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz DEFAULT NULL
);

CREATE INDEX idx_x402_payments_payer ON public.x402_payments(payer_agent_id);
CREATE INDEX idx_x402_payments_payee ON public.x402_payments(payee_agent_id);
CREATE INDEX idx_x402_payments_status ON public.x402_payments(status);

ALTER TABLE public.x402_payments ENABLE ROW LEVEL SECURITY;

-- Participants can view their x402 payments
CREATE POLICY "Participants can view x402 payments" ON public.x402_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agent_registry ar
      WHERE (ar.id = payer_agent_id OR ar.id = payee_agent_id)
        AND ar.builder_id = auth.uid()
    )
  );

-- Service role handles inserts (admin client)
