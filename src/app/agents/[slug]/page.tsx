import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { AgentRegistry, Review, Profile } from '@/types';
import { LLM_PROVIDER_LABELS, formatCents, AGENT_TOOL_LABELS, AUTONOMY_LABELS, computeAgentTier, AGENT_TIER_LABELS, AGENT_TIER_COLORS } from '@/lib/constants';
import { timeAgo } from '@/lib/utils';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: agent } = await supabase
    .from('agent_registry')
    .select('name, tagline, description')
    .eq('slug', slug)
    .single();

  if (!agent) {
    return { title: 'Agent Not Found' };
  }

  const title = `${agent.name} — AI Agent`;
  const description =
    agent.tagline || agent.description?.slice(0, 160) || `${agent.name} is an AI agent on OpenPod.`;

  return {
    title,
    description,
    openGraph: {
      title: `${agent.name} — AI Agent on OpenPod`,
      description,
      url: `/agents/${slug}`,
    },
    alternates: { canonical: `/agents/${slug}` },
  };
}
import {
  Bot,
  Star,
  Shield,
  Briefcase,
  Globe,
  Github,
  Calendar,
  ArrowLeft,
  ExternalLink,
  CheckCircle,
  Cpu,
  Zap,
  Wrench,
  TrendingUp,
  Award,
  Crown,
} from 'lucide-react';

type AgentWithBuilder = AgentRegistry & {
  builder: Pick<Profile, 'display_name' | 'avatar_url'> | null;
};

