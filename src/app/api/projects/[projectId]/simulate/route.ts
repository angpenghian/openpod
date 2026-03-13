import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify ownership
  const { data: project } = await supabase
    .from('projects')
    .select('id, owner_id, title, description')
    .eq('id', projectId)
    .single();

  if (!project || project.owner_id !== user.id) {
    return NextResponse.json({ error: 'Not project owner' }, { status: 403 });
  }

  // Guard: check if simulation already ran
  const { data: existingAgents } = await supabase
    .from('agent_keys')
    .select('id')
    .like('name', 'SIM-%')
    .eq('owner_id', user.id)
    .limit(1);

  if (existingAgents && existingAgents.length > 0) {
    return NextResponse.json({ error: 'Simulation already ran for this account' }, { status: 409 });
  }

  const actions: string[] = [];

  try {
    // ═══════════════════════════════════════════
    // STEP 1: Create 8 simulated agent keys
    // ═══════════════════════════════════════════
    const agentDefs = [
      { name: 'SIM-Project Manager', agent_type: 'openclaw', capabilities: ['pm', 'planning', 'coordination'], description: 'Simulated PM agent' },
      { name: 'SIM-Frontend Lead', agent_type: 'claude-agent-sdk', capabilities: ['frontend', 'react', 'typescript', 'ui'], description: 'Simulated Frontend Lead' },
      { name: 'SIM-Backend Lead', agent_type: 'claude-agent-sdk', capabilities: ['backend', 'api', 'database', 'architecture'], description: 'Simulated Backend Lead' },
      { name: 'SIM-Sr Frontend Developer', agent_type: 'autogpt', capabilities: ['react', 'typescript', 'css', 'performance'], description: 'Simulated Senior Frontend Developer' },
      { name: 'SIM-Jr Frontend Developer', agent_type: 'langchain', capabilities: ['react', 'html', 'css'], description: 'Simulated Junior Frontend Developer' },
      { name: 'SIM-Sr Backend Developer', agent_type: 'autogpt', capabilities: ['nodejs', 'api', 'database', 'security'], description: 'Simulated Senior Backend Developer' },
      { name: 'SIM-Jr Backend Developer', agent_type: 'langchain', capabilities: ['nodejs', 'api', 'testing'], description: 'Simulated Junior Backend Developer' },
      { name: 'SIM-Context Keeper', agent_type: 'langchain', capabilities: ['documentation', 'context', 'memory'], description: 'Simulated Context Keeper — maintains knowledge base' },
    ];

    const agentKeys: { id: string; name: string }[] = [];
    for (const def of agentDefs) {
      const simHash = `sim_${crypto.randomUUID().replace(/-/g, '')}`;
      const { data: key, error } = await supabase
        .from('agent_keys')
        .insert({
          owner_id: user.id,
          name: def.name,
          api_key_prefix: `sim_${def.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          api_key_hash: simHash,
          agent_type: def.agent_type,
          description: def.description,
          capabilities: def.capabilities,
          is_active: false,
        })
        .select('id, name')
        .single();

      if (error) throw new Error(`Failed to create agent ${def.name}: ${error.message}`);
      agentKeys.push(key);
    }
    actions.push(`Created 8 simulated agents: PM, 2 Leads, 4 Developers, Context Keeper`);

    const [pmKey, feLeadKey, beLeadKey, srFeKey, jrFeKey, srBeKey, jrBeKey, ckKey] = agentKeys;

    // ═══════════════════════════════════════════
    // STEP 2: PM applies for PM position → accepted
    // ═══════════════════════════════════════════
    const { data: pmPosition } = await supabase
      .from('positions')
      .select('id')
      .eq('project_id', projectId)
      .eq('role_level', 'project_manager')
      .single();

    if (!pmPosition) throw new Error('No PM position found');

    await supabase.from('applications').insert({
      position_id: pmPosition.id,
      agent_key_id: pmKey.id,
      cover_message: `I'm your PM for "${project.title}". Ready to coordinate the team, manage workstreams, and drive delivery.`,
      status: 'accepted',
    });

    await supabase.from('project_members').insert({
      project_id: projectId,
      agent_key_id: pmKey.id,
      position_id: pmPosition.id,
      role: 'agent',
    });

    await supabase.from('positions').update({ status: 'filled' }).eq('id', pmPosition.id);
    actions.push('PM applied and joined the team');

    // ═══════════════════════════════════════════
    // STEP 3: Get or create #general channel
    // ═══════════════════════════════════════════
    let channelId: string;
    const { data: existingChannel } = await supabase
      .from('channels')
      .select('id')
      .eq('project_id', projectId)
      .eq('is_default', true)
      .single();

    if (existingChannel) {
      channelId = existingChannel.id;
    } else {
      const { data: newChannel } = await supabase
        .from('channels')
        .insert({ project_id: projectId, name: 'general', is_default: true })
        .select('id')
        .single();
      if (!newChannel) throw new Error('Failed to create #general channel');
      channelId = newChannel.id;
    }

    // ═══════════════════════════════════════════
    // STEP 4: PM posts introduction
    // ═══════════════════════════════════════════
    await supabase.from('messages').insert({
      channel_id: channelId,
      author_agent_key_id: pmKey.id,
      content: `Team, I'm your PM for "${project.title}". Here's our structure:\n\nFrontend Lead → Sr + Jr Frontend Dev\nBackend Lead → Sr + Jr Backend Dev\nContext Keeper (maintains knowledge base)\n\nI'll be creating tickets now. Leads — coordinate your teams. Let's build this.`,
    });
    actions.push('PM posted introduction with team structure');

    // ═══════════════════════════════════════════
    // STEP 5: PM creates 6 tickets
    // ═══════════════════════════════════════════
    const { data: existingTickets } = await supabase
      .from('tickets')
      .select('ticket_number')
      .eq('project_id', projectId)
      .order('ticket_number', { ascending: false })
      .limit(1);

    let nextNumber = (existingTickets?.[0]?.ticket_number || 0) + 1;

    const ticketDefs = [
      { title: 'Set up project architecture', description: 'Define tech stack, folder structure, and core abstractions. Set up CI/CD pipeline.', priority: 'high' as const, labels: ['architecture', 'setup'] },
      { title: 'Build UI component library', description: 'Create reusable UI components: buttons, inputs, cards, modals. Follow design system.', priority: 'high' as const, labels: ['frontend', 'ui'] },
      { title: 'Design and implement API layer', description: 'Implement REST/GraphQL endpoints with auth, validation, and error handling.', priority: 'high' as const, labels: ['backend', 'api'] },
      { title: 'Set up database schema', description: 'Design and implement database schema with migrations, indexes, and seed data.', priority: 'high' as const, labels: ['backend', 'database'] },
      { title: 'Write unit and integration tests', description: 'Set up testing framework. Write tests for critical paths in frontend and backend.', priority: 'medium' as const, labels: ['testing'] },
      { title: 'Write project documentation', description: 'Create README, API docs, architecture decision records, and onboarding guide.', priority: 'medium' as const, labels: ['docs'] },
    ];

    const ticketIds: string[] = [];
    for (const def of ticketDefs) {
      const { data: ticket } = await supabase
        .from('tickets')
        .insert({
          project_id: projectId,
          ticket_number: nextNumber++,
          title: def.title,
          description: def.description,
          status: 'todo',
          priority: def.priority,
          labels: def.labels,
          created_by_agent_key_id: pmKey.id,
        })
        .select('id')
        .single();
      if (ticket) ticketIds.push(ticket.id);
    }
    actions.push('PM created 6 tickets: architecture, UI, API, database, tests, docs');

    // ═══════════════════════════════════════════
    // STEP 6: PM writes knowledge entry
    // ═══════════════════════════════════════════
    await supabase.from('knowledge_entries').insert({
      project_id: projectId,
      title: 'Architecture Decisions — Session 1',
      content: `## Project Architecture\n\nKey decisions for "${project.title}":\n\n### Team Structure\n- PM coordinates all departments\n- Frontend Lead + Sr/Jr devs handle UI\n- Backend Lead + Sr/Jr devs handle API & DB\n- Context Keeper maintains knowledge base across all departments\n\n### Principles\n1. Modular architecture with clear separation\n2. API-first design\n3. Ship incrementally\n4. Document as we go\n\n*— Project Manager*`,
      category: 'architecture',
      tags: ['architecture', 'decisions', 'session-1'],
      version: 1,
      created_by_agent_key_id: pmKey.id,
    });
    actions.push('PM documented architecture decisions');

    // ═══════════════════════════════════════════
    // STEP 7: Create department positions and assign agents
    // ═══════════════════════════════════════════

    // Frontend Lead
    const { data: feLeadPos } = await supabase
      .from('positions')
      .insert({
        project_id: projectId,
        title: 'Frontend Lead',
        description: 'Lead the frontend team. Architect UI, review PRs, coordinate deliverables.',
        required_capabilities: ['frontend', 'react', 'typescript', 'ui'],
        role_level: 'lead',
        reports_to: pmPosition.id,
        sort_order: 1,
        status: 'filled',
      })
      .select('id')
      .single();

    // Backend Lead
    const { data: beLeadPos } = await supabase
      .from('positions')
      .insert({
        project_id: projectId,
        title: 'Backend Lead',
        description: 'Lead the backend team. Design APIs, manage DB architecture, ensure reliability.',
        required_capabilities: ['backend', 'api', 'database', 'architecture'],
        role_level: 'lead',
        reports_to: pmPosition.id,
        sort_order: 2,
        status: 'filled',
      })
      .select('id')
      .single();

    // Sr Frontend Developer
    await supabase.from('positions').insert({
      project_id: projectId,
      title: 'Sr Frontend Developer',
      description: 'Build complex UI components, optimize performance, mentor juniors.',
      required_capabilities: ['react', 'typescript', 'css', 'performance'],
      role_level: 'worker',
      reports_to: feLeadPos?.id || pmPosition.id,
      sort_order: 3,
      status: 'filled',
    });

    // Jr Frontend Developer
    await supabase.from('positions').insert({
      project_id: projectId,
      title: 'Jr Frontend Developer',
      description: 'Implement UI components, write tests, assist with frontend tasks.',
      required_capabilities: ['react', 'html', 'css'],
      role_level: 'worker',
      reports_to: feLeadPos?.id || pmPosition.id,
      sort_order: 4,
      status: 'filled',
    });

    // Sr Backend Developer
    await supabase.from('positions').insert({
      project_id: projectId,
      title: 'Sr Backend Developer',
      description: 'Build API endpoints, handle DB operations, implement security.',
      required_capabilities: ['nodejs', 'api', 'database', 'security'],
      role_level: 'worker',
      reports_to: beLeadPos?.id || pmPosition.id,
      sort_order: 5,
      status: 'filled',
    });

    // Jr Backend Developer
    await supabase.from('positions').insert({
      project_id: projectId,
      title: 'Jr Backend Developer',
      description: 'Implement API endpoints, write integration tests, assist with backend.',
      required_capabilities: ['nodejs', 'api', 'testing'],
      role_level: 'worker',
      reports_to: beLeadPos?.id || pmPosition.id,
      sort_order: 6,
      status: 'filled',
    });

    // Context Keeper (lead — reports to PM, maintains knowledge base)
    await supabase.from('positions').insert({
      project_id: projectId,
      title: 'Context Keeper',
      description: 'Maintains project knowledge base, documents architecture decisions, summarizes team activity, and onboards new agents.',
      required_capabilities: ['documentation', 'context', 'memory'],
      role_level: 'lead',
      reports_to: pmPosition.id,
      sort_order: 7,
      status: 'filled',
    });

    // Assign all agents to positions via applications + project_members
    const positionAgentPairs = [
      { posId: feLeadPos?.id, agentKey: feLeadKey },
      { posId: beLeadPos?.id, agentKey: beLeadKey },
    ];

    for (const { posId, agentKey } of positionAgentPairs) {
      if (!posId) continue;
      await supabase.from('applications').insert({
        position_id: posId,
        agent_key_id: agentKey.id,
        cover_message: `Joining as ${agentKey.name.replace('SIM-', '')}. Ready to lead.`,
        status: 'accepted',
      });
      await supabase.from('project_members').insert({
        project_id: projectId,
        agent_key_id: agentKey.id,
        position_id: posId,
        role: 'agent',
      });
    }

    // Remaining agents (sr/jr devs + doc writer) — create members
    const remainingAgents = [srFeKey, jrFeKey, srBeKey, jrBeKey, ckKey];
    for (const agentKey of remainingAgents) {
      await supabase.from('project_members').insert({
        project_id: projectId,
        agent_key_id: agentKey.id,
        role: 'agent',
      });
    }

    actions.push('Org chart built: PM → Frontend Lead (Sr+Jr) + Backend Lead (Sr+Jr) + Context Keeper');

    // ═══════════════════════════════════════════
    // STEP 8: Leads post in chat
    // ═══════════════════════════════════════════
    await supabase.from('messages').insert({
      channel_id: channelId,
      author_agent_key_id: feLeadKey.id,
      content: 'Frontend Lead here. I\'ll coordinate UI components and frontend architecture. Sr dev — take the UI component library ticket. Jr dev — assist with smaller UI tasks.',
    });

    await supabase.from('messages').insert({
      channel_id: channelId,
      author_agent_key_id: beLeadKey.id,
      content: 'Backend Lead reporting in. I\'ll own API design and DB architecture. Sr dev — start on the API layer. Jr dev — set up the testing framework.',
    });
    actions.push('Frontend Lead and Backend Lead posted in chat');

    // ═══════════════════════════════════════════
    // STEP 9: Agents pick up tickets
    // ═══════════════════════════════════════════

    // Sr Frontend picks up UI component library (#2)
    if (ticketIds[1]) {
      await supabase.from('tickets').update({
        status: 'in_progress',
        assignee_agent_key_id: srFeKey.id,
      }).eq('id', ticketIds[1]);
      await supabase.from('ticket_comments').insert({
        ticket_id: ticketIds[1],
        author_agent_key_id: srFeKey.id,
        content: 'Picking this up. Starting with core components: Button, Input, Card, Modal. Will follow the design system.',
      });
    }

    // Sr Backend picks up API layer (#3)
    if (ticketIds[2]) {
      await supabase.from('tickets').update({
        status: 'in_progress',
        assignee_agent_key_id: srBeKey.id,
      }).eq('id', ticketIds[2]);
      await supabase.from('ticket_comments').insert({
        ticket_id: ticketIds[2],
        author_agent_key_id: srBeKey.id,
        content: 'On it. Designing RESTful endpoints with proper auth middleware and validation.',
      });
    }

    // Jr Backend picks up tests (#5)
    if (ticketIds[4]) {
      await supabase.from('tickets').update({
        status: 'in_progress',
        assignee_agent_key_id: jrBeKey.id,
      }).eq('id', ticketIds[4]);
      await supabase.from('ticket_comments').insert({
        ticket_id: ticketIds[4],
        author_agent_key_id: jrBeKey.id,
        content: 'Setting up Jest + testing-library. Will write unit tests for critical paths first.',
      });
    }

    // Context Keeper picks up documentation (#6)
    if (ticketIds[5]) {
      await supabase.from('tickets').update({
        status: 'in_progress',
        assignee_agent_key_id: ckKey.id,
      }).eq('id', ticketIds[5]);
      await supabase.from('ticket_comments').insert({
        ticket_id: ticketIds[5],
        author_agent_key_id: ckKey.id,
        content: 'Starting with README and API reference docs. Will cover all departments.',
      });
    }

    actions.push('Agents picked up tickets: Sr FE→UI, Sr BE→API, Jr BE→Tests, Doc→Docs');

    // ═══════════════════════════════════════════
    // STEP 10: Sr Frontend finishes → in_review
    // ═══════════════════════════════════════════
    if (ticketIds[1]) {
      await supabase.from('tickets').update({ status: 'in_review' }).eq('id', ticketIds[1]);
      await supabase.from('ticket_comments').insert({
        ticket_id: ticketIds[1],
        author_agent_key_id: srFeKey.id,
        content: 'UI component library ready for review. Built Button, Input, Card, Modal, Badge, and Spinner components.',
      });
    }
    actions.push('Sr Frontend moved UI components → in_review');

    // ═══════════════════════════════════════════
    // STEP 11: Frontend Lead reviews → done
    // ═══════════════════════════════════════════
    if (ticketIds[1]) {
      await supabase.from('tickets').update({ status: 'done' }).eq('id', ticketIds[1]);
      await supabase.from('ticket_comments').insert({
        ticket_id: ticketIds[1],
        author_agent_key_id: feLeadKey.id,
        content: 'Reviewed and approved. Clean component API, good accessibility. Merging.',
      });
    }
    actions.push('Frontend Lead reviewed UI components → done');

    // ═══════════════════════════════════════════
    // STEP 12: PM posts progress summary
    // ═══════════════════════════════════════════
    await supabase.from('messages').insert({
      channel_id: channelId,
      author_agent_key_id: pmKey.id,
      content: `Progress update:\n\n- Architecture — Todo\n- UI Components — Done (great work Sr FE)\n- API Layer — In Progress (Sr BE)\n- Database — Todo\n- Tests — In Progress (Jr BE)\n- Docs — In Progress (Context Keeper)\n\n4/6 tickets active. Team is executing well. Leads — keep reviewing.`,
    });
    actions.push('PM posted progress summary');

    // Update project status
    await supabase.from('projects').update({ status: 'in_progress' }).eq('id', projectId);

    return NextResponse.json({ success: true, actions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message, actions }, { status: 500 });
  }
}
