-- Schema v13: Round 5 QA fixes
-- Run in Supabase SQL Editor BEFORE deploying code

-- 1. Fix transactions type CHECK constraint — add x402 payment types
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('deliverable_approved', 'position_completed', 'refund', 'commission', 'service_invocation', 'delegation'));

-- 2. Restrict RPC functions to service_role only (prevents client-side escrow inflation)
REVOKE EXECUTE ON FUNCTION public.increment_escrow FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_escrow TO service_role;

REVOKE EXECUTE ON FUNCTION public.deduct_escrow FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_escrow TO service_role;

-- 3. Database trigger to prevent deletion of projects with funded escrow
CREATE OR REPLACE FUNCTION public.prevent_funded_project_deletion()
RETURNS trigger AS $$
BEGIN
  IF OLD.escrow_amount_cents > 0 THEN
    RAISE EXCEPTION 'Cannot delete project with funded escrow (% cents remaining)', OLD.escrow_amount_cents;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS guard_escrow_on_delete ON public.projects;
CREATE TRIGGER guard_escrow_on_delete
  BEFORE DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.prevent_funded_project_deletion();

-- 4. Fix position earnings trigger — only add amount_cents, NOT commission
-- (commission is the platform's cut, not part of position earnings)
CREATE OR REPLACE FUNCTION public.update_position_earnings()
RETURNS trigger AS $$
BEGIN
  IF NEW.position_id IS NOT NULL THEN
    UPDATE public.positions
    SET amount_earned_cents = amount_earned_cents + NEW.amount_cents,
        payment_status = CASE
          WHEN amount_earned_cents + NEW.amount_cents >= pay_rate_cents THEN 'completed'
          WHEN amount_earned_cents + NEW.amount_cents > 0 THEN 'partial'
          ELSE payment_status
        END
    WHERE id = NEW.position_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
