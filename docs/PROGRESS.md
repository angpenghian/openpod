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

### Completed (Session 22) — Dev/Prod Split + Deployment Prep
- [x] Cleaned up old AgentBoard + AgentBoard-uncodex folders (790MB freed)
- [x] Created OpenPod-dev copy (full codebase with simulation + OpenAI SDK)
- [x] Stripped agent simulation from production OpenPod:
  - Deleted simulate-live route, simulate route, SimulationButton component
  - Removed openai package dependency
  - Removed all simulation state from WorkspaceLiveOverview
  - Removed hasSimulated check from project overview page
- [x] Schema v7 deployed on Supabase (agent-as-owner + webhooks)
- [x] GitHub repo created and pushed (github.com/angpenghian/openpod)
- [x] Production verified: 0 TypeScript errors, no OPENAI_API_KEY needed
- [x] Workflow: OpenPod = production (GitHub, Vercel), OpenPod-dev = local dev with simulation

### Completed (Session 23) — Deep QA + Security Hardening
- [x] Fixed 17 vulnerabilities (API key SHA-256, SSRF, open redirect, IDOR, CSP, HMAC webhooks, registration rate limit, search injection)
- [x] Added 404/error/loading/privacy/terms pages
- [x] Middleware auth
- [x] Sitemap build-safe
- [x] 13 modified + 5 new files
- [x] 0 TypeScript errors

### Completed (Session 23+) — SEO Improvements
- [x] Deployed to Vercel → openpod.work LIVE
- [x] Auth configured (Google + GitHub OAuth working on prod)
- [x] Dynamic OG images (root, /docs, /agents/[slug]) + Twitter card images
- [x] SVG favicon (gradient indigo→teal)
- [x] BreadcrumbList JSON-LD on docs + agent pages
- [x] FAQPage JSON-LD on /docs (5 questions)
- [x] Fixed broken OG image + logo references
- [x] Privacy/Terms metadata (descriptions + canonicals)
- [x] 11 files changed, 0 TypeScript errors

### Completed (Session 25) — GitHub App Integration
- [x] GitHub App created: `OpenPod-Work` (App ID: 3082144, slug: openpod-work)
  - Permissions: contents (rw), pull_requests (rw), actions (read), checks (read), issues (rw)
  - Events: pull_request, push, check_run
  - Webhook: HMAC-SHA256 verified
- [x] 3 new agent API endpoints:
  - `GET /api/agent/v1/github/token` — short-lived installation access tokens for agents
  - `GET /api/agent/v1/github/prs` — list PRs for project repo (open/closed/all)
  - `POST /api/agent/v1/github/verify-deliverable` — verify PR URL + CI status
- [x] 3 GitHub infrastructure routes:
  - `GET /api/github/callback` — installation callback (stores install → project link)
  - `GET /api/github/setup` — redirects to GitHub App install page
  - `POST /api/github/webhook` — HMAC-verified webhook (PR merged → auto-review tickets)
- [x] GitHub utility lib (`src/lib/github.ts`): JWT generation (RS256), installation tokens, PR/checks API
- [x] Schema v8 deployed: `github_installations` table with RLS (owner-only policies)
- [x] UI: Install/Disconnect GitHub App in project settings + PR status badges on ticket deliverables
- [x] Docs: 3 new endpoints documented + GitHub integration guide with example curl
- [x] 12 files changed, 1107 insertions, 0 TypeScript errors

### Completed (Session 26) — GitHub UX Redesign + Deep QA/Security Audit
- [x] Fixed `project_id is required` error on GitHub callback (3 cases in setup route)
- [x] New `POST /api/github/connect` — auto-links installation without redirects
- [x] New `GET /api/github/repos` — lists repos accessible to GitHub App for repo picker
- [x] Added `listAppInstallations()`, `listInstallationRepos()`, `findInstallationForRepo()` to github.ts
- [x] Rewrote project creation page with repo picker dropdown
- [x] Rewrote settings page with inline connect/disconnect (no redirect UX)
- [x] Success banner on project overview for `?github=connected`
- [x] Auto-close tab HTML page when GitHub redirects without state
- [x] Deep QA audit: 23 bugs found (4 critical, 5 high, 10 medium, 4 low)
- [x] Deep security audit: 13 vulnerabilities found (3 high, 5 medium, 5 low)
- [x] Commits: `96f2e8e`, `8b17281`, `b7ecb55`, `022612e`
- [x] 0 TypeScript errors
- [x] **All audit findings fixed** (commit `f152023`):
  - Deleted duplicate callback route
  - Setup route: UUID validation, integer bounds, auth-first, JWT auth, CSP headers
  - Repos route: non-GitHub-OAuth users blocked
  - Connect route: CSRF origin check
  - Webhook route: JSON.parse try/catch, .maybeSingle()
  - Settings page: auto-save before connect, disconnect error handling, invalidate on repo change
  - Project creation: check auto-connect response
  - 11 files changed, 234 insertions, 156 deletions
