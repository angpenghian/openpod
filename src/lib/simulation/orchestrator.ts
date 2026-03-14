/**
 * Live LLM simulation orchestrator — deterministic coordination, LLM writes code.
 *
 * Phases:
 *   0. Cleanup — deactivate old sim keys, delete old positions
 *   1. Setup — create PM agent key via admin client
 *   2. PM Planning — GPT-4o-mini creates tickets via real API
 *   3. Auto-hire — create agent keys, orchestrator assigns tickets deterministically
 *   4. Work Loop — each worker writes code (LLM), leads review (LLM), PM approves (deterministic)
 *   5. Cleanup — set all SIM keys to is_active: false
 */

import crypto from 'crypto';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashApiKey } from '@/lib/agent-auth';
import { OPENPOD_TOOLS, GITHUB_TOOLS, executeApiTool, type ToolContext } from './tools';
import { createBranch as ghCreateBranch, readFile as ghReadFile, writeFile as ghWriteFile } from './github-tools';

const MODEL = 'gpt-4o-mini';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SimulationAgent {
  id: string;          // agent_keys.id
  apiKey: string;      // plaintext openpod_* key (kept in memory only)
  name: string;        // display name e.g. "SIM-Frontend Developer"
  roleTitle: string;   // position title e.g. "Frontend Developer"
  roleLevel: string;   // 'project_manager' | 'lead' | 'worker'
  positionId: string;
  assignedTicketId?: string;    // orchestrator-assigned ticket UUID
  assignedTicketTitle?: string; // for display
  branchName?: string;          // orchestrator-created git branch
}

export interface SimulationEvent {
  type: 'system' | 'thinking' | 'action' | 'error' | 'refresh' | 'round' | 'done' | 'keepalive';
  agent: string;
  action: string;
  round?: number;
}

export type GitMode = 'create_pr' | 'direct_commit' | 'auto_merge';

export interface SimulationConfig {
  projectId: string;
  project: { id: string; title: string; description: string };
  maxRounds: number;
  baseUrl: string;
  openaiApiKey: string;
  userId: string;
  github: { token: string; owner: string; repo: string; installationId: number; defaultBranch?: string; permissions?: Record<string, string> } | null;
  gitMode: GitMode;
  onEvent: (event: SimulationEvent) => void;
  signal: AbortSignal;
}

// ─── Role Descriptions ──────────────────────────────────────────────────────

const ROLE_DESCRIPTIONS: Record<string, string> = {
  'frontend lead': 'You own the frontend — UI architecture, component system, state management, and UX quality.',
  'backend lead': 'You own backend systems — API design, database architecture, server logic, and integrations.',
  'frontend': 'You build UI — components, pages, interactions, responsive design.',
  'backend': 'You build server-side logic — APIs, database queries, business logic, integrations.',
  'fullstack': 'You work across the full stack — frontend UI, backend APIs, database.',
  'mobile': 'You build mobile apps — native or cross-platform.',
};

function getRoleDescription(title: string): string {
  const t = title.toLowerCase();
  for (const [key, desc] of Object.entries(ROLE_DESCRIPTIONS)) {
    if (t.includes(key)) return desc;
  }
  return ROLE_DESCRIPTIONS.fullstack;
}

// ─── Domain Matching ─────────────────────────────────────────────────────────

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  frontend: ['frontend', 'front-end', 'react', 'vue', 'angular', 'ui', 'css'],
  backend: ['backend', 'back-end', 'server', 'api', 'node', 'database', 'python'],
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

/** Get tools for a worker's coding turn — only GitHub write + comment tools */
function getWorkerTools(hasGitHub: boolean, gitMode: GitMode) {
  const tools = OPENPOD_TOOLS.filter(t =>
    t.type === 'function' && ['add_comment', 'post_message'].includes(t.function.name)
  );
  if (hasGitHub) {
    // Always include write_file
    const ghToolNames = ['write_file'];
    // Include create_pull_request for PR-based modes (create_pr, auto_merge)
    if (gitMode !== 'direct_commit') {
      ghToolNames.push('create_pull_request');
    }
    tools.push(...GITHUB_TOOLS.filter(t =>
      t.type === 'function' && ghToolNames.includes(t.function.name)
    ));
  }
  return tools;
}

