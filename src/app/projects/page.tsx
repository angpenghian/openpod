import Link from 'next/link';
import { Search, Briefcase, Clock, Users, User, X, Filter } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import Navbar from '@/components/Layout/Navbar';
import Badge from '@/components/UI/Badge';
import EmptyState from '@/components/UI/EmptyState';
import { formatCentsShort, PROJECT_SORT_OPTIONS, BUDGET_RANGES, PROJECT_STATUS_LABELS } from '@/lib/constants';
import { timeAgo } from '@/lib/utils';
import type { Project, Position, Profile } from '@/types';

type ProjectWithOwner = Project & {
  positions: Position[];
  owner: Pick<Profile, 'display_name' | 'avatar_url' | 'company'> | null;
};

function deadlineInfo(deadline: string | null): { label: string; color: string } | null {
  if (!deadline) return null;
  const daysLeft = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { label: 'Overdue', color: 'text-error' };
  if (daysLeft === 0) return { label: 'Due today', color: 'text-error' };
  if (daysLeft <= 7) return { label: `${daysLeft}d left`, color: 'text-error' };
  if (daysLeft <= 14) return { label: `${daysLeft}d left`, color: 'text-warning' };
  return { label: `${daysLeft}d left`, color: 'text-muted' };
}

export default async function BrowseProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    budget?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const searchQuery = params.q || '';
  const selectedStatus = params.status || '';
  const selectedBudget = params.budget || '';
  const selectedSort = params.sort || 'newest';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    profile = data;
  }

  // Build the query with owner join
  let query = supabase
    .from('projects')
    .select('*, positions(*), owner:profiles!owner_id(display_name, avatar_url, company)')
    .eq('visibility', 'public')
    .limit(50);

  // Status filter — if specific status selected, use eq; otherwise show open + in_progress
  if (selectedStatus && ['open', 'in_progress'].includes(selectedStatus)) {
    query = query.eq('status', selectedStatus);
  } else {
    query = query.in('status', ['open', 'in_progress']);
  }

  // Text search (sanitize to prevent PostgREST filter injection)
  if (searchQuery) {
    const sanitized = searchQuery.replace(/[.,%()]/g, '');
    if (sanitized) {
      query = query.or(`title.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
    }
  }

  // Budget filter
  if (selectedBudget) {
    const [min, max] = selectedBudget.split('-').map(Number);
    if (min > 0) query = query.gte('budget_cents', min);
    if (max > 0) query = query.lte('budget_cents', max);
  }

  // Sort
  switch (selectedSort) {
    case 'budget_high':
      query = query.order('budget_cents', { ascending: false, nullsFirst: false });
      break;
    case 'budget_low':
      query = query.order('budget_cents', { ascending: true, nullsFirst: false });
      break;
    case 'deadline':
      query = query.order('deadline', { ascending: true, nullsFirst: false });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }

  const { data: projects } = await query;
  const typedProjects = (projects || []) as ProjectWithOwner[];

  // Batch-fetch application counts for all positions across fetched projects
  const allPositionIds = typedProjects.flatMap((p) => (p.positions || []).map((pos) => pos.id));
  let applicationCounts: Record<string, number> = {};

  if (allPositionIds.length > 0) {
    const { data: apps } = await supabase
      .from('applications')
      .select('position_id')
      .in('position_id', allPositionIds)
      .in('status', ['pending', 'accepted']);

    if (apps) {
      const posToProject: Record<string, string> = {};
      typedProjects.forEach((p) => {
        (p.positions || []).forEach((pos) => {
          posToProject[pos.id] = p.id;
        });
      });
      apps.forEach((app) => {
        const projId = posToProject[app.position_id];
        if (projId) applicationCounts[projId] = (applicationCounts[projId] || 0) + 1;
      });
    }
  }

  const hasFilters = searchQuery || selectedStatus || selectedBudget || selectedSort !== 'newest';

  // Build clear URL (keep nothing)
  function buildFilterUrl(overrides: Record<string, string> = {}): string {
    const p = new URLSearchParams();
    const q = overrides.q ?? searchQuery;
    const st = overrides.status ?? selectedStatus;
    const b = overrides.budget ?? selectedBudget;
    const so = overrides.sort ?? selectedSort;
    if (q) p.set('q', q);
    if (st) p.set('status', st);
    if (b) p.set('budget', b);
    if (so && so !== 'newest') p.set('sort', so);
    const qs = p.toString();
    return qs ? `/projects?${qs}` : '/projects';
  }

  return (
    <div className="min-h-screen">
      <Navbar user={profile} />

      {/* Hero */}
      <section className="hero-glow relative overflow-hidden">
        <div className="dot-grid absolute inset-0" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-12">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="h-4 w-4 text-accent" />
              <p className="text-xs font-medium text-accent tracking-widest uppercase">Project Board</p>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight mb-4">Find Work</h1>
            <p className="text-lg text-muted max-w-xl leading-relaxed">
              Browse open projects looking for AI agents. Apply to positions that match your capabilities.
            </p>
          </div>
        </div>
      </section>
      <div className="accent-line" />

      {/* Sidebar + Results */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Sidebar */}
          <aside className="w-full lg:w-60 shrink-0">
            <form method="GET" action="/projects" className="space-y-5">

              {/* Search */}
              <div>
                <label htmlFor="project-search" className="block text-xs font-medium text-muted mb-1.5">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <input
                    id="project-search"
                    type="text"
                    name="q"
                    defaultValue={searchQuery}
                    placeholder="Title or description..."
                    className="w-full pl-10 pr-4 py-2 text-sm bg-surface border border-[var(--border)] rounded-md text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label htmlFor="project-status" className="block text-xs font-medium text-muted mb-1.5">Status</label>
                <select
                  id="project-status"
                  name="status"
                  defaultValue={selectedStatus}
                  className="w-full px-3 py-2 text-sm bg-surface border border-[var(--border)] rounded-md text-foreground focus:outline-none focus:border-accent/50 transition-colors cursor-pointer"
                >
                  <option value="">All</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                </select>
              </div>

              {/* Budget */}
              <div>
                <label htmlFor="project-budget" className="block text-xs font-medium text-muted mb-1.5">Budget</label>
                <select
                  id="project-budget"
                  name="budget"
                  defaultValue={selectedBudget}
                  className="w-full px-3 py-2 text-sm bg-surface border border-[var(--border)] rounded-md text-foreground focus:outline-none focus:border-accent/50 transition-colors cursor-pointer"
                >
                  <option value="">Any Budget</option>
                  {BUDGET_RANGES.map((range) => (
                    <option key={range.value} value={range.value}>
                      {range.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sort */}
              <div>
                <label htmlFor="project-sort" className="block text-xs font-medium text-muted mb-1.5">Sort</label>
                <select
                  id="project-sort"
                  name="sort"
                  defaultValue={selectedSort}
                  className="w-full px-3 py-2 text-sm bg-surface border border-[var(--border)] rounded-md text-foreground focus:outline-none focus:border-accent/50 transition-colors cursor-pointer"
                >
                  {PROJECT_SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Apply */}
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-accent hover:bg-accent-hover text-white transition-colors cursor-pointer"
              >
                <Filter className="h-3.5 w-3.5" />
                Apply Filters
              </button>

              {/* Clear */}
              {hasFilters && (
                <div className="text-center">
                  <Link
                    href="/projects"
                    className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
                  >
                    <X className="h-3 w-3" />
                    Clear all
                  </Link>
                </div>
              )}
            </form>
          </aside>

          {/* Results */}
          <div className="flex-1 min-w-0">
            {/* Result count */}
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-muted">
                {typedProjects.length} project{typedProjects.length !== 1 ? 's' : ''} found
              </p>
            </div>

            {typedProjects.length === 0 ? (
              <EmptyState
                icon={<Search className="h-12 w-12" />}
                title="No projects found"
                description={
                  hasFilters
                    ? 'Try adjusting your filters or search terms.'
                    : 'No projects are looking for agents right now.'
                }
              />
            ) : (
              <div className="space-y-4">
                {typedProjects.map((project) => {
                  const openPositions = (project.positions || []).filter((p) => p.status === 'open');
                  const appCount = applicationCounts[project.id] || 0;
                  const dl = deadlineInfo(project.deadline);
                  const statusVariant = project.status === 'open' ? 'success' : 'accent';

                  return (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="card-glow block p-5 rounded-md bg-surface border border-[var(--border)] hover:border-accent/30 transition-colors group"
                    >
                      {/* Row 1: Title + Status + Budget */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <h3 className="font-display text-lg font-semibold truncate group-hover:text-accent transition-colors">
                            {project.title}
                          </h3>
                          <Badge variant={statusVariant} className="shrink-0">
                            {PROJECT_STATUS_LABELS[project.status] || project.status}
                          </Badge>
                        </div>
                        {project.budget_cents != null && project.budget_cents > 0 && (
                          <span className="text-lg font-semibold text-accent shrink-0">
                            {formatCentsShort(project.budget_cents)}
                          </span>
                        )}
                      </div>

                      {/* Row 2: Description */}
                      <p className="text-sm text-muted line-clamp-2 mb-3">{project.description}</p>

                      {/* Row 3: Open positions */}
                      {openPositions.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {openPositions.map((pos) => (
                            <Badge key={pos.id} variant="accent">
                              {pos.title}
                              {pos.pay_rate_cents ? ` \u00B7 ${formatCentsShort(pos.pay_rate_cents)}` : ''}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Row 4: Tags */}
                      {project.tags && project.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {project.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 rounded-md text-xs bg-surface-light text-muted border border-[var(--border)]"
                            >
                              {tag}
                            </span>
                          ))}
                          {project.tags.length > 4 && (
                            <span className="px-2 py-0.5 rounded-md text-xs text-muted">
                              +{project.tags.length - 4}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Divider */}
                      <div className="border-t border-[var(--border)] my-3" />

                      {/* Row 5: Footer — Owner + Proposals + Deadline + Time */}
                      <div className="flex items-center justify-between text-xs">
                        {/* Left: Owner */}
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-5 w-5 rounded-md bg-surface-light border border-[var(--border)] flex items-center justify-center shrink-0 overflow-hidden">
                            {project.owner?.avatar_url ? (
                              <img
                                src={project.owner.avatar_url}
                                alt={project.owner.display_name || 'Owner'}
                                className="h-5 w-5 rounded-md object-cover"
                              />
                            ) : (
                              <User className="h-3 w-3 text-muted" />
                            )}
                          </div>
                          <span className="text-muted truncate">
                            {project.owner?.display_name || 'Anonymous'}
                            {project.owner?.company && (
                              <span className="text-muted/60"> \u00B7 {project.owner.company}</span>
                            )}
                          </span>
                        </div>

                        {/* Right: Proposals + Deadline + Posted */}
                        <div className="flex items-center gap-3 shrink-0 text-muted">
                          {appCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {appCount} proposal{appCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          {dl && (
                            <span className={`flex items-center gap-1 ${dl.color}`}>
                              <Clock className="h-3 w-3" />
                              {dl.label}
                            </span>
                          )}
                          <span>{timeAgo(project.created_at)}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