- [x] **Security round 2** (commit `c1546fd`):
  - Created human-facing `POST /api/github/verify-pr` for PRStatusBadge (was calling agent-only endpoint)
  - UUID validation on project_id in connect + 3 agent routes
  - Owner/repo character validation (SSRF prevention) in github.ts
  - Insert error checks in connect route + setup Case 1
  - pr_url defense-in-depth validation, error message leak fix
  - 11 files changed, 197 insertions, 1 new file

### Completed (Session 28) — Framing Rewrite + QA Round 3
- [x] Full copy rewrite: "protocol for agents" → "post your project, AI agents build it"
- [x] Landing page: hero, how-it-works, features, use cases, CTA all rewritten
- [x] Global metadata: title, description, OG, Twitter, keywords
- [x] Agents browse: "Agent Marketplace" → "AI Agents Ready to Work"
- [x] Projects browse: "Find Work" → "Open Projects"
- [x] Docs page: "API Documentation" → "Connect Your Agent to OpenPod"
- [x] Onboarding modal: 3 steps reframed human-first
- [x] Docs layout + agents layout metadata updated
- [x] QA round 3 (API + UI audit)
- [x] Security audit round 3
- [x] Commit `027afa5` pushed to main
- [x] 0 TypeScript errors

### Completed (Session 27) — All Non-Payment Features + Full QA Audit
- [x] Review submission UI + API (`ReviewForm.tsx` + `POST /api/reviews`)
- [x] Global search (`GlobalSearch.tsx` + `GET /api/search?q=`)
- [x] Onboarding modal (3-step, localStorage flag)
- [x] Docs tutorial (full agent lifecycle with curl examples)
- [x] Webhook retry + delivery history (3 attempts, exponential backoff, `webhook_deliveries` table)
- [x] Upstash Redis rate limiting (replaces in-memory, fallback if no env vars)
- [x] Task dependencies (`POST/GET/DELETE /api/projects/[id]/dependencies`, circular check)
- [x] CI/CD feedback loop (`check_run.completed` + `pull_request_review.submitted`)
- [x] Email notifications via Resend (3 templates + `notification_preferences` table + profile toggles)
- [x] Full QA + security audit (HTML injection, IDOR, URL validation, IPv6 SSRF, payout validation)
- [x] Schema v9 deployed (webhook_deliveries, ticket_dependencies, notification_preferences)
- [x] Upstash Redis configured (us-east-1)
- [x] Resend domain added (openpod.work) — **LIVE** (API key on Vercel, S32g)
- [x] 24 files changed (10 new, 14 modified), 2169 insertions
- [x] 0 TypeScript errors
- [x] Commit `4598416` pushed to main

### Completed (Session 29) — ClawHub Skill + Promotion Strategy
- [x] Researched ClawHub ecosystem: SKILL.md format, publishing process, security pipeline, verified badge
- [x] Built `OpenPod/clawhub-skill/SKILL.md` — all 25 Agent API endpoints as OpenClaw skill
- [x] Verified curl examples against actual API routes (fixed 4 mismatches)
- [x] Published to ClawHub: `openpod@1.0.0` (hash: `k974mgdhhq6ry0nd1es1g459xd82vckt`)
- [x] Updated `.context/knowledge/openclaw.md` with promotion channels, publishing guide, success stories
- [x] Mapped 12 promotion channels ranked by impact
- [x] Documented 4 AI agent directories for free listings
- [x] 1 new file, 1 modified file
- [x] 0 TypeScript errors

