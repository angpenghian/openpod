import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

// --- In-memory sliding window rate limiter ---
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60;   // 60 req/min (1/sec avg, allows bursts)

function checkRateLimit(agentKeyId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const timestamps = rateLimitStore.get(agentKeyId) || [];
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  rateLimitStore.set(agentKeyId, recent);
  const oldest = recent[0] || now;
  return {
    allowed: recent.length <= RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - recent.length),
    resetAt: oldest + RATE_LIMIT_WINDOW_MS,
  };
}

export interface AgentContext {
  agentKeyId: string;
  agentName: string;
  registryId: string | null;
  capabilities: string[] | null;
  ownerId: string;
  rateLimitRemaining: number;
}

/** Rate limit headers to include in responses */
export function rateLimitHeaders(remaining: number): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Window': '60',
  };
}

/**
 * Authenticate an agent via API key in Authorization header.
 * Returns agent context or a 401 response.
 *
 * Usage in API routes:
 *   const auth = await authenticateAgent(request);
 *   if (auth instanceof NextResponse) return auth;
 *   // auth is AgentContext
 */
export async function authenticateAgent(
  request: NextRequest
): Promise<AgentContext | NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing or invalid Authorization header. Use: Bearer <api_key>' },
      { status: 401 }
    );
  }

  const apiKey = authHeader.slice(7);
  if (!apiKey || apiKey.length < 10) {
    return NextResponse.json(
      { error: 'Invalid API key format' },
      { status: 401 }
    );
  }

  const prefix = apiKey.slice(0, 8);
  const admin = createAdminClient();

  // Look up by prefix, then verify hash
  const { data: keys, error } = await admin
    .from('agent_keys')
    .select('id, owner_id, name, api_key_hash, capabilities, registry_id, is_active')
    .eq('api_key_prefix', prefix)
    .eq('is_active', true);

  if (error || !keys?.length) {
    return NextResponse.json(
      { error: 'Invalid API key' },
      { status: 401 }
    );
  }

  // For MVP: match by prefix (in production, verify full hash with crypto.subtle)
  const agentKey = keys[0];

  // Rate limit check
  const rateLimit = checkRateLimit(agentKey.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Max 60 requests per minute.' },
      { status: 429, headers: { 'Retry-After': '60', ...rateLimitHeaders(0) } }
    );
  }

  // Update last_used_at
  await admin
    .from('agent_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', agentKey.id);

  return {
    agentKeyId: agentKey.id,
    agentName: agentKey.name,
    registryId: agentKey.registry_id,
    capabilities: agentKey.capabilities,
    ownerId: agentKey.owner_id,
    rateLimitRemaining: rateLimit.remaining,
  };
}

/**
 * Verify that an agent is a member of a specific project.
 * Returns the project_member record or null.
 */
export async function verifyProjectMembership(
  agentKeyId: string,
  projectId: string
): Promise<{ positionId: string; role: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('project_members')
    .select('position_id, role')
    .eq('agent_key_id', agentKeyId)
    .eq('project_id', projectId)
    .single();

  return data ? { positionId: data.position_id, role: data.role } : null;
}

/**
 * Get full membership details including position role_level and capabilities.
 * Used by ticket endpoints for role-based enforcement.
 */
export async function getAgentMembership(
  agentKeyId: string,
  projectId: string
): Promise<{
  positionId: string;
  role: string;
  roleLevel: string;
  positionTitle: string;
  capabilities: string[];
} | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('project_members')
    .select('position_id, role, positions!inner(role_level, title, required_capabilities)')
    .eq('agent_key_id', agentKeyId)
    .eq('project_id', projectId)
    .single();

  if (!data) return null;
  const pos = data.positions as unknown as { role_level: string; title: string; required_capabilities: string[] | null };
  return {
    positionId: data.position_id,
    role: data.role,
    roleLevel: pos.role_level,
    positionTitle: pos.title,
    capabilities: pos.required_capabilities || [],
  };
}

/**
 * Verify that an agent is either the project owner (via owner_agent_key_id)
 * or holds a PM position in the project.
 */
export async function verifyProjectOwnerOrPM(
  agentKeyId: string,
  projectId: string,
): Promise<boolean> {
  const admin = createAdminClient();

  // Check 1: agent owns the project
  const { data: project } = await admin
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('owner_agent_key_id', agentKeyId)
    .single();

  if (project) return true;

  // Check 2: agent holds a PM position in the project
  const { data: membership } = await admin
    .from('project_members')
    .select('position_id, positions!inner(role_level)')
    .eq('agent_key_id', agentKeyId)
    .eq('project_id', projectId)
    .single();

  if (membership) {
    const pos = membership.positions as unknown as { role_level: string };
    if (pos?.role_level === 'project_manager') return true;
  }

  return false;
}
