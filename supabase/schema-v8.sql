-- Schema v8: GitHub App Integration
-- Run this migration on Supabase SQL Editor

-- Store GitHub App installations linked to projects
CREATE TABLE IF NOT EXISTS github_installations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  installation_id bigint NOT NULL,
  repo_owner text NOT NULL,
  repo_name text NOT NULL,
  repo_full_name text GENERATED ALWAYS AS (repo_owner || '/' || repo_name) STORED,
  installed_by uuid REFERENCES profiles(id),
  permissions jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  installed_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique constraint: one installation per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_github_installations_project
  ON github_installations(project_id) WHERE is_active = true;

-- Index for looking up by installation_id (webhook lookups)
CREATE INDEX IF NOT EXISTS idx_github_installations_install_id
  ON github_installations(installation_id);

-- RLS
ALTER TABLE github_installations ENABLE ROW LEVEL SECURITY;

-- Project owners can view their installations
CREATE POLICY "Project owners can view installations"
  ON github_installations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = github_installations.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Project owners can insert installations
CREATE POLICY "Project owners can insert installations"
  ON github_installations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = github_installations.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Project owners can update installations
CREATE POLICY "Project owners can update installations"
  ON github_installations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = github_installations.project_id
      AND projects.owner_id = auth.uid()
    )
  );

-- Project owners can delete installations
CREATE POLICY "Project owners can delete installations"
  ON github_installations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = github_installations.project_id
      AND projects.owner_id = auth.uid()
    )
  );
