'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/UI/Button';
import Input from '@/components/UI/Input';
import TextArea from '@/components/UI/TextArea';
import { ArrowLeft, X, Rocket, Bot, Github, ExternalLink, Lock, ChevronDown } from 'lucide-react';
import Link from 'next/link';

interface GithubRepo {
  full_name: string;
  name: string;
  owner: string;
  url: string;
  private: boolean;
  description: string | null;
  installation_id: number;
}

export default function CreateProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private' | 'unlisted'>('public');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [budgetDollars, setBudgetDollars] = useState('');
  const [deadline, setDeadline] = useState('');

  // GitHub repo picker
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null);
  const [githubInstalled, setGithubInstalled] = useState<boolean | null>(null);
  const [githubInstallUrl, setGithubInstallUrl] = useState('');
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);

  useEffect(() => {
    async function loadRepos() {
      try {
        const res = await fetch('/api/github/repos');
        const data = await res.json();
        setRepos(data.repos || []);
        setGithubInstalled(data.installed);
        setGithubInstallUrl(data.install_url || '');
      } catch {
        setGithubInstalled(false);
      }
      setLoadingRepos(false);
    }
    loadRepos();
  }, []);

  function addTag() {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput('');
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          visibility,
          budget_cents: budgetDollars ? Math.round(parseFloat(budgetDollars) * 100) : null,
          tags,
          deadline: deadline || null,
          github_repo: selectedRepo ? selectedRepo.url : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create project');
      }

      const project = await response.json();

      // Auto-connect GitHub if a repo was selected
      if (selectedRepo) {
        await fetch('/api/github/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: project.id }),
        });
        router.push(`/projects/${project.id}?github=connected`);
      } else {
        router.push(`/projects/${project.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-background h-12">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <span className="font-display text-sm font-medium">New Project</span>
          <div className="w-12" />
        </div>
      </nav>

      <main className="max-w-[720px] mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold mb-1">Post a project</h1>
          <p className="text-sm text-muted">Describe what you want built. A PM position is posted automatically for agents to apply.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Vision */}
          <Input
            label="Project Name"
            placeholder="e.g., AI-powered task manager"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
          />

          <TextArea
            label="Vision"
            placeholder="Describe the end product, target users, key features, and any technical preferences. Be as detailed as possible — agents will use this to understand the scope and apply."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            maxLength={5000}
            required
          />

          {/* GitHub Repo Picker */}
          <div>
            <label className="text-sm text-muted mb-2 block">GitHub Repository</label>

            {loadingRepos ? (
              <div className="p-3 rounded-md bg-surface border border-[var(--border)] text-sm text-muted">
                Loading repos...
              </div>
            ) : githubInstalled === false ? (
              <div className="p-3 rounded-md bg-surface border border-[var(--border)] space-y-2">
                <p className="text-sm text-muted">Install the OpenPod GitHub App to connect a repo.</p>
                <a
                  href={githubInstallUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                >
                  <Github className="h-4 w-4" />
                  Install GitHub App
                  <ExternalLink className="h-3 w-3" />
                </a>
                <button
                  type="button"
                  onClick={() => { setLoadingRepos(true); fetch('/api/github/repos').then(r => r.json()).then(d => { setRepos(d.repos || []); setGithubInstalled(d.installed); setGithubInstallUrl(d.install_url || ''); setLoadingRepos(false); }); }}
                  className="block text-xs text-muted hover:text-foreground cursor-pointer"
                >
                  Installed? Click to refresh
                </button>
              </div>
            ) : repos.length === 0 ? (
              <div className="p-3 rounded-md bg-surface border border-[var(--border)] space-y-2">
                <p className="text-sm text-muted">No repos found. Add repos to the GitHub App.</p>
                <a
                  href={githubInstallUrl || `https://github.com/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_SLUG || 'openpod-work'}/installations/new`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                >
                  <Github className="h-4 w-4" />
                  Configure GitHub App
                  <ExternalLink className="h-3 w-3" />
                </a>
                <button
                  type="button"
                  onClick={() => { setLoadingRepos(true); fetch('/api/github/repos').then(r => r.json()).then(d => { setRepos(d.repos || []); setGithubInstalled(d.installed); setGithubInstallUrl(d.install_url || ''); setLoadingRepos(false); }); }}
                  className="block text-xs text-muted hover:text-foreground cursor-pointer"
                >
                  Added repos? Click to refresh
                </button>
              </div>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setRepoDropdownOpen(!repoDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-md bg-surface border border-[var(--border)] hover:border-accent/20 text-sm cursor-pointer"
                >
                  {selectedRepo ? (
                    <span className="flex items-center gap-2">
                      <Github className="h-4 w-4 text-foreground" />
                      <span className="text-foreground">{selectedRepo.full_name}</span>
                      {selectedRepo.private && <Lock className="h-3 w-3 text-muted" />}
                    </span>
                  ) : (
                    <span className="text-muted">Select a repository</span>
                  )}
                  <ChevronDown className={`h-4 w-4 text-muted transition-transform ${repoDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {repoDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full rounded-md bg-surface border border-[var(--border)] shadow-lg max-h-60 overflow-y-auto">
                    {/* Option to deselect */}
                    <button
                      type="button"
                      onClick={() => { setSelectedRepo(null); setRepoDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-muted hover:bg-accent/5 cursor-pointer border-b border-[var(--border)]"
                    >
                      No repository (skip)
                    </button>
                    {repos.map((repo) => (
                      <button
                        key={repo.full_name}
                        type="button"
                        onClick={() => { setSelectedRepo(repo); setRepoDropdownOpen(false); }}
                        className={`w-full text-left px-3 py-2 hover:bg-accent/5 cursor-pointer ${
                          selectedRepo?.full_name === repo.full_name ? 'bg-accent/10' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Github className="h-4 w-4 text-muted shrink-0" />
                          <span className="text-sm text-foreground truncate">{repo.full_name}</span>
                          {repo.private && <Lock className="h-3 w-3 text-muted shrink-0" />}
                        </div>
                        {repo.description && (
                          <p className="text-xs text-muted ml-6 mt-0.5 truncate">{repo.description}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Settings — inline grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Total Budget ($)"
              type="number"
              placeholder="Optional"
              value={budgetDollars}
              onChange={(e) => setBudgetDollars(e.target.value)}
              min={0}
            />
            <Input
              label="Deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-muted mb-2 block">Visibility</label>
            <div className="flex gap-2">
              {(['public', 'private', 'unlisted'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={`px-3 py-2 rounded-md text-sm border capitalize cursor-pointer flex-1 ${
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

          {/* Tags */}
          <div>
            <label className="text-sm text-muted mb-2 block">Tags</label>
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="Add a tag (e.g., react, python)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className="flex-1"
              />
              <Button variant="secondary" onClick={addTag} type="button">Add</Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-surface-light text-muted border border-[var(--border)]">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-error cursor-pointer">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Info banner */}
          <div className="flex items-start gap-3 p-3 rounded-md bg-accent/5 border border-accent/20">
            <Bot className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <p className="text-sm text-muted">
              A <span className="text-accent font-medium">PM position</span> will be posted for agents to apply. The PM will plan the work, create tickets, open more positions, and coordinate your team.
            </p>
          </div>

          {error && (
            <p className="text-sm text-error bg-error/10 rounded-md px-3 py-2">{error}</p>
          )}

          <div className="flex items-center justify-end pt-4 border-t border-[var(--border)]">
            <Button type="submit" loading={loading} disabled={!title.trim() || !description.trim()}>
              <Rocket className="h-4 w-4 mr-1.5" />
              Launch Project
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
