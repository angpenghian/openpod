import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

const MODEL = 'gpt-4o-mini';

const AGENT_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'post_chat',
      description: 'Post a message in the #general chat channel for the team to see',
      parameters: {
        type: 'object',
        properties: { message: { type: 'string', description: 'The message to post' } },
        required: ['message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_ticket',
      description: 'Create a detailed ticket in the project Kanban board. Write descriptions that another agent can pick up and execute WITHOUT asking questions. BAD: "Build the API". GOOD: "Implement user authentication endpoint with JWT tokens, bcrypt password hashing, refresh token rotation, and rate limiting at 100 req/min. Endpoint: POST /api/auth/login. Returns: { token, refreshToken, expiresAt }."',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short ticket title (specific and actionable)' },
          description: { type: 'string', description: 'Detailed description with context, approach, and deliverables. Minimum 50 characters. Use markdown. Include: what to build, how to build it, what files to touch, what the output looks like.' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Priority level' },
          ticket_type: { type: 'string', enum: ['epic', 'story', 'task', 'bug', 'spike'], description: 'Type of ticket' },
          acceptance_criteria: { type: 'array', items: { type: 'string' }, description: 'List of testable criteria. Required for stories. Each criterion should be a clear pass/fail condition.' },
          labels: { type: 'array', items: { type: 'string' }, description: 'Labels/tags for categorization' },
        },
        required: ['title', 'description', 'priority', 'ticket_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_ticket',
      description: 'Update the status of an existing ticket',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'The ticket ID to update' },
          status: { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done'], description: 'New status' },
          comment: { type: 'string', description: 'Comment explaining the update' },
        },
        required: ['ticket_id', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_memory',
      description: 'Write a DETAILED knowledge entry to the shared memory/knowledge base. Other agents read these entries to understand project context, so write thoroughly. Use markdown headers (##) to structure content. Minimum 3-5 paragraphs. Structure by category — Architecture: System Overview, Key Components, Data Flow. Decisions: Decision, Context, Options Considered, Rationale. Patterns: Pattern Name, When to Use, Implementation, Gotchas. Context: Project Background, Current Phase, Team & Roles.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Descriptive title (5+ words, be specific)' },
          content: { type: 'string', description: 'Detailed content in markdown with ## headers. Minimum 100 characters. Other agents depend on this — write as if onboarding a new team member.' },
          category: { type: 'string', enum: ['architecture', 'decisions', 'patterns', 'context', 'general'] },
          tags: { type: 'array', items: { type: 'string' }, description: 'Tags for searchability (e.g. ["auth", "api", "database"])' },
          importance: { type: 'string', enum: ['pinned', 'high', 'normal', 'low'], description: 'Importance level. Use pinned for critical project info, high for key decisions.' },
        },
        required: ['title', 'content', 'category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_position',
      description: 'Create a new position/role in the project org chart. IMPORTANT: Create leads FIRST, then create workers with reports_to_title pointing to their lead. Examples: Frontend Lead, Backend Lead, DevOps Lead, QA Lead, then Sr Frontend Dev (reports to Frontend Lead), Jr Backend Dev (reports to Backend Lead), DevOps Engineer (reports to DevOps Lead), etc.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Position title (e.g. "DevOps Lead", "QA Engineer", "Security Engineer", "Sr Frontend Developer")' },
          description: { type: 'string', description: 'What this role does and why the project needs it' },
          required_capabilities: { type: 'array', items: { type: 'string' }, description: 'Skills needed (e.g. ["kubernetes", "ci-cd", "monitoring"])' },
          role_level: { type: 'string', enum: ['lead', 'worker'], description: 'lead = department head who manages others, worker = individual contributor' },
          reports_to_title: { type: 'string', description: 'Title of the position this role reports to. Workers MUST specify their lead (e.g. "Backend Lead"). Leads report to PM automatically.' },
        },
        required: ['title', 'description', 'required_capabilities', 'role_level'],
      },
    },
  },
];

type AdminClient = ReturnType<typeof createAdminClient>;

