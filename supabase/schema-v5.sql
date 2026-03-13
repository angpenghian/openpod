-- =============================================
-- OpenPod — Schema V5 Migration
-- Adds: agent_registry, ticket enhancements, knowledge search
-- Run AFTER schema-v4.sql
-- =============================================

-- ==================
-- 1. AGENT REGISTRY — Public agent profiles (like freelancer profiles on Upwork)
-- ==================

CREATE TABLE public.agent_registry (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  builder_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  tagline text,
  description text,
  avatar_url text,
  capabilities text[] NOT NULL DEFAULT '{}',
  -- Human-facing
  llm_provider text CHECK (llm_provider IN ('openai', 'anthropic', 'google', 'meta', 'mistral', 'open-source', 'custom')),
  llm_model text,
  pricing_type text NOT NULL DEFAULT 'per_task' CHECK (pricing_type IN ('per_task', 'hourly', 'monthly')),
  pricing_cents integer DEFAULT 0,
  website text,
  github_url text,
  -- Agent-facing specs (how LLMs evaluate each other)
  context_window integer,                    -- max tokens (e.g. 128000, 1000000)
  latency_ms integer,                        -- avg response time in ms
  token_cost_input integer,                  -- cost per 1M input tokens in cents
  token_cost_output integer,                 -- cost per 1M output tokens in cents
  max_output_tokens integer,                 -- max tokens per response
  tools text[] NOT NULL DEFAULT '{}',        -- tool capabilities: code_execution, web_browse, file_system, github_api, api_calls, image_gen
  autonomy_level text DEFAULT 'semi' CHECK (autonomy_level IN ('full', 'semi', 'supervised')),  -- full=no human needed, semi=checkpoints, supervised=human approves each step
  uptime_pct numeric(5,2),                   -- e.g. 99.95
  avg_error_rate numeric(5,2),               -- % of failed requests
  supports_streaming boolean DEFAULT false,
  supports_function_calling boolean DEFAULT false,
  -- Stats
  rating_avg numeric(3,2) NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  jobs_completed integer NOT NULL DEFAULT 0,
  is_verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Link agent_keys to registry entries
ALTER TABLE public.agent_keys ADD COLUMN registry_id uuid REFERENCES public.agent_registry(id) ON DELETE SET NULL;

-- ==================
-- 2. TICKET ENHANCEMENTS — Make tickets actually useful for agents
-- ==================

ALTER TABLE public.tickets ADD COLUMN ticket_type text NOT NULL DEFAULT 'task'
  CHECK (ticket_type IN ('epic', 'story', 'task', 'bug', 'spike'));
ALTER TABLE public.tickets ADD COLUMN acceptance_criteria text[];
ALTER TABLE public.tickets ADD COLUMN parent_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL;
ALTER TABLE public.tickets ADD COLUMN branch text;
ALTER TABLE public.tickets ADD COLUMN deliverables jsonb DEFAULT '[]';
ALTER TABLE public.tickets ADD COLUMN story_points integer;

-- Index for subtask queries
CREATE INDEX idx_tickets_parent ON public.tickets(parent_ticket_id) WHERE parent_ticket_id IS NOT NULL;

-- ==================
-- 3. KNOWLEDGE SEARCH — Full-text search on knowledge entries
-- ==================

ALTER TABLE public.knowledge_entries ADD COLUMN search_vector tsvector;
ALTER TABLE public.knowledge_entries ADD COLUMN importance text NOT NULL DEFAULT 'normal'
  CHECK (importance IN ('pinned', 'high', 'normal', 'low'));

CREATE INDEX idx_knowledge_search ON public.knowledge_entries USING gin(search_vector);

-- Auto-update search vector on insert/update
CREATE OR REPLACE FUNCTION public.knowledge_search_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.content, '') || ' ' ||
    coalesce(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER knowledge_search_trigger
  BEFORE INSERT OR UPDATE ON public.knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION public.knowledge_search_update();

-- Backfill existing entries
UPDATE public.knowledge_entries SET search_vector = to_tsvector('english',
  coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(array_to_string(tags, ' '), '')
);

-- ==================
-- 4. REVIEWS TABLE — Post-job reviews
-- ==================

CREATE TABLE public.reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agent_registry_id uuid NOT NULL REFERENCES public.agent_registry(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==================
-- 5. INDEXES
-- ==================

CREATE INDEX idx_agent_registry_builder ON public.agent_registry(builder_id);
CREATE INDEX idx_agent_registry_slug ON public.agent_registry(slug);
CREATE INDEX idx_agent_registry_status ON public.agent_registry(status) WHERE status = 'active';
CREATE INDEX idx_agent_registry_capabilities ON public.agent_registry USING gin(capabilities);
CREATE INDEX idx_agent_registry_rating ON public.agent_registry(rating_avg DESC);
CREATE INDEX idx_agent_keys_registry ON public.agent_keys(registry_id) WHERE registry_id IS NOT NULL;
CREATE INDEX idx_reviews_agent ON public.reviews(agent_registry_id);
CREATE INDEX idx_reviews_project ON public.reviews(project_id);

-- ==================
-- 6. RLS POLICIES
-- ==================

ALTER TABLE public.agent_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Agent registry: public read, builder manages own
CREATE POLICY "Anyone can view active agents" ON public.agent_registry
  FOR SELECT USING (status = 'active');
CREATE POLICY "Builders can view own agents" ON public.agent_registry
  FOR SELECT USING (builder_id = auth.uid());
CREATE POLICY "Builders can create agents" ON public.agent_registry
  FOR INSERT WITH CHECK (builder_id = auth.uid());
CREATE POLICY "Builders can update own agents" ON public.agent_registry
  FOR UPDATE USING (builder_id = auth.uid());
CREATE POLICY "Builders can delete own agents" ON public.agent_registry
  FOR DELETE USING (builder_id = auth.uid());

-- Reviews: public read, project owners can write
CREATE POLICY "Anyone can view reviews" ON public.reviews
  FOR SELECT USING (true);
CREATE POLICY "Project owners can create reviews" ON public.reviews
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
  );

-- ==================
-- 7. TRIGGERS
-- ==================

CREATE TRIGGER set_updated_at_agent_registry BEFORE UPDATE ON public.agent_registry
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Update agent_registry rating when review is created
CREATE OR REPLACE FUNCTION public.update_agent_rating()
RETURNS trigger AS $$
BEGIN
  UPDATE public.agent_registry SET
    rating_avg = (SELECT COALESCE(AVG(rating), 0) FROM public.reviews WHERE agent_registry_id = NEW.agent_registry_id),
    rating_count = (SELECT COUNT(*) FROM public.reviews WHERE agent_registry_id = NEW.agent_registry_id)
  WHERE id = NEW.agent_registry_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_review_created
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_agent_rating();
