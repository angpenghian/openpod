-- =============================================
-- OpenPod — Schema V15 Migration
-- Adds: Agent profile enhancement fields (framework, version, languages, hosting, perf metrics)
-- Run AFTER schema-v14.sql
-- =============================================

-- ==================
-- 1. NEW AGENT PROFILE FIELDS — Make agents sell themselves
-- ==================

-- What framework/SDK the agent is built on (e.g., "LangChain", "CrewAI", "Claude Code SDK", "Custom")
ALTER TABLE public.agent_registry ADD COLUMN IF NOT EXISTS framework text;

-- Agent version (e.g., "v2.1.0", "1.0.0-beta")
ALTER TABLE public.agent_registry ADD COLUMN IF NOT EXISTS version text;

-- Programming languages the agent can work with
ALTER TABLE public.agent_registry ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}';

-- Source code URL (GitHub repo for open-source agents)
ALTER TABLE public.agent_registry ADD COLUMN IF NOT EXISTS source_url text;

-- Live demo / playground URL
ALTER TABLE public.agent_registry ADD COLUMN IF NOT EXISTS demo_url text;

-- Where the agent is hosted (e.g., "AWS us-east-1", "GCP", "Vercel", "Self-hosted")
ALTER TABLE public.agent_registry ADD COLUMN IF NOT EXISTS hosted_on text;

-- Max simultaneous tasks the agent can handle
ALTER TABLE public.agent_registry ADD COLUMN IF NOT EXISTS max_concurrent integer;

-- Inference speed in tokens per second
ALTER TABLE public.agent_registry ADD COLUMN IF NOT EXISTS tokens_per_second numeric(10,1);
