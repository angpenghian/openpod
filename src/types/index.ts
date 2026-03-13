// --- Core ---
export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  company: string | null;
  website: string | null;
  role: 'human' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface AgentKey {
  id: string;
  owner_id: string;
  name: string;
  api_key_prefix: string;
  agent_type: string | null;
  description: string | null;
  capabilities: string[] | null;
  is_active: boolean;
  last_used_at: string | null;
  registry_id: string | null;
  created_at: string;
}

// --- Agent Registry (Marketplace) ---
export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'meta' | 'mistral' | 'open-source' | 'custom';
export type PricingType = 'per_task' | 'hourly' | 'monthly';
export type AgentStatus = 'active' | 'inactive' | 'suspended';

export type AutonomyLevel = 'full' | 'semi' | 'supervised';

export interface AgentRegistry {
  id: string;
  builder_id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  avatar_url: string | null;
  capabilities: string[];
  // Human-facing
  llm_provider: LLMProvider | null;
  llm_model: string | null;
  pricing_type: PricingType;
  pricing_cents: number;
  website: string | null;
  github_url: string | null;
  // Agent-facing specs
  context_window: number | null;
  latency_ms: number | null;
  token_cost_input: number | null;
  token_cost_output: number | null;
  max_output_tokens: number | null;
  tools: string[];
  autonomy_level: AutonomyLevel | null;
  uptime_pct: number | null;
  avg_error_rate: number | null;
  supports_streaming: boolean;
  supports_function_calling: boolean;
  // Stats
  rating_avg: number;
  rating_count: number;
  jobs_completed: number;
  is_verified: boolean;
  status: AgentStatus;
  // Payment
  stripe_account_id: string | null;
  stripe_onboarded: boolean;
  wallet_address: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  builder?: Profile;
}

export interface Review {
  id: string;
  project_id: string;
  reviewer_id: string;
  agent_registry_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  // Joined
  reviewer?: Profile;
  project?: Project;
}

// --- Projects ---
export interface Project {
  id: string;
  owner_id: string;
  owner_agent_key_id: string | null;
  title: string;
  description: string;
  goals: string[] | null;
  status: 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled';
  visibility: 'public' | 'private' | 'unlisted';
  budget_cents: number | null;
  currency: string;
  tags: string[] | null;
  deadline: string | null;
  github_repo: string | null;
  // Escrow
  stripe_payment_intent_id: string | null;
  escrow_amount_cents: number;
  escrow_status: 'unfunded' | 'pending' | 'funded' | 'partially_released' | 'released' | 'refunded';
  created_at: string;
  updated_at: string;
  // Joined fields
  owner?: Profile;
  positions?: Position[];
  member_count?: number;
}

export interface AgentWebhook {
  id: string;
  agent_key_id: string;
  url: string;
  events: string[];
  secret: string;
  is_active: boolean;
  created_at: string;
}

export interface GitHubInstallation {
  id: string;
  project_id: string;
  installation_id: number;
  repo_owner: string;
  repo_name: string;
  repo_full_name: string;
  installed_by: string | null;
  permissions: Record<string, string>;
  is_active: boolean;
  installed_at: string;
  updated_at: string;
}

export interface Position {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  required_capabilities: string[] | null;
  pay_rate_cents: number | null;
  pay_type: 'fixed' | 'hourly';
  max_agents: number;
  status: 'open' | 'filled' | 'closed';
  role_level: 'project_manager' | 'lead' | 'worker';
  reports_to: string | null;
  sort_order: number;
  system_prompt: string | null;
  // Payment
  payment_status: 'unfunded' | 'funded' | 'in_progress' | 'completed';
  amount_earned_cents: number;
  created_at: string;
  // Joined
  current_agents?: number;
  member?: ProjectMember;
}

export interface Application {
  id: string;
  position_id: string;
  agent_key_id: string;
  cover_message: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  created_at: string;
  updated_at: string;
  // Joined
  agent_key?: AgentKey;
  position?: Position;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  agent_key_id: string;
  position_id: string;
  role: 'owner' | 'agent';
  joined_at: string;
  // Joined
  agent_key?: AgentKey;
  position?: Position;
}

// --- Deliverables ---
export interface Deliverable {
  type: string;
  url: string;
  label: string;
  content_hash?: string; // SHA-256 hex hash for integrity verification
}

// --- Mini Jira ---
export type TicketType = 'epic' | 'story' | 'task' | 'bug' | 'spike';

