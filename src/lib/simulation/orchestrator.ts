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

import crypto from 'crypto';
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
  github: { token: string; owner: string; repo: string; installationId: number; defaultBranch?: string; permissions?: Record<string, string> } | null;
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
  return 'openpod_sim_' + crypto.randomBytes(24).toString('base64url');
}

function getToolsForRole(roleLevel: string, hasGitHub: boolean): typeof OPENPOD_TOOLS {
  let tools = [...OPENPOD_TOOLS];
  if (hasGitHub && (roleLevel === 'worker' || roleLevel === 'lead')) {
    tools.push(...GITHUB_TOOLS);
  }
  // Remove approve_ticket for non-PM roles
  if (roleLevel !== 'project_manager') {
    tools = tools.filter(t => t.type !== 'function' || t.function.name !== 'approve_ticket');
  }
  // Only PM creates tickets — leads and workers just work on existing ones
  if (roleLevel !== 'project_manager') {
    tools = tools.filter(t => t.type !== 'function' || t.function.name !== 'create_ticket');
  }
  return tools;
}

// ─── Main Orchestrator ───────────────────────────────────────────────────────

export async function runLiveSimulation(config: SimulationConfig): Promise<void> {
  const { projectId, project, maxRounds, baseUrl, openaiApiKey, userId, github, onEvent, signal } = config;
  const db = createAdminClient();
  const openai = new OpenAI({ apiKey: openaiApiKey, timeout: 60_000 });
  const agents: SimulationAgent[] = [];
  const allCreatedKeyIds: string[] = [];

  function emit(event: SimulationEvent) {
    if (signal.aborted) return;
    onEvent(event);
  }

  function isAborted(): boolean {
    return signal.aborted;
  }

  // Keep-alive timer (with try-catch so it doesn't throw after stream closes)
  const keepAliveInterval = setInterval(() => {
    try {
      if (!isAborted()) {
        emit({ type: 'keepalive', agent: 'System', action: '' });
      }
    } catch {
      clearInterval(keepAliveInterval);
    }
  }, 25_000);

  // Validate GitHub connection, detect default branch, initialize empty repos
  let validatedGitHub = github;
  if (github) {
    try {
      const repoRes = await fetch(`https://api.github.com/repos/${github.owner}/${github.repo}`, {
        headers: { Authorization: `Bearer ${github.token}`, Accept: 'application/vnd.github+json' },
      });
      if (!repoRes.ok) {
        validatedGitHub = null; // GitHub connection broken — disable GitHub tools
      } else {
        const repoData = await repoRes.json();
        const defaultBranch = repoData.default_branch || 'main';
        validatedGitHub = { ...github, defaultBranch };

        // Check GitHub App permissions
        const perms = github.permissions || {};
        const missingPerms: string[] = [];
        if (perms.contents !== 'write') missingPerms.push('contents:write');
        if (perms.pull_requests !== 'write') missingPerms.push('pull_requests:write');
        if (missingPerms.length > 0) {
          emit({ type: 'error', agent: 'System', action: `⚠️ GitHub App missing permissions: ${missingPerms.join(', ')}. Go to github.com/apps/openpod-work → Configure → Permissions.` });
          // Still keep GitHub enabled for read operations — but warn clearly
          emit({ type: 'system', agent: 'System', action: `📋 GitHub App permissions: ${JSON.stringify(perms)}` });
        }

        // Check if repo is empty (no commits → default branch ref doesn't exist)
        const refRes = await fetch(
          `https://api.github.com/repos/${github.owner}/${github.repo}/git/ref/heads/${defaultBranch}`,
          { headers: { Authorization: `Bearer ${github.token}`, Accept: 'application/vnd.github+json' } },
        );
        if (!refRes.ok && refRes.status === 404) {
          // Empty repo — initialize with README so branches can be created
          emit({ type: 'system', agent: 'System', action: '📄 Initializing empty repo with README...' });
          const initRes = await fetch(
            `https://api.github.com/repos/${github.owner}/${github.repo}/contents/README.md`,
            {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${github.token}`,
                Accept: 'application/vnd.github+json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: 'Initial commit — OpenPod simulation',
                content: Buffer.from(`# ${project.title}\n\n${project.description || 'Project initialized by OpenPod simulation.'}\n`).toString('base64'),
              }),
            },
          );
          if (!initRes.ok) {
            const errText = await initRes.text();
            emit({ type: 'error', agent: 'System', action: `⚠️ Failed to init repo: ${errText.slice(0, 100)}` });
            validatedGitHub = null;
          } else {
            emit({ type: 'system', agent: 'System', action: '✅ Repo initialized with README' });
          }
        } else if (!refRes.ok) {
          await refRes.text(); // consume body
        }
      }
    } catch {
      validatedGitHub = null;
    }
  }

  try {
    emit({ type: 'system', agent: 'System', action: validatedGitHub
      ? `🚀 Setting up live simulation... (GitHub: ${validatedGitHub.owner}/${validatedGitHub.repo})`
      : '🚀 Setting up live simulation... (no GitHub — code will be in ticket comments)' });

    // ═══════════════════════════════════════════════════════════════════════
    // RESUME CHECK: Look for existing active SIM agents for this project
    // ═══════════════════════════════════════════════════════════════════════

    const { data: existingMembers } = await db
      .from('project_members')
      .select('agent_key_id, position_id, positions(title, role_level)')
      .eq('project_id', projectId)
      .eq('role', 'agent');

    // Find which of these have active SIM agent keys
    const existingAgentKeyIds = (existingMembers || []).map(m => m.agent_key_id).filter(Boolean);
    let resuming = false;

    if (existingAgentKeyIds.length > 0) {
      const { data: activeSimKeys } = await db
        .from('agent_keys')
        .select('id, name, capabilities')
        .eq('agent_type', 'simulation')
        .eq('is_active', true)
        .in('id', existingAgentKeyIds);

      if (activeSimKeys && activeSimKeys.length > 0) {
        // Resume: reactivate existing agents with fresh API keys
        resuming = true;
        emit({ type: 'system', agent: 'System', action: `🔄 Resuming with ${activeSimKeys.length} existing agents...` });

        for (const simKey of activeSimKeys) {
          const member = existingMembers!.find(m => m.agent_key_id === simKey.id);
          const posRaw = member?.positions;
          const pos = (Array.isArray(posRaw) ? posRaw[0] : posRaw) as { title: string; role_level: string } | null;
          if (!pos) continue;

          // Generate fresh API key for this session (old hash is stale)
          const freshKey = generateApiKey();
          await db.from('agent_keys').update({
            api_key_prefix: freshKey.slice(0, 16),
            api_key_hash: hashApiKey(freshKey),
          }).eq('id', simKey.id);

          agents.push({
            id: simKey.id,
            apiKey: freshKey,
            name: simKey.name,
            roleTitle: pos.title,
            roleLevel: pos.role_level,
            positionId: member!.position_id,
          });
        }

        // Clean up stale data from previous runs:
        // 1. Strip labels from all tickets (prevents capability mismatch)
        // 2. Normalize agent capabilities to lowercase
        await db.from('tickets').update({ labels: [] }).eq('project_id', projectId);
        for (const simKey of activeSimKeys) {
          const lowered = (simKey.capabilities || []).map((c: string) => c.toLowerCase());
          await db.from('agent_keys').update({ capabilities: lowered }).eq('id', simKey.id);
        }

        emit({ type: 'system', agent: 'System', action: `✅ Restored ${agents.length} agents — cleaned stale data, going to work loop` });
      }
    }

    if (isAborted()) return;

    // ═══════════════════════════════════════════════════════════════════════
    // PHASES 1-3: Only run if NOT resuming (fresh simulation)
    // ═══════════════════════════════════════════════════════════════════════

    let pmAgent: SimulationAgent | undefined;

    if (!resuming) {
      // ── PHASE 0: Clean up old simulation data ──
      // Delete old positions (except PM), tickets, and deactivate old sim keys
      // so fresh simulation starts clean without leftover "Context Keeper" etc.
      emit({ type: 'system', agent: 'System', action: '🧹 Cleaning up old simulation data...' });

      // Deactivate any old simulation agent keys for this project
      const { data: oldMembers } = await db
        .from('project_members')
        .select('agent_key_id')
        .eq('project_id', projectId)
        .eq('role', 'agent');
      if (oldMembers?.length) {
        const oldKeyIds = oldMembers.map(m => m.agent_key_id).filter(Boolean) as string[];
        if (oldKeyIds.length > 0) {
          await db.from('agent_keys').update({ is_active: false }).in('id', oldKeyIds).eq('agent_type', 'simulation');
        }
        // Remove old agent project members
        await db.from('project_members').delete().eq('project_id', projectId).eq('role', 'agent');
      }

      // Delete old non-PM positions (they'll be recreated by the new PM)
      await db.from('positions').delete().eq('project_id', projectId).neq('role_level', 'project_manager');

      // Clear old tickets and their labels so fresh sim starts clean
      await db.from('tickets').update({ labels: [] }).eq('project_id', projectId);

      // ── PHASE 1: Setup — Create PM agent with real API key ──

      // Get or create #general channel
      const { data: existingChannel } = await db
        .from('channels')
        .select('id')
        .eq('project_id', projectId)
        .eq('is_default', true)
        .maybeSingle();

      if (!existingChannel) {
        await db
          .from('channels')
          .insert({ project_id: projectId, name: 'general', is_default: true })
          .select('id')
          .single();
      }

      // Ensure PM position exists
      let pmPositionId: string;
      const { data: existingPm } = await db
        .from('positions')
        .select('id')
        .eq('project_id', projectId)
        .eq('role_level', 'project_manager')
        .maybeSingle();

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

      // Create PM agent key
      const pmApiKey = generateApiKey();

      const { data: pmKey } = await db
        .from('agent_keys')
        .insert({
          owner_id: userId,
          name: 'SIM-Project Manager',
          api_key_prefix: pmApiKey.slice(0, 16),
          api_key_hash: hashApiKey(pmApiKey),
          agent_type: 'simulation',
          description: 'Simulated Project Manager — live LLM simulation',
          capabilities: ['pm', 'planning', 'coordination', 'hiring'],
          is_active: true,
        })
        .select('id')
        .single();

      if (!pmKey) throw new Error('Failed to create PM agent key');
      allCreatedKeyIds.push(pmKey.id);

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

      pmAgent = {
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

      // ── PHASE 2: PM Planning ──

      emit({ type: 'thinking', agent: 'Project Manager', action: '⏳ Analyzing project vision...' });

      const pmToolCtx: ToolContext = {
        baseUrl,
        apiKey: pmApiKey,
        projectId,
        agentKeyId: pmKey.id,
        agentName: 'SIM-Project Manager',
        github: validatedGitHub,
      };

      // Step 1: Create positions (via admin client)
      const createPositionTool = {
        type: 'function' as const,
        function: {
          name: 'create_position',
          description: 'Create a new position/role in the project. You MUST create both leads AND workers.',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Position title (e.g. "Frontend Lead", "Sr Frontend Developer")' },
              description: { type: 'string', description: 'What this role does' },
              required_capabilities: { type: 'array', items: { type: 'string' }, description: 'Skills needed (use lowercase, e.g. ["frontend", "react", "css"])' },
              role_level: { type: 'string', enum: ['lead', 'worker'] },
              reports_to_title: { type: 'string', description: 'Exact title of the lead this worker reports to (REQUIRED for workers)' },
            },
            required: ['title', 'description', 'required_capabilities', 'role_level'],
          },
        },
      };

      const positionResponse = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: `You are the Project Manager for "${project.title}".\n\n## Project Vision\n${project.description}\n\nPlan the team. You MUST create BOTH leads AND workers:\n- 2-3 leads (e.g. "Frontend Lead", "Backend Lead")\n- 3-5 workers under those leads (e.g. "Sr Frontend Developer" reports_to_title "Frontend Lead")\n\nCapabilities should be lowercase tech terms like: frontend, backend, react, node, database, api, css, mobile, testing, design.\nWorkers MUST have reports_to_title matching their lead's exact title.` },
          { role: 'user', content: 'Create the team: leads FIRST, then workers. Every worker needs reports_to_title. Create 5-8 total positions.' },
        ],
        tools: [createPositionTool],
        tool_choice: 'required',
        temperature: 0.7,
      });

      if (isAborted()) return;

      const posChoice = positionResponse.choices[0];
      if (posChoice.message.tool_calls) {
        const sorted = [...posChoice.message.tool_calls].sort((a, b) => {
          if (a.type !== 'function' || b.type !== 'function') return 0;
          try {
            const aArgs = JSON.parse(a.function.arguments);
            const bArgs = JSON.parse(b.function.arguments);
            if (aArgs.role_level === 'lead' && bArgs.role_level !== 'lead') return -1;
            if (aArgs.role_level !== 'lead' && bArgs.role_level === 'lead') return 1;
          } catch { /* keep order */ }
          return 0;
        });

        let nextSortOrder = 1;

        for (const toolCall of sorted) {
          if (isAborted()) break;
          if (toolCall.type !== 'function') continue;

          let args;
          try { args = JSON.parse(toolCall.function.arguments); } catch {
            emit({ type: 'error', agent: 'Project Manager', action: '⚠️ Malformed tool args, skipping' });
            continue;
          }
          let reportsTo: string | null = pmPositionId;
          if (args.reports_to_title && typeof args.reports_to_title === 'string') {
            const escapedTitle = String(args.reports_to_title).replace(/%/g, '\\%').replace(/_/g, '\\_');
            const { data: match } = await db
              .from('positions')
              .select('id')
              .eq('project_id', projectId)
              .ilike('title', escapedTitle)
              .maybeSingle();
            if (match) reportsTo = match.id;
            else {
              const { data: fuzzy } = await db
                .from('positions')
                .select('id')
                .eq('project_id', projectId)
                .ilike('title', `%${escapedTitle}%`)
                .limit(1)
                .maybeSingle();
              if (fuzzy) reportsTo = fuzzy.id;
            }
          }

          const { error: posInsertErr } = await db.from('positions').insert({
            project_id: projectId,
            title: args.title,
            description: args.description || '',
            required_capabilities: (args.required_capabilities || []).map((c: string) => c.toLowerCase()),
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
        }
      }

      if (isAborted()) return;

      // Check if workers were created — if not, make a follow-up call
      const { data: createdPositions } = await db
        .from('positions')
        .select('id, title, role_level')
        .eq('project_id', projectId)
        .neq('role_level', 'project_manager');

      const hasWorkers = createdPositions?.some(p => p.role_level === 'worker');
      const leadTitles = createdPositions?.filter(p => p.role_level === 'lead').map(p => p.title) || [];

      if (!hasWorkers && leadTitles.length > 0) {
        emit({ type: 'thinking', agent: 'Project Manager', action: '⏳ Creating worker positions...' });

        const workerResponse = await openai.chat.completions.create({
          model: MODEL,
          messages: [
            { role: 'system', content: `You are the Project Manager for "${project.title}". You already created these lead positions: ${leadTitles.join(', ')}.\n\nNow create 3-5 WORKER positions under those leads. Workers do the actual coding/design work.\nExamples: "Sr Frontend Developer" (reports_to_title: "Frontend Lead"), "Backend Engineer" (reports_to_title: "Backend Lead").\n\nEach worker MUST have role_level "worker" and reports_to_title matching an existing lead title exactly.\nCapabilities should be lowercase tech terms.` },
            { role: 'user', content: `Create 3-5 worker positions. Available leads: ${leadTitles.join(', ')}. Every worker needs role_level "worker" and reports_to_title.` },
          ],
          tools: [createPositionTool],
          tool_choice: 'required',
          temperature: 0.7,
        });

        if (isAborted()) return;

        const workerChoice = workerResponse.choices[0];
        if (workerChoice.message.tool_calls) {
          let nextSort = (createdPositions?.length || 0) + 1;
          for (const toolCall of workerChoice.message.tool_calls) {
            if (isAborted()) break;
            if (toolCall.type !== 'function') continue;

            let args;
            try { args = JSON.parse(toolCall.function.arguments); } catch {
              emit({ type: 'error', agent: 'Project Manager', action: '⚠️ Malformed worker tool args, skipping' });
              continue;
            }
            // Force worker role_level
            args.role_level = 'worker';

            let reportsTo: string | null = pmPositionId;
            if (args.reports_to_title && typeof args.reports_to_title === 'string') {
              const escapedTitle = String(args.reports_to_title).replace(/%/g, '\\%').replace(/_/g, '\\_');
              const { data: match } = await db
                .from('positions')
                .select('id')
                .eq('project_id', projectId)
                .ilike('title', escapedTitle)
                .maybeSingle();
              if (match) reportsTo = match.id;
              else {
                const { data: fuzzy } = await db
                  .from('positions')
                  .select('id')
                  .eq('project_id', projectId)
                  .ilike('title', `%${escapedTitle}%`)
                  .limit(1)
                  .maybeSingle();
                if (fuzzy) reportsTo = fuzzy.id;
              }
            }

            const { error: posInsertErr } = await db.from('positions').insert({
              project_id: projectId,
              title: args.title,
              description: args.description || '',
              required_capabilities: (args.required_capabilities || []).map((c: string) => c.toLowerCase()),
              role_level: 'worker',
              reports_to: reportsTo,
              sort_order: nextSort++,
              status: 'open',
              pay_type: 'fixed',
              max_agents: 1,
              payment_status: 'unfunded',
              amount_earned_cents: 0,
            });

            if (posInsertErr) {
              emit({ type: 'error', agent: 'Project Manager', action: `⚠️ Failed to create worker "${args.title}": ${posInsertErr.message}` });
            } else {
              emit({ type: 'action', agent: 'Project Manager', action: `👤 Created position: ${args.title} (worker)` });
            }
          }
        }
      }

      if (isAborted()) return;

      // Step 2: Create tickets, chat, knowledge (via real API)
      // IMPORTANT: Do NOT use labels on tickets to avoid capability mismatch issues
      emit({ type: 'thinking', agent: 'Project Manager', action: '⏳ Creating tickets and project plan...' });

      const pmTicketTools = OPENPOD_TOOLS.filter(t => t.type === 'function' && ['create_ticket', 'post_message', 'write_knowledge'].includes(t.function.name));

      const ticketResponse = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: `You are the Project Manager for "${project.title}".\n\n## Project Vision\n${project.description}\n\nCreate the work plan:\n1. **Create 10-15 tickets** — actionable work items with detailed descriptions (50+ chars) and acceptance criteria. Create MORE tickets than team members so everyone has work. Use priority: "urgent" for must-haves, "high" for important, "medium" for nice-to-have.\n   IMPORTANT: Do NOT include labels on tickets. Leave labels empty.\n2. **Post in chat** — Introduce yourself and outline the plan.\n3. **Write knowledge** — Document architecture decisions and tech stack.` },
          { role: 'user', content: 'Create 10-15 tickets (NO labels field), post your intro, and write knowledge. Call create_ticket at least 10 times — we have a large team.' },
        ],
        tools: pmTicketTools,
        tool_choice: 'required',
        temperature: 0.7,
      });

      if (isAborted()) return;

      const ticketChoice = ticketResponse.choices[0];
      if (ticketChoice.message.tool_calls) {
        for (const toolCall of ticketChoice.message.tool_calls) {
          if (isAborted()) break;
          if (toolCall.type !== 'function') continue;
          let args;
          try { args = JSON.parse(toolCall.function.arguments); } catch {
            emit({ type: 'error', agent: 'Project Manager', action: '⚠️ Malformed ticket tool args, skipping' });
            continue;
          }
          // Strip labels to prevent capability mismatch
          delete args.labels;
          const { action } = await executeApiTool(toolCall.function.name, args, pmToolCtx);
          emit({ type: 'action', agent: 'Project Manager', action });
        }
      }

      if (isAborted()) return;

      // ── PHASE 3: Auto-hire ──

      const { data: openPositions } = await db
        .from('positions')
        .select('id, title, role_level, required_capabilities, reports_to')
        .eq('project_id', projectId)
        .eq('status', 'open')
        .order('sort_order');

      if (!openPositions || openPositions.length === 0) {
        emit({ type: 'system', agent: 'System', action: '⚠️ No open positions — only PM will work' });
      } else {
        emit({ type: 'system', agent: 'System', action: `📋 Hiring ${openPositions.length} agents...` });

        // Fix worker→lead hierarchy
        const leads = openPositions.filter(p => p.role_level === 'lead');
        const workers = openPositions.filter(p => p.role_level === 'worker');

        for (const worker of workers) {
          const workerDomain = findDomain(worker.title);
          if (workerDomain) {
            const bestLead = leads.find(l => findDomain(l.title) === workerDomain);
            if (bestLead) {
              await db.from('positions').update({ reports_to: bestLead.id }).eq('id', worker.id);
            }
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
              capabilities: (pos.required_capabilities || []).map((c: string) => c.toLowerCase()),
              is_active: true,
            })
            .select('id')
            .single();

          if (!agentKey) continue;
          allCreatedKeyIds.push(agentKey.id);

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
    } // end if (!resuming)

    // Find PM agent (needed for work cycle)
    if (!pmAgent) {
      pmAgent = agents.find(a => a.roleLevel === 'project_manager');
    }

    if (isAborted()) return;

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 4: Work Loop — agents take turns using real API + GitHub
    // ═══════════════════════════════════════════════════════════════════════

    // Multi-turn tool-calling loop: sends results back to OpenAI so it can
    // see API responses and decide next actions (max 5 iterations per turn).
    const MAX_TOOL_ITERATIONS = 5;

    async function runAgentTurn(
      agent: SimulationAgent,
      systemPrompt: string,
      userMessage: string,
      tools: typeof OPENPOD_TOOLS,
      roundNum?: number,
    ): Promise<void> {
      const toolCtx: ToolContext = {
        baseUrl,
        apiKey: agent.apiKey,
        projectId,
        agentKeyId: agent.id,
        agentName: agent.name,
        github: validatedGitHub,
      };

      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ];

      let consecutiveErrors = 0;

      for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
        if (isAborted()) return;

        const response = await openai.chat.completions.create({
          model: MODEL,
          messages,
          tools,
          tool_choice: iter === 0 ? 'required' : 'auto', // Force first call, then let model decide
          temperature: 0.7,
        });

        const choice = response.choices[0];

        // If no tool calls, the agent is done for this turn
        if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
          break;
        }

        // Append the assistant message (with tool_calls) to conversation
        messages.push(choice.message);

        // Execute each tool call and build result messages
        let iterHadError = false;
        for (const toolCall of choice.message.tool_calls) {
          if (isAborted()) return;
          if (toolCall.type !== 'function') continue;

          let args;
          try { args = JSON.parse(toolCall.function.arguments); } catch {
            emit({ type: 'error', agent: agent.roleTitle, action: '⚠️ Malformed tool args, skipping' });
            messages.push({ role: 'tool', tool_call_id: toolCall.id, content: 'Error: malformed arguments' });
            iterHadError = true;
            continue;
          }
          const { result, action } = await executeApiTool(toolCall.function.name, args, toolCtx);

          if (result.startsWith('ERROR:')) iterHadError = true;

          // Emit the human-readable action to SSE stream
          emit({ type: 'action', agent: agent.roleTitle, action, round: roundNum });

          // Send the actual result data back to OpenAI so it can act on it
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result,
          });
        }

        // Break if agent keeps hitting errors (stuck in a loop)
        if (iterHadError) {
          consecutiveErrors++;
          if (consecutiveErrors >= 2) {
            emit({ type: 'error', agent: agent.roleTitle, action: '⚠️ Multiple errors — moving on' });
            break;
          }
        } else {
          consecutiveErrors = 0;
        }
      }
    }

    // ── Setup turns — only for fresh simulation, not resume ──
    // Workers first (they pick up tickets), then leads (they review and write knowledge)
    if (!resuming) {
    const setupOrder = [
      ...agents.filter(a => a.roleLevel === 'worker'),
      ...agents.filter(a => a.roleLevel === 'lead'),
    ];

    for (const agent of setupOrder) {
      if (isAborted()) break;

      emit({ type: 'thinking', agent: agent.roleTitle, action: `⏳ ${agent.roleTitle} joining team...` });

      const roleDesc = getRoleDescription(agent.roleTitle, agent.roleLevel);
      const tools = getToolsForRole(agent.roleLevel, !!validatedGitHub);

      const setupPrompt = agent.roleLevel === 'lead'
        ? `You are "${agent.roleTitle}" (your agent name is "${agent.name}") working on "${project.title}".

## Your Role
${roleDesc}

## Project Vision
${project.description}

You just joined the team AS A LEAD. Do ALL of these:
1. Call list_tickets ONCE to see the full board
2. Post a message in chat introducing yourself as "${agent.roleTitle}" and your technical approach (post_message)
3. Write a knowledge entry about your department's architecture decisions and tech standards (write_knowledge)
4. Add review comments on 1-2 tickets in your domain (add_comment) — give technical guidance

DO NOT pick up or self-assign any tickets. Leave tickets for workers. Your job is to review and guide.`
        : `You are "${agent.roleTitle}" (your agent name is "${agent.name}") working on "${project.title}".

## Your Role
${roleDesc}

## Project Vision
${project.description}

You just joined the team. Do these steps IN ORDER:
1. Call list_tickets ONCE to see the full board
2. Pick EXACTLY ONE unassigned ticket (marked "⬜ UNASSIGNED") — call update_ticket with the ticket_id (the long UUID string like "a1b2c3d4-...") and status "in_progress". ONLY PICK ONE TICKET.
3. Add a comment on YOUR ticket with your implementation plan (add_comment)
4. Post a chat message introducing yourself as "${agent.roleTitle}" (post_message)

CRITICAL:
- The ticket_id is the UUID string shown as ticket_id="..." — NOT a number. Use the full UUID.
- Pick ONLY ONE ticket. Do NOT call update_ticket more than once.
- Do NOT pick tickets marked "🔒 TAKEN" — you will get a 403 error.
- If a tool call fails, move on — do NOT retry.`;

      await runAgentTurn(
        agent,
        setupPrompt,
        agent.roleLevel === 'lead'
          ? 'Call list_tickets once, then introduce yourself in chat, write knowledge, and review tickets. Do NOT pick up tickets.'
          : 'Call list_tickets once, pick up an UNASSIGNED ticket, add a comment with your plan, then introduce yourself in chat.',
        tools,
      );
    }
    } // end if (!resuming) for setup turns

    if (isAborted()) return;

    // ── Work rounds — workers FIRST (do work), then leads (review), then PM (approve) ──
    const workCycle = [
      ...agents.filter(a => a.roleLevel === 'worker'),
      ...agents.filter(a => a.roleLevel === 'lead'),
      ...(pmAgent ? [pmAgent] : agents.filter(a => a.roleLevel === 'project_manager')),
    ];

    if (workCycle.length === 0) {
      emit({ type: 'error', agent: 'System', action: '❌ No agents available for work loop' });
      return;
    }

    for (let round = 1; round <= maxRounds; round++) {
      if (isAborted()) break;

      emit({ type: 'round', agent: 'System', action: `🔄 Round ${round}/${maxRounds} — ${workCycle.length} agents working`, round });

      for (const agent of workCycle) {
        if (isAborted()) break;

        emit({ type: 'thinking', agent: agent.roleTitle, action: `⏳ ${agent.roleTitle} working (round ${round})...` });

        try {
        const roleDesc = agent.roleLevel === 'project_manager'
          ? 'As PM: review completed work, coordinate the team, create new tickets for gaps, approve finished tickets (approve_ticket), track progress.'
          : getRoleDescription(agent.roleTitle, agent.roleLevel);

        const tools = getToolsForRole(agent.roleLevel, !!validatedGitHub);

        const hasGitHubNote = validatedGitHub
          ? `\n\nYou have access to the GitHub repo (${validatedGitHub.owner}/${validatedGitHub.repo}). Default branch: "${validatedGitHub.defaultBranch || 'main'}". Use create_branch, write_file, create_pull_request to write REAL code.`
          : '';

        await runAgentTurn(
          agent,
          `You are "${agent.roleTitle}" (agent name: "${agent.name}") working on "${project.title}".

## Your Role
${roleDesc}${hasGitHubNote}

## Instructions — DO ALL OF THESE EACH TURN:
1. Call list_tickets ONCE (no filters) to see the full board
2. Then take MULTIPLE actions based on what you see:

${agent.roleLevel === 'project_manager' ? `**As PM, you MUST do these each turn:**
- The ticket_id is the UUID string shown as ticket_id="..." — NOT a number. Always use the full UUID.
- approve_ticket on ANY ticket with status "in_review" — approve ALL of them (use ticket_id UUID)
- If all tickets are in_review or done, create new tickets for remaining work
- Post a status update in chat summarizing team progress (use your title "Project Manager", NOT placeholder text)` : agent.roleLevel === 'lead' ? `**As Lead, your job is to REVIEW work and write knowledge — do NOT pick up tickets (leave those for workers):**
- Add detailed review comments (add_comment) on tickets that are "in_progress" or "in_review" — give technical feedback, suggest improvements, review architecture
- Write knowledge entries about architecture decisions, design patterns, and technical standards in your domain (write_knowledge)
- Post coordination updates in chat — summarize what your team is working on, flag blockers, give direction (post_message)
- If you already have a ticket assigned to you: add implementation comments with actual code snippets, then move it to in_review
- Do NOT try to pick up unassigned tickets — workers handle implementation` : `**As Worker, you MUST do these each turn:**
- The ticket_id is the UUID string shown as ticket_id="..." — NOT a number. Always use the full UUID.
- If you have NO ticket yet: pick ONE unassigned ticket (marked "⬜ UNASSIGNED") with update_ticket
- Do NOT pick more than one ticket. Do NOT pick tickets marked "🔒 TAKEN".
${validatedGitHub ? `- **WRITE CODE VIA GITHUB (REQUIRED):** This is your primary job each turn:
  1. create_branch("feat/short-name") — creates a branch from "${validatedGitHub.defaultBranch || 'main'}"
  2. write_file(path, content, branch, message) — write REAL implementation code (not placeholder)
  3. After writing all files, create_pull_request(title, head_branch) — PR back to "${validatedGitHub.defaultBranch || 'main'}"
  4. Then update_ticket to status "in_review" with the PR URL in deliverables
- You MUST call create_branch + write_file + create_pull_request. This is MORE important than comments.` : `- Write REAL implementation code in ticket comments using markdown code blocks`}
- Post progress updates in chat (use your title "${agent.roleTitle}")
- Do NOT retry failed tool calls — move on to a different action`}

CRITICAL RULES:
- Do NOT call list_tickets more than once per turn.
- Take 3-5 ACTIONS per turn (comments, updates, chat, knowledge). Make VISIBLE progress.
- If a tool call returns an error, do NOT retry it — move on to a different action.
- Never use placeholder text like "[Your Name]" — always use your role title "${agent.roleTitle}".`,
          'Call list_tickets once, then take multiple actions. Add comments, update statuses, post in chat. Make real progress.',
          tools,
          round,
        );
        } catch (turnErr) {
          const msg = turnErr instanceof Error ? turnErr.message : 'Unknown';
          emit({ type: 'error', agent: agent.roleTitle, action: `⚠️ Turn failed: ${msg}` });
        }
      }

      // After each full round, check if all tickets are done
      const { data: totalTickets } = await db
        .from('tickets')
        .select('id')
        .eq('project_id', projectId);

      const { data: activeTickets } = await db
        .from('tickets')
        .select('id, status')
        .eq('project_id', projectId)
        .not('status', 'in', '(done,cancelled)');

      if (totalTickets && totalTickets.length > 0 && (!activeTickets || activeTickets.length === 0)) {
        emit({ type: 'system', agent: 'System', action: `🎉 All ${totalTickets.length} tickets completed!` });
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
    // Cleanup: deactivate ALL created agent keys (even ones not in agents[] due to early abort)
    clearInterval(keepAliveInterval);
    const keyIds = new Set([...agents.map(a => a.id), ...allCreatedKeyIds]);
    await Promise.allSettled(
      Array.from(keyIds).map(id =>
        db.from('agent_keys').update({ is_active: false }).eq('id', id)
      )
    );
  }
}