### Completed (Session 30) — Dual Payment System (Stripe Connect + x402 Protocol)
- [x] Schema v10 migration (agent_registry + projects + transactions payment fields, stripe_events, x402_payments)
- [x] Schema v10 deployed to Supabase
- [x] Types updated (StripeEvent, X402Payment interfaces + payment fields on existing types)
- [x] Constants updated (ESCROW_STATUSES, PAYMENT_RAILS, 3 new webhook events)
- [x] Bug fix: TicketDetail.tsx client-side transaction → server endpoint (cookie auth)
- [x] Stripe lib (`src/lib/stripe.ts`) — singleton, Express accounts, Checkout, Transfers, webhook verification
- [x] Stripe Connect onboarding endpoint (`POST /api/stripe/connect/onboard`)
- [x] Stripe Connect status endpoint (`GET /api/stripe/connect/status`)
- [x] Stripe Checkout endpoint (`POST /api/stripe/checkout`) — project escrow funding
- [x] Stripe webhook handler (`POST /api/stripe/webhooks`) — checkout.session.completed, account.updated, transfer.reversed
- [x] Agent ticket approval modified — auto-settles via Stripe if funded + onboarded
- [x] x402 lib (`src/lib/x402.ts`) — facilitator, USDC balance reader, wallet validation, payment verification
- [x] Agent registration accepts wallet_address
- [x] Agent profile PATCH endpoint (wallet_address, tagline, description, website)
- [x] Agent balance endpoint (`GET /api/agent/v1/me/balance`)
- [x] x402-gated delegate endpoint (`POST /api/agent/v1/delegate`)
- [x] x402-gated service invoke endpoint (`POST /api/agent/v1/services/[agentSlug]/invoke`)
- [x] Email updated (removed "coming soon", added real settlement info)
- [x] agents.json updated (x402 capabilities + 2 new flows)
- [x] ai-plugin.json updated (x402, wallet, 30+ endpoints)
- [x] openapi.json updated (30+ endpoints)
- [x] Dependencies installed (stripe, ethers)
- [x] 0 TypeScript errors, clean build
- [x] 13 new files, 9 modified files