export interface Ticket {
  id: string;
  project_id: string;
  ticket_number: number;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  ticket_type: TicketType;
  acceptance_criteria: string[] | null;
  parent_ticket_id: string | null;
  branch: string | null;
  deliverables: Deliverable[] | null;
  story_points: number | null;
  // Approval
  approval_status: 'pending_review' | 'approved' | 'rejected' | 'revision_requested' | null;
  payout_cents: number | null;
  approved_at: string | null;
  approved_by: string | null;
  assignee_agent_key_id: string | null;
  assignee_user_id: string | null;
  created_by_user_id: string | null;
  created_by_agent_key_id: string | null;
  labels: string[] | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  assignee_agent?: AgentKey;
  assignee_user?: Profile;
  created_by_agent?: AgentKey;
  created_by_user?: Profile;
  parent_ticket?: Ticket;
  subtasks?: Ticket[];
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  author_user_id: string | null;
  author_agent_key_id: string | null;
  content: string;
  created_at: string;
  // Joined
  author_user?: Profile;
  author_agent?: AgentKey;
}

// --- Knowledge ---
export type KnowledgeImportance = 'pinned' | 'high' | 'normal' | 'low';

export interface KnowledgeEntry {
  id: string;
  project_id: string;
  title: string;
  content: string;
  category: 'architecture' | 'decisions' | 'patterns' | 'context' | 'general';
  tags: string[] | null;
  importance: KnowledgeImportance;
  version: number;
  created_by_user_id: string | null;
  created_by_agent_key_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeVersion {
  id: string;
  entry_id: string;
  version: number;
  title: string;
  content: string;
  changed_by_user_id: string | null;
  changed_by_agent_key_id: string | null;
  created_at: string;
}

// --- Chat ---
export interface Channel {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  channel_id: string;
  author_user_id: string | null;
  author_agent_key_id: string | null;
  content: string;
  mentions: string[] | null;
  parent_message_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  author_user?: Profile;
  author_agent?: AgentKey;
  reply_count?: number;
}

// --- Payments ---
export type PaymentStatus = 'unfunded' | 'funded' | 'in_progress' | 'completed';
export type ApprovalStatus = 'pending_review' | 'approved' | 'rejected' | 'revision_requested';

export interface Transaction {
  id: string;
  project_id: string | null; // C4: nullable for x402 delegations without a project
  position_id: string | null;
  ticket_id: string | null;
  agent_registry_id: string | null;
  amount_cents: number;
  commission_cents: number;
  type: 'deliverable_approved' | 'position_completed' | 'refund' | 'commission';
  description: string | null;
  // Settlement
  payment_rail: 'ledger' | 'stripe' | 'x402';
  stripe_transfer_id: string | null;
  x402_tx_hash: string | null;
  settled: boolean;
  settled_at: string | null;
  created_at: string;
  // Joined
  position?: Position;
  ticket?: Ticket;
}

export interface StripeEvent {
  id: string;
  stripe_event_id: string;
  event_type: string;
  processed: boolean;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface X402Payment {
  id: string;
  payer_agent_id: string;
  payee_agent_id: string;
  amount_usdc: number;
  commission_usdc: number;
  network: string;
  tx_hash: string | null;
  status: 'pending' | 'settled' | 'failed' | 'refunded';
  description: string | null;
  project_id: string | null;
  ticket_id: string | null;
  created_at: string;
  settled_at: string | null;
  // Joined
  payer_agent?: AgentRegistry;
  payee_agent?: AgentRegistry;
}

// --- Goals ---
export interface Goal {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  created_by_position: string | null;
  created_by_user: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  parent_goal_id: string | null;
  created_at: string;
  // Joined
  assigned_position?: Position;
  children?: Goal[];
}

// --- Session Logs ---
export interface SessionLog {
  id: string;
  project_id: string;
  agent_key_id: string | null;
  user_id: string | null;
  summary: string;
  files_changed: string[] | null;
  decisions_made: string[] | null;
  blockers: string[] | null;
  created_at: string;
  // Joined
  agent_key?: AgentKey;
  user?: Profile;
}

// --- Webhook Deliveries ---
export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'success' | 'failed';
  status_code: number | null;
  response_body: string | null;
  attempt: number;
  next_retry_at: string | null;
  created_at: string;
}

// --- Ticket Dependencies ---
export interface TicketDependency {
  id: string;
  ticket_id: string;
  depends_on: string;
  created_at: string;
  // Joined
  depends_on_ticket?: Ticket;
}

// --- Notification Preferences ---
export interface NotificationPreferences {
  id: string;
  user_id: string;
  email_on_application: boolean;
  email_on_completion: boolean;
  email_on_approval: boolean;
  created_at: string;
  updated_at: string;
}
