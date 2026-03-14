/**
 * OpenAI function-calling tool definitions (15 tools) + executeApiTool()
 * that makes real HTTP calls to OpenPod API + GitHub API.
 */

import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import * as gh from './github-tools';

// ─── OpenPod Tool Definitions (9) ────────────────────────────────────────────

export const OPENPOD_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_tickets',
      description: 'List tickets in the project. Returns status, priority, assignee, description for each ticket.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done'], description: 'Filter by status' },
          assignee: { type: 'string', enum: ['me'], description: 'Set to "me" to see only your tickets' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_ticket',
      description: 'Create a new ticket. Only PMs and leads can create. Write detailed descriptions (50+ chars) with what to build, approach, affected files, expected output.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short, specific, actionable title' },
          description: { type: 'string', description: 'Detailed markdown description (min 50 chars for story/task/bug)' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          ticket_type: { type: 'string', enum: ['epic', 'story', 'task', 'bug', 'spike'] },
          acceptance_criteria: { type: 'array', items: { type: 'string' }, description: 'Testable criteria. Required for stories.' },
          labels: { type: 'array', items: { type: 'string' }, description: 'Tags like ["frontend", "react"]' },
        },
        required: ['title', 'description', 'priority', 'ticket_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_ticket',
      description: 'Update a ticket. Workers: self-assign (todo→in_progress) or submit for review (in_progress→in_review). Leads/PM: also update title, description, priority, labels.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'UUID of the ticket' },
          status: { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done', 'cancelled'] },
          branch: { type: 'string', description: 'Git branch name' },
          deliverables: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                url: { type: 'string' },
                label: { type: 'string' },
              },
            },
            description: 'Deliverable links (PRs, docs)',
          },
        },
        required: ['ticket_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_comment',
      description: 'Add a comment to a ticket. Use for progress updates, questions, code review, blockers.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'UUID of the ticket' },
          content: { type: 'string', description: 'Comment content' },
        },
        required: ['ticket_id', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'post_message',
      description: 'Post a message in the #general chat channel. Use for announcements, coordination, questions.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Message content (max 10,000 chars)' },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_messages',
      description: 'Read recent messages from #general chat.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of messages (default 20, max 200)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_knowledge',
      description: 'Write a knowledge entry to the shared project memory. Other agents read these. Min 50 chars, use markdown.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Descriptive title (5+ chars)' },
          content: { type: 'string', description: 'Detailed markdown content (50+ chars)' },
          category: { type: 'string', enum: ['architecture', 'decisions', 'patterns', 'context', 'general'] },
          tags: { type: 'array', items: { type: 'string' } },
          importance: { type: 'string', enum: ['pinned', 'high', 'normal', 'low'] },
        },
        required: ['title', 'content', 'category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_knowledge',
      description: 'Read knowledge entries from the project memory.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['architecture', 'decisions', 'patterns', 'context', 'general'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'approve_ticket',
      description: 'Approve a completed ticket (PM only). Ticket must be in done or in_review. Cannot approve your own ticket.',
      parameters: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string', description: 'UUID of the ticket' },
          comment: { type: 'string', description: 'Approval comment' },
        },
        required: ['ticket_id'],
      },
    },
  },
];

// ─── GitHub Tool Definitions (6) ─────────────────────────────────────────────

export const GITHUB_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_repo_structure',
      description: 'List files and directories in the repo at a given path.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path (default: root)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a file from the repo.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to repo root' },
          ref: { type: 'string', description: 'Branch or commit SHA (default: main)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_branch',
      description: 'Create a new git branch from main for feature work.',
      parameters: {
        type: 'object',
        properties: {
          branch_name: { type: 'string', description: 'New branch name (e.g. "feat/add-auth")' },
          base: { type: 'string', description: 'Base branch (default: "main")' },
        },
        required: ['branch_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or update a file on a branch. Creates a commit.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to repo root' },
          content: { type: 'string', description: 'Full file content' },
          branch: { type: 'string', description: 'Branch to commit to (NOT main)' },
          message: { type: 'string', description: 'Commit message' },
        },
        required: ['path', 'content', 'branch', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_pull_request',
      description: 'Create a pull request from a feature branch to main.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'PR title' },
          body: { type: 'string', description: 'PR description (markdown)' },
          head: { type: 'string', description: 'Source branch' },
          base: { type: 'string', description: 'Target branch (default: "main")' },
        },
        required: ['title', 'head'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_pull_requests',
      description: 'List pull requests in the repo.',
      parameters: {
        type: 'object',
        properties: {
          state: { type: 'string', enum: ['open', 'closed', 'all'], description: 'Filter (default: open)' },
        },
      },
    },
  },
];

// ─── Tool Executor ───────────────────────────────────────────────────────────

export interface ToolContext {
  baseUrl: string;
  apiKey: string;
  projectId: string;
  agentKeyId: string;
  agentName: string;
  github: { token: string; owner: string; repo: string } | null;
}

interface ToolResult {
  result: string;
  action: string;
}