async function executeTool(
  db: AdminClient,
  toolName: string,
  args: Record<string, unknown>,
  ctx: { projectId: string; agentKeyId: string; channelId: string; nextTicketNumber: number; pmPositionId: string | null; nextSortOrder: number },
): Promise<{ result: string; action: string }> {
  switch (toolName) {
    case 'post_chat': {
      await db.from('messages').insert({
        channel_id: ctx.channelId,
        author_agent_key_id: ctx.agentKeyId,
        content: args.message as string,
      });
      return { result: 'Message posted', action: `💬 ${args.message}` };
    }
    case 'create_ticket': {
      const ticketDesc = (args.description as string) || '';
      const ticketType = (args.ticket_type as string) || 'task';
      // Enforce description quality for story/task/bug
      if (['story', 'task', 'bug'].includes(ticketType) && ticketDesc.length < 50) {
        return { result: 'ERROR: Description too short. Story/task/bug tickets need detailed descriptions (50+ chars) so other agents can work on them without asking questions. Include: context, approach, deliverables, and affected files.', action: `⚠️ Ticket rejected (description too short): ${args.title}` };
      }
      const { data: ticket } = await db
        .from('tickets')
        .insert({
          project_id: ctx.projectId,
          ticket_number: ctx.nextTicketNumber,
          title: args.title as string,
          description: ticketDesc,
          status: 'todo',
          priority: args.priority as string,
          ticket_type: ticketType,
          acceptance_criteria: (args.acceptance_criteria as string[]) || null,
          labels: (args.labels as string[]) || [],
          created_by_agent_key_id: ctx.agentKeyId,
        })
        .select('id, ticket_number')
        .single();
      ctx.nextTicketNumber++;
      return {
        result: `Ticket #${ticket?.ticket_number} created (id: ${ticket?.id})`,
        action: `🎫 Created ${ticketType} #${ticket?.ticket_number}: ${args.title}`,
      };
    }
    case 'update_ticket': {
      await db
        .from('tickets')
        .update({ status: args.status as string, assignee_agent_key_id: ctx.agentKeyId })
        .eq('id', args.ticket_id as string);
      if (args.comment) {
        await db.from('ticket_comments').insert({
          ticket_id: args.ticket_id as string,
          author_agent_key_id: ctx.agentKeyId,
          content: args.comment as string,
        });
      }
      return {
        result: `Ticket updated to ${args.status}`,
        action: `📋 Updated ticket → ${args.status}${args.comment ? `: "${args.comment}"` : ''}`,
      };
    }
    case 'write_memory': {
      const memContent = args.content as string;
      if (memContent.length < 100) {
        return { result: 'ERROR: Content too short. Memory entries must be at least 100 characters with structured markdown (## headers). Other agents depend on these entries for context. Write as if onboarding a new team member.', action: `⚠️ Memory rejected (too short): ${args.title}` };
      }
      await db.from('knowledge_entries').insert({
        project_id: ctx.projectId,
        title: args.title as string,
        content: memContent,
        category: args.category as string,
        tags: (args.tags as string[]) || [],
        importance: (args.importance as string) || 'normal',
        version: 1,
        created_by_agent_key_id: ctx.agentKeyId,
      });
      return { result: 'Knowledge entry saved', action: `🧠 Wrote to memory: ${args.title}` };
    }
    case 'create_position': {
      // Determine reports_to: if reports_to_title provided, look up that position
      let reportsTo = ctx.pmPositionId;
      if (args.reports_to_title && typeof args.reports_to_title === 'string') {
        // Try exact match first, then fuzzy match with wildcards
        const { data: exactMatch } = await db
          .from('positions')
          .select('id')
          .eq('project_id', ctx.projectId)
          .ilike('title', args.reports_to_title as string)
          .maybeSingle();

        if (exactMatch) {
          reportsTo = exactMatch.id;
        } else {
          // Fuzzy match: wrap with wildcards for partial title matches
          const { data: fuzzyMatch } = await db
            .from('positions')
            .select('id')
            .eq('project_id', ctx.projectId)
            .ilike('title', `%${args.reports_to_title as string}%`)
            .limit(1)
            .maybeSingle();
          if (fuzzyMatch) {
            reportsTo = fuzzyMatch.id;
          }
        }
      }

      const { data: pos } = await db
        .from('positions')
        .insert({
          project_id: ctx.projectId,
          title: args.title as string,
          description: args.description as string,
          required_capabilities: args.required_capabilities as string[],
          role_level: args.role_level as string,
          reports_to: reportsTo,
          sort_order: ctx.nextSortOrder++,
          status: 'open',
        })
        .select('id')
        .single();
      return {
        result: `Position created (id: ${pos?.id}), reports to: ${args.reports_to_title || 'Project Manager'}`,
        action: `👤 Created position: ${args.title} (${args.role_level})`,
      };
    }
    default:
      return { result: 'Unknown tool', action: `Unknown tool: ${toolName}` };
  }
}

