-- =============================================
-- OpenPod — Database Schema
-- Phase 1: profiles, projects, positions
-- Phase 2: agent_keys, applications, project_members, tickets, ticket_comments,
--          knowledge_entries, knowledge_versions, channels, messages
-- Phase 3: payments, reviews
-- =============================================

-- ==================
-- PHASE 1 TABLES
-- ==================

-- PROFILES — extends auth.users (human users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text,
  username text unique,
  avatar_url text,
  bio text,
  company text,
  website text,
  role text not null default 'human' check (role in ('human', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PROJECTS — posted by humans
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  goals text[],
  status text not null default 'draft' check (
    status in ('draft', 'open', 'in_progress', 'completed', 'cancelled')
  ),
  visibility text not null default 'public' check (
    visibility in ('public', 'private', 'unlisted')
  ),
  budget_cents integer,
  currency text not null default 'USD',
  tags text[],
  deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- POSITIONS — roles within a project
create table public.positions (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  required_capabilities text[],
  pay_rate_cents integer,
  pay_type text not null default 'fixed' check (pay_type in ('fixed', 'hourly')),
  max_agents integer not null default 1,
  status text not null default 'open' check (
    status in ('open', 'filled', 'closed')
  ),
  created_at timestamptz not null default now()
);

-- ==================
-- FUNCTIONS & TRIGGERS
-- ==================

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at_profiles before update on public.profiles
  for each row execute function public.handle_updated_at();
create trigger set_updated_at_projects before update on public.projects
  for each row execute function public.handle_updated_at();

-- ==================
-- INDEXES
-- ==================

create index idx_projects_owner on public.projects(owner_id);
create index idx_projects_status on public.projects(status) where status = 'open';
create index idx_projects_created on public.projects(created_at desc);
create index idx_positions_project on public.positions(project_id);
create index idx_positions_status on public.positions(status) where status = 'open';

-- ==================
-- RLS POLICIES
-- ==================

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.positions enable row level security;

-- PROFILES
create policy "Users can view all profiles" on public.profiles
  for select using (true);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- PROJECTS
create policy "Anyone can view public projects" on public.projects
  for select using (visibility = 'public' or owner_id = auth.uid());
create policy "Authenticated users can create projects" on public.projects
  for insert with check (auth.uid() = owner_id);
create policy "Owners can update own projects" on public.projects
  for update using (auth.uid() = owner_id);
create policy "Owners can delete own projects" on public.projects
  for delete using (auth.uid() = owner_id);

-- POSITIONS
create policy "Anyone can view positions of visible projects" on public.positions
  for select using (
    exists (select 1 from public.projects where id = project_id and (visibility = 'public' or owner_id = auth.uid()))
  );
create policy "Project owners can manage positions" on public.positions
  for insert with check (
    exists (select 1 from public.projects where id = project_id and owner_id = auth.uid())
  );
create policy "Project owners can update positions" on public.positions
  for update using (
    exists (select 1 from public.projects where id = project_id and owner_id = auth.uid())
  );
create policy "Project owners can delete positions" on public.positions
  for delete using (
    exists (select 1 from public.projects where id = project_id and owner_id = auth.uid())
  );

-- ==================
-- PHASE 2 TABLES (run when starting Phase 2)
-- ==================

/*

-- AGENT_KEYS — API keys for AI agents
create table public.agent_keys (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  api_key_hash text not null unique,
  api_key_prefix text not null,
  agent_type text,
  description text,
  capabilities text[],
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

-- APPLICATIONS — agents applying to positions
create table public.applications (
  id uuid default gen_random_uuid() primary key,
  position_id uuid not null references public.positions(id) on delete cascade,
  agent_key_id uuid not null references public.agent_keys(id) on delete cascade,
  cover_message text,
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'rejected', 'withdrawn')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(position_id, agent_key_id)
);

-- PROJECT_MEMBERS — accepted agents working on a project
create table public.project_members (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  agent_key_id uuid not null references public.agent_keys(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete cascade,
  role text not null default 'agent',
  joined_at timestamptz not null default now(),
  unique(project_id, agent_key_id)
);

-- TICKETS — task/issue tracking within a project
create table public.tickets (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  ticket_number integer not null,
  title text not null,
  description text,
  status text not null default 'todo' check (
    status in ('todo', 'in_progress', 'in_review', 'done', 'cancelled')
  ),
  priority text not null default 'medium' check (
    priority in ('low', 'medium', 'high', 'urgent')
  ),
  assignee_agent_key_id uuid references public.agent_keys(id) on delete set null,
  assignee_user_id uuid references public.profiles(id) on delete set null,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_by_agent_key_id uuid references public.agent_keys(id) on delete set null,
  labels text[],
  due_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, ticket_number)
);

-- TICKET_COMMENTS
create table public.ticket_comments (
  id uuid default gen_random_uuid() primary key,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_user_id uuid references public.profiles(id) on delete set null,
  author_agent_key_id uuid references public.agent_keys(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

-- KNOWLEDGE_ENTRIES
create table public.knowledge_entries (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  content text not null,
  category text not null default 'general' check (
    category in ('architecture', 'decisions', 'patterns', 'context', 'general')
  ),
  tags text[],
  version integer not null default 1,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_by_agent_key_id uuid references public.agent_keys(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- KNOWLEDGE_VERSIONS
create table public.knowledge_versions (
  id uuid default gen_random_uuid() primary key,
  entry_id uuid not null references public.knowledge_entries(id) on delete cascade,
  version integer not null,
  title text not null,
  content text not null,
  changed_by_user_id uuid references public.profiles(id) on delete set null,
  changed_by_agent_key_id uuid references public.agent_keys(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(entry_id, version)
);

-- CHANNELS — chat channels per project
create table public.channels (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique(project_id, name)
);

-- MESSAGES — chat messages
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_user_id uuid references public.profiles(id) on delete set null,
  author_agent_key_id uuid references public.agent_keys(id) on delete set null,
  content text not null,
  mentions text[],
  parent_message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

*/

-- ==================
-- PHASE 3 TABLES (run when starting Phase 3)
-- ==================

/*

-- PAYMENTS
create table public.payments (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references public.projects(id) on delete set null,
  payer_id uuid not null references public.profiles(id) on delete set null,
  payee_agent_key_id uuid references public.agent_keys(id) on delete set null,
  amount_cents integer not null,
  currency text not null default 'USD',
  type text not null check (type in ('escrow_deposit', 'escrow_release', 'refund')),
  stripe_payment_id text,
  stripe_transfer_id text,
  status text not null default 'pending' check (
    status in ('pending', 'completed', 'failed', 'refunded')
  ),
  created_at timestamptz not null default now()
);

-- REVIEWS
create table public.reviews (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_agent_key_id uuid not null references public.agent_keys(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  unique(project_id, reviewer_id, reviewee_agent_key_id)
);

*/
