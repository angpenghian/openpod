-- =============================================
-- OpenPod — Schema V6 Migration
-- Adds: payment tracking, ticket approval, transactions
-- Run AFTER schema-v5.sql
-- =============================================

-- ==================
-- 1. POSITION PAYMENT TRACKING
-- ==================

ALTER TABLE public.positions ADD COLUMN payment_status text NOT NULL DEFAULT 'unfunded'
  CHECK (payment_status IN ('unfunded', 'funded', 'in_progress', 'completed'));
ALTER TABLE public.positions ADD COLUMN amount_earned_cents integer NOT NULL DEFAULT 0;

-- ==================
-- 2. TICKET APPROVAL FIELDS
-- ==================

ALTER TABLE public.tickets ADD COLUMN approval_status text DEFAULT NULL
  CHECK (approval_status IN ('pending_review', 'approved', 'rejected', 'revision_requested'));
ALTER TABLE public.tickets ADD COLUMN payout_cents integer DEFAULT NULL;
ALTER TABLE public.tickets ADD COLUMN approved_at timestamptz DEFAULT NULL;
ALTER TABLE public.tickets ADD COLUMN approved_by uuid REFERENCES public.profiles(id) DEFAULT NULL;

-- ==================
-- 3. TRANSACTIONS TABLE
-- ==================

CREATE TABLE public.transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  agent_registry_id uuid REFERENCES public.agent_registry(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL,
  commission_cents integer NOT NULL DEFAULT 0,
  type text NOT NULL CHECK (type IN ('deliverable_approved', 'position_completed', 'refund', 'commission')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==================
-- 4. INDEXES
-- ==================

CREATE INDEX idx_transactions_project ON public.transactions(project_id);
CREATE INDEX idx_transactions_position ON public.transactions(position_id) WHERE position_id IS NOT NULL;
CREATE INDEX idx_transactions_ticket ON public.transactions(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_tickets_approval ON public.tickets(project_id, approval_status) WHERE approval_status IS NOT NULL;
CREATE INDEX idx_positions_payment ON public.positions(project_id, payment_status);

-- ==================
-- 5. RLS POLICIES
-- ==================

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners can view transactions" ON public.transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
  );

CREATE POLICY "Project owners can create transactions" ON public.transactions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
  );

-- ==================
-- 6. AUTO-UPDATE POSITION EARNINGS ON TRANSACTION INSERT
-- ==================

CREATE OR REPLACE FUNCTION public.update_position_earnings()
RETURNS trigger AS $$
BEGIN
  IF NEW.type = 'deliverable_approved' AND NEW.position_id IS NOT NULL THEN
    UPDATE public.positions SET
      amount_earned_cents = amount_earned_cents + NEW.amount_cents + NEW.commission_cents,
      payment_status = CASE
        WHEN amount_earned_cents + NEW.amount_cents + NEW.commission_cents >= COALESCE(pay_rate_cents, 0) THEN 'completed'
        ELSE 'in_progress'
      END
    WHERE id = NEW.position_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_transaction_created
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_position_earnings();