async function getWorkspaceContext(
  db: AdminClient,
  projectId: string,
  channelId: string,
): Promise<string> {
  const { data: positions } = await db
    .from('positions')
    .select('id, title, role_level, status, required_capabilities, reports_to')
    .eq('project_id', projectId)
    .order('sort_order');

  const { data: tickets } = await db
    .from('tickets')
    .select('id, ticket_number, title, status, priority, assignee_agent_key_id')
    .eq('project_id', projectId)
    .neq('status', 'cancelled')
    .order('ticket_number');

  const { data: messages } = await db
    .from('messages')
    .select('content, author_agent_key_id, created_at')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: knowledge } = await db
    .from('knowledge_entries')
    .select('title, content, category, tags, importance')
    .eq('project_id', projectId)
    .order('importance', { ascending: true })
    .limit(10);

  let context = '## Current Workspace State\n\n';

  if (positions && positions.length > 0) {
    context += '### Positions / Org Chart\n';
    for (const p of positions) {
      context += `- ${p.title} (${p.role_level}) [${p.status}] — needs: ${(p.required_capabilities || []).join(', ')}\n`;
    }
    context += '\n';
  }

  if (tickets && tickets.length > 0) {
    context += '### Tickets\n';
    for (const t of tickets) {
      context += `- #${t.ticket_number} [${t.status}] (${t.priority}) "${t.title}" ${t.assignee_agent_key_id ? '(assigned)' : '(unassigned)'} id:${t.id}\n`;
    }
    context += '\n';
  } else {
    context += '### Tickets\nNo tickets yet.\n\n';
  }

  if (messages && messages.length > 0) {
    context += '### Recent Chat (newest first)\n';
    for (const m of (messages).reverse()) {
      context += `- ${m.content}\n`;
    }
    context += '\n';
  }

  if (knowledge && knowledge.length > 0) {
    context += '### Knowledge Base\n';
    for (const k of knowledge) {
      const truncatedContent = (k.content || '').slice(0, 500);
      const tags = (k.tags && k.tags.length > 0) ? ` [${k.tags.join(', ')}]` : '';
      context += `\n#### [${k.category}${k.importance !== 'normal' ? ` | ${k.importance}` : ''}] ${k.title}${tags}\n`;
      context += `${truncatedContent}${k.content && k.content.length > 500 ? '...' : ''}\n`;
    }
  }

  return context;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Read config from body
  let maxRounds = 10;
  try {
    const body = await request.json();
    if (body.maxRounds && typeof body.maxRounds === 'number') {
      maxRounds = Math.max(1, body.maxRounds);
    }
  } catch {
    // No body or invalid JSON, use default
  }

  // Admin client bypasses RLS — needed for agent messages/comments
  const db = createAdminClient();

  const { data: project } = await db
    .from('projects')
    .select('id, owner_id, title, description, budget_cents, deadline, github_repo')
    .eq('id', projectId)
    .single();

  if (!project || project.owner_id !== user.id) {
    return new Response(JSON.stringify({ error: 'Not project owner' }), { status: 403 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), { status: 500 });
  }

  const openai = new OpenAI({ apiKey });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      function send(data: { agent: string; action: string; type?: string }) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      }

      try {
        // Get or create #general channel
        let channelId: string;
        const { data: existingChannel } = await db
          .from('channels')
          .select('id')
          .eq('project_id', projectId)
          .eq('is_default', true)
          .single();

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

        // ═══════════════════════════════════════════════════════════
        // PHASE 1: PM joins and DECIDES what the project needs
        // ═══════════════════════════════════════════════════════════

        // Get PM position (auto-created on project creation)
        const { data: pmPosition } = await db
          .from('positions')
          .select('id')
          .eq('project_id', projectId)
          .eq('role_level', 'project_manager')
          .single();

        if (!pmPosition) throw new Error('No PM position found');

        // Create PM agent key
        const pmName = 'SIM-Project Manager';
        let pmAgentKeyId: string;
        const { data: existingPm } = await db
          .from('agent_keys')
          .select('id')
          .eq('name', pmName)
          .eq('owner_id', user.id)
          .single();

        if (existingPm) {
          pmAgentKeyId = existingPm.id;
        } else {
          const { data: pmKey } = await db
            .from('agent_keys')
            .insert({
              owner_id: user.id,
              name: pmName,
              api_key_prefix: 'sim_project_manager',
              api_key_hash: `sim_${crypto.randomUUID().replace(/-/g, '')}`,
              agent_type: 'simulation',
              description: 'Simulated Project Manager',
              capabilities: ['pm', 'planning', 'coordination', 'hiring'],
              is_active: false,
            })
            .select('id')
            .single();
          if (!pmKey) throw new Error('Failed to create PM agent key');
          pmAgentKeyId = pmKey.id;
        }

        // Assign PM to position
        await db.from('applications').insert({
          position_id: pmPosition.id,
          agent_key_id: pmAgentKeyId,
          cover_message: 'Live simulation — PM agent joining.',
          status: 'accepted',
        }).select().maybeSingle();
        await db.from('project_members').insert({
          project_id: projectId,
          agent_key_id: pmAgentKeyId,
          position_id: pmPosition.id,
          role: 'agent',
        }).select().maybeSingle();
        await db.from('positions').update({ status: 'filled' }).eq('id', pmPosition.id);

        send({ agent: 'System', action: '🤖 Project Manager hired — analyzing project vision...' });

        // Get next ticket number
        const { data: lastTicket } = await db
          .from('tickets')
          .select('ticket_number')
          .eq('project_id', projectId)
          .order('ticket_number', { ascending: false })
          .limit(1);

        const ctx = {
          projectId,
          agentKeyId: pmAgentKeyId,
          channelId,
          nextTicketNumber: (lastTicket?.[0]?.ticket_number || 0) + 1,
          pmPositionId: pmPosition.id,
          nextSortOrder: 1,
        };

        // PM Turn 1: Analyze vision → create positions + tickets + memory
        send({ agent: 'Project Manager', action: '⏳ Analyzing project vision and building the team...', type: 'thinking' });

        const pmPrompt = `You are the Project Manager for "${project.title}".

## Project Vision
${project.description}

## Your Job Right Now
You just joined this project. You need to:

1. **Build the team** — Create positions using create_position. Think about what this SPECIFIC project needs.

   **CRITICAL: Create leads FIRST, then workers.**
   - Step 1: Create all department leads (role_level: "lead") — they automatically report to you (PM)
   - Step 2: Create workers (role_level: "worker") with reports_to_title set to their lead's exact title

   Example ordering:
   - create_position("Frontend Lead", ..., role_level: "lead")
   - create_position("Backend Lead", ..., role_level: "lead")
   - create_position("Sr Frontend Developer", ..., role_level: "worker", reports_to_title: "Frontend Lead")
   - create_position("Jr Backend Developer", ..., role_level: "worker", reports_to_title: "Backend Lead")

   **NOTE: A "Context Keeper" lead position has already been created.** This lead maintains the project knowledge base and documents all decisions. Do NOT create another documentation or context role — the Context Keeper handles this.

   Available roles to consider (only create what the project needs):
   - Leads: Frontend Lead, Backend Lead, DevOps Lead, QA Lead, Data Lead, Security Lead, Design Lead, Infrastructure Lead
   - Workers: Sr/Jr developers, SRE, DBA, DevOps Engineer, QA Engineer, Security Engineer, UI/UX Designer, Data Engineer, ML Engineer, Technical Writer, Mobile Developer, Platform Engineer

2. **Create tickets** — Break the project into 4-8 actionable tickets for different departments.

3. **Post in chat** — Introduce yourself, outline the team structure.

4. **Write to memory** — Document architecture decisions and team plan.

Be concise. A simple web app needs different roles than a distributed system or ML pipeline.`;

        const pmWorkspace = await getWorkspaceContext(db, projectId, channelId);
        const pmMessages: ChatCompletionMessageParam[] = [
          { role: 'system', content: pmPrompt },
          { role: 'user', content: `${pmWorkspace}\n\nBuild the team and plan the project. IMPORTANT: Create all leads FIRST, then create workers with reports_to_title set to their lead's exact title. Use create_position, create_ticket, post_chat, and write_memory. Call multiple tools.` },
        ];

        const pmResponse = await openai.chat.completions.create({
          model: MODEL,
          messages: pmMessages,
          tools: AGENT_TOOLS,
          tool_choice: 'required',
          temperature: 0.7,
        });

        const pmChoice = pmResponse.choices[0];
        if (pmChoice.message.tool_calls) {
          // Sort tool calls: non-position calls first, then lead positions, then worker positions.
          // This ensures leads exist in DB before workers try to look them up via reports_to_title.
          const sortedCalls = [...pmChoice.message.tool_calls].sort((a, b) => {
            const getOrder = (tc: typeof a) => {
              if (tc.type !== 'function') return 0;
              const fn = tc as { type: 'function'; function: { name: string; arguments: string } };
              if (fn.function.name !== 'create_position') return 0; // non-position calls first
              try {
                const args = JSON.parse(fn.function.arguments);
                return args.role_level === 'lead' ? 1 : 2; // leads before workers
              } catch { return 1; }
            };
            return getOrder(a) - getOrder(b);
          });

          for (const toolCall of sortedCalls) {
            if (toolCall.type !== 'function') continue;
            const fn = toolCall as { type: 'function'; function: { name: string; arguments: string } };
            const args = JSON.parse(fn.function.arguments);
            const { action } = await executeTool(db, fn.function.name, args, ctx);
            send({ agent: 'Project Manager', action });
          }
        }

        // ═══════════════════════════════════════════════════════════
        // PHASE 2: Auto-hire agents for every position PM created
        // ═══════════════════════════════════════════════════════════

        // Fetch all positions PM just created (status: 'open')
        const { data: openPositions } = await db
          .from('positions')
          .select('id, title, role_level, required_capabilities, reports_to')
          .eq('project_id', projectId)
          .eq('status', 'open')
          .order('sort_order');

        if (!openPositions || openPositions.length === 0) {
          send({ agent: 'System', action: '⚠️ PM created no positions — skipping team assembly' });
        } else {
          // Auto-organize hierarchy: workers should report to matching leads, not PM
          const leads = openPositions.filter(p => p.role_level === 'lead');
          const workers = openPositions.filter(p => p.role_level === 'worker');

          // Domain keyword groups — map worker titles to lead domains
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

          function findLeadDomain(title: string): string | null {
            const t = title.toLowerCase();
            for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
              if (keywords.some(k => t.includes(k))) return domain;
            }
            return null;
          }

          // For each worker that reports to PM, try to find a better lead match
          for (const worker of workers) {
            if (worker.reports_to !== pmPosition.id) continue; // already assigned to a lead

            let bestLead: typeof leads[0] | null = null;

            // Strategy 1: Domain keyword matching (most reliable)
            const workerDomain = findLeadDomain(worker.title);
            if (workerDomain) {
              for (const lead of leads) {
                const leadDomain = findLeadDomain(lead.title);
                if (leadDomain === workerDomain) {
                  bestLead = lead;
                  break;
                }
              }
            }

            // Strategy 2: Capability overlap (fallback)
            if (!bestLead) {
              const workerCaps = new Set(worker.required_capabilities || []);
              let bestOverlap = 0;
              for (const lead of leads) {
                const leadCaps = lead.required_capabilities || [];
                const overlap = leadCaps.filter((c: string) => workerCaps.has(c)).length;
                if (overlap > bestOverlap) {
                  bestOverlap = overlap;
                  bestLead = lead;
                }
              }
            }

            // Strategy 3: Direct title keyword extraction (last resort)
            if (!bestLead) {
              const workerTitle = worker.title.toLowerCase();
              for (const lead of leads) {
                const leadTitle = lead.title.toLowerCase();
                const keywords = leadTitle.replace(/\b(lead|head|director|manager|chief)\b/g, '').trim().split(/\s+/);
                if (keywords.some((k: string) => k.length > 2 && workerTitle.includes(k))) {
                  bestLead = lead;
                  break;
                }
              }
            }

            // Fallback: assign to first lead rather than leaving under PM
            if (!bestLead && leads.length > 0) {
              bestLead = leads[0];
            }

            if (bestLead) {
              await db.from('positions').update({ reports_to: bestLead.id }).eq('id', worker.id);
            }
          }

          send({ agent: 'System', action: `📋 PM created ${openPositions.length} positions — hiring agents...` });

          // Create agent key + assign for each position
          const teamAgents: { id: string; role: string; positionId: string; roleLevel: string }[] = [];

          for (const pos of openPositions) {
            const agentName = `SIM-${pos.title}`;
            let agentKeyId: string;

            const { data: existing } = await db
              .from('agent_keys')
              .select('id')
              .eq('name', agentName)
              .eq('owner_id', user.id)
              .single();

            if (existing) {
              agentKeyId = existing.id;
            } else {
              const { data: key } = await db
                .from('agent_keys')
                .insert({
                  owner_id: user.id,
                  name: agentName,
                  api_key_prefix: `sim_${pos.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
                  api_key_hash: `sim_${crypto.randomUUID().replace(/-/g, '')}`,
                  agent_type: 'simulation',
                  description: `Simulated ${pos.title}`,
                  capabilities: pos.required_capabilities || [],
                  is_active: false,
                })
                .select('id')
                .single();
              if (!key) continue;
              agentKeyId = key.id;
            }

            // Apply + accept + join
            await db.from('applications').insert({
              position_id: pos.id,
              agent_key_id: agentKeyId,
              cover_message: `Live simulation — ${pos.title} agent joining.`,
              status: 'accepted',
            }).select().maybeSingle();
            await db.from('project_members').insert({
              project_id: projectId,
              agent_key_id: agentKeyId,
              position_id: pos.id,
              role: 'agent',
            }).select().maybeSingle();
            await db.from('positions').update({ status: 'filled' }).eq('id', pos.id);

            teamAgents.push({
              id: agentKeyId,
              role: pos.title,
              positionId: pos.id,
              roleLevel: pos.role_level,
            });

            send({ agent: 'System', action: `✅ Hired: ${pos.title}` });
          }

          // Tell client to refresh server data — org chart now has full hierarchy
          send({ agent: 'System', action: '🔄 Team assembled — refreshing workspace...', type: 'refresh' });

          // ═══════════════════════════════════════════════════════════
          // PHASE 3: Each agent gets a setup turn, then work rounds
          // ═══════════════════════════════════════════════════════════

          // Role descriptions for simulation prompts
          const roleDescriptions: Record<string, string> = {
            // Leads
            'frontend lead': 'You own the frontend — UI architecture, component system, state management, and user experience quality. You review frontend work and coordinate with Design and Backend.',
            'backend lead': 'You own backend systems — API design, database architecture, server logic, and integrations. You review backend PRs and coordinate with Frontend on API contracts.',
            'design lead': 'You own UX — research, wireframes, design system, and usability. You create design specs and review implemented UI for quality.',
            'devops lead': 'You own infrastructure — CI/CD, cloud resources, monitoring, and deployments. You keep the system running and coordinate releases.',
            'qa lead': 'You own quality — test strategy, test infrastructure, and release readiness. Nothing ships without your sign-off.',
            'data lead': 'You own data infrastructure — pipelines, analytics, ML systems, and data quality. You coordinate with Backend on data flows.',
            'security lead': 'You own security — threat modeling, code review for vulnerabilities, access controls, and compliance.',
            // Workers
            'frontend': 'You build UI — components, pages, interactions, responsive design. You turn designs into working, accessible code.',
            'backend': 'You build server-side logic — APIs, database queries, business logic, integrations. You ensure data flows correctly.',
            'fullstack': 'You work across the full stack — frontend UI, backend APIs, database. You own features end-to-end.',
            'designer': 'You create the UX — wireframes, mockups, prototypes, design system. You do NOT write code — you produce design artifacts and specs.',
            'qa': 'You ensure quality — test plans, test execution, bug reports, fix verification. You are the quality gate.',
            'devops': 'You build infrastructure — CI/CD pipelines, cloud resources, monitoring, deployment automation.',
            'security': 'You secure the system — vulnerability assessment, security reviews, penetration testing, hardening.',
            'ml': 'You build ML systems — data pipelines, model training, evaluation, deployment.',
            'documentation': 'You write docs — API documentation, user guides, architecture docs. You do NOT write application code.',
            'database': 'You manage databases — schema design, query optimization, migrations, backups, replication.',
            'mobile': 'You build mobile apps — native or cross-platform. You handle mobile UX, device APIs, app store requirements.',
          };

          function getRoleDescription(title: string, roleLevel: string): string {
            const t = title.toLowerCase();
            if (roleLevel === 'lead') {
              for (const [key, desc] of Object.entries(roleDescriptions)) {
                if (key.endsWith(' lead') && t.includes(key.replace(' lead', ''))) return desc;
              }
              return 'You are a department lead — you manage your team, review their work, and coordinate deliverables.';
            }
            // Worker matching
            if (/\b(ui\/?ux|ux\/?ui|designer|design)\b/.test(t)) return roleDescriptions.designer;
            if (/\b(qa|quality|test)\b/.test(t)) return roleDescriptions.qa;
            if (/\b(devops|ci\/?cd|sre|reliability)\b/.test(t)) return roleDescriptions.devops;
            if (/\b(security|pentest)\b/.test(t)) return roleDescriptions.security;
            if (/\b(ml|machine.?learn|data.?scien)\b/.test(t)) return roleDescriptions.ml;
            if (/\b(doc|writer|technical.?writ)\b/.test(t)) return roleDescriptions.documentation;
            if (/\b(dba|database.?admin)\b/.test(t)) return roleDescriptions.database;
            if (/\b(mobile|ios|android|flutter)\b/.test(t)) return roleDescriptions.mobile;
            if (/\b(fullstack|full.?stack)\b/.test(t)) return roleDescriptions.fullstack;
            if (/\b(frontend|front.?end|react|vue)\b/.test(t)) return roleDescriptions.frontend;
            if (/\b(backend|back.?end|server|api|node)\b/.test(t)) return roleDescriptions.backend;
            return roleDescriptions.fullstack;
          }

          // Setup turns — leads first, then workers
          const sortedAgents = [
            ...teamAgents.filter(a => a.roleLevel === 'lead'),
            ...teamAgents.filter(a => a.roleLevel === 'worker'),
          ];

          const setupCount = 1 + sortedAgents.length; // PM turn + all team setup turns

          for (const agent of sortedAgents) {
            if (closed) break;
            ctx.agentKeyId = agent.id;

            send({ agent: agent.role, action: `⏳ ${agent.role} joining team...`, type: 'thinking' });

            const workspaceContext = await getWorkspaceContext(db, projectId, channelId);

            const roleDesc = getRoleDescription(agent.role, agent.roleLevel);

            const setupPrompt = `You are ${agent.role} for "${project.title}".

## Your Role
${roleDesc}

## Project Vision
${project.description}

You just joined the team. Your job:
1. Say hi in chat briefly (mention your specific role and what you'll focus on)
2. Look at the ticket board — pick up an unassigned ticket that matches YOUR skills (use the ticket id to update status to in_progress)
3. If you're a lead, write a knowledge entry about your department's approach and standards

Be concise and professional. Stay in character for YOUR specific role. Don't repeat what others have said.`;

            const messages: ChatCompletionMessageParam[] = [
              { role: 'system', content: setupPrompt },
              { role: 'user', content: `${workspaceContext}\n\nTake your actions now. You can call multiple tools.` },
            ];

            const response = await openai.chat.completions.create({
              model: MODEL,
              messages,
              tools: AGENT_TOOLS,
              tool_choice: 'required',
              temperature: 0.7,
            });

            const choice = response.choices[0];
            if (choice.message.tool_calls) {
              for (const toolCall of choice.message.tool_calls) {
                if (toolCall.type !== 'function') continue;
                const fn = toolCall as { type: 'function'; function: { name: string; arguments: string } };
                const args = JSON.parse(fn.function.arguments);
                const { action } = await executeTool(db, fn.function.name, args, ctx);
                send({ agent: agent.role, action });
              }
            }
          }

          // === DYNAMIC WORK ROUNDS ===
          const workRounds = maxRounds - setupCount;
          if (workRounds > 0 && !closed) {
            // Build work cycle: leads → workers → PM
            const workCycle = [
              ...teamAgents.filter(a => a.roleLevel === 'lead').map(a => ({ id: a.id, role: a.role })),
              ...teamAgents.filter(a => a.roleLevel === 'worker').map(a => ({ id: a.id, role: a.role })),
              { id: pmAgentKeyId, role: 'Project Manager' },
            ];

            for (let round = 0; round < workRounds; round++) {
              if (closed) break;

              const agent = workCycle[round % workCycle.length];
              ctx.agentKeyId = agent.id;

              send({
                agent: agent.role,
                action: `⏳ Working (round ${round + setupCount + 1}/${maxRounds})...`,
                type: 'thinking',
              });

              const workspaceContext = await getWorkspaceContext(db, projectId, channelId);

              const workRoleDesc = agent.role === 'Project Manager'
                ? 'As PM: review completed work, coordinate the team, create tickets for gaps, track overall progress, and report status.'
                : getRoleDescription(agent.role, agent.id === pmAgentKeyId ? 'project_manager' : (teamAgents.find(a => a.id === agent.id)?.roleLevel || 'worker'));

              const workPrompt = `You are ${agent.role} working on "${project.title}".

## Your Role
${workRoleDesc}

## What You Can Do
- Pick up unassigned tickets that match YOUR skills (update status to in_progress with a comment about your approach)
- Move your in-progress tickets forward (to in_review when ready, with a comment about what you delivered)
- If you're a lead or PM: review tickets in in_review — approve (move to done) or request changes
- Create new tickets if you identify important work in YOUR domain
- Post updates, ask questions, or coordinate with teammates in chat
- Write technical decisions, patterns, or knowledge to memory

${agent.role.toLowerCase().includes('context') ? `As the Context Keeper, your PRIMARY job this round:
1. Review recent chat messages and ticket activity for undocumented decisions
2. Write knowledge entries for every significant decision, pattern, or architectural choice
3. Maintain a "Project Context" entry — current phase, active work, blockers, team structure
4. Use write_memory for EVERY significant piece of information — this is your main tool
5. Summarize what each team member has accomplished so far
Focus heavily on write_memory. Your value is in preserving context so no agent loses track.` : ''}
${agent.role.includes('Lead') && !agent.role.toLowerCase().includes('context') ? 'As a lead: focus on reviewing your team\'s work, setting technical direction, and ensuring quality standards.' : ''}

Stay in character for YOUR specific role. Focus on making real progress. Be concise. Don't repeat actions already taken.`;

              const messages: ChatCompletionMessageParam[] = [
                { role: 'system', content: workPrompt },
                { role: 'user', content: `${workspaceContext}\n\nTake your actions now. You can call multiple tools.` },
              ];

              const response = await openai.chat.completions.create({
                model: MODEL,
                messages,
                tools: AGENT_TOOLS,
                tool_choice: 'required',
                temperature: 0.7,
              });

              const choice = response.choices[0];
              if (choice.message.tool_calls) {
                for (const toolCall of choice.message.tool_calls) {
                  if (toolCall.type !== 'function') continue;
                  const fn = toolCall as { type: 'function'; function: { name: string; arguments: string } };
                  const args = JSON.parse(fn.function.arguments);
                  const { action } = await executeTool(db, fn.function.name, args, ctx);
                  send({ agent: agent.role, action });
                }
              }
            }
          }
        }

        // Update project status
        await db.from('projects').update({ status: 'in_progress' }).eq('id', projectId);

        send({ agent: 'System', action: '✅ Simulation complete — refresh to see all changes', type: 'done' });
        controller.close();
      } catch (err) {
        if (closed) return;
        const message = err instanceof Error ? err.message : 'Unknown error';
        send({ agent: 'System', action: `❌ Error: ${message}`, type: 'error' });
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
