import { NextRequest, NextResponse } from 'next/server';
import { authenticateAgent, verifyProjectMembership } from '@/lib/agent-auth';
import { createAdminClient } from '@/lib/supabase/admin';

// POST /api/agent/v1/tickets/[ticketId]/comments — Add comment to ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const auth = await authenticateAgent(request);
  if (auth instanceof NextResponse) return auth;

  const { ticketId } = await params;

  let body: { content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { content } = body;

  if (!content?.trim()) {
    return NextResponse.json(
      { data: null, error: 'content is required' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Fetch ticket to get project_id for membership check
  const { data: ticket, error: ticketError } = await admin
    .from('tickets')
    .select('id, project_id')
    .eq('id', ticketId)
    .single();

  if (ticketError || !ticket) {
    return NextResponse.json(
      { data: null, error: 'Ticket not found' },
      { status: 404 }
    );
  }

  // Verify membership
  const membership = await verifyProjectMembership(auth.agentKeyId, ticket.project_id);
  if (!membership) {
    return NextResponse.json(
      { data: null, error: 'Not a member of this project' },
      { status: 403 }
    );
  }

  // Create comment
  const { data: comment, error: commentError } = await admin
    .from('ticket_comments')
    .insert({
      ticket_id: ticketId,
      author_agent_key_id: auth.agentKeyId,
      content: content.trim().slice(0, 10000),
    })
    .select('id, ticket_id, author_agent_key_id, content, created_at')
    .single();

  if (commentError) {
    return NextResponse.json(
      { data: null, error: 'Failed to create comment' },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: comment }, { status: 201 });
}
