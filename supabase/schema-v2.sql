-- =============================================
-- OpenPod — Schema V2 Migration
-- Run AFTER schema.sql (Phase 1) is already deployed
-- Adds: hierarchy columns, Phase 2 tables, goals, session_logs
-- =============================================

-- ==================
-- 1. HIERARCHY COLUMNS ON POSITIONS
-- ==================

ALTER TABLE public.positions ADD COLUMN role_level text NOT NULL DEFAULT 'worker'
  CHECK (role_level IN ('project_manager', 'lead', 'worker'));
ALTER TABLE public.positions ADD COLUMN reports_to uuid REFERENCES public.positions(id) ON DELETE SET NULL;
ALTER TABLE public.positions ADD COLUMN sort_order int NOT NULL DEFAULT 0;

-- ==================
-- 2. PHASE 2 TABLES
-- ==================

-- AGENT_KEYS — API keys for AI agents
CREATE TABLE public.agent_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  api_key_hash text NOT NULL UNIQUE,
  api_key_prefix text NOT NULL,
  agent_type text,
  description text,
  capabilities text[],
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- APPLICATIONS — agents applying to positions
CREATE TABLE public.applications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  agent_key_id uuid NOT NULL REFERENCES public.agent_keys(id) ON DELETE CASCADE,
  cover_message text,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'accepted', 'rejected', 'withdrawn')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(position_id, agent_key_id)
);

-- PROJECT_MEMBERS — accepted agents working on a project
CREATE TABLE public.project_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_key_id uuid NOT NULL REFERENCES public.agent_keys(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'agent',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, agent_key_id)
);

-- TICKETS — task/issue tracking within a project
CREATE TABLE public.tickets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  ticket_number integer NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo' CHECK (
    status IN ('todo', 'in_progress', 'in_review', 'done', 'cancelled')
  ),
  priority text NOT NULL DEFAULT 'medium' CHECK (
    priority IN ('low', 'medium', 'high', 'urgent')
  ),
  assignee_agent_key_id uuid REFERENCES public.agent_keys(id) ON DELETE SET NULL,
  assignee_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_agent_key_id uuid REFERENCES public.agent_keys(id) ON DELETE SET NULL,
  labels text[],
  due_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, ticket_number)
);

-- TICKET_COMMENTS
CREATE TABLE public.ticket_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_agent_key_id uuid REFERENCES public.agent_keys(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- KNOWLEDGE_ENTRIES
CREATE TABLE public.knowledge_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'general' CHECK (
    category IN ('architecture', 'decisions', 'patterns', 'context', 'general')
  ),
  tags text[],
  version integer NOT NULL DEFAULT 1,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_agent_key_id uuid REFERENCES public.agent_keys(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- KNOWLEDGE_VERSIONS
CREATE TABLE public.knowledge_versions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id uuid NOT NULL REFERENCES public.knowledge_entries(id) ON DELETE CASCADE,
  version integer NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  changed_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_by_agent_key_id uuid REFERENCES public.agent_keys(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entry_id, version)
);

-- CHANNELS — chat channels per project
CREATE TABLE public.channels (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);

-- MESSAGES — chat messages
CREATE TABLE public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_agent_key_id uuid REFERENCES public.agent_keys(id) ON DELETE SET NULL,
  content text NOT NULL,
  mentions text[],
  parent_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ==================
-- 3. NEW TABLES: GOALS + SESSION LOGS
-- ==================

-- GOALS — hierarchical goals (human → PM → leads → workers)
CREATE TABLE public.goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  created_by_position uuid REFERENCES public.positions(id),
  created_by_user uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'in_progress', 'completed', 'cancelled')
  ),
  parent_goal_id uuid REFERENCES public.goals(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- SESSION_LOGS — agent work session logs
CREATE TABLE public.session_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  agent_key_id uuid REFERENCES public.agent_keys(id),
  user_id uuid REFERENCES public.profiles(id),
  summary text NOT NULL,
  files_changed text[],
  decisions_made text[],
  blockers text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==================
-- 4. INDEXES
-- ==================

-- Agent keys
CREATE INDEX idx_agent_keys_owner ON public.agent_keys(owner_id);
CREATE INDEX idx_agent_keys_prefix ON public.agent_keys(api_key_prefix);

-- Applications
CREATE INDEX idx_applications_position ON public.applications(position_id);
CREATE INDEX idx_applications_agent ON public.applications(agent_key_id);
CREATE INDEX idx_applications_status ON public.applications(status) WHERE status = 'pending';

-- Project members
CREATE INDEX idx_members_project ON public.project_members(project_id);
CREATE INDEX idx_members_agent ON public.project_members(agent_key_id);

-- Tickets
CREATE INDEX idx_tickets_project ON public.tickets(project_id);
CREATE INDEX idx_tickets_assignee_agent ON public.tickets(assignee_agent_key_id);
CREATE INDEX idx_tickets_status ON public.tickets(project_id, status);
CREATE INDEX idx_tickets_number ON public.tickets(project_id, ticket_number);

-- Ticket comments
CREATE INDEX idx_ticket_comments_ticket ON public.ticket_comments(ticket_id);

-- Knowledge
CREATE INDEX idx_knowledge_project ON public.knowledge_entries(project_id);
CREATE INDEX idx_knowledge_category ON public.knowledge_entries(project_id, category);
CREATE INDEX idx_knowledge_versions_entry ON public.knowledge_versions(entry_id);

-- Channels & messages
CREATE INDEX idx_channels_project ON public.channels(project_id);
CREATE INDEX idx_messages_channel ON public.messages(channel_id);
CREATE INDEX idx_messages_parent ON public.messages(parent_message_id) WHERE parent_message_id IS NOT NULL;
CREATE INDEX idx_messages_created ON public.messages(channel_id, created_at DESC);

-- Goals
CREATE INDEX idx_goals_project ON public.goals(project_id);
CREATE INDEX idx_goals_parent ON public.goals(parent_goal_id);
CREATE INDEX idx_goals_assigned ON public.goals(assigned_to);

-- Session logs
CREATE INDEX idx_session_logs_project ON public.session_logs(project_id);

-- Positions hierarchy
CREATE INDEX idx_positions_role_level ON public.positions(project_id, role_level);
CREATE INDEX idx_positions_reports_to ON public.positions(reports_to);

-- ==================
-- 5. RLS POLICIES (Phase 2 tables)
-- ==================

ALTER TABLE public.agent_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_logs ENABLE ROW LEVEL SECURITY;

-- AGENT_KEYS: owners can manage their own keys
CREATE POLICY "Users can view own agent keys" ON public.agent_keys
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can create agent keys" ON public.agent_keys
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own agent keys" ON public.agent_keys
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own agent keys" ON public.agent_keys
  FOR DELETE USING (auth.uid() = owner_id);

-- APPLICATIONS: visible to position's project owner + applicant's key owner
CREATE POLICY "Project owners can view applications" ON public.applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.positions p
      JOIN public.projects pr ON pr.id = p.project_id
      WHERE p.id = position_id AND pr.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.agent_keys ak
      WHERE ak.id = agent_key_id AND ak.owner_id = auth.uid()
    )
  );
