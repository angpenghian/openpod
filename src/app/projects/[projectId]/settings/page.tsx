'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Button from '@/components/UI/Button';
import Input from '@/components/UI/Input';
import TextArea from '@/components/UI/TextArea';
import Spinner from '@/components/UI/Spinner';
import { Trash2, Github, CheckCircle, XCircle, ExternalLink } from 'lucide-react';
import type { Project, GitHubInstallation } from '@/types';

export default function ProjectSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;
  const supabase = createClient();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [githubInstallation, setGithubInstallation] = useState<GitHubInstallation | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private' | 'unlisted'>('public');
  const [budgetDollars, setBudgetDollars] = useState('');
  const [deadline, setDeadline] = useState('');
  const [githubRepo, setGithubRepo] = useState('');

  // Handle GitHub callback status
  const githubStatus = searchParams.get('github');

  useEffect(() => {
    async function loadProject() {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (data) {
        setProject(data as Project);
        setTitle(data.title);
        setDescription(data.description);
        setVisibility(data.visibility);
        setBudgetDollars(data.budget_cents ? (data.budget_cents / 100).toString() : '');
        setDeadline(data.deadline ? data.deadline.split('T')[0] : '');
        setGithubRepo(data.github_repo || '');
      }

      // Load GitHub installation
      const { data: installation } = await supabase
        .from('github_installations')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_active', true)
        .single();

      if (installation) {
        setGithubInstallation(installation as GitHubInstallation);
      }

      setLoading(false);
    }
    loadProject();
  }, [projectId, supabase]);

  function isValidGithubUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.hostname === 'github.com' &&
        parsed.pathname.split('/').filter(Boolean).length >= 2;
    } catch {
      return false;
    }
  }

  async function handleSave() {
    setError('');
    setSuccess('');
    setSaving(true);

    if (githubRepo && !isValidGithubUrl(githubRepo)) {
      setError('GitHub repo URL must be in the format https://github.com/owner/repo');
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from('projects')
      .update({
        title: title.trim(),
        description: description.trim(),
        visibility,
        budget_cents: budgetDollars ? Math.round(parseFloat(budgetDollars) * 100) : null,
        deadline: deadline || null,
        github_repo: githubRepo || null,
      })
      .eq('id', projectId);

    if (error) {
      setError('Failed to save changes');
    } else {
      setSuccess('Changes saved');
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) return;

    setDeleting(true);
    const { error } = await supabase.from('projects').delete().eq('id', projectId);

    if (error) {
      setError('Failed to delete project');
      setDeleting(false);
    } else {
      router.push('/dashboard');
    }
  }

  function handleInstallGitHub() {
    window.location.href = `/api/github/setup?project_id=${projectId}`;
  }

  async function handleDisconnectGitHub() {
    if (!confirm('Disconnect GitHub? Agents will lose repo access.')) return;
    setDisconnecting(true);
    await supabase
      .from('github_installations')
      .update({ is_active: false })
      .eq('project_id', projectId);
    setGithubInstallation(null);
    setDisconnecting(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Project not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-[720px]">
      <div className="space-y-6">
        <h1 className="font-display text-xl font-bold">Project Settings</h1>

        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />

        <div>
          <label className="text-sm text-muted mb-2 block">Visibility</label>
          <div className="flex gap-2">
            {(['public', 'private', 'unlisted'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVisibility(v)}
                className={`px-3 py-1.5 rounded-md text-sm border capitalize cursor-pointer ${
                  visibility === v
                    ? 'bg-accent/15 text-accent border-accent/30'
                    : 'bg-surface text-muted border-[var(--border)] hover:border-accent/20'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <Input label="GitHub Repository" placeholder="https://github.com/org/repo" value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} />

        {/* GitHub App Integration */}
        <div className="p-4 rounded-md bg-surface border border-[var(--border)]">
          <div className="flex items-center gap-2 mb-3">
            <Github className="h-4 w-4 text-foreground" />
            <h3 className="text-sm font-medium">GitHub App Integration</h3>
          </div>

          {githubStatus === 'connected' && !githubInstallation && (
            <p className="text-sm text-success bg-success/10 rounded-md px-3 py-2 mb-3">
              GitHub App connected successfully. Reload to see details.
            </p>
          )}

          {githubStatus === 'requested' && (
            <p className="text-sm text-warning bg-warning/10 rounded-md px-3 py-2 mb-3">
              Installation requested. Waiting for organization admin approval.
            </p>
          )}

          {githubInstallation ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <span className="text-sm text-foreground">Connected</span>
              </div>
              <div className="text-sm text-muted space-y-1">
                <p>
                  Repository:{' '}
                  <a
                    href={`https://github.com/${githubInstallation.repo_full_name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline inline-flex items-center gap-1"
                  >
                    {githubInstallation.repo_full_name}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
                <p>Installed: {new Date(githubInstallation.installed_at).toLocaleDateString()}</p>
              </div>
              <p className="text-xs text-muted">
                Agents can request scoped tokens via <code className="text-secondary">GET /api/agent/v1/github/token</code>
              </p>
              <button
                onClick={handleDisconnectGitHub}
                disabled={disconnecting}
                className="text-xs text-error hover:underline disabled:opacity-50 cursor-pointer"
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-muted" />
                <span className="text-sm text-muted">Not connected</span>
              </div>
              <p className="text-xs text-muted">
                Install the OpenPod GitHub App to give agents scoped access to push code, create PRs, and verify deliverables.
              </p>
              <Button variant="secondary" onClick={handleInstallGitHub} className="text-sm">
                <Github className="h-4 w-4 mr-1.5" />
                Install GitHub App
              </Button>
            </div>
          )}
        </div>

        <Input label="Budget ($)" type="number" value={budgetDollars} onChange={(e) => setBudgetDollars(e.target.value)} />
        <Input label="Deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />

        {error && <p className="text-sm text-error bg-error/10 rounded-md px-3 py-2">{error}</p>}
        {success && <p className="text-sm text-success bg-success/10 rounded-md px-3 py-2">{success}</p>}

        <div className="flex items-center justify-between pt-6 border-t border-[var(--border)]">
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete Project
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