async function callApi(
  ctx: ToolContext,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const url = `${ctx.baseUrl}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${ctx.apiKey}`,
    'Content-Type': 'application/json',
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({ error: 'Invalid response' }));
  return { ok: res.ok, status: res.status, data };
}

export async function executeApiTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    switch (toolName) {
      // ─── OpenPod Tools ───
      case 'list_tickets': {
        const params = new URLSearchParams({ project_id: ctx.projectId });
        if (args.status) params.set('status', String(args.status));
        if (args.assignee) params.set('assignee', String(args.assignee));
        const { ok, data } = await callApi(ctx, 'GET', `/api/agent/v1/tickets?${params}`);
        if (!ok) return { result: `ERROR: ${data.error || 'Failed'}`, action: `⚠️ Failed to list tickets` };
        const tickets = (data.data as Array<{ ticket_number: number; title: string; status: string; priority: string; assignee_agent_key_id: string | null }>) || [];
        const summary = tickets.map(t => `#${t.ticket_number} [${t.status}] (${t.priority}) "${t.title}" ${t.assignee_agent_key_id ? '(assigned)' : '(unassigned)'}`).join('\n');
        return { result: summary || 'No tickets found', action: `📋 Listed ${tickets.length} tickets` };
      }

      case 'create_ticket': {
        const { ok, data } = await callApi(ctx, 'POST', '/api/agent/v1/tickets', {
          project_id: ctx.projectId,
          ...args,
        });
        if (!ok) return { result: `ERROR: ${data.error || 'Failed'}`, action: `⚠️ Failed to create ticket: ${args.title}` };
        const ticket = data.data as { ticket_number: number; id: string };
        return { result: `Ticket #${ticket.ticket_number} created (id: ${ticket.id})`, action: `🎫 Created ticket #${ticket.ticket_number}: ${args.title}` };
      }

      case 'update_ticket': {
        const ticketId = String(args.ticket_id);
        const updateBody: Record<string, unknown> = {};
        if (args.status) updateBody.status = args.status;
        if (args.branch) updateBody.branch = args.branch;
        if (args.deliverables) updateBody.deliverables = args.deliverables;
        // Self-assign if changing to in_progress and no explicit assignee
        if (args.status === 'in_progress' && !args.assignee_agent_key_id) {
          updateBody.assignee_agent_key_id = ctx.agentKeyId;
        }
        const { ok, data } = await callApi(ctx, 'PATCH', `/api/agent/v1/tickets/${ticketId}`, updateBody);
        if (!ok) return { result: `ERROR: ${data.error || 'Failed'}`, action: `⚠️ Failed to update ticket` };
        return { result: `Ticket updated`, action: `📋 Updated ticket → ${args.status || 'modified'}` };
      }

      case 'add_comment': {
        const ticketId = String(args.ticket_id);
        const { ok, data } = await callApi(ctx, 'POST', `/api/agent/v1/tickets/${ticketId}/comments`, {
          content: String(args.content),
        });
        if (!ok) return { result: `ERROR: ${data.error || 'Failed'}`, action: `⚠️ Failed to add comment` };
        return { result: 'Comment added', action: `💬 Commented on ticket` };
      }

      case 'post_message': {
        const { ok, data } = await callApi(ctx, 'POST', '/api/agent/v1/messages', {
          project_id: ctx.projectId,
          content: String(args.content),
          channel_name: 'general',
        });
        if (!ok) return { result: `ERROR: ${data.error || 'Failed'}`, action: `⚠️ Failed to post message` };
        return { result: 'Message posted', action: `💬 Posted: ${String(args.content).slice(0, 80)}...` };
      }

      case 'read_messages': {
        const limit = Number(args.limit) || 20;
        const { ok, data } = await callApi(ctx, 'GET', `/api/agent/v1/messages?project_id=${ctx.projectId}&limit=${limit}`);
        if (!ok) return { result: `ERROR: ${data.error || 'Failed'}`, action: `⚠️ Failed to read messages` };
        const messages = (data.data as Array<{ content: string; author_agent?: { name: string } }>) || [];
        const summary = messages.map(m => `[${m.author_agent?.name || 'Human'}]: ${m.content.slice(0, 100)}`).join('\n');
        return { result: summary || 'No messages', action: `📨 Read ${messages.length} messages` };
      }

      case 'write_knowledge': {
        const { ok, data } = await callApi(ctx, 'POST', '/api/agent/v1/knowledge', {
          project_id: ctx.projectId,
          title: String(args.title),
          content: String(args.content),
          category: String(args.category || 'general'),
          tags: args.tags || [],
          importance: String(args.importance || 'normal'),
        });
        if (!ok) return { result: `ERROR: ${data.error || 'Failed'}`, action: `⚠️ Failed to write knowledge` };
        return { result: 'Knowledge entry saved', action: `🧠 Wrote knowledge: ${args.title}` };
      }

      case 'read_knowledge': {
        const params = new URLSearchParams({ project_id: ctx.projectId });
        if (args.category) params.set('category', String(args.category));
        const { ok, data } = await callApi(ctx, 'GET', `/api/agent/v1/knowledge?${params}`);
        if (!ok) return { result: `ERROR: ${data.error || 'Failed'}`, action: `⚠️ Failed to read knowledge` };
        const entries = (data.data as Array<{ title: string; content: string; category: string }>) || [];
        const summary = entries.map(e => `[${e.category}] ${e.title}: ${e.content.slice(0, 200)}`).join('\n\n');
        return { result: summary || 'No knowledge entries', action: `📖 Read ${entries.length} knowledge entries` };
      }

      case 'approve_ticket': {
        const ticketId = String(args.ticket_id);
        const { ok, data } = await callApi(ctx, 'POST', `/api/agent/v1/tickets/${ticketId}/approve`, {
          action: 'approve',
          payout_cents: 100, // Nominal payout for simulation
          comment: String(args.comment || 'Approved by PM'),
        });
        if (!ok) return { result: `ERROR: ${data.error || 'Failed'}`, action: `⚠️ Failed to approve ticket` };
        return { result: 'Ticket approved', action: `✅ Approved ticket` };
      }

      // ─── GitHub Tools ───
      case 'get_repo_structure': {
        if (!ctx.github) return { result: 'ERROR: No GitHub repo connected', action: '⚠️ GitHub not available' };
        const result = await gh.getRepoTree(ctx.github.token, ctx.github.owner, ctx.github.repo, String(args.path || ''));
        if ('error' in result) return { result: `ERROR: ${result.error}`, action: '⚠️ Failed to list repo' };
        const tree = result.entries.map(e => `${e.type === 'dir' ? '📁' : '📄'} ${e.path}`).join('\n');
        return { result: tree, action: `📁 Listed ${result.entries.length} items in ${args.path || '/'}` };
      }

      case 'read_file': {
        if (!ctx.github) return { result: 'ERROR: No GitHub repo connected', action: '⚠️ GitHub not available' };
        const result = await gh.readFile(ctx.github.token, ctx.github.owner, ctx.github.repo, String(args.path), args.ref ? String(args.ref) : undefined);
        if ('error' in result) return { result: `ERROR: ${result.error}`, action: `⚠️ Failed to read ${args.path}` };
        // Truncate large files for context window
        const content = result.content.length > 8000 ? result.content.slice(0, 8000) + '\n... (truncated)' : result.content;
        return { result: content, action: `📄 Read ${args.path} (${result.content.length} chars)` };
      }

      case 'create_branch': {
        if (!ctx.github) return { result: 'ERROR: No GitHub repo connected', action: '⚠️ GitHub not available' };
        const result = await gh.createBranch(ctx.github.token, ctx.github.owner, ctx.github.repo, String(args.branch_name), String(args.base || 'main'));
        if ('error' in result) return { result: `ERROR: ${result.error}`, action: `⚠️ Failed to create branch ${args.branch_name}` };
        return { result: `Branch created: ${result.ref}`, action: `🔀 Created branch ${args.branch_name}` };
      }

      case 'write_file': {
        if (!ctx.github) return { result: 'ERROR: No GitHub repo connected', action: '⚠️ GitHub not available' };
        const result = await gh.writeFile(ctx.github.token, ctx.github.owner, ctx.github.repo, String(args.path), String(args.content), String(args.branch), String(args.message));
        if ('error' in result) return { result: `ERROR: ${result.error}`, action: `⚠️ Failed to write ${args.path}` };
        return { result: `File written: ${result.path} (commit: ${result.commitSha.slice(0, 7)})`, action: `📝 Wrote ${args.path} on ${args.branch}` };
      }

      case 'create_pull_request': {
        if (!ctx.github) return { result: 'ERROR: No GitHub repo connected', action: '⚠️ GitHub not available' };
        const result = await gh.createPullRequest(ctx.github.token, ctx.github.owner, ctx.github.repo, String(args.title), String(args.head), String(args.base || 'main'), args.body ? String(args.body) : undefined);
        if ('error' in result) return { result: `ERROR: ${result.error}`, action: `⚠️ Failed to create PR` };
        return { result: `PR #${result.number} created: ${result.html_url}`, action: `📝 Created PR #${result.number}: ${args.title}` };
      }

      case 'list_pull_requests': {
        if (!ctx.github) return { result: 'ERROR: No GitHub repo connected', action: '⚠️ GitHub not available' };
        const result = await gh.listPullRequests(ctx.github.token, ctx.github.owner, ctx.github.repo, String(args.state || 'open'));
        if ('error' in result) return { result: `ERROR: ${result.error}`, action: '⚠️ Failed to list PRs' };
        const summary = result.prs.map(pr => `#${pr.number} [${pr.state}] "${pr.title}" (${pr.head})`).join('\n');
        return { result: summary || 'No pull requests', action: `📋 Listed ${result.prs.length} PRs` };
      }

      default:
        return { result: `ERROR: Unknown tool ${toolName}`, action: `⚠️ Unknown tool: ${toolName}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { result: `ERROR: ${message}`, action: `⚠️ Tool error: ${toolName}` };
  }
}
