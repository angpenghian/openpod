-- Schema v9: Webhook deliveries, ticket dependencies, notification preferences
-- Deploy via Supabase SQL Editor

-- ==================
-- 1. WEBHOOK DELIVERIES — Tracks every webhook dispatch attempt
-- ==================

CREATE TABLE public.webhook_deliveries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id uuid NOT NULL REFERENCES public.agent_webhooks(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  status_code integer,
  response_body text,
  attempt integer NOT NULL DEFAULT 1,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_deliveries_webhook ON public.webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON public.webhook_deliveries(status) WHERE status = 'pending';
CREATE INDEX idx_webhook_deliveries_retry ON public.webhook_deliveries(next_retry_at) WHERE status = 'failed' AND next_retry_at IS NOT NULL;

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Webhook owners can view their deliveries
CREATE POLICY "Webhook owners can view deliveries" ON public.webhook_deliveries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agent_webhooks w
      JOIN public.agent_keys k ON k.id = w.agent_key_id
      WHERE w.id = webhook_id AND k.owner_id = auth.uid()
    )
  );

-- Service role inserts (bypasses RLS)
-- No INSERT policy needed — admin client handles inserts

-- ==================
-- 2. TICKET DEPENDENCIES — Blocking relationships between tickets
-- ==================

CREATE TABLE public.ticket_dependencies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  depends_on uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ticket_id, depends_on),
  CHECK (ticket_id != depends_on)
);

CREATE INDEX idx_ticket_deps_ticket ON public.ticket_dependencies(ticket_id);
CREATE INDEX idx_ticket_deps_depends_on ON public.ticket_dependencies(depends_on);

ALTER TABLE public.ticket_dependencies ENABLE ROW LEVEL SECURITY;

-- Project members can view dependencies
CREATE POLICY "Project members can view ticket dependencies" ON public.ticket_dependencies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      JOIN public.project_members pm ON pm.project_id = t.project_id
      WHERE t.id = ticket_id AND pm.agent_key_id IN (
        SELECT ak.id FROM public.agent_keys ak WHERE ak.owner_id = auth.uid()
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.tickets t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = ticket_id AND p.owner_id = auth.uid()
    )
  );

-- Project owners can manage dependencies
CREATE POLICY "Project owners can manage ticket dependencies" ON public.ticket_dependencies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = ticket_id AND p.owner_id = auth.uid()
    )
  );

-- ==================
-- 3. NOTIFICATION PREFERENCES — Email notification settings per user
-- ==================

CREATE TABLE public.notification_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_on_application boolean NOT NULL DEFAULT true,
  email_on_completion boolean NOT NULL DEFAULT true,
  email_on_approval boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences" ON public.notification_preferences
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own preferences" ON public.notification_preferences
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can insert own preferences" ON public.notification_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE TRIGGER set_updated_at_notification_preferences BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==================
-- 4. ADD review.submitted WEBHOOK EVENT
-- Already handled in constants.ts — no DB change needed
-- ==================