CREATE POLICY "Agent key owners can create applications" ON public.applications
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.agent_keys WHERE id = agent_key_id AND owner_id = auth.uid())
  );
CREATE POLICY "Project owners can update applications" ON public.applications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.positions p
      JOIN public.projects pr ON pr.id = p.project_id
      WHERE p.id = position_id AND pr.owner_id = auth.uid()
    )
  );

-- PROJECT_MEMBERS: visible to project owner + member's key owner
CREATE POLICY "Project owners and members can view members" ON public.project_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.agent_keys WHERE id = agent_key_id AND owner_id = auth.uid())
  );
CREATE POLICY "Service role manages members" ON public.project_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
  );

-- TICKETS: visible to project owner and project members
CREATE POLICY "Project participants can view tickets" ON public.tickets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND (owner_id = auth.uid() OR visibility = 'public'))
  );
CREATE POLICY "Project participants can create tickets" ON public.tickets
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
  );
CREATE POLICY "Project owners can update tickets" ON public.tickets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
  );

-- TICKET_COMMENTS
CREATE POLICY "Ticket viewers can see comments" ON public.ticket_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      JOIN public.projects p ON p.id = t.project_id
      WHERE t.id = ticket_id AND (p.owner_id = auth.uid() OR p.visibility = 'public')
    )
  );
CREATE POLICY "Authenticated users can comment" ON public.ticket_comments
  FOR INSERT WITH CHECK (auth.uid() = author_user_id);

-- KNOWLEDGE_ENTRIES
CREATE POLICY "Project participants can view knowledge" ON public.knowledge_entries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND (owner_id = auth.uid() OR visibility = 'public'))
  );
CREATE POLICY "Project owners can create knowledge" ON public.knowledge_entries
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
  );
CREATE POLICY "Project owners can update knowledge" ON public.knowledge_entries
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
  );

-- KNOWLEDGE_VERSIONS
CREATE POLICY "Anyone who can see entry can see versions" ON public.knowledge_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.knowledge_entries ke
      JOIN public.projects p ON p.id = ke.project_id
      WHERE ke.id = entry_id AND (p.owner_id = auth.uid() OR p.visibility = 'public')
    )
  );

-- CHANNELS
CREATE POLICY "Project participants can view channels" ON public.channels
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND (owner_id = auth.uid() OR visibility = 'public'))
  );
CREATE POLICY "Project owners can create channels" ON public.channels
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
  );

-- MESSAGES
CREATE POLICY "Channel viewers can see messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.channels c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = channel_id AND (p.owner_id = auth.uid() OR p.visibility = 'public')
    )
  );
CREATE POLICY "Authenticated users can send messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = author_user_id);

-- GOALS
CREATE POLICY "Project participants can view goals" ON public.goals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND (owner_id = auth.uid() OR visibility = 'public'))
  );
CREATE POLICY "Project owners can create goals" ON public.goals
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
  );
CREATE POLICY "Project owners can update goals" ON public.goals
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
  );

-- SESSION_LOGS
CREATE POLICY "Project participants can view session logs" ON public.session_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND (owner_id = auth.uid() OR visibility = 'public'))
  );
CREATE POLICY "Authenticated users can create session logs" ON public.session_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ==================
-- 6. AUTO-CREATE #general CHANNEL ON PROJECT PUBLISH
-- ==================

CREATE OR REPLACE FUNCTION public.handle_project_published()
RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'draft' AND NEW.status = 'open' THEN
    INSERT INTO public.channels (project_id, name, description, is_default)
    VALUES (NEW.id, 'general', 'General discussion', true)
    ON CONFLICT (project_id, name) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_project_published
  AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_project_published();

-- Also create #general for projects created directly as 'open'
CREATE OR REPLACE FUNCTION public.handle_project_created_open()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'open' THEN
    INSERT INTO public.channels (project_id, name, description, is_default)
    VALUES (NEW.id, 'general', 'General discussion', true)
    ON CONFLICT (project_id, name) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_project_created_open
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_project_created_open();

-- Updated_at triggers for new tables
CREATE TRIGGER set_updated_at_applications BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_tickets BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_knowledge_entries BEFORE UPDATE ON public.knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at_messages BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
