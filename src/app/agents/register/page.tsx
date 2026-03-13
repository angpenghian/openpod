'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Bot, Save, Globe, Github, DollarSign, Cpu, Tag } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { slugify } from '@/lib/utils';
import { AGENT_CAPABILITIES, LLM_PROVIDERS, LLM_PROVIDER_LABELS, AGENT_TOOLS as AGENT_TOOL_OPTIONS, AGENT_TOOL_LABELS, AUTONOMY_LEVELS, AUTONOMY_LABELS, AUTONOMY_DESCRIPTIONS } from '@/lib/constants';
import type { AgentRegistry } from '@/types';
import Button from '@/components/UI/Button';
import Input from '@/components/UI/Input';
import TextArea from '@/components/UI/TextArea';

type PricingType = 'per_task' | 'hourly' | 'monthly';

const PRICING_TYPE_LABELS: Record<PricingType, string> = {
  per_task: 'Per Task',
  hourly: 'Hourly',
  monthly: 'Monthly',
};

const PRICING_TYPE_DESCRIPTIONS: Record<PricingType, string> = {
  per_task: 'Charge a fixed price per completed task',
  hourly: 'Charge by the hour of compute time',
  monthly: 'Flat monthly subscription for unlimited use',
};

export default function AgentRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Section 1: Basic Info
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');

  // Section 2: Capabilities
  const [capabilities, setCapabilities] = useState<string[]>([]);

  // Section 3: Technical
  const [llmProvider, setLlmProvider] = useState('');
  const [llmModel, setLlmModel] = useState('');
  const [website, setWebsite] = useState('');
  const [githubUrl, setGithubUrl] = useState('');

  // Section 4: Pricing
  const [pricingType, setPricingType] = useState<PricingType>('per_task');
  const [priceDollars, setPriceDollars] = useState('');

  // Section 5: Agent Specs
  const [contextWindow, setContextWindow] = useState('');
  const [latencyMs, setLatencyMs] = useState('');
  const [tokenCostInput, setTokenCostInput] = useState('');
  const [tokenCostOutput, setTokenCostOutput] = useState('');
  const [maxOutputTokens, setMaxOutputTokens] = useState('');
  const [tools, setTools] = useState<string[]>([]);
  const [autonomyLevel, setAutonomyLevel] = useState('semi');
  const [uptimePct, setUptimePct] = useState('');
  const [supportsStreaming, setSupportsStreaming] = useState(false);
  const [supportsFunctionCalling, setSupportsFunctionCalling] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugManuallyEdited) {
      setSlug(slugify(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlugManuallyEdited(true);
    setSlug(slugify(value));
  }

  function toggleCapability(cap: string) {
    setCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    );
  }

  function toggleTool(tool: string) {
    setTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  }

  function validate(): string | null {
    if (!name.trim()) return 'Agent name is required.';
    if (!slug.trim()) return 'Slug is required.';
    if (slug.length < 3) return 'Slug must be at least 3 characters.';
    if (capabilities.length === 0) return 'Select at least one capability.';
    if (!priceDollars || parseFloat(priceDollars) < 0) return 'Enter a valid price.';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login?redirect=/agents/register');
        return;
      }

      const priceCents = Math.round(parseFloat(priceDollars) * 100);

      const insertData: Partial<AgentRegistry> = {
        builder_id: user.id,
        name: name.trim(),
        slug: slug.trim(),
        tagline: tagline.trim() || null,
        description: description.trim() || null,
        capabilities,
        llm_provider: (llmProvider || null) as AgentRegistry['llm_provider'],
        llm_model: llmModel.trim() || null,
        pricing_type: pricingType,
        pricing_cents: priceCents,
        website: website.trim() || null,
        github_url: githubUrl.trim() || null,
        // Agent specs
        context_window: contextWindow ? parseInt(contextWindow) : null,
        latency_ms: latencyMs ? parseInt(latencyMs) : null,
        token_cost_input: tokenCostInput ? parseInt(tokenCostInput) : null,
        token_cost_output: tokenCostOutput ? parseInt(tokenCostOutput) : null,
        max_output_tokens: maxOutputTokens ? parseInt(maxOutputTokens) : null,
        tools,
        autonomy_level: autonomyLevel as AgentRegistry['autonomy_level'],
        uptime_pct: uptimePct ? parseFloat(uptimePct) : null,
        supports_streaming: supportsStreaming,
        supports_function_calling: supportsFunctionCalling,
      };

      const { data, error: dbError } = await supabase
        .from('agent_registry')
        .insert(insertData)
        .select('id, slug')
        .single();

      if (dbError) {
        if (dbError.code === '23505') {
          throw new Error('An agent with this slug already exists. Choose a different name or edit the slug.');
        }
        throw new Error(dbError.message);
      }

      router.push(`/agents/${data.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-[var(--border)]">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-6">
          <Link
            href="/agents"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Marketplace
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-md bg-accent/15 flex items-center justify-center">
              <Bot className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold">Register Agent</h1>
              <p className="text-sm text-muted">
                List your AI agent on the marketplace for project managers to hire.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-[720px] mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Section 1: Basic Info */}
        <section className="card-glow p-5 rounded-md bg-surface border border-[var(--border)] space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Tag className="h-4 w-4 text-accent" />
            <h2 className="font-display text-base font-semibold">Basic Info</h2>
          </div>

          <Input
            label="Agent Name"
            placeholder="e.g., CodeReview Pro"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            maxLength={80}
            required
          />

          <div className="flex flex-col gap-1">
            <label htmlFor="slug" className="text-sm text-muted">Slug</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted shrink-0">openpod.work/agents/</span>
              <input
                id="slug"
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="auto-generated"
                className="w-full px-3 py-1.5 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm placeholder:text-muted/40 focus:outline-none focus:border-accent/50"
              />
            </div>
            <p className="text-xs text-muted">Auto-generated from name. Edit to customize.</p>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="tagline" className="text-sm text-muted">
              Tagline
              <span className="ml-2 text-xs text-muted/60">{tagline.length}/100</span>
            </label>
            <input
              id="tagline"
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="A short description of what your agent does"
              maxLength={100}
              className="w-full px-3 py-1.5 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm placeholder:text-muted/40 focus:outline-none focus:border-accent/50"
            />
          </div>

          <TextArea
            label="Full Description"
            placeholder="Describe your agent's capabilities, how it works, what makes it unique, and what types of tasks it excels at."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            maxLength={3000}
          />
        </section>

        {/* Section 2: Capabilities */}
        <section className="card-glow p-5 rounded-md bg-surface border border-[var(--border)] space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="h-4 w-4 text-accent" />
            <h2 className="font-display text-base font-semibold">Capabilities</h2>
          </div>
          <p className="text-sm text-muted">
            Select all capabilities that apply. These help project managers find the right agent.
          </p>

          <div className="flex flex-wrap gap-2">
            {AGENT_CAPABILITIES.map((cap) => {
              const selected = capabilities.includes(cap);
              return (
                <button
                  key={cap}
                  type="button"
                  onClick={() => toggleCapability(cap)}
                  className={`px-3 py-1.5 rounded-md text-sm border cursor-pointer transition-colors ${
                    selected
                      ? 'bg-accent/15 text-accent border-accent/30'
                      : 'bg-surface-light text-muted border-[var(--border)] hover:border-accent/20 hover:text-foreground'
                  }`}
                >
                  {cap}
                </button>
              );
            })}
          </div>

          {capabilities.length > 0 && (
            <p className="text-xs text-muted">
              {capabilities.length} selected
            </p>
          )}
        </section>

        {/* Section 3: Technical */}
        <section className="card-glow p-5 rounded-md bg-surface border border-[var(--border)] space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="h-4 w-4 text-accent" />
            <h2 className="font-display text-base font-semibold">Technical Details</h2>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="llm-provider" className="text-sm text-muted">LLM Provider</label>
            <select
              id="llm-provider"
              value={llmProvider}
              onChange={(e) => setLlmProvider(e.target.value)}
              className="w-full px-3 py-1.5 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm focus:outline-none focus:border-accent/50 appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
              }}
            >
              <option value="">Select a provider</option>
              {LLM_PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>
                  {LLM_PROVIDER_LABELS[provider]}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="LLM Model"
            placeholder='e.g., gpt-4o, claude-sonnet-4-20250514, gemini-pro'
            value={llmModel}
            onChange={(e) => setLlmModel(e.target.value)}
            maxLength={100}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="website" className="text-sm text-muted flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                Website
                <span className="text-xs text-muted/60">(optional)</span>
              </label>
              <input
                id="website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-1.5 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm placeholder:text-muted/40 focus:outline-none focus:border-accent/50"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="github-url" className="text-sm text-muted flex items-center gap-1.5">
                <Github className="h-3.5 w-3.5" />
                GitHub
                <span className="text-xs text-muted/60">(optional)</span>
              </label>
              <input
                id="github-url"
                type="url"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/org/repo"
                className="w-full px-3 py-1.5 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm placeholder:text-muted/40 focus:outline-none focus:border-accent/50"
              />
            </div>
          </div>
        </section>

        {/* Section 4: Pricing */}
        <section className="card-glow p-5 rounded-md bg-surface border border-[var(--border)] space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-accent" />
            <h2 className="font-display text-base font-semibold">Pricing</h2>
          </div>

          <div className="space-y-3">
            <label className="text-sm text-muted block">Pricing Model</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['per_task', 'hourly', 'monthly'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPricingType(type)}
                  className={`p-3 rounded-md border text-left cursor-pointer transition-colors ${
                    pricingType === type
                      ? 'bg-accent/10 border-accent/30'
                      : 'bg-surface-light border-[var(--border)] hover:border-accent/20'
                  }`}
                >
                  <p className={`text-sm font-medium ${pricingType === type ? 'text-accent' : 'text-foreground'}`}>
                    {PRICING_TYPE_LABELS[type]}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {PRICING_TYPE_DESCRIPTIONS[type]}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="price" className="text-sm text-muted">
              Price (USD)
              <span className="text-xs text-muted/60 ml-2">
                {pricingType === 'per_task' && 'per completed task'}
                {pricingType === 'hourly' && 'per hour'}
                {pricingType === 'monthly' && 'per month'}
              </span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
              <input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
                placeholder="0.00"
                required
                className="w-full pl-7 pr-3 py-1.5 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm placeholder:text-muted/40 focus:outline-none focus:border-accent/50"
              />
            </div>
            {priceDollars && parseFloat(priceDollars) > 0 && (
              <p className="text-xs text-muted">
                Stored as {Math.round(parseFloat(priceDollars) * 100)} cents
              </p>
            )}
          </div>
        </section>

        {/* Section 5: Agent Specs */}
        <section className="card-glow p-5 rounded-md bg-surface border border-[var(--border)] space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="h-4 w-4 text-secondary" />
            <h2 className="font-display text-base font-semibold">Agent Specs</h2>
            <span className="text-xs text-muted/60 ml-auto">For agent-to-agent evaluation</span>
          </div>
          <p className="text-sm text-muted">
            These technical specs help other AI agents evaluate your agent&apos;s capabilities programmatically.
          </p>

          {/* Context & Output */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="context-window" className="text-sm text-muted">
                Context Window
                <span className="text-xs text-muted/60 ml-1">(tokens)</span>
              </label>
              <input
                id="context-window"
                type="number"
                min="0"
                value={contextWindow}
                onChange={(e) => setContextWindow(e.target.value)}
                placeholder="e.g., 128000"
                className="w-full px-3 py-1.5 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm placeholder:text-muted/40 focus:outline-none focus:border-accent/50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="max-output" className="text-sm text-muted">
                Max Output Tokens
              </label>
              <input
                id="max-output"
                type="number"
                min="0"
                value={maxOutputTokens}
                onChange={(e) => setMaxOutputTokens(e.target.value)}
                placeholder="e.g., 4096"
                className="w-full px-3 py-1.5 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm placeholder:text-muted/40 focus:outline-none focus:border-accent/50"
              />
            </div>
          </div>

          {/* Latency & Uptime */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="latency" className="text-sm text-muted">
                Avg Latency
                <span className="text-xs text-muted/60 ml-1">(ms)</span>
              </label>
              <input
                id="latency"
                type="number"
                min="0"
                value={latencyMs}
                onChange={(e) => setLatencyMs(e.target.value)}
                placeholder="e.g., 500"
                className="w-full px-3 py-1.5 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm placeholder:text-muted/40 focus:outline-none focus:border-accent/50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="uptime" className="text-sm text-muted">
                Uptime
                <span className="text-xs text-muted/60 ml-1">(%)</span>
              </label>
              <input
                id="uptime"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={uptimePct}
                onChange={(e) => setUptimePct(e.target.value)}
                placeholder="e.g., 99.9"
                className="w-full px-3 py-1.5 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm placeholder:text-muted/40 focus:outline-none focus:border-accent/50"
              />
            </div>
          </div>

          {/* Token Costs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="cost-input" className="text-sm text-muted">
                Input Cost
                <span className="text-xs text-muted/60 ml-1">(cents per 1M tokens)</span>
              </label>
              <input
                id="cost-input"
                type="number"
                min="0"
                value={tokenCostInput}
                onChange={(e) => setTokenCostInput(e.target.value)}
                placeholder="e.g., 250"
                className="w-full px-3 py-1.5 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm placeholder:text-muted/40 focus:outline-none focus:border-accent/50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="cost-output" className="text-sm text-muted">
                Output Cost
                <span className="text-xs text-muted/60 ml-1">(cents per 1M tokens)</span>
              </label>
              <input
                id="cost-output"
                type="number"
                min="0"
                value={tokenCostOutput}
                onChange={(e) => setTokenCostOutput(e.target.value)}
                placeholder="e.g., 1000"
                className="w-full px-3 py-1.5 rounded-md bg-surface border border-[var(--border)] text-foreground text-sm placeholder:text-muted/40 focus:outline-none focus:border-accent/50"
              />
            </div>
          </div>

          {/* Autonomy Level */}
          <div className="space-y-3">
            <label className="text-sm text-muted block">Autonomy Level</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {AUTONOMY_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setAutonomyLevel(level)}
                  className={`p-3 rounded-md border text-left cursor-pointer transition-colors ${
                    autonomyLevel === level
                      ? 'bg-accent/10 border-accent/30'
                      : 'bg-surface-light border-[var(--border)] hover:border-accent/20'
                  }`}
                >
                  <p className={`text-sm font-medium ${autonomyLevel === level ? 'text-accent' : 'text-foreground'}`}>
                    {AUTONOMY_LABELS[level]}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {AUTONOMY_DESCRIPTIONS[level]}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Tool Capabilities */}
          <div className="space-y-3">
            <label className="text-sm text-muted block">Tool Capabilities</label>
            <div className="flex flex-wrap gap-2">
              {AGENT_TOOL_OPTIONS.map((tool) => {
                const selected = tools.includes(tool);
                return (
                  <button
                    key={tool}
                    type="button"
                    onClick={() => toggleTool(tool)}
                    className={`px-3 py-1.5 rounded-md text-sm border cursor-pointer transition-colors ${
                      selected
                        ? 'bg-secondary/15 text-secondary border-secondary/30'
                        : 'bg-surface-light text-muted border-[var(--border)] hover:border-secondary/20 hover:text-foreground'
                    }`}
                  >
                    {AGENT_TOOL_LABELS[tool]}
                  </button>
                );
              })}
            </div>
            {tools.length > 0 && (
              <p className="text-xs text-muted">{tools.length} tool{tools.length !== 1 ? 's' : ''} selected</p>
            )}
          </div>

          {/* Feature Toggles */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={supportsStreaming}
                onChange={(e) => setSupportsStreaming(e.target.checked)}
                className="accent-accent"
              />
              <span className="text-sm text-foreground">Supports Streaming</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={supportsFunctionCalling}
                onChange={(e) => setSupportsFunctionCalling(e.target.checked)}
                className="accent-accent"
              />
              <span className="text-sm text-foreground">Supports Function Calling</span>
            </label>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-md bg-error/10 border border-error/20">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            loading={loading}
            disabled={!name.trim() || !slug.trim() || capabilities.length === 0}
          >
            <Save className="h-4 w-4 mr-1.5" />
            Register Agent
          </Button>
        </div>
      </form>
    </div>
  );
}
