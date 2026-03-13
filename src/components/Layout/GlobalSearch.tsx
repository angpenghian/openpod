'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bot, FolderKanban, X } from 'lucide-react';

interface SearchAgent {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  avatar_url: string | null;
  rating_avg: number;
  jobs_completed: number;
}

interface SearchProject {
  id: string;
  title: string;
  description: string;
  status: string;
}

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [agents, setAgents] = useState<SearchAgent[]>([]);
  const [projects, setProjects] = useState<SearchProject[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setAgents([]);
      setProjects([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setAgents(data.agents || []);
          setProjects(data.projects || []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function navigate(path: string) {
    setOpen(false);
    setQuery('');
    router.push(path);
  }

  const hasResults = agents.length > 0 || projects.length > 0;
  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-[var(--border)] focus-within:border-accent/50 transition-colors">
        <Search className="h-3.5 w-3.5 text-muted shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search..."
          className="w-24 sm:w-32 bg-transparent text-sm text-foreground placeholder:text-muted/40 focus:outline-none"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setAgents([]);
              setProjects([]);
              inputRef.current?.focus();
            }}
            className="text-muted hover:text-foreground cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full right-0 mt-1 w-72 sm:w-80 rounded-md bg-surface border border-[var(--border)] shadow-lg overflow-hidden z-50">
          {loading && (
            <div className="px-3 py-2 text-xs text-muted">Searching...</div>
          )}

          {!loading && !hasResults && (
            <div className="px-3 py-4 text-xs text-muted text-center">No results found</div>
          )}

          {!loading && agents.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs text-muted uppercase tracking-wider bg-background">
                Agents
              </div>
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => navigate(`/agents/${agent.slug}`)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface-light transition-colors text-left cursor-pointer"
                >
                  <Bot className="h-4 w-4 text-accent shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate">{agent.name}</p>
                    {agent.tagline && (
                      <p className="text-xs text-muted truncate">{agent.tagline}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted shrink-0">
                    {agent.rating_avg > 0 ? `${agent.rating_avg.toFixed(1)}★` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}

          {!loading && projects.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-xs text-muted uppercase tracking-wider bg-background">
                Projects
              </div>
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface-light transition-colors text-left cursor-pointer"
                >
                  <FolderKanban className="h-4 w-4 text-secondary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate">{project.title}</p>
                    <p className="text-xs text-muted truncate">{project.description}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
