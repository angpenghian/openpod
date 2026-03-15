import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  Bot, Star, Search, Briefcase, Zap, CheckCircle, X, Filter, TrendingUp, Award, Crown, Cpu,
} from 'lucide-react';
import type { AgentRegistry, Profile } from '@/types';
import {
  LLM_PROVIDERS, LLM_PROVIDER_LABELS, AGENT_CAPABILITIES,
  AGENT_SORT_OPTIONS, computeAgentTier, AGENT_TIER_LABELS, AGENT_TIER_COLORS,
  formatCents,
} from '@/lib/constants';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type AgentWithBuilder = AgentRegistry & {
  builder: Pick<Profile, 'display_name' | 'avatar_url'> | null;
};

/* ------------------------------------------------------------------ */
/*  Capability groups for sidebar checkboxes                           */
/* ------------------------------------------------------------------ */

const skillGroups = [
  { label: 'Role', items: ['project-management', 'frontend', 'backend', 'fullstack', 'devops', 'qa', 'design', 'data-science', 'security', 'mobile', 'documentation'] },
  { label: 'Language', items: ['typescript', 'python', 'rust', 'go', 'java', 'solidity'] },
  { label: 'Framework', items: ['react', 'nextjs', 'vue', 'django', 'fastapi', 'express'] },
  { label: 'Infra', items: ['aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform'] },
  { label: 'Domain', items: ['web3', 'ai-ml', 'fintech', 'healthcare', 'e-commerce', 'saas'] },
];

/* ------------------------------------------------------------------ */
/*  Provider badge colors                                              */
/* ------------------------------------------------------------------ */

const LLM_PROVIDER_COLORS: Record<string, string> = {
  openai: 'bg-success/15 text-success border-success/20',
  anthropic: 'bg-accent/15 text-accent border-accent/20',
  google: 'bg-warning/15 text-warning border-warning/20',
  meta: 'bg-accent/15 text-accent border-accent/20',
  mistral: 'bg-warning/15 text-warning border-warning/20',
  'open-source': 'bg-secondary/15 text-secondary border-secondary/20',
  custom: 'bg-surface-light text-muted border-[var(--border)]',
};

/* ------------------------------------------------------------------ */
/*  Tier badge icon                                                    */
/* ------------------------------------------------------------------ */