/** Get tools for a lead's review turn */
function getLeadTools() {
  return OPENPOD_TOOLS.filter(t =>
    t.type === 'function' && ['add_comment', 'post_message', 'write_knowledge'].includes(t.function.name)
  );
}

// ─── Main Orchestrator ───────────────────────────────────────────────────────

export async function runLiveSimulation(config: SimulationConfig): Promise<void> {
  const { projectId, project, maxRounds, baseUrl, openaiApiKey, userId, github, gitMode, onEvent, signal } = config;
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

  // Keep-alive timer
  const keepAliveInterval = setInterval(() => {
    try {
      if (!isAborted()) emit({ type: 'keepalive', agent: 'System', action: '' });
    } catch { clearInterval(keepAliveInterval); }
  }, 25_000);

  // ── Validate GitHub ──
  let validatedGitHub = github;
  if (github) {
    try {
      const repoRes = await fetch(`https://api.github.com/repos/${github.owner}/${github.repo}`, {
        headers: { Authorization: `Bearer ${github.token}`, Accept: 'application/vnd.github+json' },
      });
      if (!repoRes.ok) {
        validatedGitHub = null;
      } else {
        const repoData = await repoRes.json();
        const defaultBranch = repoData.default_branch || 'main';
        validatedGitHub = { ...github, defaultBranch };

        // Check permissions
        const perms = github.permissions || {};
        if (perms.contents !== 'write' || perms.pull_requests !== 'write') {
          emit({ type: 'error', agent: 'System', action: `⚠️ GitHub App needs contents:write + pull_requests:write. Current: ${JSON.stringify(perms)}` });
        }

        // Init empty repo — check BOTH size===0 AND ref existence
        // GitHub returns 409 (not 404) for empty repos on git/ref endpoints
        const repoIsEmpty = repoData.size === 0;
        let refExists = false;
        if (!repoIsEmpty) {
          const refRes = await fetch(
            `https://api.github.com/repos/${github.owner}/${github.repo}/git/ref/heads/${defaultBranch}`,
            { headers: { Authorization: `Bearer ${github.token}`, Accept: 'application/vnd.github+json' } },
          );
          refExists = refRes.ok;
          if (!refRes.ok) await refRes.text(); // consume body
        }

        if (repoIsEmpty || !refExists) {
          emit({ type: 'system', agent: 'System', action: `📄 Initializing empty repo (size=${repoData.size}, refExists=${refExists})...` });
          const initRes = await fetch(
            `https://api.github.com/repos/${github.owner}/${github.repo}/contents/README.md`,
            {
              method: 'PUT',
              headers: { Authorization: `Bearer ${github.token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: 'Initial commit — OpenPod simulation',
                content: Buffer.from(`# ${project.title}\n\n${project.description || 'Project initialized by OpenPod.'}\n`).toString('base64'),
              }),
            },
          );
          if (!initRes.ok) {
            const initErr = await initRes.text();
            // If README already exists (409/422), repo is actually initialized — proceed
            if (initRes.status === 409 || initRes.status === 422) {
              emit({ type: 'system', agent: 'System', action: '✅ Repo already has content, proceeding' });
            } else {
              emit({ type: 'error', agent: 'System', action: `⚠️ Failed to init repo (${initRes.status}) — disabling GitHub` });
              validatedGitHub = null;
            }
          } else {
            emit({ type: 'system', agent: 'System', action: '✅ Repo initialized with README' });
            // Wait a moment for GitHub to process the commit
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }
    } catch { validatedGitHub = null; }
  }

  try {
    const ghLabel = validatedGitHub ? `GitHub: ${validatedGitHub.owner}/${validatedGitHub.repo}` : 'no GitHub';
    const modeLabel = gitMode === 'direct_commit' ? ', direct commit' : gitMode === 'auto_merge' ? ', auto-merge PRs' : '';
    emit({ type: 'system', agent: 'System', action: `🚀 Starting simulation (${ghLabel}${modeLabel})` });

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 0: Cleanup old simulation data
    // ═════════════════════════════════════════════════════════════════════════

    emit({ type: 'system', agent: 'System', action: '🧹 Cleaning up old simulation data...' });

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
      await db.from('project_members').delete().eq('project_id', projectId).eq('role', 'agent');
    }
    await db.from('positions').delete().eq('project_id', projectId).neq('role_level', 'project_manager');
    await db.from('tickets').update({ labels: [] }).eq('project_id', projectId);

    if (isAborted()) return;

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 1: Create PM agent key
    // ═════════════════════════════════════════════════════════════════════════

    // Ensure #general channel
    const { data: existingChannel } = await db
      .from('channels').select('id').eq('project_id', projectId).eq('is_default', true).maybeSingle();
    if (!existingChannel) {
      await db.from('channels').insert({ project_id: projectId, name: 'general', is_default: true });
    }

    // Ensure PM position
    let pmPositionId: string;
    const { data: existingPm } = await db
      .from('positions').select('id').eq('project_id', projectId).eq('role_level', 'project_manager').maybeSingle();
    if (existingPm) {
      pmPositionId = existingPm.id;
    } else {
      const { data: newPm } = await db.from('positions').insert({
        project_id: projectId, title: 'Project Manager', description: 'Project coordination',
        required_capabilities: ['pm'], role_level: 'project_manager', sort_order: 0, status: 'open',
      }).select('id').single();
      if (!newPm) throw new Error('Failed to create PM position');
      pmPositionId = newPm.id;
    }

    // Create PM agent key
    const pmApiKey = generateApiKey();
    const { data: pmKey } = await db.from('agent_keys').insert({
      owner_id: userId, name: 'SIM-Project Manager', api_key_prefix: pmApiKey.slice(0, 16),
      api_key_hash: hashApiKey(pmApiKey), agent_type: 'simulation',
      description: 'Simulated PM', capabilities: ['pm'], is_active: true,
    }).select('id').single();
    if (!pmKey) throw new Error('Failed to create PM key');
    allCreatedKeyIds.push(pmKey.id);

    await db.from('applications').insert({
      position_id: pmPositionId, agent_key_id: pmKey.id,
      cover_message: 'Simulation PM joining.', status: 'accepted',
    });
    await db.from('project_members').insert({
      project_id: projectId, agent_key_id: pmKey.id, position_id: pmPositionId, role: 'agent',
    });
    await db.from('positions').update({ status: 'filled' }).eq('id', pmPositionId);

    const pmAgent: SimulationAgent = {
      id: pmKey.id, apiKey: pmApiKey, name: 'SIM-Project Manager',
      roleTitle: 'Project Manager', roleLevel: 'project_manager', positionId: pmPositionId,
    };
    agents.push(pmAgent);
    emit({ type: 'action', agent: 'System', action: '✅ Project Manager created' });

    if (isAborted()) return;

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 2: PM creates tickets via LLM + real API
    // ═════════════════════════════════════════════════════════════════════════

    emit({ type: 'thinking', agent: 'Project Manager', action: '⏳ Planning project...' });

    const pmToolCtx: ToolContext = {
      baseUrl, apiKey: pmApiKey, projectId, agentKeyId: pmKey.id,
      agentName: 'SIM-Project Manager', github: validatedGitHub, gitMode,
    };

    // Step 1: Create positions (hardcoded structure — 2 leads + 3 workers)
    const teamStructure = [
      { title: 'Frontend Lead', role_level: 'lead', capabilities: ['frontend', 'react', 'css'] },
      { title: 'Backend Lead', role_level: 'lead', capabilities: ['backend', 'api', 'database'] },
      { title: 'Frontend Developer', role_level: 'worker', capabilities: ['frontend', 'react', 'css'], reports_to: 'Frontend Lead' },
      { title: 'Backend Developer', role_level: 'worker', capabilities: ['backend', 'api', 'node'], reports_to: 'Backend Lead' },
      { title: 'Fullstack Developer', role_level: 'worker', capabilities: ['fullstack', 'frontend', 'backend'], reports_to: 'Frontend Lead' },
    ];

    const positionMap: Record<string, string> = {}; // title → id
    let sortOrder = 1;
    for (const pos of teamStructure) {
      const reportsTo = pos.reports_to ? positionMap[pos.reports_to] || pmPositionId : pmPositionId;
      const { data: created } = await db.from('positions').insert({
        project_id: projectId, title: pos.title, description: `${pos.title} for ${project.title}`,
        required_capabilities: pos.capabilities, role_level: pos.role_level,
        reports_to: reportsTo, sort_order: sortOrder++, status: 'open',
        pay_type: 'fixed', max_agents: 1, payment_status: 'unfunded', amount_earned_cents: 0,
      }).select('id').single();
      if (created) {
        positionMap[pos.title] = created.id;
        emit({ type: 'action', agent: 'Project Manager', action: `👤 Created position: ${pos.title} (${pos.role_level})` });
      }
    }

    if (isAborted()) return;

    // Step 2: PM creates tickets via LLM (only creative content — WHAT to build)
    emit({ type: 'thinking', agent: 'Project Manager', action: '⏳ Creating tickets...' });

    const pmTicketTools = OPENPOD_TOOLS.filter(t =>
      t.type === 'function' && ['create_ticket', 'post_message', 'write_knowledge'].includes(t.function.name)
    );

    const ticketResponse = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `You are the Project Manager for "${project.title}".\n\nProject: ${project.description}\n\nCreate exactly 5 tickets — one per developer. Each should be a concrete, buildable feature with:\n- Clear title\n- Detailed description (50+ chars) explaining what to build\n- Acceptance criteria\n- Priority: urgent/high/medium\n- Type: story or task\n\nAlso post an intro message in chat and write a knowledge entry about tech stack.\nDo NOT include labels on tickets.`
        },
        { role: 'user', content: 'Create exactly 5 tickets, post intro, write knowledge. Call create_ticket 5 times.' },
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
        try { args = JSON.parse(toolCall.function.arguments); } catch { continue; }
        delete args.labels;
        const { action } = await executeApiTool(toolCall.function.name, args, pmToolCtx);
        emit({ type: 'action', agent: 'Project Manager', action });
      }
    }

    if (isAborted()) return;

    // Step 3: PM generates a proper README.md via LLM + GitHub API
    if (validatedGitHub) {
      emit({ type: 'thinking', agent: 'Project Manager', action: '⏳ Writing README.md...' });

      // Read existing README if any
      const defaultBr = validatedGitHub.defaultBranch || 'main';
      let existingReadme = '';
      const readResult = await ghReadFile(validatedGitHub.token, validatedGitHub.owner, validatedGitHub.repo, 'README.md', defaultBr);
      if (!('error' in readResult)) {
        existingReadme = readResult.content;
      }

      // Collect ticket titles from what PM just created
      const { data: createdTickets } = await db.from('tickets')
        .select('title, description, priority')
        .eq('project_id', projectId).order('created_at');
      const ticketList = (createdTickets || []).map(t => `- **${t.title}** (${t.priority}): ${(t.description || '').slice(0, 80)}`).join('\n');

      const teamList = teamStructure.map(t => `- **${t.title}** (${t.role_level})`).join('\n');

      const readmePrompt = existingReadme
        ? `You are updating an existing README.md for the project "${project.title}". Here is the current README:\n\n---\n${existingReadme.slice(0, 3000)}\n---\n\nUpdate it to reflect the current project state. Keep any existing useful content but add/update: project overview, features being built, team structure, and tech stack. Make it look professional.`
        : `You are writing a README.md for a new project "${project.title}".`;

      const readmeResponse = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: `${readmePrompt}

Project: ${project.description}

## Team
${teamList}

## Features In Progress
${ticketList}

Write a professional, well-structured README.md with:
1. Project title + description (compelling, not generic)
2. Features section (based on the tickets above)
3. Tech stack (infer from the project description)
4. Team/contributors section
5. Getting started / setup instructions (reasonable defaults)
6. License placeholder

Output ONLY the raw markdown content. No code fences, no explanations.`,
          },
          { role: 'user', content: 'Write the README.md now. Output only the markdown.' },
        ],
        temperature: 0.7,
      });

      const readmeContent = readmeResponse.choices[0]?.message?.content?.trim();
      if (readmeContent && readmeContent.length > 50) {
        const writeResult = await ghWriteFile(
          validatedGitHub.token, validatedGitHub.owner, validatedGitHub.repo,
          'README.md', readmeContent, defaultBr, 'docs: Update README with project overview and team structure',
        );
        if ('error' in writeResult) {
          emit({ type: 'error', agent: 'Project Manager', action: `⚠️ Failed to write README: ${writeResult.error.slice(0, 100)}` });
        } else {
          emit({ type: 'action', agent: 'Project Manager', action: '📝 Updated README.md with project overview' });
        }
      }
    }

    if (isAborted()) return;

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 3: Auto-hire agents + ASSIGN tickets deterministically
    // ═════════════════════════════════════════════════════════════════════════

    emit({ type: 'system', agent: 'System', action: '📋 Hiring agents and assigning tickets...' });

    // Create agent keys for each position
    const { data: openPositions } = await db.from('positions')
      .select('id, title, role_level, required_capabilities')
      .eq('project_id', projectId).eq('status', 'open').order('sort_order');

    for (const pos of openPositions || []) {
      if (isAborted()) break;
      const agentApiKey = generateApiKey();
      const agentName = `SIM-${pos.title}`;
      const { data: agentKey } = await db.from('agent_keys').insert({
        owner_id: userId, name: agentName, api_key_prefix: agentApiKey.slice(0, 16),
        api_key_hash: hashApiKey(agentApiKey), agent_type: 'simulation',
        description: `Simulated ${pos.title}`, capabilities: (pos.required_capabilities || []).map((c: string) => c.toLowerCase()),
        is_active: true,
      }).select('id').single();
      if (!agentKey) continue;
      allCreatedKeyIds.push(agentKey.id);

      await db.from('applications').insert({
        position_id: pos.id, agent_key_id: agentKey.id,
        cover_message: `Simulation — ${pos.title} joining.`, status: 'accepted',
      });
      await db.from('project_members').insert({
        project_id: projectId, agent_key_id: agentKey.id, position_id: pos.id, role: 'agent',
      });
      await db.from('positions').update({ status: 'filled' }).eq('id', pos.id);

      agents.push({
        id: agentKey.id, apiKey: agentApiKey, name: agentName,
        roleTitle: pos.title, roleLevel: pos.role_level, positionId: pos.id,
      });
      emit({ type: 'action', agent: 'System', action: `✅ Hired: ${pos.title}` });
    }

    // Fetch all tickets and assign them to workers round-robin
    const { data: tickets } = await db.from('tickets')
      .select('id, title, description, status, priority')
      .eq('project_id', projectId).eq('status', 'todo').order('created_at');

    const workers = agents.filter(a => a.roleLevel === 'worker');

    if (tickets && workers.length > 0) {
      for (let i = 0; i < tickets.length && i < workers.length; i++) {
        const ticket = tickets[i];
        const worker = workers[i];

        // Assign via real API (exercises the full auth + validation stack)
        const assignCtx: ToolContext = {
          baseUrl, apiKey: worker.apiKey, projectId, agentKeyId: worker.id,
          agentName: worker.name, github: validatedGitHub, gitMode,
        };
        const { action } = await executeApiTool('update_ticket', {
          ticket_id: ticket.id, status: 'in_progress',
        }, assignCtx);
        emit({ type: 'action', agent: worker.roleTitle, action: `📋 Assigned: "${ticket.title}"` });

        // Store assignment on the agent object
        worker.assignedTicketId = ticket.id;
        worker.assignedTicketTitle = ticket.title;

        if (action.includes('ERROR')) {
          emit({ type: 'error', agent: 'System', action: `⚠️ Failed to assign ticket to ${worker.roleTitle}: ${action}` });
        }
      }
    }

    // Create git branches for each worker BEFORE they start coding (skip for direct_commit mode)
    if (validatedGitHub && gitMode !== 'direct_commit') {
      const defaultBr = validatedGitHub.defaultBranch || 'main';
      for (const worker of workers) {
        if (isAborted()) break;
        if (!worker.assignedTicketTitle) continue;
        const brName = `feat/ticket-${worker.assignedTicketTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`;
        const brResult = await ghCreateBranch(validatedGitHub.token, validatedGitHub.owner, validatedGitHub.repo, brName, defaultBr);
        if ('error' in brResult) {
          emit({ type: 'error', agent: 'System', action: `⚠️ Failed to create branch ${brName}: ${brResult.error.slice(0, 100)}` });
        } else {
          worker.branchName = brName;
          emit({ type: 'action', agent: worker.roleTitle, action: `🔀 Branch created: ${brName}` });
        }
      }
    }

    emit({ type: 'refresh', agent: 'System', action: '🔄 Team assembled, tickets assigned — starting work' });
    if (isAborted()) return;

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 4: Work Loop — deterministic orchestration, LLM writes code
    // ═════════════════════════════════════════════════════════════════════════

    const MAX_TOOL_ITERATIONS = 5;
    const defaultBranch = validatedGitHub?.defaultBranch || 'main';

    /** Run a single LLM turn for an agent with given tools */
    async function runAgentTurn(
      agent: SimulationAgent,
      systemPrompt: string,
      userMessage: string,
      tools: typeof OPENPOD_TOOLS,
      roundNum?: number,
    ): Promise<void> {
      const toolCtx: ToolContext = {
        baseUrl, apiKey: agent.apiKey, projectId, agentKeyId: agent.id,
        agentName: agent.name, github: validatedGitHub, gitMode,
      };

      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ];

      for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
        if (isAborted()) return;

        const response = await openai.chat.completions.create({
          model: MODEL, messages, tools,
          tool_choice: iter === 0 ? 'required' : 'auto',
          temperature: 0.7,
        });

        const choice = response.choices[0];
        if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) break;

        messages.push(choice.message);

        for (const toolCall of choice.message.tool_calls) {
          if (isAborted()) return;
          if (toolCall.type !== 'function') continue;

          let args;
          try { args = JSON.parse(toolCall.function.arguments); } catch {
            messages.push({ role: 'tool', tool_call_id: toolCall.id, content: 'Error: bad args' });
            continue;
          }
          const { result, action } = await executeApiTool(toolCall.function.name, args, toolCtx);
          emit({ type: 'action', agent: agent.roleTitle, action, round: roundNum });
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
        }
      }
    }

    // ── Work rounds ──
    for (let round = 1; round <= maxRounds; round++) {
      if (isAborted()) break;

      emit({ type: 'round', agent: 'System', action: `🔄 Round ${round}/${maxRounds}`, round });

      // 1. WORKERS: Each worker writes code for their assigned ticket
      for (const worker of workers) {
        if (isAborted()) break;
        if (!worker.assignedTicketId) continue;

        // Check current ticket status
        const { data: ticket } = await db.from('tickets')
          .select('id, title, description, status, acceptance_criteria')
          .eq('id', worker.assignedTicketId).single();
        if (!ticket || ticket.status === 'done' || ticket.status === 'cancelled') continue;
        if (ticket.status === 'in_review') continue; // Already submitted

        emit({ type: 'thinking', agent: worker.roleTitle, action: `⏳ Working on "${ticket.title}"...` });

        const roleDesc = getRoleDescription(worker.roleTitle);
        const tools = getWorkerTools(!!validatedGitHub, gitMode);

        const criteria = Array.isArray(ticket.acceptance_criteria)
          ? ticket.acceptance_criteria.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')
          : '';

        const branchName = worker.branchName || `feat/ticket-${ticket.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`;
        const targetBranch = gitMode === 'direct_commit' ? defaultBranch : branchName;

        let ghInstructions: string;
        if (validatedGitHub && gitMode === 'direct_commit') {
          // Direct commit mode — write files straight to default branch, no PRs
          ghInstructions = `## GitHub Workflow (DIRECT COMMIT MODE)
Write real code directly to the "${defaultBranch}" branch using these tools:
1. write_file — write 2-3 implementation files with branch="${defaultBranch}". Use proper file paths like "src/components/Auth.tsx". Write REAL, complete, working code.

IMPORTANT: For EVERY write_file call, set branch="${defaultBranch}" exactly.
After writing your files, post a message in chat about what you implemented.`;
        } else if (validatedGitHub && worker.branchName) {
          // PR modes (create_pr or auto_merge) — same worker instructions
          ghInstructions = `## GitHub Workflow (REQUIRED)
Your branch "${branchName}" is already created. Write real code using these tools:
1. write_file — write 2-3 implementation files on branch="${branchName}". Use proper file paths like "src/components/Auth.tsx". Write REAL, complete, working code.
2. create_pull_request — title: "${ticket.title}", head: "${branchName}"

IMPORTANT: For EVERY write_file call, set branch="${branchName}" exactly.
After creating the PR, post a message in chat about it.`;
        } else {
          ghInstructions = `## Implementation
Write your implementation as a detailed comment on the ticket using add_comment. Include real code in markdown code blocks.
Then post a message in chat saying you completed "${ticket.title}".`;
        }

        const userMsg = gitMode === 'direct_commit'
          ? `Write the code for "${ticket.title}" now. Use write_file to commit files directly to "${defaultBranch}".`
          : `Write the code for "${ticket.title}" now. Use write_file to write files on branch "${branchName}", then create_pull_request.`;

        await runAgentTurn(
          worker,
          `You are "${worker.roleTitle}" working on "${project.title}".
${roleDesc}

## Your Assigned Ticket
Title: ${ticket.title}
Description: ${ticket.description || 'No description'}
${criteria ? `Acceptance Criteria:\n${criteria}` : ''}

${ghInstructions}

Write REAL, working implementation code. Not pseudocode, not placeholders.`,
          userMsg,
          tools,
          round,
        );

        // After worker turn, move ticket to in_review via admin client
        // (deterministic — no LLM needed for status change)
        if (ticket.status === 'in_progress') {
          await db.from('tickets').update({ status: 'in_review' }).eq('id', ticket.id);
          emit({ type: 'action', agent: worker.roleTitle, action: `📋 Submitted "${ticket.title}" for review` });
        }
      }

      if (isAborted()) break;

      // 2. LEADS: Review submitted work
      const leads = agents.filter(a => a.roleLevel === 'lead');
      for (const lead of leads) {
        if (isAborted()) break;

        // Get tickets in review that match lead's domain
        const { data: reviewTickets } = await db.from('tickets')
          .select('id, title, description, status')
          .eq('project_id', projectId).eq('status', 'in_review');

        if (!reviewTickets || reviewTickets.length === 0) continue;

        emit({ type: 'thinking', agent: lead.roleTitle, action: `⏳ Reviewing ${reviewTickets.length} ticket(s)...` });

        // CRITICAL: Include ticket IDs so leads can use add_comment
        const ticketSummary = reviewTickets.map(t => `- ticket_id="${t.id}" "${t.title}": ${(t.description || '').slice(0, 100)}`).join('\n');
        const tools = getLeadTools();

        // Leads only get 1 iteration — they don't need multi-round tool calling
        const leadToolCtx: ToolContext = {
          baseUrl, apiKey: lead.apiKey, projectId, agentKeyId: lead.id,
          agentName: lead.name, github: validatedGitHub, gitMode,
        };

        const leadMessages: ChatCompletionMessageParam[] = [
          {
            role: 'system',
            content: `You are "${lead.roleTitle}" reviewing work on "${project.title}".
${getRoleDescription(lead.roleTitle)}

## Tickets to Review (use the ticket_id UUID for add_comment)
${ticketSummary}

Do ALL of these in ONE round of tool calls:
1. Add a review comment on 1-2 tickets using add_comment with the ticket_id UUID
2. Write a knowledge entry (write_knowledge)
3. Post a team update in chat (post_message)`,
          },
          { role: 'user', content: 'Review the submitted tickets. Call add_comment, write_knowledge, and post_message.' },
        ];

        const leadResponse = await openai.chat.completions.create({
          model: MODEL, messages: leadMessages, tools,
          tool_choice: 'required', temperature: 0.7,
        });
        const leadChoice = leadResponse.choices[0];
        if (leadChoice.message.tool_calls) {
          for (const toolCall of leadChoice.message.tool_calls) {
            if (isAborted()) break;
            if (toolCall.type !== 'function') continue;
            let args;
            try { args = JSON.parse(toolCall.function.arguments); } catch { continue; }
            const { result, action } = await executeApiTool(toolCall.function.name, args, leadToolCtx);
            emit({ type: 'action', agent: lead.roleTitle, action, round });
          }
        }
      }

      if (isAborted()) break;

      // 3. PM: Approve all in_review tickets (deterministic — no LLM)
      const { data: reviewableTickets } = await db.from('tickets')
        .select('id, title').eq('project_id', projectId).eq('status', 'in_review');

      if (reviewableTickets && reviewableTickets.length > 0) {
        for (const ticket of reviewableTickets) {
          const { action } = await executeApiTool('approve_ticket', {
            ticket_id: ticket.id,
            comment: `Approved by PM — "${ticket.title}" implementation looks good.`,
          }, pmToolCtx);
          emit({ type: 'action', agent: 'Project Manager', action: action.includes('ERROR')
            ? `⚠️ Couldn't approve "${ticket.title}": ${action.slice(0, 80)}`
            : `✅ Approved: "${ticket.title}"` });
        }

        // PM posts summary in chat
        await executeApiTool('post_message', {
          content: `Project Manager update: Approved ${reviewableTickets.length} ticket(s) this round — ${reviewableTickets.map(t => t.title).join(', ')}. Good progress team!`,
        }, pmToolCtx);
        emit({ type: 'action', agent: 'Project Manager', action: `💬 Posted progress update` });
      }

      // Check if all tickets are done
      const { data: totalTickets } = await db.from('tickets').select('id').eq('project_id', projectId);
      const { data: activeTickets } = await db.from('tickets')
        .select('id').eq('project_id', projectId).not('status', 'in', '(done,cancelled)');

      if (totalTickets && totalTickets.length > 0 && (!activeTickets || activeTickets.length === 0)) {
        emit({ type: 'system', agent: 'System', action: `🎉 All ${totalTickets.length} tickets completed!` });
        break;
      }

      // If workers still have work, assign new tickets for next round
      const { data: unassignedTickets } = await db.from('tickets')
        .select('id, title').eq('project_id', projectId).eq('status', 'todo').order('created_at');
      if (unassignedTickets && unassignedTickets.length > 0) {
        const freeWorkers = workers.filter(w => {
          // Worker is free if their ticket is done
          if (!w.assignedTicketId) return true;
          const done = !activeTickets?.find(t => t.id === w.assignedTicketId);
          return done;
        });
        for (let i = 0; i < unassignedTickets.length && i < freeWorkers.length; i++) {
          const ticket = unassignedTickets[i];
          const worker = freeWorkers[i];
          const assignCtx: ToolContext = {
            baseUrl, apiKey: worker.apiKey, projectId, agentKeyId: worker.id,
            agentName: worker.name, github: validatedGitHub, gitMode,
          };
          await executeApiTool('update_ticket', { ticket_id: ticket.id, status: 'in_progress' }, assignCtx);
          worker.assignedTicketId = ticket.id;
          worker.assignedTicketTitle = ticket.title;
          emit({ type: 'action', agent: worker.roleTitle, action: `📋 New assignment: "${ticket.title}"` });
        }
      }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // PHASE 5: Done
    // ═════════════════════════════════════════════════════════════════════════

    await db.from('projects').update({ status: 'in_progress' }).eq('id', projectId);
    emit({ type: 'done', agent: 'System', action: '✅ Simulation complete — refresh to see changes' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    emit({ type: 'error', agent: 'System', action: `❌ Error: ${message}` });
  } finally {
    clearInterval(keepAliveInterval);
    const keyIds = new Set([...agents.map(a => a.id), ...allCreatedKeyIds]);
    await Promise.allSettled(
      Array.from(keyIds).map(id => db.from('agent_keys').update({ is_active: false }).eq('id', id))
    );
  }
}