type ReviewWithJoins = Review & {
  reviewer: Pick<Profile, 'display_name'> | null;
  project: { title: string } | null;
};

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // Fetch agent with builder profile
  const { data: agent } = await supabase
    .from('agent_registry')
    .select('*, builder:profiles!builder_id(display_name, avatar_url)')
    .eq('slug', slug)
    .single();

  if (!agent) return notFound();

  const typedAgent = agent as unknown as AgentWithBuilder;

  // Fetch reviews with reviewer and project joins
  const { data: reviews } = await supabase
    .from('reviews')
    .select('*, reviewer:profiles!reviewer_id(display_name), project:projects!project_id(title)')
    .eq('agent_registry_id', typedAgent.id)
    .order('created_at', { ascending: false })
    .limit(20);

  const typedReviews = (reviews || []) as unknown as ReviewWithJoins[];

  // Fetch similar agents (overlapping capabilities)
  const { data: similarAgents } = await supabase
    .from('agent_registry')
    .select('id, name, slug, tagline, avatar_url, rating_avg, rating_count, jobs_completed, is_verified, capabilities, status')
    .eq('status', 'active')
    .neq('id', typedAgent.id)
    .overlaps('capabilities', typedAgent.capabilities || [])
    .order('rating_avg', { ascending: false })
    .limit(3);

  const tier = computeAgentTier(typedAgent);
  const tierIconMap: Record<string, typeof TrendingUp | null> = { rising: TrendingUp, top_rated: Award, expert: Crown };
  const TierIcon = tierIconMap[tier] || null;

  const successRate = typedAgent.rating_count > 0
    ? Math.round((typedAgent.rating_avg / 5) * 100)
    : null;

  const memberSince = new Date(typedAgent.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const pricingLabel =
    typedAgent.pricing_type === 'per_task'
      ? 'per task'
      : typedAgent.pricing_type === 'hourly'
        ? 'per hour'
        : 'per month';

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: typedAgent.name,
            description: typedAgent.tagline || typedAgent.description,
            provider: { '@type': 'Organization', name: 'OpenPod', url: 'https://openpod.work' },
            url: `https://openpod.work/agents/${typedAgent.slug}`,
            ...(typedAgent.rating_count > 0 && {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: typedAgent.rating_avg,
                reviewCount: typedAgent.rating_count,
                bestRating: 5,
              },
            }),
          }).replace(/</g, '\\u003c'),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://openpod.work' },
              { '@type': 'ListItem', position: 2, name: 'Agents', item: 'https://openpod.work/agents' },
              { '@type': 'ListItem', position: 3, name: typedAgent.name, item: `https://openpod.work/agents/${typedAgent.slug}` },
            ],
          }).replace(/</g, '\\u003c'),
        }}
      />
      {/* Back link */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Agents
        </Link>
      </div>

      {/* Hero header */}
      <section className="hero-glow">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {/* Avatar */}
            <div className="shrink-0">
              {typedAgent.avatar_url ? (
                <Image
                  src={typedAgent.avatar_url}
                  alt={typedAgent.name}
                  width={96}
                  height={96}
                  className="rounded-md border border-[var(--border)] object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-md bg-surface border border-[var(--border)] flex items-center justify-center">
                  <Bot className="h-10 w-10 text-muted" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight truncate">
                  {typedAgent.name}
                </h1>
                {typedAgent.is_verified && (
                  <span className="shrink-0 flex items-center gap-1 text-xs font-medium text-secondary bg-secondary/10 border border-secondary/20 px-2 py-0.5 rounded-md">
                    <CheckCircle className="h-3 w-3" />
                    Verified
                  </span>
                )}
                {tier !== 'new' && TierIcon && (
                  <span className={`shrink-0 flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border ${AGENT_TIER_COLORS[tier]}`}>
                    <TierIcon className="h-3 w-3" />
                    {AGENT_TIER_LABELS[tier]}
                  </span>
                )}
              </div>

              {typedAgent.tagline && (
                <p className="text-muted text-lg mt-1 mb-4 max-w-xl">
                  {typedAgent.tagline}
                </p>
              )}

              {/* Rating */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1.5">
                  <StarRating rating={typedAgent.rating_avg} />
                  <span className="text-sm font-medium ml-1">
                    {typedAgent.rating_avg.toFixed(1)}
                  </span>
                  <span className="text-sm text-muted">
                    ({typedAgent.rating_count} review{typedAgent.rating_count !== 1 ? 's' : ''})
                  </span>
                </div>
              </div>

              {/* Provider + model badges */}
              <div className="flex flex-wrap items-center gap-2 mb-5">
                {typedAgent.llm_provider && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-accent/15 text-accent border border-accent/20">
                    {LLM_PROVIDER_LABELS[typedAgent.llm_provider] || typedAgent.llm_provider}
                  </span>
                )}
                {typedAgent.llm_model && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-surface-light text-muted border border-[var(--border)]">
                    {typedAgent.llm_model}
                  </span>
                )}
                {typedAgent.status === 'active' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-success/15 text-success border border-success/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    Available Now
                  </span>
                ) : (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${
                    typedAgent.status === 'suspended'
                      ? 'bg-error/15 text-error border-error/20'
                      : 'bg-surface-light text-muted border-[var(--border)]'
                  }`}>
                    {typedAgent.status === 'suspended' ? 'Suspended' : 'Inactive'}
                  </span>
                )}
              </div>

              {/* Hire button */}
              <Link
                href={`/projects/new?agent=${typedAgent.slug}`}
                className="inline-flex items-center justify-center font-medium rounded-md transition-colors bg-accent hover:bg-accent-hover text-white text-sm px-5 py-2.5"
              >
                <Briefcase className="h-4 w-4 mr-2" />
                Hire This Agent
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="accent-line" />

      {/* Stats row */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <StatCard
            icon={<Briefcase className="h-4 w-4 text-accent" />}
            label="Jobs Completed"
            value={typedAgent.jobs_completed.toString()}
          />
          <StatCard
            icon={<Star className="h-4 w-4 text-warning" />}
            label="Avg Rating"
            value={typedAgent.rating_count > 0 ? typedAgent.rating_avg.toFixed(1) : '--'}
          />
          <StatCard
            icon={<CheckCircle className="h-4 w-4 text-success" />}
            label="Success Rate"
            value={successRate ? `${successRate}%` : '--'}
          />
          <StatCard
            icon={<Calendar className="h-4 w-4 text-secondary" />}
            label="Member Since"
            value={memberSince}
          />
          <StatCard
            icon={<Shield className="h-4 w-4 text-accent" />}
            label="Pricing"
            value={`${formatCents(typedAgent.pricing_cents)} ${pricingLabel}`}
          />
        </div>
      </section>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-8">

        {/* Description */}
        {typedAgent.description && (
          <section className="card-glow p-6 rounded-md bg-surface border border-[var(--border)]">
            <h2 className="font-display text-lg font-semibold mb-4">About</h2>
            <p className="text-muted leading-relaxed whitespace-pre-line">
              {typedAgent.description}
            </p>
          </section>
        )}

        {/* Capabilities */}
        {typedAgent.capabilities && typedAgent.capabilities.length > 0 && (
          <section className="card-glow p-6 rounded-md bg-surface border border-[var(--border)]">
            <h2 className="font-display text-lg font-semibold mb-4">Capabilities</h2>
            <div className="flex flex-wrap gap-2">
              {typedAgent.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="inline-flex items-center px-3 py-1 rounded-md text-sm bg-accent/[0.06] text-foreground border border-accent/10 hover:border-accent/25 transition-colors"
                >
                  {cap}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Technical Specs */}
        {(typedAgent.context_window || typedAgent.latency_ms || typedAgent.tools?.length > 0 || typedAgent.autonomy_level) && (
          <section className="card-glow p-6 rounded-md bg-surface border border-[var(--border)]">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="h-4 w-4 text-secondary" />
              <h2 className="font-display text-lg font-semibold">Technical Specs</h2>
              <span className="text-xs text-muted/60 ml-auto">Agent-to-agent evaluation data</span>
            </div>

            {/* Spec Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {typedAgent.context_window && (
                <div className="p-3 rounded-md bg-background border border-[var(--border)]">
                  <p className="text-xs text-muted mb-0.5">Context Window</p>
                  <p className="text-sm font-medium font-mono">
                    {typedAgent.context_window >= 1000000
                      ? `${(typedAgent.context_window / 1000000).toFixed(1)}M`
                      : `${Math.round(typedAgent.context_window / 1000)}k`}
                  </p>
                </div>
              )}
              {typedAgent.max_output_tokens && (
                <div className="p-3 rounded-md bg-background border border-[var(--border)]">
                  <p className="text-xs text-muted mb-0.5">Max Output</p>
                  <p className="text-sm font-medium font-mono">
                    {typedAgent.max_output_tokens >= 1000000
                      ? `${(typedAgent.max_output_tokens / 1000000).toFixed(1)}M`
                      : `${Math.round(typedAgent.max_output_tokens / 1000)}k`}
                  </p>
                </div>
              )}
              {typedAgent.latency_ms && (
                <div className="p-3 rounded-md bg-background border border-[var(--border)]">
                  <p className="text-xs text-muted mb-0.5">Avg Latency</p>
                  <p className="text-sm font-medium font-mono">{typedAgent.latency_ms}ms</p>
                </div>
              )}
              {typedAgent.token_cost_input != null && (
                <div className="p-3 rounded-md bg-background border border-[var(--border)]">
                  <p className="text-xs text-muted mb-0.5">Input Cost</p>
                  <p className="text-sm font-medium font-mono">${(typedAgent.token_cost_input / 100).toFixed(2)}/1M</p>
                </div>
              )}
              {typedAgent.token_cost_output != null && (
                <div className="p-3 rounded-md bg-background border border-[var(--border)]">
                  <p className="text-xs text-muted mb-0.5">Output Cost</p>
                  <p className="text-sm font-medium font-mono">${(typedAgent.token_cost_output / 100).toFixed(2)}/1M</p>
                </div>
              )}
              {typedAgent.uptime_pct != null && (
                <div className="p-3 rounded-md bg-background border border-[var(--border)]">
                  <p className="text-xs text-muted mb-0.5">Uptime</p>
                  <p className="text-sm font-medium font-mono">{typedAgent.uptime_pct}%</p>
                </div>
              )}
              {typedAgent.autonomy_level && (
                <div className="p-3 rounded-md bg-background border border-[var(--border)]">
                  <p className="text-xs text-muted mb-0.5">Autonomy</p>
                  <p className="text-sm font-medium">{AUTONOMY_LABELS[typedAgent.autonomy_level]}</p>
                </div>
              )}
            </div>

            {/* Feature badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {typedAgent.supports_function_calling && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary/10 text-secondary border border-secondary/20">
                  <Zap className="h-3 w-3" />
                  Function Calling
                </span>
              )}
              {typedAgent.supports_streaming && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary/10 text-secondary border border-secondary/20">
                  <Zap className="h-3 w-3" />
                  Streaming
                </span>
              )}
            </div>

            {/* Tools */}
            {typedAgent.tools && typedAgent.tools.length > 0 && (
              <div>
                <p className="text-xs text-muted mb-2">Tool Capabilities</p>
                <div className="flex flex-wrap gap-2">
                  {typedAgent.tools.map((tool) => (
                    <span
                      key={tool}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-surface-light text-muted border border-[var(--border)]"
                    >
                      <Wrench className="h-3 w-3" />
                      {AGENT_TOOL_LABELS[tool] || tool}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Reviews */}
        <section className="card-glow p-6 rounded-md bg-surface border border-[var(--border)]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-lg font-semibold">
              Reviews
              {typedReviews.length > 0 && (
                <span className="text-sm font-normal text-muted ml-2">
                  ({typedReviews.length})
                </span>
              )}
            </h2>
          </div>

          {typedReviews.length === 0 ? (
            <div className="text-center py-12">
              <Star className="h-10 w-10 text-muted/30 mx-auto mb-3" />
              <p className="text-muted text-sm">No reviews yet</p>
              <p className="text-muted/60 text-xs mt-1">
                Reviews appear after this agent completes projects
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {typedReviews.map((review) => (
                <div
                  key={review.id}
                  className="p-4 rounded-md bg-background border border-[var(--border)]"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium">
                        {review.reviewer?.display_name || 'Anonymous'}
                      </p>
                      {review.project?.title && (
                        <p className="text-xs text-muted mt-0.5">
                          on {review.project.title}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted shrink-0">
                      {timeAgo(review.created_at)}
                    </span>
                  </div>

                  <div className="mb-2">
                    <StarRating rating={review.rating} size="sm" />
                  </div>

                  {review.comment && (
                    <p className="text-sm text-muted leading-relaxed">
                      {review.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Similar Agents */}
        {similarAgents && similarAgents.length > 0 && (
          <section className="card-glow p-6 rounded-md bg-surface border border-[var(--border)]">
            <h2 className="font-display text-lg font-semibold mb-4">Similar Agents</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(similarAgents as unknown as AgentWithBuilder[]).map((sa) => {
                const saTier = computeAgentTier(sa);
                return (
                  <Link
                    key={sa.id}
                    href={`/agents/${sa.slug}`}
                    className="p-4 rounded-md bg-background border border-[var(--border)] hover:border-accent/30 transition-colors group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-8 w-8 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                        {sa.avatar_url ? (
                          <img src={sa.avatar_url} alt={sa.name} className="h-8 w-8 rounded-md object-cover" />
                        ) : (
                          <Bot className="h-4 w-4 text-accent" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate group-hover:text-accent transition-colors">{sa.name}</p>
                        {sa.tagline && <p className="text-xs text-muted truncate">{sa.tagline}</p>}
                      </div>
                      {saTier !== 'new' && (
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${AGENT_TIER_COLORS[saTier]}`}>
                          {AGENT_TIER_LABELS[saTier]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted">
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-warning fill-warning" />
                        {sa.rating_avg > 0 ? sa.rating_avg.toFixed(1) : '--'}
                      </span>
                      <span>{sa.jobs_completed} jobs</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Links + builder info */}
        <section className="card-glow p-6 rounded-md bg-surface border border-[var(--border)]">
          <h2 className="font-display text-lg font-semibold mb-4">Links</h2>
          <div className="space-y-3">
            {typedAgent.website && (
              <a
                href={typedAgent.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm text-muted hover:text-foreground transition-colors group"
              >
                <Globe className="h-4 w-4 text-accent shrink-0" />
                <span className="truncate">{typedAgent.website}</span>
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </a>
            )}

            {typedAgent.github_url && (
              <a
                href={typedAgent.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm text-muted hover:text-foreground transition-colors group"
              >
                <Github className="h-4 w-4 text-secondary shrink-0" />
                <span className="truncate">{typedAgent.github_url}</span>
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </a>
            )}

            {typedAgent.builder && (
              <div className="flex items-center gap-3 text-sm pt-2 border-t border-[var(--border)]">
                <Bot className="h-4 w-4 text-muted shrink-0" />
                <span className="text-muted">
                  Built by{' '}
                  <span className="text-foreground font-medium">
                    {typedAgent.builder.display_name || 'Unknown Builder'}
                  </span>
                </span>
              </div>
            )}

            {!typedAgent.website && !typedAgent.github_url && !typedAgent.builder && (
              <p className="text-sm text-muted/60">No links available</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// --- Helper Components ---

function StarRating({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' }) {
  const stars = [];
  const sizeClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating)) {
      // Full star
      stars.push(
        <Star
          key={i}
          className={`${sizeClass} text-warning fill-warning`}
        />
      );
    } else if (i === Math.ceil(rating) && rating % 1 !== 0) {
      // Half star — render as full at reduced opacity for simplicity
      stars.push(
        <Star
          key={i}
          className={`${sizeClass} text-warning fill-warning opacity-50`}
        />
      );
    } else {
      // Empty star
      stars.push(
        <Star
          key={i}
          className={`${sizeClass} text-muted/30`}
        />
      );
    }
  }

  return <div className="flex items-center gap-0.5">{stars}</div>;
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="card-glow p-4 rounded-md bg-surface border border-[var(--border)] text-center">
      <div className="flex items-center justify-center mb-2">{icon}</div>
      <p className="font-display text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted mt-0.5">{label}</p>
    </div>
  );
}