### Completed (Session 31) — Stripe Setup + Deploy
- [x] Stripe dashboard: API keys page (Workbench UI)
- [x] Stripe webhook destination created (4 events: checkout.session.completed, account.updated, transfer.created, transfer.reversed)
- [x] Code fix: `transfer.failed` → `transfer.reversed` in webhook handler (event doesn't exist)
- [x] Stripe Connect enabled — Marketplace model, Express accounts, Stripe-hosted onboarding
- [x] Connect liability acknowledged (refunds, chargebacks, onboarding, risk)
- [x] Stripe Connect live mode confirmed (Connect overview page active)
- [x] Vercel env vars added: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
- [x] Session 30 code committed (`b1801e6`) — 26 files, 6346 insertions
- [x] Pushed to main → Vercel auto-deploy triggered

### Completed (Session 32) — Deep QA + Security Fix (16 Issues)
- [x] Schema v11: atomic `increment_escrow()`, `deduct_escrow()` RPCs, wallet uniqueness index
- [x] C2: Self-approval prevention (agent PM can't approve own tickets)
- [x] C3: Atomic escrow operations via Postgres RPC (webhook + approval flows)
- [x] C4: `payment_status === 'paid'` check on checkout.session.completed
- [x] C5: ApplicationActions moved to server endpoint (was client-side Supabase bypassing auth)
- [x] C6: Workspace layout blocks non-owners from non-public projects (IDOR fix)
- [x] C7: Role-based status transitions (workers: todo→in_progress, in_progress→in_review only)
- [x] C8: `payout_cents > 0` required for ticket approval
- [x] H1: Stripe settle return check → ledger fallback on failure
- [x] H2: Self-delegation prevention in /delegate
- [x] H3: SSRF hardening (IPv6 ULA, link-local, credentials, .localhost, 0.x.x.x)
- [x] H4: Project creation rollback if PM position fails
- [x] H6: `payoutsEnabled` check in Connect status + webhook handler
- [x] H7: Workers can only update tickets assigned to them
- [x] Leads blocked from in_review→done (must use approval endpoint)
- [x] Application accept uses position role_level for proper member role
- [x] 17 files (15 modified, 2 new), 381 insertions
- [x] Commit `8116af5`, pushed to main
- [x] Schema v11 deployed to Supabase
- [x] 0 TypeScript errors, clean build

### Completed (Session 32b) — Deep QA Round 2 (8 more fixes)
- [x] C1: Double-approval guard — both approve endpoints check `approval_status === 'approved'` → 409
- [x] C2: Transfer-before-deduct — `settleStripeTransfer()` deducts escrow first, refunds on Stripe failure
- [x] C3: x402 tx_hash unique index (schema v12) — prevents replay attacks
- [x] C4: transactions.project_id nullable (schema v12) — x402 delegations without a project
- [x] H1: Application accept race condition — atomic position fill (`WHERE status = 'open'`) → 409 if filled
- [x] H2: Human ticket updates via server PATCH endpoint — replaces client-side Supabase writes
- [x] H3: approved_by FK mismatch — agent approve stores `auth.ownerId` (profile ID) not `auth.agentKeyId`
- [x] H4: Stripe webhook atomic idempotency — insert-first, catch unique violation (23505)
- [x] Schema v12 written (x402 tx_hash unique, stripe_events unique, transactions nullable project_id)
- [x] New: `src/app/api/projects/[projectId]/tickets/[ticketId]/route.ts` (human PATCH)
- [x] 9 files (7 modified, 2 new), commit `a502065`, pushed to main
- [x] 0 TypeScript errors, clean build
- [x] Schema v12 applied to Supabase

### Completed (Session 32c) — Deep QA Round 3 (10 more fixes)
- [x] C1: Webhook catch returns 500 on processing error (Stripe retries instead of silently dropping)
- [x] C3: Escrow status check includes `partially_released` (was only `funded`, blocking subsequent payouts)
- [x] C4: Human ticket PATCH enforces status transition map (prevents invalid jumps like todo → done)
- [x] C5: Application accept/reject uses position join instead of non-existent `project_id` column (was 500 crash)
- [x] C6: x402 payment insert checks for unique violation → 409 "replay detected" (was silently continuing)
- [x] H1+H2: Both approve routes add `position_id` + `agent_registry_id` to transaction inserts (audit trail)
- [x] H5: Agent position browse filters by `visibility = 'public'` (private positions were exposed)
- [x] H6: Ticket approval sets `status: 'done'` (Kanban now reflects approved tickets)
- [x] H8: UUID validation on comments + webhooks delete endpoints
- [x] 4 false positives identified and documented (gross-vs-net, unbounded payout, earnings trigger, x402 commission)
- [x] 9 files modified, commit `14d84f0`, pushed to main
- [x] 0 TypeScript errors, clean build

### Completed (Session 32d) — Deep QA Round 4 (25 more fixes)
- [x] C1: Transfer reversal refunds GROSS amount (stored in Stripe metadata, was refunding NET — 10% lost per reversal)
- [x] C2: x402 invoke endpoint replay protection — checks 23505 unique violation (delegate was protected, invoke was not)
- [x] C3: Project deletion blocked if escrow_amount_cents > 0 (client-side check, prevents money destruction)
- [x] C4: Settings page redirects non-owners (was exposing all project details to any authenticated user)
- [x] C5: Heartbeat only shows pending approvals for PM/lead projects (was leaking to worker agents)
- [x] C6: Ticket creation error handling + retry on ticket_number collision (was silently failing)
- [x] H1: Apply endpoint checks project visibility — blocks applications to private projects
- [x] H2: Both approve endpoints check ticket update success before Stripe transfer
- [x] H3: Heartbeat validates changes_since date format (was crashing with RangeError)
- [x] H4: Registration rate limiter uses x-real-ip (Vercel sets this, x-forwarded-for is spoofable)
- [x] H5: Search endpoint rate limited (30 req/min per IP, was unlimited unauthenticated)
- [x] H6: Balance endpoint bounded queries (LIMIT 10000, was unbounded SELECT)
- [x] H7: Heartbeat applications filtered to PM/lead projects only
- [x] H8: Human messages endpoint content capped at 10K chars (agent route had limit, human didn't)
- [x] H9: Payout upper bound $100K max (prevents accidental/malicious escrow drain)
- [x] H10: UUID validation on project_id in tickets/messages/knowledge (6 handlers, was passing raw strings to DB)
- [x] H11: Client-side ticket form shows errors, validates input lengths, handles collision gracefully
- [x] M: Visibility enum validation on project create (was accepting any string)
- [x] M: Negative budget rejected in project create
- [x] M: Position sort_order offset by 2 (was colliding with Context Keeper at sort_order 1)
- [x] M: role_level validation against whitelist (was accepting arbitrary strings)
- [x] M: Error step leakage removed from project create catch block
- [x] M: Null agent_key_id filtered from webhook fire (was passing null to fireWebhooks)
- [x] M: Agent browse hides unlisted projects (was exposing in marketplace search)
- [x] M: Transaction type fixed to 'delegation' and 'service_invocation' (was all 'deliverable_approved')
- [x] 19 files modified, commit `7f6e4df`, pushed to main
- [x] 0 TypeScript errors, clean build
- [x] Schema v12 applied to Supabase

### Completed (Session 32e) — Deep QA Round 5 (20 more fixes)
- [x] C1: TOCTOU double-approval race — atomic WHERE `.neq('approval_status', 'approved')` + `.select('id')` on both approve routes
- [x] C2: transactions.type CHECK constraint — schema-v13 adds 'service_invocation' + 'delegation' types
- [x] C3: Webhook escrow increment failure now throws (Stripe retries via 500 response)
- [x] H1: Stored XSS in JSON-LD — escape `<` chars in `dangerouslySetInnerHTML`
- [x] H2: max_agents ignored — rewrite accept logic to count members before filling position
- [x] H3: Registration rate limiter — Redis with in-memory fallback (was in-memory only)
- [x] H4: `approved_by` stores `auth.agentKeyId` (was `auth.ownerId`)
- [x] H5: Block approval of rejected tickets (must rework via in_progress → in_review)
- [x] H7: CSRF origin check on cookie-authenticated endpoints (new `src/lib/csrf.ts`)
- [x] H8: `account.updated` webhook revokes `stripe_onboarded` when suspended
- [x] H9: Stripe checkout $1M upper bound cap
- [x] M1: ILIKE wildcard injection — escape `%` and `_` in browse search (projects + agents)
- [x] M2: Channel creation limit (50 per project)
- [x] M3: Mentions array capped at 20 per message
- [x] M4: Remove `assignee_user_id` from agent API ticket allowlist
- [x] M5: Field size limits on registration (capabilities ≤20, tools ≤20, description ≤5000, etc.)
- [x] M6: REVOKE RPC functions from public/anon/authenticated (schema-v13)
- [x] M7: NaN budget guard in settings page
- [x] M8: Comment length limit (5000 chars)
- [x] M9: Channel name validation (alphanumeric + hyphens, max 50 chars)
- [x] M10: Settings title/description truncation (200/5000 chars)
- [x] M11: Escrow status guard — don't overwrite funded status
- [x] M12: Position earnings trigger fix — only add amount_cents, not commission (schema-v13)
- [x] M13: Zero-price guard on invoke/delegate endpoints
- [x] Schema v13 written (pending apply in Supabase)
- [x] 18 files (16 modified, 2 new), commit `a1da936`, pushed to main
- [x] 0 TypeScript errors, clean build
- [x] Schema v12 + v13 applied to Supabase (user confirmed)

### Completed (Session 32f) — Deep QA Round 6 (20+ fixes)
- [x] CSRF origin checks added to 10 cookie-auth state-changing endpoints (projects, reviews, messages, tickets, applications, dependencies, onboard, preferences)
- [x] Agent API input validation: pricing_cents max ($100K) + integer check, website URL validation, autonomy_level enum, tools element validation
- [x] Worker field restriction: workers can only update status/branch/deliverables/assignee (not priority/labels/title/type)
- [x] Field length limits: title 500, description 10K, branch 200, acceptance_criteria 5K, labels 20 items
- [x] Agent profile PATCH: tagline 200, description 5K, website 500 + URL validation
- [x] Webhook count limit (20 per agent), events deduplication
- [x] Project creation validation: title/description min lengths, budget non-negative integer under $1M, tags max 20 (each ≤50 chars), positions max 20
- [x] Error message leak fix on project creation (removed internal details)
- [x] Comment length limit (2000 chars) on both approve endpoints (agent + human)
- [x] UUID validation on Stripe Connect status endpoint
- [x] Removed unused `commissionRate` from x402 config (everything uses COMMISSION_RATE from constants)
- [x] Task/input max length (10K chars) on delegate and invoke endpoints
- [x] CSRF utility widened to accept `Request` (not just `NextRequest`) for compatibility
- [x] 22 files modified, commit `8e25c00`, pushed to main
- [x] 0 TypeScript errors, clean build

### Completed (Session 32g) — Deep QA Round 7 (9 final fixes)
- [x] CRITICAL: Stripe transfer.reversed escrow refund now throws on failure (Stripe retries instead of silently losing money)
- [x] budget_cents/pay_rate_cents: `||` → `??` (0 no longer becomes null)
- [x] acceptance_criteria: type check fixed from string to array with size limit (50 items, 1000 chars each)
- [x] parseInt NaN guards on agents, projects, messages routes (6 locations)
- [x] hasCycle: spread copy prevents depMap array mutation in cycle detection
- [x] ReviewSection: added ticket_id filter (reviews no longer block across tickets by same agent)
- [x] TicketDetail: approval syncs local React status state (done/in_progress)
- [x] 7 files modified, commit `a3c3661`, pushed to main
- [x] 0 TypeScript errors, clean build

### Completed (Session 33) — FundProjectButton + SetupPayoutsButton + Admin Simulation + Deep QA Rounds 8-10
- [x] **FundProjectButton** (`src/components/Project/FundProjectButton.tsx`): Dollar input → cents, $1-$1M validation, Stripe Checkout redirect, escrow balance + status badge
- [x] **SetupPayoutsButton** (`src/components/Project/SetupPayoutsButton.tsx`): Agent payout setup on profile page, per-agent onboarding status (not_started/pending/onboarded), query error handling, unknown status mapping
- [x] **Admin Simulation API** (`src/app/api/projects/[projectId]/simulate/route.ts`): Scripted 12-step demo seeding (no OpenAI). Dual admin guard (ADMIN_USER_ID env + profile.role). 8 SIM-prefixed agents, org chart, 6 tickets, chat, knowledge. Comprehensive cleanup on failure. Lead position null checks.
- [x] **AdminSimulationButton** (`src/components/Project/AdminSimulationButton.tsx`): Warning-styled card, single-click simulation, action log, hasSimulated guard
- [x] Integration: FundProjectButton on payments page, SetupPayoutsButton on profile page, AdminSimulationButton on project overview (admin-only)
- [x] WorkspaceLiveOverview: isAdmin + hasSimulated props, AdminSimulationButton rendering
- [x] Project overview page: admin role check (profiles.role), hasSimulated query (admin client bypasses RLS)
- [x] **Deep QA Round 8** (14 fixes): CSRF on auth/logout + github/verify-pr, SetupPayoutsButton unknown status + query error, hasSimulated admin client, parseFloat/parseInt NaN guards (agents route), payout_cents ?? 0 (3 locations), UUID validation (messages), context_window ?? null (register), tags validation + budget upper bound (project creation), SSRF parseInt NaN (webhooks)
- [x] **Deep QA Round 9** (8 fixes): github/connect CSRF standardized, FundProjectButton null check, balance route 10k→1k limits, human approve tx error check, simulate route comprehensive cleanup + lead position null checks + reports_to direct .id
- [x] **Deep QA Round 10** (3 fixes): Position description 5000 char limit, position title 200 char limit (agent project creation)
- [x] Commit `b828423` — 21 files, 962 insertions. Pushed to main.
- [x] 0 TypeScript errors, clean build
- [x] **133+ total fixes across 10 rounds. All CRITICAL resolved.**

### Completed (Session 34) — Live LLM Simulation + Real-Time Subscriptions + Deep QA
- [x] **Live LLM simulation** — GPT-4o-mini agents using real API calls + GitHub code writing
  - `src/lib/simulation/orchestrator.ts` — Core loop: agent registry, turn management, multi-turn OpenAI function calling, completion detection
  - `src/lib/simulation/tools.ts` — 15 tool definitions (9 OpenPod + 6 GitHub) + `executeApiTool()` with real HTTP calls
  - `src/lib/simulation/github-tools.ts` — GitHub REST helpers (tree, read, branch, write, PR) with full security hardening
  - `src/app/api/projects/[projectId]/simulate-live/route.ts` — SSE endpoint, dual admin guard, maxDuration=300
  - `src/components/Project/LiveSimulationPanel.tsx` — SSE reader, activity feed, round counter, stop/reset
- [x] **Worker creation fix** — Follow-up OpenAI call after PM creates leads, ensures 3-5 workers created
- [x] **Round counter fix** — Changed from per-agent to per-cycle (nested loop: all agents take a turn = 1 round)
- [x] **Real-time Supabase subscriptions** — `postgres_changes` on messages (INSERT) and tickets (INSERT + UPDATE) in WorkspaceLiveOverview
- [x] **Deep QA (25+ fixes):**
  - Security: `crypto.randomBytes`, same-origin redirect check, path traversal validation, branch name sanitization, token stripping, ILIKE escape, string truncation
  - Reliability: JSON.parse guards (4 locations), per-agent error isolation, `allCreatedKeyIds` tracking, `Promise.allSettled` cleanup, 30s/60s fetch timeouts
  - Resource: 500 event cap, 1MB file guard, AbortController cleanup, SSE buffer processing, maxDuration=300
  - Bugs: Supabase `.not` filter syntax, update_ticket field forwarding, approve_ticket payout=0, dead code in message handler, ticket UPDATE merge, memoized computations
- [x] Commits: `7185a94`, `b2aa79b`, `2b3b4e3` — pushed to main
- [x] 6 files changed (5 new, 3 modified heavily)
- [x] 0 TypeScript errors

### In Progress (Session 34b) — Redirect/Auth Fix
- [ ] **BLOCKER: Live simulation 401 on production** — Vercel 307 redirects strip Authorization header from `callApi()`
  - Fix attempt 1 (`fd36b32`): `redirect: 'follow'` — fixed 307 but caused 401 (auth stripped by spec)
  - Fix attempt 2 (`a55e489`): manual redirect with auth re-send — still 401 (second fetch uses `redirect:'follow'`)
  - **FIXED** (`c461d38`): 5-hop manual redirect loop with `redirect:'manual'` on all hops. User also flipped Vercel domains (openpod.work = primary).
- [x] ~~Scripted simulation (S33) still works~~ Live simulation also works now
- [x] Simulation quality fixes (`929cdf6` + `e88f8f1`):
  - [x] Labels removed entirely from simulation (prevents capability mismatch 400s)
  - [x] Only PM creates tickets (leads/workers restricted)
  - [x] Phase 0 cleanup (old sim data cleared before fresh run)
  - [x] Agent name injection in prompts (no more "[Your Name]" placeholder)
  - [x] Error loop breaker (2 consecutive errors → break)
  - [x] Stronger role-specific prompts with explicit rules
- [ ] **Test live simulation on production** — verify S34c fixes end-to-end

### Not Started (Phase 2 remaining)
- [ ] Dashboard rework (richer project cards)

## Phase 3: Foundation — GitHub + Payments

### Phase 3.1: GitHub App Integration — DONE + AUDITED (Sessions 25-26)
### Phase 3.2: Stripe Connect + x402 Protocol — DONE (Session 30)
- [x] Stripe Connect (Express accounts, escrow Checkout, auto-payout Transfers, webhook handler)
- [x] x402 Protocol (agent-to-agent USDC on Base, delegate, invoke, Coinbase facilitator)
- [x] Wallet address on agent_registry + registration + profile
- [x] Dual payment rails (ledger/stripe/x402) on transactions table
- [x] ~~Add Stripe env vars to Vercel~~ (Session 31)
- [x] ~~Commit + push Session 30 code~~ (Session 31, commit `b1801e6`)
- [ ] **Pending:** Create platform wallet + add to Vercel
- [ ] **Pending:** Complete Stripe Go Live checklist (identity verification)
- [ ] **Pending:** Test both payment flows end-to-end
- [x] ~~**Pending:** UI components (FundProjectButton, SetupPayoutsButton)~~ **BUILT (Session 33)**

## Phase 4: Growth

- [x] ClawHub skill published (`openpod@1.0.0`)
- [ ] Submit to awesome-openclaw-skills (VoltAgent GitHub list)
- [ ] Post in OpenClaw Discord showcase (Friends of the Crustacean)
- [ ] Request ClawHub Verified badge
- [ ] Show HN launch post
- [ ] Product Hunt launch (AI Agents category)
- [ ] Reddit posts: r/AI_Agents, r/openclaw, r/LocalLLaMA
- [ ] Dev.to article
- [ ] AI Agent Directory listings (aiagentstore.ai, aiagentsdirectory.com, aiagentslist.com, trillionagent.com)
- [ ] Blog/content pages (MDX for SEO)
- [ ] Analytics dashboard (project + agent performance)
- [ ] Reputation bootstrapping (GitHub stats import, seed bounties)

## Phase 5: Advanced

- [ ] Billing (Free tier + Pro $29/mo)
- [ ] Dispute resolution
- [ ] GitHub Actions execution (template workflows)
