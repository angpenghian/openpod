/**
 * Live LLM simulation orchestrator.
 * Manages agent lifecycle, OpenAI calls, and work loop.
 *
 * Phases:
 *   1. Setup — create SIM agent keys (is_active: true) via admin client
 *   2. PM Planning — GPT-4o-mini creates positions, tickets, chat, knowledge via real API
 *   3. Auto-hire — create agent keys per position, assign workers to leads
 *   4. Work Loop — each agent takes turns using real API + GitHub
 *   5. Cleanup — set all SIM keys to is_active: false
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashApiKey } from '@/lib/agent-auth';
import { OPENPOD_TOOLS, GITHUB_TOOLS, executeApiTool, type ToolContext } from './tools';

const MODEL = 'gpt-4o-mini';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SimulationAgent {
  id: string;          // agent_keys.id
  apiKey: string;      // plaintext openpod_* key (kept in memory only)
  name: string;        // display name e.g. "SIM-Frontend Lead"
  roleTitle: string;   // position title e.g. "Frontend Lead"
  roleLevel: string;   // 'project_manager' | 'lead' | 'worker'
  positionId: string;
}

export interface SimulationEvent {
  type: 'system' | 'thinking' | 'action' | 'error' | 'refresh' | 'round' | 'done' | 'keepalive';
  agent: string;
  action: string;
  round?: number;
}

export interface SimulationConfig {
  projectId: string;
  project: { id: string; title: string; description: string };
  maxRounds: number;
  baseUrl: string;
  openaiApiKey: string;
  userId: string;
  github: { token: string; owner: string; repo: string; installationId: number } | null;
  onEvent: (event: SimulationEvent) => void;
  signal: AbortSignal;
}

// ─── Role Descriptions ──────────────────────────────────────────────────────

const ROLE_DESCRIPTIONS: Record<string, string> = {
  'frontend lead': 'You own the frontend — UI architecture, component system, state management, and UX quality. Review frontend work and coordinate with Design and Backend.',
  'backend lead': 'You own backend systems — API design, database architecture, server logic, and integrations. Review backend PRs and coordinate API contracts with Frontend.',
  'design lead': 'You own UX — research, wireframes, design system, and usability. Create design specs and review implemented UI.',
  'devops lead': 'You own infrastructure — CI/CD, cloud resources, monitoring, and deployments.',
  'qa lead': 'You own quality — test strategy, test infrastructure, and release readiness.',
  'data lead': 'You own data infrastructure — pipelines, analytics, ML systems, and data quality.',
  'security lead': 'You own security — threat modeling, code review for vulnerabilities, access controls, and compliance.',
  'frontend': 'You build UI — components, pages, interactions, responsive design. You turn designs into working, accessible code.',
  'backend': 'You build server-side logic — APIs, database queries, business logic, integrations.',
  'fullstack': 'You work across the full stack — frontend UI, backend APIs, database. You own features end-to-end.',
  'designer': 'You create the UX — wireframes, mockups, prototypes, design system specs. You do NOT write application code.',
  'qa': 'You ensure quality — test plans, test execution, bug reports, fix verification.',
  'devops': 'You build infrastructure — CI/CD pipelines, cloud resources, monitoring, deployment automation.',
  'security': 'You secure the system — vulnerability assessment, security reviews, penetration testing, hardening.',
  'ml': 'You build ML systems — data pipelines, model training, evaluation, deployment.',
  'documentation': 'You write docs — API documentation, user guides, architecture docs. You do NOT write application code.',
  'database': 'You manage databases — schema design, query optimization, migrations, backups.',
  'mobile': 'You build mobile apps — native or cross-platform. Handle mobile UX, device APIs, app store requirements.',
};

function getRoleDescription(title: string, roleLevel: string): string {
  const t = title.toLowerCase();
  if (roleLevel === 'lead' || roleLevel === 'project_manager') {
    for (const [key, desc] of Object.entries(ROLE_DESCRIPTIONS)) {
      if (key.endsWith(' lead') && t.includes(key.replace(' lead', ''))) return desc;
    }
    return 'You are a department lead — manage your team, review their work, and coordinate deliverables.';
  }
  if (/\b(ui\/?ux|ux\/?ui|designer|design)\b/.test(t)) return ROLE_DESCRIPTIONS.designer;
  if (/\b(qa|quality|test)\b/.test(t)) return ROLE_DESCRIPTIONS.qa;
  if (/\b(devops|ci\/?cd|sre|reliability)\b/.test(t)) return ROLE_DESCRIPTIONS.devops;
  if (/\b(security|pentest)\b/.test(t)) return ROLE_DESCRIPTIONS.security;
  if (/\b(ml|machine.?learn|data.?scien)\b/.test(t)) return ROLE_DESCRIPTIONS.ml;
  if (/\b(doc|writer|technical.?writ)\b/.test(t)) return ROLE_DESCRIPTIONS.documentation;
  if (/\b(dba|database.?admin)\b/.test(t)) return ROLE_DESCRIPTIONS.database;
  if (/\b(mobile|ios|android|flutter)\b/.test(t)) return ROLE_DESCRIPTIONS.mobile;
  if (/\b(fullstack|full.?stack)\b/.test(t)) return ROLE_DESCRIPTIONS.fullstack;
  if (/\b(frontend|front.?end|react|vue)\b/.test(t)) return ROLE_DESCRIPTIONS.frontend;
  if (/\b(backend|back.?end|server|api|node)\b/.test(t)) return ROLE_DESCRIPTIONS.backend;
  return ROLE_DESCRIPTIONS.fullstack;
}

// ─── Domain Matching ─────────────────────────────────────────────────────────

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  frontend: ['frontend', 'front-end', 'front end', 'react', 'vue', 'angular', 'ui dev', 'css', 'html'],
  backend: ['backend', 'back-end', 'back end', 'server', 'api', 'node', 'python', 'go ', 'rust', 'java '],
  design: ['design', 'ux', 'ui/ux', 'ux/ui', 'figma', 'wireframe', 'prototype'],
  devops: ['devops', 'dev ops', 'ci/cd', 'ci-cd', 'deploy', 'sre', 'reliability', 'infrastructure', 'infra', 'platform', 'cloud'],
  qa: ['qa', 'quality', 'test', 'testing', 'automation'],
  data: ['data', 'ml', 'machine learn', 'analytics', 'ai engineer', 'data scien'],
  security: ['security', 'appsec', 'pentest', 'vulnerability'],
  mobile: ['mobile', 'ios', 'android', 'flutter', 'react native'],
};

function findDomain(title: string): string | null {
  const t = title.toLowerCase();
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some(k => t.includes(k))) return domain;
  }
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateApiKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = 'openpod_sim_';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

function getToolsForRole(roleLevel: string, hasGitHub: boolean): typeof OPENPOD_TOOLS {
  const tools = [...OPENPOD_TOOLS];
  if (hasGitHub && (roleLevel === 'worker' || roleLevel === 'lead')) {
    tools.push(...GITHUB_TOOLS);
  }
  // Remove approve_ticket for non-PM roles
  if (roleLevel !== 'project_manager') {
    return tools.filter(t => t.type !== 'function' || t.function.name !== 'approve_ticket');
  }
  return tools;
}

// ─── Main Orchestrator ───────────────────────────────────────────────────────

export async function runLiveSimulation(config: SimulationConfig): Promise<void> {
  const { projectId, project, maxRounds, baseUrl, openaiApiKey, userId, github, onEvent, signal } = config;
  const db = createAdminClient();
  const openai = new OpenAI({ apiKey: openaiApiKey });
  const agents: SimulationAgent[] = [];

  function emit(event: SimulationEvent) {
    if (signal.aborted) return;
    onEvent(event);
  }

  function isAborted(): boolean {
    return signal.aborted;
  }

  // Keep-alive timer
  const keepAliveInterval = setInterval(() => {
    if (!isAborted()) {
      emit({ type: 'keepalive', agent: 'System', action: '' });
    }
  }, 25_000);

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: Setup — Create PM agent with real API key
    // ═══════════════════════════════════════════════════════════════════════

    emit({ type: 'system', agent: 'System', action: '🚀 Setting up live simulation...' });

    // Get or create #general channel (needed for PM membership check)
    const { data: existingChannel } = await db
      .from('channels')
      .select('id')
      .eq('project_id', projectId)
      .eq('is_default', true)
      .single();

    let channelId: string;
    if (existingChannel) {
      channelId = existingChannel.id;
    } else {
      const { data: newChannel } = await db
        .from('channels')
        .insert({ project_id: projectId, name: 'general', is_default: true })
        .select('id')
        .single();
      if (!newChannel) throw new Error('Failed to create channel');
      channelId = newChannel.id;
    }

    // Ensure PM position exists
    let pmPositionId: string;
    const { data: existingPm } = await db
      .from('positions')
      .select('id')
      .eq('project_id', projectId)
      .eq('role_level', 'project_manager')
      .single();

    if (existingPm) {
      pmPositionId = existingPm.id;
    } else {
      const { data: newPm } = await db
        .from('positions')
        .insert({
          project_id: projectId,
          title: 'Project Manager',
          description: 'Overall project coordination and delivery',
          required_capabilities: ['pm', 'planning', 'coordination'],
          role_level: 'project_manager',
          sort_order: 0,
          status: 'open',
        })
        .select('id')
        .single();
      if (!newPm) throw new Error('Failed to create PM position');
      pmPositionId = newPm.id;
    }

    // Create PM agent key with real openpod_* API key
    const pmApiKey = generateApiKey();
    const pmKeyHash = hashApiKey(pmApiKey);
    const pmPrefix = pmApiKey.slice(0, 16);

    const { data: pmKey } = await db
      .from('agent_keys')
      .insert({
        owner_id: userId,
        name: 'SIM-Project Manager',
        api_key_prefix: pmPrefix,
        api_key_hash: pmKeyHash,
        agent_type: 'simulation',
        description: 'Simulated Project Manager — live LLM simulation',
        capabilities: ['pm', 'planning', 'coordination', 'hiring'],
        is_active: true, // Must be true for API auth to work
      })
      .select('id')
      .single();

    if (!pmKey) throw new Error('Failed to create PM agent key');

    // Assign PM to position
    await db.from('applications').insert({
      position_id: pmPositionId,
      agent_key_id: pmKey.id,
      cover_message: 'Live simulation — PM agent joining.',
      status: 'accepted',
    }).select().maybeSingle();

    await db.from('project_members').insert({
      project_id: projectId,
      agent_key_id: pmKey.id,
      position_id: pmPositionId,
      role: 'agent',
    }).select().maybeSingle();

    await db.from('positions').update({ status: 'filled' }).eq('id', pmPositionId);

    const pmAgent: SimulationAgent = {
      id: pmKey.id,
      apiKey: pmApiKey,
      name: 'SIM-Project Manager',
      roleTitle: 'Project Manager',
      roleLevel: 'project_manager',
      positionId: pmPositionId,
    };
    agents.push(pmAgent);

    emit({ type: 'system', agent: 'System', action: '✅ Project Manager created with real API key' });
    if (isAborted()) return;

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: PM Planning — GPT-4o-mini creates positions, tickets, etc.
    // ═══════════════════════════════════════════════════════════════════════

    emit({ type: 'thinking', agent: 'Project Manager', action: '⏳ Analyzing project vision...' });

    const pmToolCtx: ToolContext = {
      baseUrl,
      apiKey: pmApiKey,
      projectId,
      agentKeyId: pmKey.id,
      agentName: 'SIM-Project Manager',
      github,
    };

    // PM can't create positions via agent API — we'll handle that via admin client
    // PM uses real API for tickets, chat, knowledge
    const pmPrompt = `You are the Project Manager for "${project.title}".

## Project Vision
${project.description}

## Your Job
You just joined. You need to:

1. **Plan the team** — Decide what positions this project needs. Output a list of positions you want using the create_position tool.
   - Create leads FIRST, then workers
   - Workers MUST specify reports_to_title pointing to their lead's exact title
   - Only create what the project actually needs (4-8 positions)

2. **Create tickets** — Break the project into 4-8 actionable tickets. Use create_ticket with detailed descriptions (50+ chars), acceptance criteria, and labels.

3. **Post in chat** — Introduce yourself and outline the plan.

4. **Write knowledge** — Document the architecture decisions and team plan.

Be concise. A simple web app needs different roles than a distributed system.`;

    // For PM planning, we use a mix: create_position via admin client, rest via real API
    const pmPlanningTools = [
      ...OPENPOD_TOOLS.filter(t => t.type === 'function' && ['create_ticket', 'post_message', 'write_knowledge'].includes(t.function.name)),
      {
        type: 'function' as const,
        function: {
          name: 'create_position',
          description: 'Create a new position/role in the project. Create leads FIRST, then workers with reports_to_title.',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Position title (e.g. "Frontend Lead", "Sr Backend Developer")' },
              description: { type: 'string', description: 'What this role does' },
              required_capabilities: { type: 'array', items: { type: 'string' }, description: 'Skills needed' },
              role_level: { type: 'string', enum: ['lead', 'worker'] },
              reports_to_title: { type: 'string', description: 'Title of the lead this role reports to (required for workers)' },
            },
            required: ['title', 'description', 'required_capabilities', 'role_level'],
          },
        },
      },
    ];

    const pmMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: pmPrompt },
      { role: 'user', content: 'Build the team and plan the project. Create leads FIRST, then workers. Use create_position, create_ticket, post_message, and write_knowledge. Call multiple tools.' },
    ];

    const pmResponse = await openai.chat.completions.create({
      model: MODEL,
      messages: pmMessages,
      tools: pmPlanningTools,
      tool_choice: 'required',
      temperature: 0.7,
    });

    if (isAborted()) return;

    // Execute PM's tool calls — sort leads before workers
    const pmChoice = pmResponse.choices[0];
    if (pmChoice.message.tool_calls) {
      const sorted = [...pmChoice.message.tool_calls].sort((a, b) => {
        if (a.type !== 'function' || b.type !== 'function') return 0;
        const aName = a.function.name;
        const bName = b.function.name;
        // create_position leads first, then workers, then other tools
        if (aName === 'create_position' && bName !== 'create_position') return -1;
        if (aName !== 'create_position' && bName === 'create_position') return 1;
        if (aName === 'create_position' && bName === 'create_position') {
          try {
            const aArgs = JSON.parse(a.function.arguments);
            const bArgs = JSON.parse(b.function.arguments);
            if (aArgs.role_level === 'lead' && bArgs.role_level !== 'lead') return -1;
            if (aArgs.role_level !== 'lead' && bArgs.role_level === 'lead') return 1;
          } catch { /* keep order */ }
        }
        return 0;
      });

      let nextSortOrder = 1;

      for (const toolCall of sorted) {
        if (isAborted()) break;
        if (toolCall.type !== 'function') continue;

        const fnName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        if (fnName === 'create_position') {
          // Handle via admin client (no agent API for position creation)
          let reportsTo: string | null = pmPositionId;
          if (args.reports_to_title && typeof args.reports_to_title === 'string') {
            const { data: match } = await db
              .from('positions')
              .select('id')
              .eq('project_id', projectId)
              .ilike('title', args.reports_to_title)
              .maybeSingle();
            if (match) reportsTo = match.id;
            else {
              const { data: fuzzy } = await db
                .from('positions')
                .select('id')
                .eq('project_id', projectId)
                .ilike('title', `%${args.reports_to_title}%`)
                .limit(1)
                .maybeSingle();
              if (fuzzy) reportsTo = fuzzy.id;
            }
          }

          const { error: posInsertErr } = await db.from('positions').insert({
            project_id: projectId,
            title: args.title,
            description: args.description || '',
            required_capabilities: args.required_capabilities || [],
            role_level: args.role_level || 'worker',
            reports_to: reportsTo,
            sort_order: nextSortOrder++,
            status: 'open',
            pay_type: 'fixed',
            max_agents: 1,
            payment_status: 'unfunded',
            amount_earned_cents: 0,
          });

          if (posInsertErr) {
            emit({ type: 'error', agent: 'Project Manager', action: `⚠️ Failed to create position "${args.title}": ${posInsertErr.message}` });
          } else {
            emit({ type: 'action', agent: 'Project Manager', action: `👤 Created position: ${args.title} (${args.role_level})` });
          }
        } else {
          // Real API call via tools.ts
          const { action } = await executeApiTool(fnName, args, pmToolCtx);
          emit({ type: 'action', agent: 'Project Manager', action });
        }
      }
    }

    if (isAborted()) return;

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 3: Auto-hire — create agent keys for each open position
    // ═══════════════════════════════════════════════════════════════════════

    const { data: openPositions, error: posQueryErr } = await db
      .from('positions')
      .select('id, title, role_level, required_capabilities, reports_to')
      .eq('project_id', projectId)
      .eq('status', 'open')
      .order('sort_order');

    if (posQueryErr) {
      emit({ type: 'error', agent: 'System', action: `⚠️ Failed to query positions: ${posQueryErr.message}` });
    }

    if (!openPositions || openPositions.length === 0) {
      // Debug: check ALL positions for this project regardless of status
      const { data: allPositions } = await db
        .from('positions')
        .select('id, title, status, role_level')
        .eq('project_id', projectId);
      const statusSummary = (allPositions || []).map(p => `${p.title}:${p.status}`).join(', ');
      emit({ type: 'system', agent: 'System', action: `⚠️ No open positions found. All positions (${allPositions?.length || 0}): ${statusSummary || 'none'}` });
    } else {
      emit({ type: 'system', agent: 'System', action: `📋 Hiring ${openPositions.length} agents...` });

      // Fix worker→lead hierarchy
      const leads = openPositions.filter(p => p.role_level === 'lead');
      const workers = openPositions.filter(p => p.role_level === 'worker');

      for (const worker of workers) {
        if (worker.reports_to !== pmPositionId) continue;
        let bestLead: typeof leads[0] | null = null;

        const workerDomain = findDomain(worker.title);
        if (workerDomain) {
          bestLead = leads.find(l => findDomain(l.title) === workerDomain) || null;
        }

        if (!bestLead) {
          const workerCaps = new Set(worker.required_capabilities || []);
          let bestOverlap = 0;
          for (const lead of leads) {
            const overlap = (lead.required_capabilities || []).filter((c: string) => workerCaps.has(c)).length;
            if (overlap > bestOverlap) {
              bestOverlap = overlap;
              bestLead = lead;
            }
          }
        }

        if (!bestLead && leads.length > 0) bestLead = leads[0];

        if (bestLead) {
          await db.from('positions').update({ reports_to: bestLead.id }).eq('id', worker.id);
        }
      }

      // Create agent key for each position
      for (const pos of openPositions) {
        if (isAborted()) break;

        const agentApiKey = generateApiKey();
        const agentName = `SIM-${pos.title}`;

        const { data: agentKey } = await db
          .from('agent_keys')
          .insert({
            owner_id: userId,
            name: agentName,
            api_key_prefix: agentApiKey.slice(0, 16),
            api_key_hash: hashApiKey(agentApiKey),
            agent_type: 'simulation',
            description: `Simulated ${pos.title} — live LLM simulation`,
            capabilities: pos.required_capabilities || [],
            is_active: true,
          })
          .select('id')
          .single();

        if (!agentKey) continue;

        // Apply + join
        await db.from('applications').insert({
          position_id: pos.id,
          agent_key_id: agentKey.id,
          cover_message: `Live simulation — ${pos.title} agent joining.`,
          status: 'accepted',
        }).select().maybeSingle();

        await db.from('project_members').insert({
          project_id: projectId,
          agent_key_id: agentKey.id,
          position_id: pos.id,
          role: 'agent',
        }).select().maybeSingle();

        await db.from('positions').update({ status: 'filled' }).eq('id', pos.id);

        agents.push({
          id: agentKey.id,
          apiKey: agentApiKey,
          name: agentName,
          roleTitle: pos.title,
          roleLevel: pos.role_level,
          positionId: pos.id,
        });

        emit({ type: 'action', agent: 'System', action: `✅ Hired: ${pos.title}` });
      }

      emit({ type: 'refresh', agent: 'System', action: '🔄 Team assembled — refreshing workspace...' });
    }

    if (isAborted()) return;

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 4: Work Loop — agents take turns using real API + GitHub
    // ═══════════════════════════════════════════════════════════════════════

    // Order: leads setup first, then workers, then work rounds cycle all
    const sortedTeam = [
      ...agents.filter(a => a.roleLevel === 'lead'),
      ...agents.filter(a => a.roleLevel === 'worker'),
    ];

    // Setup turns — each non-PM agent introduces itself
    for (const agent of sortedTeam) {
      if (isAborted()) break;

      emit({ type: 'thinking', agent: agent.roleTitle, action: `⏳ ${agent.roleTitle} joining team...` });

      const toolCtx: ToolContext = {
        baseUrl,
        apiKey: agent.apiKey,
        projectId,
        agentKeyId: agent.id,
        agentName: agent.name,
        github,
      };

      const roleDesc = getRoleDescription(agent.roleTitle, agent.roleLevel);
      const tools = getToolsForRole(agent.roleLevel, !!github);

      const setupPrompt = `You are ${agent.roleTitle} for "${project.title}".

## Your Role
${roleDesc}

## Project Vision
${project.description}

You just joined the team. Your job:
1. Say hi in chat briefly (mention your specific role and focus area)
2. Look at the ticket board — pick up an unassigned ticket that matches YOUR skills (update status to in_progress)
3. If you're a lead, write a knowledge entry about your department's approach

Be concise and professional. Stay in character for YOUR specific role.`;

      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: setupPrompt },
        { role: 'user', content: 'Take your actions now. Use list_tickets first to see available work, then take action. Call multiple tools.' },
      ];

      const response = await openai.chat.completions.create({
        model: MODEL,
        messages,
        tools,
        tool_choice: 'required',
        temperature: 0.7,
      });

      if (isAborted()) break;

      const choice = response.choices[0];
      if (choice.message.tool_calls) {
        for (const toolCall of choice.message.tool_calls) {
          if (isAborted()) break;
          if (toolCall.type !== 'function') continue;
          const args = JSON.parse(toolCall.function.arguments);
          const { action } = await executeApiTool(toolCall.function.name, args, toolCtx);
          emit({ type: 'action', agent: agent.roleTitle, action });
        }
      }
    }

    if (isAborted()) return;

    // Work rounds — cycle through all agents (leads → workers → PM)
    const workCycle = [
      ...agents.filter(a => a.roleLevel === 'lead'),
      ...agents.filter(a => a.roleLevel === 'worker'),
      pmAgent,
    ];

    const setupRounds = 1 + sortedTeam.length; // PM + each team member
    const workRounds = Math.max(0, maxRounds - setupRounds);

    for (let round = 0; round < workRounds; round++) {
      if (isAborted()) break;

      const currentRound = round + setupRounds + 1;
      const agent = workCycle[round % workCycle.length];

      emit({ type: 'round', agent: agent.roleTitle, action: `⏳ Working (round ${currentRound}/${maxRounds})...`, round: currentRound });

      const toolCtx: ToolContext = {
        baseUrl,
        apiKey: agent.apiKey,
        projectId,
        agentKeyId: agent.id,
        agentName: agent.name,
        github,
      };

      const roleDesc = agent.roleLevel === 'project_manager'
        ? 'As PM: review completed work, coordinate the team, create tickets for gaps, approve finished tickets, track progress.'
        : getRoleDescription(agent.roleTitle, agent.roleLevel);

      const tools = getToolsForRole(agent.roleLevel, !!github);

      const hasGitHubNote = github
        ? `\n\nYou have access to the GitHub repo (${github.owner}/${github.repo}). Workers can create branches, write code files, and create PRs.`
        : '';

      const workPrompt = `You are ${agent.roleTitle} working on "${project.title}".

## Your Role
${roleDesc}${hasGitHubNote}

## What You Can Do
- Pick up unassigned tickets that match YOUR skills (update status to in_progress)
- Move your in-progress tickets forward (to in_review when ready)
- If you're a lead or PM: review tickets in in_review — move to done or request changes
- ${agent.roleLevel === 'project_manager' ? 'Use approve_ticket on completed tickets to finalize them' : 'Create new tickets if you identify important work in YOUR domain'}
- Post updates, ask questions, or coordinate with teammates in chat
- Write technical decisions, patterns, or knowledge to memory
${github && (agent.roleLevel === 'worker' || agent.roleLevel === 'lead') ? `
## GitHub Workflow
1. create_branch with a descriptive name (feat/...)
2. Use get_repo_structure and read_file to understand existing code
3. Use write_file to commit code to your branch
4. create_pull_request when your work is ready for review
` : ''}

Stay in character for YOUR specific role. Focus on making real progress. Be concise.`;

      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: workPrompt },
        { role: 'user', content: 'Check the current state with list_tickets, then take your actions. Call multiple tools.' },
      ];

      const response = await openai.chat.completions.create({
        model: MODEL,
        messages,
        tools,
        tool_choice: 'required',
        temperature: 0.7,
      });

      if (isAborted()) break;

      const choice = response.choices[0];
      if (choice.message.tool_calls) {
        for (const toolCall of choice.message.tool_calls) {
          if (isAborted()) break;
          if (toolCall.type !== 'function') continue;
          const args = JSON.parse(toolCall.function.arguments);
          const { action } = await executeApiTool(toolCall.function.name, args, toolCtx);
          emit({ type: 'action', agent: agent.roleTitle, action, round: currentRound });
        }
      }

      // Check if all tickets are done
      const { data: activeTickets } = await db
        .from('tickets')
        .select('id, status')
        .eq('project_id', projectId)
        .not('status', 'in', '("done","cancelled")');

      if (!activeTickets || activeTickets.length === 0) {
        emit({ type: 'system', agent: 'System', action: '🎉 All tickets completed!' });
        break;
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 5: Done
    // ═══════════════════════════════════════════════════════════════════════

    await db.from('projects').update({ status: 'in_progress' }).eq('id', projectId);
    emit({ type: 'done', agent: 'System', action: '✅ Live simulation complete — refresh to see all changes' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    emit({ type: 'error', agent: 'System', action: `❌ Error: ${message}` });
  } finally {
    // Cleanup: deactivate all SIM agent keys
    clearInterval(keepAliveInterval);
    for (const agent of agents) {
      await db.from('agent_keys').update({ is_active: false }).eq('id', agent.id);
    }
  }
}
