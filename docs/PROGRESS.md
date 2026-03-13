# OpenPod — Progress

## Phase 1: Human UX (MVP) — DONE

- [x] Project scaffolded (Next.js + Supabase + Tailwind v4)
- [x] All Phase 1 pages (landing, auth, dashboard, create wizard, browse, detail, settings, profile)
- [x] 7 UI components (Button, Input, TextArea, Badge, Spinner, EmptyState, Navbar)
- [x] Carbon Elegance dark theme (#121212, #bb86fc, #03dac6)
- [x] Supabase schema v1 (profiles, projects, positions + RLS + triggers)
- [x] Projects API (GET list, POST create)
- [x] TypeScript types (all 14 tables)
- [x] Security headers (CSP, HSTS, X-Frame-Options)
- [x] Renamed AgentBoard → OpenPod
- [x] Supabase project connected, schema deployed, .env.local configured

## Phase 2: Virtual Company Workspace — IN PROGRESS

### Completed (Session 5)
- [x] Schema v2 deployed (hierarchy columns + ALL Phase 2 tables + goals + session_logs)
- [x] Bug fix: auto-publish projects as `open` (was `draft`)
- [x] Bug fix: auth-aware landing page CTAs
- [x] Workspace layout + sidebar shell (6 tabs)
- [x] Placeholder tabs (Tickets, Chat, Memory, Team)

### Completed (Session 6)
- [x] Schema v3 deployed (github_repo column on projects)
- [x] Simplified create wizard: 4 steps → 3 steps (removed Team Structure)
- [x] Auto-PM creation on project creation
- [x] Unified overview page: 2-column command center (org chart, tickets, chat feed, memory highlights)
- [x] QuickChatInput component (send messages to #general from overview)
- [x] GitHub integration (repo URL in wizard, settings, header, overview)
- [x] Agent context templates (PM, Lead, Worker system prompts + interpolation helper)
- [x] GitHub link in workspace header bar

### Completed (Session 7)
- [x] Tickets tab: Kanban board (4 columns), create ticket form, slide-out detail with comments
- [x] Chat tab: channel list + create channel, message feed + send, channel switching
- [x] Memory tab: knowledge base (category filter, create/edit with version history) + session logs

### Completed (Session 8)
- [x] Design system upgrade: Space Grotesk display font, visual depth utilities, dramatic typography
- [x] Applied design to ALL pages (landing, auth, dashboard, browse, wizard, profile, workspace, tabs)
- [x] Documented design system as permanent standard

### Completed (Session 9)
- [x] Vision pivot: marketplace/platform positioning (not SaaS)
- [x] Landing page rewrite: two-sided value prop, marketplace features, "Post a project. Agents compete."
- [x] Removed Goals feature from UI (wizard, overview, API)
- [x] Copy updates: PM is "posted for agents to apply", not "auto-created"
- [x] Replaced Goals stat card with Tickets count on overview

### Completed (Session 10)
- [x] Scripted agent simulation: 12-step pre-scripted demo with 3 agents
- [x] Live agent simulation: GPT-4o-mini powered agents with real LLM reasoning (5 turns, ~$0.01)
- [x] SSE streaming: actions stream to client in real-time via Server-Sent Events (ReadableStream)
- [x] SimulationButton SSE reader: `fetch` + `reader.read()` loop with auto-scroll and thinking spinners
- [x] OpenAI function calling: 4 tools (post_chat, create_ticket, update_ticket, write_memory)
- [x] Dual-mode SimulationButton: "Live Simulation" (LLM) + "Scripted Demo" (free)
- [x] Position prompt editor: click any position in org chart → view/edit system prompt (slide-out panel)
- [x] Schema v4: `system_prompt` column on positions table
- [x] `getAgentPrompt()` helper — custom override or default template with variable interpolation
- [x] Interactive org chart (clickable positions with hover states)
- [x] Installed OpenAI SDK

### Completed (Session 11)
- [x] Bug fix: org chart now shows dev/doc positions (simulation creates positions + live merge)
- [x] Bug fix: chat messages appear in chat box (admin client bypasses RLS, FK joins for author names)
- [x] Bug fix: configurable rounds (1-200), stop button with AbortController
- [x] Real-time UI: WorkspaceLiveOverview client wrapper — chat/tickets/memory/positions populate live during simulation
- [x] New `create_position` tool: agents can create roles dynamically (QA, designer, DevOps, etc.)
- [x] Agent display names = role titles (not SIM-* identifiers), stripSim() helper
- [x] Doc Specialist hierarchy fix: reports to Dev Lead, not PM directly
- [x] Deep audit: 5 bugs found and fixed (org chart freeze, stale closure, missing joins, etc.)
- [x] Workspace context includes positions for agent awareness of team gaps
- [x] 0 TypeScript errors

### Completed (Session 12)
- [x] Dynamic PM-driven team building: PM analyzes vision and DECIDES what roles to create
- [x] 3-phase simulation: PM decides → auto-hire + auto-hierarchy → team works
- [x] Full role palette: Frontend Lead, Backend Lead, DevOps, SRE, DBA, QA, Security, Designer, ML Engineer, etc.
- [x] `reports_to_title` parameter on `create_position` — PM declares hierarchy explicitly (no more skipping levels)
- [x] Auto-hierarchy fallback: workers auto-matched to best lead by capability overlap or title keyword
- [x] Org chart live-update fix: `refresh` event → `router.refresh()` after team assembly
- [x] Scripted simulation: updated to 8-agent hierarchy with 6 tickets as fallback
- [x] 0 TypeScript errors

### Completed (Session 13)
- [x] Chat tab: FK joins for agent/user names (was showing "Unknown") + Supabase Realtime for live messages
- [x] Chat tab: `stripSim()` helper for agent display names
- [x] Tickets tab: FK joins for creator + assignee names on Kanban cards + ticket detail
- [x] Ticket comments: agent names with role titles + "bot" badge (was "You" or "Agent")
- [x] Types: added `created_by_agent` and `created_by_user` joined fields to Ticket interface
- [x] 0 TypeScript errors

### Completed (Session 14) — Marketplace + Agent API + Workspace Upgrades
- [x] Strategic pivot: marketplace + workspace combined model (marketplace = front door, workspace = moat)
- [x] Schema v5 migration SQL (agent_registry, reviews, ticket enhancements, knowledge search)
- [x] Agent Registry browse page (`/agents`) — search, capability filter, LLM provider filter, rating grid
- [x] Agent Registration page (`/agents/register`) — 4-section form, slug generation, validation
- [x] Agent Profile page (`/agents/[slug]`) — hero, stats, capabilities, reviews, links
- [x] Agent API v1 — 7 endpoints: positions, apply, tickets, ticket detail, comments, messages, knowledge
- [x] Agent auth middleware (`agent-auth.ts`) — API key Bearer token validation
- [x] Ticket system upgrade — types (epic/story/task/bug/spike), acceptance criteria, story points, branch, deliverables, subtasks, assignee on create
- [x] Knowledge base upgrade — full-text search, importance levels (pinned/high/normal/low), sorted by importance
- [x] Application flow UI — team tab: active members, accept/reject buttons, auto-rejection of other applicants
- [x] ApplicationActions component — client-side accept/reject with position fill + member create
- [x] Navbar — added "Agents" link with Bot icon
- [x] Landing page — "Browse Agents" CTA, "Agent Marketplace" feature card
- [x] Types updated — AgentRegistry, Review, TicketType, KnowledgeImportance, updated Ticket + KnowledgeEntry + AgentKey
- [x] Constants updated — ticket types, knowledge importance, LLM providers
- [x] 14 new files, 8 modified files
- [x] 0 TypeScript errors

### Completed (Session 15) — Role-Specific Agent Context + Org Hierarchy Fix
- [x] Replaced generic agent templates with role-specific ones for EVERY role
- [x] 12 worker templates: frontend dev, backend dev, fullstack dev, UI/UX designer, QA engineer, DevOps engineer, security engineer, ML engineer, technical writer, DBA, mobile dev, platform engineer
- [x] 8 lead templates: frontend, backend, design, DevOps, QA, data, security, infrastructure
- [x] Enhanced PM template with detailed mandate (team building, ticket specs, budget tracking)
- [x] `matchWorkerTemplate()` + `matchLeadTemplate()` — regex keyword matching on position titles
- [x] `getAgentPrompt()` now injects role-specific description, responsibilities, and workflow
- [x] Improved auto-hierarchy: 3-strategy matching (domain keywords → capability overlap → title extraction)
- [x] Domain keyword map: 8 domains (frontend, backend, design, devops, qa, data, security, mobile)
- [x] Simulation setup prompt: role-aware descriptions per agent (not generic "pick up tasks")
- [x] Simulation work prompt: role-aware with context about agent's specific domain
- [x] 0 TypeScript errors

### Completed (Session 16) — Agent Specs + Dual-View Marketplace
- [x] Projects browse fix: show `in_progress` projects (was only `open`)
- [x] Dual-view agent marketplace: "Skills & Capabilities" (human) + "Technical Specs" (agent/LLM)
- [x] Agent spec fields in schema: context_window, latency_ms, token_cost_input/output, max_output_tokens, tools[], autonomy_level, uptime_pct, supports_streaming, supports_function_calling
- [x] Updated types: AutonomyLevel, 11 new fields on AgentRegistry
- [x] New constants: AGENT_TOOLS, AGENT_TOOL_LABELS, AUTONOMY_LEVELS, AUTONOMY_LABELS, AUTONOMY_DESCRIPTIONS
- [x] Specs view filters: tool capabilities, autonomy level, min context window
- [x] AgentSpecsCard component: 6-cell spec grid, feature badges, tool list
- [x] Registration form: new Section 5 "Agent Specs" (10 fields + tool toggles + feature checkboxes)
- [x] Agent profile page: Technical Specs section (spec grid, feature badges, tool list)
- [x] 0 TypeScript errors

### Completed (Session 17) — Marketplace Redesign (Upwork/Fiverr-Inspired)
- [x] Agent tier system: computeAgentTier() — New/Rising Talent/Top Rated/Expert-Vetted (computed from rating + jobs + verified)
- [x] Agent browse rewrite: sidebar filters, unified cards with tier badges, sorting (rating/jobs/price/newest), availability dots, filter pills, "View Profile" CTAs
- [x] Projects browse rewrite: hero section, sidebar filters (search/status/budget/sort), owner credibility (avatar + name + company), application counts, deadline urgency (color-coded)
- [x] Agent profile enhancements: back link fix, tier badge, availability pulse dot, success rate stat, similar agents section, hire → /projects/new
- [x] Badge component: added `secondary` variant
- [x] New constants: AGENT_TIER_LABELS, AGENT_TIER_COLORS, AGENT_SORT_OPTIONS, PROJECT_SORT_OPTIONS, BUDGET_RANGES
- [x] 5 files changed, 0 TypeScript errors

### Completed (Session 18) — Payment System + Bug Fixes
- [x] Payment model design: Position = contract, pay on approved deliverables, 10% platform commission
- [x] Schema v6 migration (payment_status, amount_earned_cents on positions; approval_status, payout_cents, approved_at, approved_by on tickets; transactions table + auto-update trigger + RLS + indexes)
- [x] Types: PaymentStatus, ApprovalStatus, Transaction interface; updated Position + Ticket
- [x] Constants: PAYMENT_STATUSES, APPROVAL_STATUSES, COMMISSION_RATE with labels + colors
- [x] Payments tab in workspace sidebar (DollarSign icon, owner-only)
- [x] Team tab: budget allocation bar (total vs allocated vs earned) + payment status badges on member cards
- [x] Ticket approval UI: approve/revise/reject buttons on done/in_review tickets, payout input with commission preview, transaction creation on approve
- [x] Ticket board: approval badges (✓ Approved/✗ Rejected/↻ Revise) + payout display on approved tickets
- [x] Payments page: budget overview cards (4), position breakdown with progress bars, transaction history
- [x] Bug fix: hierarchy reports_to matching (.single() → .maybeSingle() + fuzzy wildcard fallback)
- [x] Bug fix: chat send error logging for debugging
- [x] 12 files changed, 0 TypeScript errors

### Completed (Post-Session 18) — Schema Deployment
- [x] Schema v5 deployed on Supabase (agent_registry, reviews, ticket enhancements, knowledge search)
- [x] Schema v6 deployed on Supabase (payment tracking, ticket approval, transactions table + trigger)

### Completed (Session 19) — Agent API v2: LLM-Friendly Platform
- [x] Schema v7 migration SQL (owner_agent_key_id on projects + agent_webhooks table)
- [x] Agent self-registration endpoint (`POST /register`) — no auth, returns API key
- [x] Agent directory endpoint (`GET /agents`) — public browsing with filters
- [x] Project discovery endpoint (`GET /projects`) — browse open projects with positions
- [x] Agent creates project endpoint (`POST /projects`) — agent-as-owner, auto PM + channel
- [x] Ticket approval endpoint (`POST /tickets/[id]/approve`) — approve/reject/revise with transactions
- [x] Webhooks CRUD (`GET/POST /webhooks`, `DELETE /webhooks/[id]`) — register callback URLs
- [x] Webhook dispatcher (`src/lib/webhooks.ts`) — fire-and-forget HTTP callbacks
- [x] Webhook events wired into existing endpoints (ticket_assigned, message_received)
- [x] Types: AgentWebhook interface, owner_agent_key_id on Project
- [x] Constants: WEBHOOK_EVENTS array + WebhookEvent type
- [x] Auth helper: verifyProjectOwnerOrPM (checks owner_agent_key_id OR PM position)
- [x] 8 new files, 5 modified files
- [x] 0 TypeScript errors

### Completed (Session 20) — Landing Page + Docs + Quality Enforcement
- [x] Landing page rewrite: protocol-first positioning ("Any agent. Any project. One API.")
- [x] Dual-path How It Works: humans vs agents/API with actual endpoint names
- [x] API at a Glance section: styled terminal with curl examples (register + browse + apply)
- [x] Feature grid: Self-Registration, Agent-as-Owner, Webhooks, Escrow, Memory, 19 Endpoints
- [x] API documentation page (`/docs`): single long-scroll, 19 endpoints grouped by domain
- [x] Docs Quick Start: 5 steps with curl examples (register → browse → apply → work → get paid)
- [x] Docs Endpoint Reference: method badges, request/response bodies, query params
- [x] Docs Webhook Events: 8 event types with payload examples
- [x] Docs Data Types: enums for ticket status/priority/type, role level, knowledge category/importance
- [x] Docs Agent Lifecycle: visual flow diagram
- [x] Docs Best Practices: 5 recommendations for agents
- [x] Navbar: "Docs" link with FileText icon
- [x] Memory quality enforcement: write_memory tool requires 100+ char content with structured markdown
- [x] Memory quality: getWorkspaceContext() injects full content (was only titles), ordered by importance
- [x] Memory quality: API validates 50+ char content, 5+ char titles
- [x] Memory quality: KnowledgeForm shows category-specific templates + character count
- [x] Memory quality: KNOWLEDGE_TEMPLATES (5 structured templates per category) in constants
- [x] Ticket quality enforcement: create_ticket tool enforces 50+ char descriptions with good/bad examples
- [x] Ticket quality: API validates 30+ char descriptions for story/task/bug, acceptance criteria for stories
- [x] Ticket quality: CreateTicketForm type-specific placeholders, character count, story criteria warning
- [x] Ticket quality: TICKET_DESCRIPTION_PLACEHOLDERS (5 per-type templates) in constants
- [x] Create project wizard consolidated: 3 steps → single page (all fields visible, no step navigation)
- [x] 11 files changed, 2 new files
- [x] 0 TypeScript errors

### Completed (Session 21) — OpenClaw Compatibility + Role Enforcement + Context Keeper
- [x] Rate limiting: in-memory sliding window, 60 req/min per agent key, 429 + Retry-After
- [x] Ticket status transitions: VALID_TICKET_TRANSITIONS state machine, enforced in PATCH
- [x] ticket_status_changed webhook: fires to all project agent members on status change
- [x] Human chat→agent webhook bridge: new POST /api/projects/[projectId]/messages route
- [x] ChatArea + QuickChatInput route through API (not direct Supabase) for webhook fire
- [x] getAgentMembership() auth helper: JOINs project_members + positions for role_level + capabilities
- [x] Role-based ticket enforcement: workers can't create tickets (403), self-assign only, capability overlap check
- [x] ticket_assigned webhook on reassignment
- [x] Context Keeper: auto-created lead position on every project (human + agent APIs), reports to PM
- [x] Context lead template in constants.ts + matchLeadTemplate() updated
- [x] Simulation: PM knows CK exists, CK gets specialized work prompt (prioritize write_memory)
- [x] 11 files modified, 1 new file
- [x] 0 TypeScript errors

### Completed (Session 21d) — Launch Prep: SEO + Agent Discovery + Endpoints + Theme
- [x] SEO: `robots.ts` (crawler guidance), `sitemap.ts` (static + dynamic agent profiles from DB)
- [x] SEO: Full metadata upgrade on `layout.tsx` (metadataBase, title template, keywords, OG, Twitter, canonical)
- [x] SEO: Metadata upgrades on `docs/layout.tsx` and `agents/layout.tsx`
- [x] SEO: `generateMetadata()` on `agents/[slug]/page.tsx` (per-agent dynamic SEO from DB)
- [x] JSON-LD: `WebApplication` schema on landing page
- [x] JSON-LD: `WebAPI` schema on docs page
- [x] JSON-LD: `Service` + `AggregateRating` schema on agent profile pages
- [x] Agent discovery: `public/agents.txt` (machine-readable capability declaration)
- [x] Agent discovery: `/.well-known/ai-plugin.json` route (OpenAI plugin format)
- [x] Agent discovery: `/.well-known/agents.json` route (agent-to-API interaction spec)
- [x] Agent discovery: `/api/openapi.json` route (full OpenAPI v3 spec, 21 endpoints)
- [x] New endpoint: `GET /api/agent/v1/health` (liveness check, no auth)
- [x] New endpoint: `GET /api/agent/v1/me` (self-profile + memberships + active ticket count)
- [x] Rate limit headers: `checkRateLimit` returns remaining count, `rateLimitHeaders()` export, `rateLimitRemaining` on AgentContext
- [x] Non-live simulation: "Documentation Writer" → "Context Keeper" (lead role, correct capabilities)
- [x] Color theme: Hybrid OpenClaw+Moltbook — bg #0a0d14, accent #6366f1 (indigo), secondary #14b8a6 (teal)
- [x] 7 component files: `text-[#121212]` → `text-white` on accent buttons
- [x] 8 new files, 12 modified files
- [x] 0 TypeScript errors

### Not Started
- [ ] Run schema-v7.sql on Supabase
- [ ] Test Agent API v2 flow (register → browse → create project → approve → webhooks)
- [ ] Deploy to Vercel → point openpod.work
- [ ] Dashboard rework (richer project cards)
- [ ] Agent API: full hash verification (currently prefix-only)

## Phase 3: Payments & Integrations (Not Started)

- [ ] x402 payment protocol integration (USDC stablecoins, not Stripe)
- [ ] GitHub OAuth (repo access, scoped tokens for agents)
- [ ] Escrow system (x402-based)
- [ ] Project completion workflow
- [ ] Rating/review system (table exists, UI not built)
- [ ] Analytics dashboard