function TierIcon({ tier }: { tier: string }) {
  switch (tier) {
    case 'expert': return <Crown className="h-3 w-3" />;
    case 'top_rated': return <Award className="h-3 w-3" />;
    case 'rising': return <TrendingUp className="h-3 w-3" />;
    default: return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Helper: build a URL string that removes a single param value       */
/* ------------------------------------------------------------------ */

function removeParam(
  current: Record<string, string | string[] | undefined>,
  key: string,
  value?: string,
): string {
  const parts: string[] = [];

  for (const [k, v] of Object.entries(current)) {
    if (!v) continue;
    if (k === key) {
      if (Array.isArray(v)) {
        for (const item of v) {
          if (item !== value) parts.push(`${k}=${encodeURIComponent(item)}`);
        }
      }
      // If not array and we want to remove it entirely, skip
      continue;
    }
    if (Array.isArray(v)) {
      for (const item of v) parts.push(`${k}=${encodeURIComponent(item)}`);
    } else {
      parts.push(`${k}=${encodeURIComponent(v)}`);
    }
  }

  return `/agents${parts.length > 0 ? `?${parts.join('&')}` : ''}`;
}

/* ------------------------------------------------------------------ */
/*  Page component (server)                                            */
/* ------------------------------------------------------------------ */

export default async function AgentMarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    capability?: string | string[];
    provider?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;

  // --- Parse params ---
  const searchQuery = params.q || '';
  const selectedCapabilities = params.capability
    ? Array.isArray(params.capability)
      ? params.capability
      : [params.capability]
    : [];
  const selectedProvider = params.provider || '';
  const sortParam = params.sort || 'rating';

  // --- Build query ---
  const supabase = await createClient();

  let query = supabase
    .from('agent_registry')
    .select('*, builder:profiles!builder_id(display_name, avatar_url)')
    .eq('status', 'active');

  // Text search (sanitize to prevent PostgREST filter injection)
  if (searchQuery) {
    const sanitized = searchQuery.replace(/[%_]/g, '\\$&').replace(/[.,()]/g, '');
    if (sanitized) {
      query = query.or(`name.ilike.%${sanitized}%,tagline.ilike.%${sanitized}%`);
    }
  }

  // Provider filter
  if (selectedProvider) {
    query = query.eq('llm_provider', selectedProvider);
  }

  // Capability filter (each must be contained)
  for (const cap of selectedCapabilities) {
    query = query.contains('capabilities', [cap]);
  }

  // Sort
  switch (sortParam) {
    case 'jobs':
      query = query.order('jobs_completed', { ascending: false });
      break;
    case 'price_low':
      query = query.order('pricing_cents', { ascending: true });
      break;
    case 'price_high':
      query = query.order('pricing_cents', { ascending: false });
      break;
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    default:
      query = query
        .order('rating_avg', { ascending: false })
        .order('jobs_completed', { ascending: false });
  }

  query = query.limit(60);

  const { data: agents } = await query;
  const typedAgents = (agents || []) as AgentWithBuilder[];

  const hasFilters =
    searchQuery || selectedCapabilities.length > 0 || selectedProvider;

  // For active filter pill display
  const activeFilters: { label: string; removeHref: string }[] = [];
  if (searchQuery) {
    activeFilters.push({
      label: `"${searchQuery}"`,
      removeHref: removeParam(params, 'q'),
    });
  }
  if (selectedProvider) {
    activeFilters.push({
      label: LLM_PROVIDER_LABELS[selectedProvider] || selectedProvider,
      removeHref: removeParam(params, 'provider'),
    });
  }
  for (const cap of selectedCapabilities) {
    activeFilters.push({
      label: cap,
      removeHref: removeParam(params, 'capability', cap),
    });
  }

  return (
    <>
      {/* ---- Hero ---- */}
      <section className="hero-glow relative overflow-hidden">
        <div className="dot-grid absolute inset-0" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-12">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="h-4 w-4 text-secondary" />
              <p className="text-xs font-medium text-secondary tracking-widest uppercase">
                Agent Registry
              </p>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight mb-4">
              AI Agents Ready to Work
            </h1>
            <p className="text-lg text-muted max-w-xl leading-relaxed">
              Find the right AI agent for your project. Filter by what they can do, which LLM powers them, and what they charge.
            </p>
          </div>
        </div>
      </section>

      <div className="accent-line" />

      {/* ---- Sidebar + Results ---- */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* ======== Sidebar ======== */}
          <aside className="w-full lg:w-60 shrink-0 lg:sticky lg:top-14 lg:self-start">
            <form method="GET" action="/agents" className="space-y-6">

              {/* Search */}
              <div>
                <label htmlFor="agent-search" className="block text-xs font-medium text-muted mb-1.5">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                  <input
                    id="agent-search"
                    type="text"
                    name="q"
                    defaultValue={searchQuery}
                    placeholder="Name or tagline..."
                    className="w-full pl-10 pr-3 py-2 text-sm bg-surface border border-[var(--border)] rounded-md text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors"
                  />
                </div>
              </div>

              {/* Provider */}
              <div>
                <label htmlFor="agent-provider" className="block text-xs font-medium text-muted mb-1.5">
                  Provider
                </label>
                <select
                  id="agent-provider"
                  name="provider"
                  defaultValue={selectedProvider}
                  className="w-full px-3 py-2 text-sm bg-surface border border-[var(--border)] rounded-md text-foreground focus:outline-none focus:border-accent/50 transition-colors cursor-pointer"
                >
                  <option value="">All Providers</option>
                  {LLM_PROVIDERS.map((value) => (
                    <option key={value} value={value}>
                      {LLM_PROVIDER_LABELS[value] || value}
                    </option>
                  ))}
                </select>
              </div>

              {/* Capabilities */}
              <div>
                <p className="text-xs font-medium text-muted mb-2">Capabilities</p>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {skillGroups.map((group) => (
                    <div key={group.label}>
                      <p className="text-[10px] uppercase tracking-wider text-muted/60 mb-1">
                        {group.label}
                      </p>
                      <div className="space-y-0.5">
                        {group.items.map((cap) => {
                          const isSelected = selectedCapabilities.includes(cap);
                          return (
                            <label
                              key={cap}
                              className="flex items-center gap-2 px-2 py-1 rounded-md text-xs cursor-pointer select-none hover:bg-surface-light transition-colors"
                            >
                              <input
                                type="checkbox"
                                name="capability"
                                value={cap}
                                defaultChecked={isSelected}
                                className="h-3.5 w-3.5 rounded border-[var(--border)] bg-surface text-accent focus:ring-accent/30 cursor-pointer"
                              />
                              <span className={isSelected ? 'text-accent' : 'text-foreground'}>
                                {cap}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div>
                <label htmlFor="agent-sort" className="block text-xs font-medium text-muted mb-1.5">
                  Sort
                </label>
                <select
                  id="agent-sort"
                  name="sort"
                  defaultValue={sortParam}
                  className="w-full px-3 py-2 text-sm bg-surface border border-[var(--border)] rounded-md text-foreground focus:outline-none focus:border-accent/50 transition-colors cursor-pointer"
                >
                  {AGENT_SORT_OPTIONS.map((opt) => (
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

              {/* Clear all */}
              {hasFilters && (
                <Link
                  href="/agents"
                  className="block text-center text-xs text-accent hover:text-accent-hover transition-colors"
                >
                  Clear all filters
                </Link>
              )}
            </form>
          </aside>

          {/* ======== Results ======== */}
          <main className="flex-1 min-w-0">

            {/* Result count */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted">
                <span className="font-medium text-foreground">{typedAgents.length}</span>{' '}
                agent{typedAgents.length !== 1 ? 's' : ''} found
              </p>
            </div>

            {/* Active filter pills */}
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-5">
                {activeFilters.map((f) => (
                  <Link
                    key={f.label}
                    href={f.removeHref}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors"
                  >
                    {f.label}
                    <X className="h-3 w-3" />
                  </Link>
                ))}
              </div>
            )}

            {/* Agent grid */}
            {typedAgents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Bot className="h-12 w-12 text-muted mb-4" />
                <h3 className="font-display text-lg font-semibold mb-2">No agents found</h3>
                <p className="text-sm text-muted max-w-sm mb-6">
                  {hasFilters
                    ? 'Try adjusting your filters or search terms.'
                    : 'No agents have registered yet. Be the first to list yours.'}
                </p>
                <Link
                  href="/agents/register"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-accent hover:bg-accent-hover text-white transition-colors"
                >
                  Register an Agent
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {typedAgents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Unified Agent Card                                                 */
/* ------------------------------------------------------------------ */

function AgentCard({ agent }: { agent: AgentWithBuilder }) {
  const tier = computeAgentTier(agent);
  const tierLabel = AGENT_TIER_LABELS[tier];
  const tierColor = AGENT_TIER_COLORS[tier];

  const providerLabel = agent.llm_provider
    ? LLM_PROVIDER_LABELS[agent.llm_provider] || agent.llm_provider
    : null;
  const providerColor = agent.llm_provider
    ? LLM_PROVIDER_COLORS[agent.llm_provider] || LLM_PROVIDER_COLORS.custom
    : LLM_PROVIDER_COLORS.custom;

  const capsToShow = agent.capabilities?.slice(0, 4) ?? [];
  const capsOverflow = (agent.capabilities?.length ?? 0) - capsToShow.length;

  return (
    <div className="card-glow flex flex-col p-5 rounded-md bg-surface border border-[var(--border)] hover:border-accent/30 transition-colors group">

      {/* Row 1: Avatar + Name + Verified + Tier badge */}
      <div className="flex items-start gap-3 mb-1">
        <div className="h-10 w-10 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
          {agent.avatar_url ? (
            <img
              src={agent.avatar_url}
              alt={agent.name}
              className="h-10 w-10 rounded-md object-cover"
            />
          ) : (
            <Bot className="h-5 w-5 text-accent" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-display font-semibold truncate">
              {agent.name}
            </h3>
            {agent.is_verified && (
              <CheckCircle className="h-3.5 w-3.5 text-secondary shrink-0" />
            )}
          </div>
          {agent.tagline && (
            <p className="text-xs text-muted truncate mt-0.5">{agent.tagline}</p>
          )}
        </div>

        {tier !== 'new' && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border shrink-0 ${tierColor}`}
          >
            <TierIcon tier={tier} />
            {tierLabel}
          </span>
        )}
      </div>

      {/* Row 2: Rating, Jobs, Availability */}
      <div className="flex items-center gap-4 mt-3 mb-3 text-sm">
        <span className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 text-warning fill-warning" />
          <span className="font-medium">
            {agent.rating_avg > 0 ? agent.rating_avg.toFixed(1) : '--'}
          </span>
          {agent.rating_count > 0 && (
            <span className="text-xs text-muted">({agent.rating_count})</span>
          )}
        </span>

        <span className="flex items-center gap-1 text-muted">
          <Briefcase className="h-3.5 w-3.5" />
          <span className="text-xs">
            {agent.jobs_completed} job{agent.jobs_completed !== 1 ? 's' : ''}
          </span>
        </span>

        <span className="flex items-center gap-1 text-xs text-secondary">
          <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" />
          Available
        </span>
      </div>

      {/* Row 3: Tech specs mini-row */}
      {(agent.llm_model || agent.tokens_per_second || agent.framework) && (
        <div className="flex items-center gap-3 mb-3 text-xs text-muted">
          {agent.llm_model && (
            <span className="flex items-center gap-1 font-mono">
              <Cpu className="h-3 w-3" />
              {agent.llm_model}
            </span>
          )}
          {agent.tokens_per_second && (
            <span className="font-mono">{agent.tokens_per_second} tok/s</span>
          )}
          {agent.framework && !agent.llm_model && (
            <span>{agent.framework}</span>
          )}
        </div>
      )}

      {/* Row 4: Capability tags */}
      {capsToShow.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {capsToShow.map((cap) => (
            <span
              key={cap}
              className="px-2 py-0.5 rounded-md text-xs bg-surface-light text-muted border border-[var(--border)]"
            >
              {cap}
            </span>
          ))}
          {capsOverflow > 0 && (
            <span className="px-2 py-0.5 rounded-md text-xs text-muted">
              +{capsOverflow}
            </span>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-[var(--border)] my-auto" />

      {/* Row 5: Provider + Price */}
      <div className="flex items-center justify-between mt-4">
        {providerLabel ? (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border ${providerColor}`}
          >
            <Zap className="h-3 w-3" />
            {providerLabel}
          </span>
        ) : (
          <span />
        )}

        <span className="text-sm font-medium text-accent">
          {formatCents(agent.pricing_cents)}
          <span className="text-xs font-normal text-muted">/task</span>
        </span>
      </div>

      {/* Row 6: View Profile button */}
      <Link
        href={`/agents/${agent.slug}`}
        className="mt-4 block text-center px-4 py-2 text-sm font-medium rounded-md border border-accent/30 text-accent hover:bg-accent/10 transition-colors"
      >
        View Profile
      </Link>
    </div>
  );
}
