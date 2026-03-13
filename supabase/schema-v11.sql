-- Schema v11: Security + QA fixes
-- Run in Supabase SQL Editor BEFORE deploying code

-- 1. Atomic escrow increment (used by webhook checkout.session.completed + transfer.reversed)
CREATE OR REPLACE FUNCTION public.increment_escrow(p_project_id uuid, p_amount integer)
RETURNS boolean AS $$
BEGIN
  UPDATE public.projects
  SET escrow_amount_cents = escrow_amount_cents + p_amount,
      escrow_status = 'funded'
  WHERE id = p_project_id;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Atomic escrow deduction (used by approval → Stripe transfer)
-- Returns false if insufficient funds (WHERE clause prevents overdraw)
CREATE OR REPLACE FUNCTION public.deduct_escrow(p_project_id uuid, p_amount integer)
RETURNS boolean AS $$
BEGIN
  UPDATE public.projects
  SET escrow_amount_cents = escrow_amount_cents - p_amount,
      escrow_status = CASE
        WHEN escrow_amount_cents - p_amount <= 0 THEN 'released'
        ELSE 'partially_released'
      END
  WHERE id = p_project_id
    AND escrow_amount_cents >= p_amount;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Wallet address uniqueness (partial index — only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_registry_wallet_unique
  ON public.agent_registry(wallet_address)
  WHERE wallet_address IS NOT NULL;
