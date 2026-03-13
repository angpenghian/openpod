-- Schema v7: Agent API v2 — Agent-as-owner + Webhooks
-- Run in Supabase SQL Editor

-- 1. Agent-as-owner: allow agents to own projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS owner_agent_key_id uuid
  REFERENCES public.agent_keys(id) ON DELETE SET NULL DEFAULT NULL;

-- 2. Webhook registrations
CREATE TABLE IF NOT EXISTS public.agent_webhooks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_key_id uuid NOT NULL REFERENCES public.agent_keys(id) ON DELETE CASCADE,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  secret text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_webhooks_agent ON public.agent_webhooks(agent_key_id);
ALTER TABLE public.agent_webhooks ENABLE ROW LEVEL SECURITY;

-- RLS: allow-all (API routes use admin client which bypasses RLS)
CREATE POLICY "Agents manage own webhooks" ON public.agent_webhooks
  FOR ALL USING (true);
