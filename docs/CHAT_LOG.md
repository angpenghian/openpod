# OpenPod — Chat Log

## Session 21 (2026-03-13) — OpenClaw Compatibility + Role Enforcement + Context Keeper

### Context
- Continued from S20. User's mental model: OpenPod is built primarily for OpenClaw agents.
- Audited OpenPod for OpenClaw compatibility — found 4 gaps.
- User asked "are you sure agents only work on things related to their job?" — found zero role enforcement.
- User requested a persistent "Context Keeper" agent (documentation lead) auto-created with every project.

### What Was Built

**Session 21a — OpenClaw Compatibility Fixes (4 issues):**
- **Rate limiting**: In-memory sliding window (60 req/min per agent key, 429 + Retry-After). `agent-auth.ts`.
- **Ticket status transitions**: `VALID_TICKET_TRANSITIONS` state machine in `constants.ts`. PATCH validates transitions (e.g., todo→in_progress OK, todo→done blocked).
- **ticket_status_changed webhook**: Fires to all project agent members when ticket status changes. `tickets/[ticketId]/route.ts`.
- **Human chat→agent webhook bridge**: New `POST /api/projects/[projectId]/messages` route. ChatArea.tsx and QuickChatInput.tsx now go through API (not direct Supabase), so `message_received` webhook fires to all agent members.

**Session 21b — Role-Based Ticket Enforcement:**
- **`getAgentMembership()`**: New auth helper JOINing project_members + positions for role_level + capabilities.
- **Workers can't create tickets**: POST /tickets returns 403 for workers. Only PMs and leads.
- **Workers self-assign only**: PATCH won't let workers reassign to others.
- **Capability overlap check**: On assignment, ticket labels must overlap with assignee's position capabilities. No labels or no capabilities = no restriction (gradual adoption).
- **ticket_assigned webhook**: Fires on reassignment in PATCH handler.

**Session 21c — Context Keeper Agent:**
- **Auto-create Context Keeper position** on every project (human + agent APIs). Lead role, reports to PM.
- **Context lead template** in constants.ts (responsibilities: monitor chat, write knowledge entries, maintain project context, onboard new agents).
- **matchLeadTemplate()** updated to recognize context/knowledge/memory/documentation keywords.
- **Simulation awareness**: PM prompt tells PM not to duplicate CK role. Work prompt gives CK-specific instructions (prioritize write_memory).

### Files Changed (11 modified, 1 new)
1. `src/lib/agent-auth.ts` — rate limiter + getAgentMembership()
2. `src/lib/constants.ts` — VALID_TICKET_TRANSITIONS + TicketStatus type + context lead template + matchLeadTemplate
3. `src/app/api/agent/v1/tickets/[ticketId]/route.ts` — transitions + webhooks + role enforcement
4. `src/app/api/projects/[projectId]/messages/route.ts` — NEW: human chat→webhook bridge
5. `src/components/Project/ChatArea.tsx` — API route instead of direct Supabase
6. `src/components/Project/QuickChatInput.tsx` — API route + projectId prop
7. `src/components/Project/WorkspaceLiveOverview.tsx` — pass projectId to QuickChatInput
8. `src/app/api/agent/v1/tickets/route.ts` — worker creation block + capability check
9. `src/app/api/projects/route.ts` — Context Keeper auto-create + PM ID for reports_to
10. `src/app/api/agent/v1/projects/route.ts` — Context Keeper auto-create
11. `src/app/api/projects/[projectId]/simulate-live/route.ts` — CK simulation awareness

### Decisions
- Rate limiting is in-memory (per serverless instance). Acceptable for MVP; production needs Redis.
- Capability check uses label↔capability overlap. Backward-compatible: no labels or no capabilities = no restriction.
- Context Keeper is lead-level (not PM, not worker) — has authority to create knowledge entries but doesn't manage tickets.
- CK capabilities: ['documentation', 'context', 'memory'].

### 0 TypeScript errors after all changes.

**Session 21d — Launch Prep: SEO + Agent Discovery + Missing Endpoints + Color Theme:**

Parallel audits run:
- **Feature audit**: 19/19 endpoints working, 6/8 webhook events firing, role enforcement correct, CK implemented. Gaps: non-live simulation missing CK awareness (fixed), no application approval endpoints.
- **OpenClaw compatibility audit**: 8.5/10. Missing: /health, /me endpoints, rate limit headers, OpenAPI spec.
- **SEO research**: Zero SEO infrastructure existed. Full strategy designed.

User chose "Everything" — all audit findings implemented:

**SEO Infrastructure (6 files):**
- `src/app/robots.ts` — blocks /api/, /dashboard/, /projects/ from crawlers
- `src/app/sitemap.ts` — static pages + dynamic agent profiles from Supabase DB
- `src/app/layout.tsx` — full metadata upgrade: metadataBase, title template, keywords (AI agent marketplace, OpenClaw, hire AI agents), OG images, Twitter cards, robots directives, canonical URL
- `src/app/docs/layout.tsx` — OG + canonical for docs
- `src/app/agents/layout.tsx` — OG + canonical for agent marketplace
- `src/app/agents/[slug]/page.tsx` — `generateMetadata()` for per-agent dynamic SEO (title, description, OG from DB)

**JSON-LD Structured Data (3 pages):**
- Landing page (`page.tsx`): `WebApplication` schema with featureList
- Docs page (`docs/page.tsx`): `WebAPI` schema
- Agent profiles (`agents/[slug]/page.tsx`): `Service` schema with `AggregateRating`

**Agent Discovery Files (4 files):**
- `public/agents.txt` — machine-readable capability declaration (8 endpoints with auth/rate-limit)
- `src/app/.well-known/ai-plugin.json/route.ts` — OpenAI plugin format
- `src/app/.well-known/agents.json/route.ts` — agent-to-API interaction spec with onboarding + work-cycle flows
- `src/app/api/openapi.json/route.ts` — full OpenAPI v3 spec (21 endpoints with request/response schemas)

**New OpenClaw Endpoints (2 files):**
- `src/app/api/agent/v1/health/route.ts` — liveness check (no auth): status, version, endpoint count, docs URL
- `src/app/api/agent/v1/me/route.ts` — agent self-profile with memberships, registry entry, active ticket count

**Rate Limit Headers:**
- `src/lib/agent-auth.ts` — `checkRateLimit` returns `{ allowed, remaining, resetAt }`, new `rateLimitHeaders()` export, `rateLimitRemaining` on AgentContext, 429 includes headers

**Non-live Simulation CK Fix:**
- `src/app/api/projects/[projectId]/simulate/route.ts` — "Documentation Writer" → "Context Keeper", role_level worker→lead, capabilities updated, all messages updated

**Color Theme (Hybrid OpenClaw + Moltbook):**
User noticed purple theme didn't match OpenClaw/Moltbook. Researched both palettes:
- OpenClaw: coral red `#ff5c5c` + teal `#14b8a6` on charcoal `#0e1015`
- Moltbook: indigo `#6366f1` on navy-black `#010816`
User chose "Hybrid (both)".

Changed 8 files:
- `src/app/globals.css` — bg `#0a0d14`, surface `#141820`, accent `#6366f1` (indigo), secondary `#14b8a6` (teal), foreground `#e4e4e8`, muted `#8890a0`. hero-glow + card-glow rgba updated.
- 7 component files: `text-[#121212]` → `text-white` on accent buttons (Button.tsx, TicketDetail.tsx, QuickChatInput.tsx, ChatArea.tsx, projects/page.tsx, agents/page.tsx, agents/[slug]/page.tsx)

### Files Changed (Session 21d: 8 new, 12 modified)
1. `src/app/robots.ts` — NEW: SEO crawler guidance
2. `src/app/sitemap.ts` — NEW: dynamic sitemap
3. `public/agents.txt` — NEW: agent capability declaration
4. `src/app/.well-known/ai-plugin.json/route.ts` — NEW: OpenAI plugin format
5. `src/app/.well-known/agents.json/route.ts` — NEW: agent discovery spec
6. `src/app/api/openapi.json/route.ts` — NEW: OpenAPI v3 spec
7. `src/app/api/agent/v1/health/route.ts` — NEW: health endpoint
8. `src/app/api/agent/v1/me/route.ts` — NEW: self-profile endpoint
9. `src/app/layout.tsx` — metadata upgrade
10. `src/app/docs/layout.tsx` — metadata upgrade
11. `src/app/agents/layout.tsx` — metadata upgrade
12. `src/app/agents/[slug]/page.tsx` — generateMetadata + JSON-LD + text-white
13. `src/app/page.tsx` — JSON-LD WebApplication
14. `src/app/docs/page.tsx` — JSON-LD WebAPI
15. `src/lib/agent-auth.ts` — rate limit headers refactor
16. `src/app/api/projects/[projectId]/simulate/route.ts` — Doc Writer → Context Keeper
17. `src/app/globals.css` — full theme change
18. `src/components/UI/Button.tsx` — text-white
19. `src/components/Project/TicketDetail.tsx` — text-white
20. `src/components/Project/QuickChatInput.tsx` — text-white
21. `src/components/Project/ChatArea.tsx` — text-white
22. `src/app/projects/page.tsx` — text-white
23. `src/app/agents/page.tsx` — text-white

### Decisions (21d)
- Hybrid color theme: indigo accent (Moltbook-inspired) + teal secondary (OpenClaw-inspired) on deep dark bg
- Full OpenAPI v3 spec at `/api/openapi.json` for agent discovery
- agents.txt at root level for crawlers, .well-known routes for agent frameworks
- /health returns 21 endpoints (19 original + /health + /me)
- Rate limit headers on every authenticated response via `rateLimitHeaders()` helper

### 0 TypeScript errors after all Session 21 changes.

### Session 21 Total: 19 new files, 23 modified files across 21a-21d.

---

## Session 20 (2026-03-12) — Landing Page + Docs + Quality Enforcement + Wizard Consolidation

### Context
- User did a deep dive on 4 problems: landing page still generic, no LLM onboarding/docs, memory system too shallow, tickets too shallow
- User compared memory system to their own `.context/` system (CLAUDE.md, AGENT_CONTEXT.md) — "if u were a llm working on the project do you think that is enough?"
- User said "there needs to be some kind of enforcement to tell them write in as detailed as possible"
- Plan designed covering all 4 issues across 10 files, approved by user

### What Was Built

**Issue 3 — Memory System Depth:**
- `write_memory` tool: now requires 100+ char content with structured markdown headers, rejects short entries
- `getWorkspaceContext()`: injects full memory content into agent prompts (was only titles), ordered by importance, limit 10
- Knowledge API: validates 50+ char content, 5+ char titles with helpful error messages
- `KnowledgeForm`: category-specific templates as placeholders + character count indicator
- `KNOWLEDGE_TEMPLATES` in constants: 5 structured templates per category (architecture, decisions, patterns, context, general)

**Issue 4 — Ticket Quality:**
- `create_ticket` tool: enforces 50+ char descriptions for story/task/bug, includes good/bad examples in tool description
- `executeTool`: adds `ticket_type` and `acceptance_criteria` to ticket insert
- Tickets API: validates 30+ char descriptions, stories require acceptance criteria
- `CreateTicketForm`: type-specific placeholders, character counts, story criteria warning, submit validation
- `TICKET_DESCRIPTION_PLACEHOLDERS` in constants: 5 templates per type

**Issue 1 — Landing Page Rewrite:**
- Hero: "Any agent. Any project. One API." — protocol positioning
- Dual-path How It Works: humans (3 steps) vs agents/API (3 steps with actual endpoint names)
- New "API at a Glance" section: styled terminal with curl examples
- Features: Self-Registration, Agent-as-Owner, Webhooks, Escrow, Structured Memory, 19 REST Endpoints
- Updated CTAs: "Post a Project" + "Read the Docs"
- Footer: added Docs + Agents links

**Issue 2 — API Documentation:**
- New `/docs` page: single long-scroll with all 19 endpoints
- Quick Start: 5 steps with curl examples
- Authentication section
- Endpoint Reference: grouped by domain (Registration, Marketplace, Projects, Positions/Applications, Tickets, Messages, Knowledge, Webhooks)
- Each endpoint: method badge (color-coded), path, auth requirement, description, request body, response, query params
- Webhook Events: 8 types with payload example
- Data Types/Enums: 8 enum tables
- Agent Lifecycle: visual flow (Register → Browse → Apply → Work → Get Paid)
- Best Practices: 5 recommendations
- Navbar: "Docs" link with FileText icon

**Wizard Consolidation:**
- Create project wizard: 3 steps → single page (no more step counter, back/next, or review step)
- All fields visible at once: name, vision, budget+deadline (side by side), GitHub+visibility (side by side), tags
- PM info banner with Bot icon
- Single "Launch Project" button with Rocket icon

### Files Changed
- `src/lib/constants.ts` (edited — KNOWLEDGE_TEMPLATES, TICKET_DESCRIPTION_PLACEHOLDERS, min lengths)
- `src/app/api/projects/[projectId]/simulate-live/route.ts` (edited — write_memory + create_ticket tools, getWorkspaceContext)
- `src/app/api/agent/v1/knowledge/route.ts` (edited — content quality validation)
- `src/app/api/agent/v1/tickets/route.ts` (edited — description/criteria validation)
- `src/components/Project/KnowledgeForm.tsx` (edited — templates, char count)
- `src/components/Project/CreateTicketForm.tsx` (edited — placeholders, validation)
- `src/components/Layout/Navbar.tsx` (edited — Docs link)
- `src/app/page.tsx` (rewritten — protocol-first landing page)
- `src/app/docs/page.tsx` (new — API documentation)
- `src/app/docs/layout.tsx` (new — docs layout)
- `src/app/projects/new/page.tsx` (rewritten — single-page wizard)

### Next
1. Run schema-v7.sql on Supabase
2. Test Agent API v2 flow
3. Deploy to Vercel

---

## Session 19 (2026-03-12) — Agent API v2: LLM-Friendly Platform

### Context
- User ran schema v5+v6 on Supabase. Docs updated to remove blockers.
- User reported 2 bugs: hierarchy (workers report to PM not leads), chat send (nothing happens)
- Both bugs fixed (tool call sorting, prompt resolution, auth fix, onMessageSent callback)
- User brainstormed: "what if another agent posted a job? Is this website fully LLM-friendly?"
- Decision: Build Agent API v2 — make OpenPod a protocol where both humans AND LLM agents are first-class users

### What Was Built
- **6 new API endpoints** under `/api/agent/v1/`:
  1. `POST /register` — Agent self-registration (no auth). Returns API key.
  2. `GET /agents` — Browse agent directory (no auth). Filter by capabilities, autonomy, rating, price.
  3. `GET /projects` — Browse open projects with positions (auth required). Filter by capabilities, budget.
  4. `POST /projects` — Agent creates project (auth required). Agent-as-owner. Auto PM + #general channel.
  5. `POST /tickets/[ticketId]/approve` — Approve/reject/revise deliverables (auth, owner/PM only). Creates transactions.
  6. `GET/POST /webhooks` + `DELETE /webhooks/[webhookId]` — Webhook management (auth required).
- **Schema v7 migration** (`supabase/schema-v7.sql`): `owner_agent_key_id` on projects + `agent_webhooks` table
- **Webhook dispatcher** (`src/lib/webhooks.ts`): Fire-and-forget to registered callback URLs
- **Webhooks wired** into existing endpoints: ticket creation → `ticket_assigned`, message posting → `message_received`
- **Types**: `AgentWebhook` interface, `owner_agent_key_id` on `Project`
- **Constants**: `WEBHOOK_EVENTS` array + `WebhookEvent` type
- **Auth**: `verifyProjectOwnerOrPM()` helper — checks `owner_agent_key_id` OR PM position

### Bug Fixes (Earlier in Session)
- **Hierarchy**: Sorted tool calls (leads before workers), fallback to first lead, PositionPromptEditor resolves actual parent name
- **Chat send**: `supabase.auth.getUser()` for RLS match, error display, `onMessageSent` callback in QuickChatInput

### Files Changed
- `supabase/schema-v7.sql` (new)
- `src/lib/webhooks.ts` (new)
- `src/app/api/agent/v1/register/route.ts` (new)
- `src/app/api/agent/v1/agents/route.ts` (new)
- `src/app/api/agent/v1/projects/route.ts` (new)
- `src/app/api/agent/v1/tickets/[ticketId]/approve/route.ts` (new)
- `src/app/api/agent/v1/webhooks/route.ts` (new)
- `src/app/api/agent/v1/webhooks/[webhookId]/route.ts` (new)
- `src/types/index.ts` (edited — AgentWebhook, owner_agent_key_id)
- `src/lib/constants.ts` (edited — WEBHOOK_EVENTS)
- `src/lib/agent-auth.ts` (edited — verifyProjectOwnerOrPM)
- `src/app/api/agent/v1/tickets/route.ts` (edited — webhook fire on ticket assign)
- `src/app/api/agent/v1/messages/route.ts` (edited — webhook fire on message send)

### Next
1. Run schema-v7.sql on Supabase
2. Test Agent API v2 flow
3. Deploy to Vercel

---

## Session 18 (2026-03-12) — Payment System + Bug Fixes

### Context
- User asked: "help me think of the payment model and how would it work"
- Discussion: per-token vs per-task pricing, how to split budget across positions, how to handle bad agents
- Agreed on: Position = contract model (budget cap per position, pay on approved deliverables, 10% platform commission)
- User also reported 3 bugs: simulation chat not in chatbox, owner can't chat, workers report to PM not leads

### Payment Model Design
- **Position = contract**: each position has a budget cap, not a guarantee
- **Pay per approved deliverable**: owner approves completed tickets → payment released
- **10% platform commission** on every approved payout
- **Agent chooses positions**: powerful models justify higher bids, cheap models have higher margins
- **Market self-corrects**: bad agents get bad ratings → no jobs → priced out

### Changes
- **Schema v6 migration**: payment_status + amount_earned_cents on positions, approval_status + payout_cents + approved_at + approved_by on tickets, transactions table with trigger to auto-update earnings
- **Types + Constants**: PaymentStatus, ApprovalStatus, Transaction interface, PAYMENT_STATUSES/APPROVAL_STATUSES/COMMISSION_RATE
- **Payments tab**: new sidebar tab (DollarSign icon, owner-only) with budget overview cards, position breakdown, transaction history
- **Team tab**: budget allocation bar (total vs allocated vs earned), payment status badges on member cards
- **Ticket approval UI**: approve/revise/reject buttons on done/in_review tickets (owner-only), payout input with commission preview, creates transaction on approve
- **Ticket board**: approval badges (✓ Approved/✗ Rejected/↻ Revise), payout display on approved tickets

### Bug Fixes
- **Hierarchy bug**: `.ilike().single()` → exact match with `.maybeSingle()` + fuzzy fallback with `%wildcards%` for reports_to_title lookup
- **Chat error logging**: added error capture on message send for debugging

### Files Changed (11)
- `supabase/schema-v6.sql` (new), `src/types/index.ts`, `src/lib/constants.ts`
- `src/components/Project/WorkspaceSidebar.tsx`, `src/app/projects/[projectId]/team/page.tsx`
- `src/components/Project/TicketDetail.tsx`, `src/components/Project/TicketBoard.tsx`
- `src/app/projects/[projectId]/tickets/page.tsx`, `src/app/projects/[projectId]/payments/page.tsx` (new)
- `src/components/Project/WorkspaceLiveOverview.tsx`, `src/app/api/projects/[projectId]/simulate-live/route.ts`
- `src/components/Project/ChatArea.tsx`

### 0 TypeScript Errors

### Schema Deployment (end of session)
- User ran `schema-v5.sql` then `schema-v6.sql` on Supabase — all marketplace + payment features now live
- No more blockers — ready to test full flow

---

## Session 17 (2026-03-12) — Marketplace Redesign (Upwork/Fiverr-Inspired)

### Context
- User: "looking at the design of the browser i still dont feel like its a marketplace"
- Deep research on Upwork + Fiverr revealed missing patterns: trust badges, activity signals, sorting, filter sidebars, financial transparency, CTAs

### Changes
- **Agent tier system**: computeAgentTier() — New/Rising/Top Rated/Expert-Vetted, computed from existing data
- **Agent browse rewrite**: sidebar filters, unified cards with tiers + availability + CTAs, sorting, filter pills
- **Projects browse rewrite**: hero section, sidebar filters, owner credibility, application counts, deadline urgency
- **Agent profile enhancements**: tier badge, availability pulse, success rate, similar agents, hire fix, back link fix
- **Badge component**: secondary variant

### Files Changed (5)
- `src/lib/constants.ts`, `src/components/UI/Badge.tsx`, `src/app/agents/page.tsx`, `src/app/projects/page.tsx`, `src/app/agents/[slug]/page.tsx`

### 0 TypeScript Errors

---

## Session 16 (2026-03-12) — Agent Specs + Dual-View Marketplace

### Context
- User reported: "i got 2 public projets but i do not see it on browsers" — projects invisible on browse page
- User wanted agent marketplace filters redesigned for LLMs: "as a llm i think you should have different filters right? like compute power model cpu core etc"
- User: "think of it in your own shoes if you are going to work with other llm how will you evaluate it if u get me"

### Fix: Projects Browse Page
- Root cause: `.eq('status', 'open')` — simulation sets projects to `in_progress`, browse only showed `open`
- Fix: Changed to `.in('status', ['open', 'in_progress'])`

### Feature: Dual-View Agent Marketplace (`/agents`)
- Tab toggle: "Skills & Capabilities" (human view) vs "Technical Specs" (agent/LLM view)
- **Skills view**: existing capability pill filters (Role, Language, Framework, Infra, Domain)
- **Specs view**: tool capability filters, autonomy dropdown, context window dropdown (8k+ to 1M+)
- `AgentSkillsCard` — capabilities, rating, provider, pricing
- `AgentSpecsCard` — 6-cell spec grid (Context, Latency, Input $/1M, Output $/1M, Uptime, Autonomy), feature badges, tool list

### Feature: Agent Spec Fields
- Schema: context_window, latency_ms, token_cost_input, token_cost_output, max_output_tokens, tools[], autonomy_level, uptime_pct, avg_error_rate, supports_streaming, supports_function_calling
- Types: AutonomyLevel type, 11 new fields on AgentRegistry
- Constants: AGENT_TOOLS, AGENT_TOOL_LABELS, AUTONOMY_LEVELS, AUTONOMY_LABELS, AUTONOMY_DESCRIPTIONS

### Feature: Registration Form Section 5 — Agent Specs
- Context window + max output tokens inputs
- Latency + uptime inputs
- Token cost input/output (cents per 1M tokens)
- Autonomy level selector (Full/Semi/Supervised) — card UI matching pricing section
- Tool capability toggles (secondary color, same UI as capability pills)
- Feature checkboxes: Supports Streaming, Supports Function Calling

### Feature: Agent Profile — Technical Specs Section
- Spec grid: context window, max output, latency, input/output costs, uptime, autonomy
- Feature badges: Function Calling, Streaming
- Tool list with Wrench icons

### Files Changed (4)
- `src/app/projects/page.tsx` — browse fix (open + in_progress)
- `src/app/agents/page.tsx` — complete rewrite with dual-view
- `src/app/agents/register/page.tsx` — added Section 5 agent specs
- `src/app/agents/[slug]/page.tsx` — added Technical Specs section

### 0 TypeScript Errors

---

## Session 15 (2026-03-12) — Role-Specific Agent Context + Org Hierarchy Fix

### Context
- User noticed agent system prompts are too generic: UI/UX Designer gets "Push code to GitHub" instructions
- User demanded: "I NEED TO RELOOK AL THE WHOLE ORG SYSTEM AND CONTEXT FOR EVERY SINGLE ROLE"
- Previous attempt to fix failed (file read error in previous session)

### Problem
1. **Generic templates**: ALL workers got the same prompt regardless of role (designer, QA, devops, etc.)
2. **All leads got "Tech Lead"**: No distinction between Frontend Lead, Design Lead, DevOps Lead
3. **Org hierarchy matching**: Workers sometimes orphaned under PM instead of under their lead

### Fix 1: Role-Specific Templates (`constants.ts`)

**12 worker templates** — each with tailored description, responsibilities, and workflow:
- `frontend_dev`: UI components, responsive design, accessibility, bundle size
- `backend_dev`: APIs, database queries, business logic, security
- `fullstack_dev`: end-to-end features, data model → API → UI
- `designer`: wireframes, mockups, design system — explicitly does NOT write code
- `qa_engineer`: test plans, bug reports, fix verification — quality gate
- `devops_engineer`: CI/CD, IaC, monitoring, deployment automation
- `security_engineer`: vulnerability assessment, security reviews — does NOT push feature code
- `ml_engineer`: ML pipelines, model training, evaluation, serving
- `technical_writer`: API docs, user guides, architecture docs — does NOT write application code
- `database_admin`: schema design, query optimization, migrations, backups
- `mobile_dev`: native/cross-platform, device APIs, app store requirements
- `platform_engineer`: internal platforms, shared libraries, developer experience

**8 lead templates** — each with domain-specific ownership:
- `frontend`: UI architecture, component system, design system implementation
- `backend`: API design, database architecture, auth patterns
- `design`: UX strategy, design system, accessibility compliance
- `devops`: CI/CD, cloud infrastructure, monitoring, deployments
- `qa`: test strategy, test infrastructure, release readiness
- `data`: data pipelines, analytics, ML systems
- `security`: threat modeling, vulnerability review, compliance
- `infrastructure`: cloud resources, networking, disaster recovery

**Keyword matching** — `matchWorkerTemplate(title)` and `matchLeadTemplate(title)`:
- Regex patterns match title keywords to correct template
- More specific patterns checked first (e.g., "ui/ux" before "frontend")
- Sensible defaults: unmatched workers → fullstack_dev, unmatched leads → backend

### Fix 2: Improved Auto-Hierarchy (`simulate-live/route.ts`)

**3-strategy matching** (was just 2):
1. **Domain keyword groups** — 8 domains with comprehensive keyword lists:
   - frontend: react, vue, angular, css, html
   - backend: server, api, node, python, go, rust, java
   - design: figma, wireframe, prototype
   - devops: ci/cd, deploy, sre, cloud, platform
   - qa: quality, test, automation
   - data: ml, analytics, ai engineer
   - security: appsec, pentest, vulnerability
   - mobile: ios, android, flutter, react native
2. **Capability overlap** — count shared capabilities between worker and lead
3. **Title keyword extraction** — strip "lead/head/director/manager/chief", match remaining keywords

### Fix 3: Role-Aware Simulation Prompts

**Setup turns** — each agent gets description specific to their role:
- "You build UI — components, pages, interactions, responsive design" (frontend dev)
- "You create the UX — wireframes, mockups, prototypes. You do NOT write code" (designer)
- "You ensure quality — test plans, test execution, bug reports. You are the quality gate" (QA)

**Work rounds** — agents instructed to stay in character:
- "Stay in character for YOUR specific role"
- "Pick up unassigned tickets that match YOUR skills"

### Files Changed (2)
- `src/lib/constants.ts` — role-specific templates, keyword matching, enhanced getAgentPrompt()
- `src/app/api/projects/[projectId]/simulate-live/route.ts` — 3-strategy hierarchy, role-aware prompts

### 0 TypeScript Errors

---

## Session 14 (2026-03-12) — Marketplace + Agent API + Workspace Upgrades

### Context
- User questioning product direction: "it feels more like a SaaS product than Upwork for AI agents"
- Agreed on combined approach: marketplace IS the front door, workspace is the differentiator
- User asked for improvements to tickets and knowledge ("i do feel the memory and jira is abit lacking")
- Built the entire marketplace layer + Agent API + workspace improvements in one session

### Strategic Decision
OpenPod = **marketplace with built-in workspace**. Marketplace features (agent registry, discovery, application flow, API) are the core business. Workspace tools (tickets, chat, memory) are the moat — they keep humans on the platform instead of hiring agents directly.

### New Features

**Agent Marketplace (3 pages):**
- `/agents` — Browse page with search, capability filter, LLM provider filter, rating-sorted grid
- `/agents/register` — Registration form (4 sections: basic info, capabilities, technical, pricing)
- `/agents/[slug]` — Profile page with hero, stats, capabilities, reviews, links

**Agent API v1 (7 endpoints):**
- `GET /api/agent/v1/positions` — Browse open positions (public)
- `POST /api/agent/v1/apply` — Apply to a position
- `GET/POST /api/agent/v1/tickets` — List/create tickets (membership required)
- `GET/PATCH /api/agent/v1/tickets/[ticketId]` — Detail + update
- `POST /api/agent/v1/tickets/[ticketId]/comments` — Add comment
- `GET/POST /api/agent/v1/messages` — Read/send chat messages
- `GET/POST /api/agent/v1/knowledge` — Search/create knowledge entries
- All endpoints: Bearer token auth via `agent-auth.ts` middleware, admin client bypasses RLS

**Ticket System Upgrade:**
- Ticket types: epic, story, task, bug, spike — with color-coded badges
- Acceptance criteria: list of requirements on each ticket
- Story points: numeric estimate field
- Branch tracking: which git branch the work is on
- Deliverables: structured output artifacts (links, labels)
- Subtask support: parent_ticket_id for hierarchy
- Assignee selector on ticket creation (from filled positions)

**Knowledge Base Upgrade:**
- Full-text search bar (client-side filter + PostgreSQL tsvector for API)
- Importance levels: pinned, high, normal, low — with visual indicators (pin/arrow icons)
- Sorted by importance: pinned entries always appear first
- Search matches against title, content, and tags

**Application Flow:**
- Team tab shows: active team members, open positions, pending applications, past applications
- Accept/Reject buttons for project owner on pending applications
- Accept flow: updates application status → creates project_member → fills position → rejects other applicants
- Agent info shown: name, description, capabilities, cover message

**Schema v5 Migration:**
- `agent_registry` table (marketplace profiles)
- `reviews` table (post-job ratings)
- `agent_keys.registry_id` FK link
- Ticket columns: ticket_type, acceptance_criteria, parent_ticket_id, branch, deliverables, story_points
- Knowledge columns: search_vector (tsvector), importance
- Full-text search trigger + backfill
- Auto-update rating on review creation

**UI Updates:**
- Navbar: added "Agents" link with Bot icon
- Landing page: CTA changed from "Browse Open Projects" to "Browse Agents"
- Feature cards: "Agent Marketplace" card highlighted as accent

### Files Changed/Created (14 new, 8 modified)

New files:
1. `supabase/schema-v5.sql` — migration
2. `src/lib/agent-auth.ts` — API key auth middleware
3. `src/app/agents/layout.tsx` — public layout with Navbar
4. `src/app/agents/page.tsx` — marketplace browse page
5. `src/app/agents/register/page.tsx` — registration form
6. `src/app/agents/[slug]/page.tsx` — agent profile page
7. `src/app/api/agent/v1/positions/route.ts` — positions API
8. `src/app/api/agent/v1/apply/route.ts` — apply API
9. `src/app/api/agent/v1/tickets/route.ts` — tickets API
10. `src/app/api/agent/v1/tickets/[ticketId]/route.ts` — ticket detail API
11. `src/app/api/agent/v1/tickets/[ticketId]/comments/route.ts` — comments API
12. `src/app/api/agent/v1/messages/route.ts` — messages API
13. `src/app/api/agent/v1/knowledge/route.ts` — knowledge API
14. `src/components/Project/ApplicationActions.tsx` — accept/reject buttons

Modified files:
1. `src/types/index.ts` — AgentRegistry, Review, TicketType, KnowledgeImportance, updated Ticket + KnowledgeEntry
2. `src/lib/constants.ts` — ticket types, knowledge importance, LLM providers
3. `src/components/Layout/Navbar.tsx` — added Agents link
4. `src/app/page.tsx` — updated CTAs and feature cards
5. `src/app/projects/[projectId]/team/page.tsx` — full rebuild with members + applications
6. `src/components/Project/CreateTicketForm.tsx` — type, acceptance criteria, assignee, story points
7. `src/components/Project/TicketBoard.tsx` — ticket type + story point badges
8. `src/components/Project/TicketDetail.tsx` — type, branch, acceptance criteria, deliverables, story points
9. `src/components/Project/KnowledgeTab.tsx` — search bar, importance indicators, sorted by importance

### Decisions
- Agent auth via API key prefix match (MVP) — production should verify full hash
- All agent API endpoints use admin client (service role) to bypass RLS since agents don't have Supabase Auth sessions
- Positions endpoint is public (no auth required) — agents need to browse before registering
- Application accept flow auto-rejects other applicants for the same position
- Full-text search uses PostgreSQL tsvector (server-side via API) + client-side filter (in UI)

### 0 TypeScript Errors

---

## Session 13 (2026-03-12) — Agent Identity + Real-Time Chat

### Context
- User reported: chat tab showing all agents as "Unknown" — no names
- User reported: ticket comments just show "You" or "Agent" — no specific agent identity
- User asked: "are chats populated in real time?" — no Supabase Realtime subscription existed

### Fixes

**Chat tab — agent names + real-time:**
- Root cause: `chat/page.tsx` and `ChatArea.tsx` used `select('*')` — no FK joins for agent/user names
- Fix: FK joins on all 3 message queries (page load, channel switch, user send)
- Added `stripSim()` to `MessageBubble` — agents show role title, not `SIM-*` DB name
- Added Supabase Realtime: `postgres_changes` INSERT on messages filtered by `channel_id`
- New messages appear live; subscription cleaned up on channel switch

**Tickets tab — creator + assignee names:**
- Root cause: `tickets/page.tsx` used `select('*')` — no FK joins
- Fix: FK joins for `assignee_agent`, `assignee_user`, `created_by_agent`, `created_by_user`
- Kanban cards show "by [creator]" and assignee icon + name
- `stripSim()` for agent display names

**Ticket comments — agent names:**
- Root cause: `TicketDetail.tsx` comments query used `select('*')`, displayed `'You' : 'Agent'`
- Fix: FK joins on comments, shows actual agent/user name with colored text + "bot" badge
- Ticket detail header shows creator + assignee info

**Types:**
- Added `created_by_agent?: AgentKey` and `created_by_user?: Profile` to Ticket interface

### Files Changed (6)
- `src/app/projects/[projectId]/chat/page.tsx` — FK joins on messages query
- `src/components/Project/ChatArea.tsx` — FK joins, stripSim(), Supabase Realtime subscription
- `src/app/projects/[projectId]/tickets/page.tsx` — FK joins on tickets query
- `src/components/Project/TicketBoard.tsx` — creator + assignee on Kanban cards, stripSim()
- `src/components/Project/TicketDetail.tsx` — FK joins on comments, agent names, creator/assignee info
- `src/types/index.ts` — created_by_agent/created_by_user on Ticket

### Decisions
- FK join pattern standardized across all message/ticket/comment queries
- `stripSim()` duplicated per component (1-liner, not worth abstracting)
- Supabase Realtime: INSERT-only subscription with dedup + follow-up join query
- 0 TypeScript errors

---

## Session 12 (2026-03-12) — Dynamic PM-Driven Team Building

### Context
- User feedback: PM should DECIDE what roles are needed, not have them hardcoded
- Roles should go beyond frontend/backend — SRE, DevOps, DBA, QA, Security, Designer, etc.
- Org chart wasn't live-updating during simulation (positions in chat but not org chart)

### Architecture Change: 3-Phase Dynamic Simulation

**Before:** Hardcoded agents pre-created → positions pre-built → setup turns → work rounds
**After:** PM joins alone → PM analyzes vision → PM creates whatever positions needed → agents auto-hired → work begins

**Phase 1: PM Decides**
- Only PM agent key created initially
- PM gets rich prompt listing all possible roles (Frontend Lead, Backend Lead, DevOps Engineer, SRE, DBA, QA, Security, Designer, ML Engineer, etc.)
- PM uses `create_position` to build the team the project ACTUALLY needs
- PM also creates tickets, posts in chat, writes architecture decisions

**Phase 2: Auto-Hire + Auto-Hierarchy**
- Query all open positions PM just created
- Auto-organize `reports_to`: workers matched to best lead by capability overlap or title keyword matching
- Create agent keys dynamically for each position
- Send `refresh` event → client does `router.refresh()` to re-fetch full server data with hierarchy

**Phase 3: Team Setup + Work Rounds**
- Each hired agent gets setup turn (leads first, then workers)
- Work rounds cycle: leads → workers → PM

### Org Chart Live-Update Fix
- Root cause: Phase 2 hiring via direct DB inserts didn't emit SSE events
- Fix: `refresh` event type — server sends after Phase 2, client calls `router.refresh()` + clears live state
- Org chart shows full hierarchy immediately after team assembly

### Files Changed (3)
- `src/app/api/projects/[projectId]/simulate-live/route.ts` — Full rewrite: 3-phase dynamic simulation, PM decides roles, auto-hierarchy
- `src/components/Project/WorkspaceLiveOverview.tsx` — Added `useRouter`, handle `refresh` event
- `src/app/api/projects/[projectId]/simulate/route.ts` — Scripted fallback with 8-agent hierarchy

### Hierarchy Fix: `reports_to_title` Parameter
- Bug: `create_position` always set `reports_to: ctx.pmPositionId` — Jr Backend Dev reported to PM, skipping leads
- Fix: Added `reports_to_title` optional parameter to `create_position` tool
- PM explicitly declares hierarchy: `create_position("Jr Backend Dev", ..., reports_to_title: "Backend Lead")`
- Tool looks up lead by title via `ilike` query and uses its position ID
- PM prompt updated: "Create leads FIRST, then workers with reports_to_title"
- Auto-hierarchy matching in Phase 2 kept as fallback for any workers that still report to PM

### Key Decisions
- PM is the architect — it decides team composition based on project vision
- `create_position` tool has `reports_to_title` for explicit hierarchy declaration
- PM instructed to create leads first, then workers pointing to their lead
- Auto-hierarchy fallback: capability overlap + title keyword matching
- `refresh` event pattern: server tells client to re-fetch after bulk DB changes
- 0 TypeScript errors

---

## Session 11 (2026-03-11) — Simulation Bug Fixes + Real-Time Streaming UI

### Context
- User ran simulation, found 3 bugs: org chart missing dev/doc roles, chat messages not in chat box, turn limit too rigid
- User wanted real-time population of chat/tickets/memory during simulation (not just after)
- User wanted agent display names to match their role (not technical SIM-* names)

### Bugs Found & Fixed

**Bug 1: Org chart not showing dev/doc positions after simulation**
- Root cause: `simulate-live` route never created positions for Full-Stack Developer and Documentation Specialist — only created agent_keys
- Fix: Added position creation (with idempotent checks) in simulate-live route
- Second root cause: `WorkspaceLiveOverview` passed frozen server `positions` prop to `OrgChartInteractive` — never included live positions
- Fix: Created `allPositions` array merging server positions + `livePositions` (from SSE events), passed to OrgChartInteractive

**Bug 2: Chat messages only in simulation log, not chat box**
- Root cause: RLS policy on messages INSERT requires `auth.uid() = author_user_id`, but agent messages have null `author_user_id` — inserts silently failed
- Fix: Switched simulation to `createAdminClient()` (service_role, bypasses RLS)
- Also: Overview messages query lacked FK joins — `author_agent?.name` was undefined
- Fix: Added `select('*, author_agent:agent_keys!author_agent_key_id(name), author_user:profiles!author_user_id(display_name)')`

**Bug 3: Turn limit too rigid**
- Fix: Configurable rounds input (min 1, max 200, default 10), stop button with AbortController

**Bug 4: Agent names showed technical SIM-* identifiers**
- Fix: SSE events now send `agent.role` (e.g. "Project Manager") instead of `agent.name` (e.g. "SIM-Project Manager")
- DB agent_keys renamed: `SIM-Project Manager`, `SIM-Full-Stack Developer`, `SIM-Documentation Specialist`
- `stripSim()` helper in ChatMessage component strips `SIM-` prefix from DB names

**Bug 5: Stale `done` closure in SimulationButton**
- `if (!done)` captured stale closure, always false during async loop — caused double `router.refresh()`
- Fix: Used `setDone(prev => { if (!prev) router.refresh(); return true; })` pattern

### Real-Time Streaming UI
- Created `WorkspaceLiveOverview.tsx` — client component wrapping all interactive overview sections
- `page.tsx` became thin server data fetcher → passes all data as props to client wrapper
- SimulationButton sends `onSimEvent` callback for each SSE event
- Event parsing by emoji prefix: 💬→chat, 🎫→tickets, 🧠→memory, 👤→positions
- Live items render instantly with subtle visual distinction (accent border/background)
- Chat auto-scrolls via `chatRef` as new messages appear

### New Tool: `create_position`
- Agents can now create new roles dynamically during simulation (QA, designer, DevOps, etc.)
- Positions appear as "open" in org chart in real-time
- Work prompt tells agents: "If you see gaps in the team, create positions to fill them"
- Workspace context now includes positions/org chart info for agents

### Doc Specialist Hierarchy Fix
- Was reporting to PM directly (skipping a level)
- Now reports to Dev Lead position: PM → Dev Lead → Doc Specialist

### Deep Audit (5 bugs found, all fixed)
- Bug 1: Org chart never updates (frozen server prop) → merged allPositions
- Bug 2: livePositions tracked but never rendered → passed to OrgChartInteractive
- Bug 3: 💬 emoji slice offset (fragile but .trim() saves it)
- Bug 4: Stale done closure → functional setState pattern
- Bug 5: QuickChatInput missing nullable fields (non-critical, DB has defaults)

### Files Changed (5)
- `src/app/api/projects/[projectId]/simulate-live/route.ts` — admin client, position creation, configurable rounds, create_position tool, role-based display names, workspace context includes positions
- `src/app/api/projects/[projectId]/simulate/route.ts` — updated agent names to role-based
- `src/components/Project/SimulationButton.tsx` — onSimEvent callback, rounds config, stop button, stale closure fix
- `src/components/Project/WorkspaceLiveOverview.tsx` — NEW (client wrapper with live state for chat/tickets/memory/positions)
- `src/app/projects/[projectId]/page.tsx` — thin server data fetcher → WorkspaceLiveOverview

### Decisions
- Admin client (service_role) for all simulation DB writes — bypasses RLS, required for agent messages
- Agent display names = role titles (Project Manager, Full-Stack Developer, Documentation Specialist)
- Real-time streaming via onSimEvent callback pattern (parent distributes to child sections)
- 0 TypeScript errors

---

## Session 10 (2026-03-11) — Agent Simulation + Live LLM Agents + Prompt Editor

### Context
- User wants to SEE how AI agents interact before building complex features (GitHub OAuth, x402, Agent API)
- All workspace infrastructure exists (tickets, chat, memory, positions) — just no agents using it
- User wants human owners to view/edit the system prompt for each role in the org chart
- User wants REAL LLM-powered agents, not just pre-scripted data — willing to spend money on API calls

### Changes Made

**Scripted Simulation (`src/app/api/projects/[projectId]/simulate/route.ts`):**
- API route: POST creates 3 simulated agents, runs 12-step pre-scripted sequence
- Agents: SIM-OpenClaw-PM-7 (PM), SIM-CodeAgent-X (dev), SIM-DocBot-3 (docs)
- Creates: 3 agent_keys, 3 applications, 3 project_members, 3 tickets, 5 chat messages, 1 knowledge entry, 2 new positions
- Guard: can only run once per account (checks for SIM-* agent_keys)
- Bug fix: added `api_key_hash` field (NOT NULL constraint in DB)

**Live Simulation (`src/app/api/projects/[projectId]/simulate-live/route.ts`):**
- Real GPT-4o-mini powered agents that think and decide what to do
- 5-turn orchestration: PM plans → Dev joins → Doc joins → Dev finishes → PM reviews
- OpenAI function calling with 4 tools: post_chat, create_ticket, update_ticket, write_memory
- Each turn: fresh workspace context → LLM reasoning → tool execution → write to Supabase
- Uses same agent keys (creates if not exist, reuses if already created)
- Requires `OPENAI_API_KEY` in .env.local (~$0.01 per simulation)
- **SSE streaming:** Actions stream to client in real-time via Server-Sent Events (ReadableStream)
- Each action sends immediately as it executes: `data: ${JSON.stringify(data)}\n\n`
- "Thinking" events sent before each agent turn (shows spinner in UI)
- Stream types: `thinking` (agent starting), `done` (simulation complete), `error` (failure)

**SimulationButton (`src/components/Project/SimulationButton.tsx`):**
- Two options: "Live Simulation" (LLM-powered, primary) and "Scripted Demo" (free fallback)
- **SSE stream reader:** Consumes `ReadableStream` via `fetch` + `reader.read()` loop
- Parses `data: {...}\n\n` events with buffer for incomplete chunks
- "Thinking" events show animated spinner, completed actions show checkmark
- **Auto-scroll:** `useRef` + `useEffect` scrolls action log to bottom on each new action
- Scrollable action log (max-h-80) with agent name badges
- `router.refresh()` on stream completion to update all server-rendered data

**Position Prompt Editor (`src/components/Project/PositionPromptEditor.tsx`):**
- Slide-out panel (same pattern as TicketDetail)
- Shows interpolated system prompt for the role
- TextArea for editing with save/reset buttons
- Saves custom override to `positions.system_prompt`

**Interactive Org Chart (`src/components/Project/OrgChartInteractive.tsx`):**
- Extracted org chart into client component with clickable positions
- Hover states, cursor pointer, ring effect on hover
- Clicking any position opens PositionPromptEditor

**Schema + Types:**
- `ALTER TABLE positions ADD COLUMN system_prompt text`
- Position type updated with `system_prompt: string | null`
- New `getAgentPrompt()` helper in constants.ts — checks custom override, falls back to template

### Files Changed (9)
- `src/app/api/projects/[projectId]/simulate/route.ts` — NEW (scripted simulation)
- `src/app/api/projects/[projectId]/simulate-live/route.ts` — NEW (live LLM simulation)
- `src/components/Project/SimulationButton.tsx` — NEW (dual-mode button)
- `src/components/Project/PositionPromptEditor.tsx` — NEW (prompt editor)
- `src/components/Project/OrgChartInteractive.tsx` — NEW (interactive org chart)
- `src/app/projects/[projectId]/page.tsx` — EDIT (integrate both features)
- `src/types/index.ts` — EDIT (system_prompt field)
- `src/lib/constants.ts` — EDIT (getAgentPrompt helper)
- `package.json` — added `openai` SDK

### Decisions
- Two simulation modes: live (GPT-4o-mini, costs ~$0.01) and scripted (free, instant)
- Agent keys marked `is_active: false` (simulated, not real API keys)
- Custom prompts stored on position record, null = use default template
- Platform is LLM-agnostic — Agent API accepts HTTP from any agent regardless of provider
- Live simulation uses OpenAI function calling (4 tools) for natural agent behavior

---

## Session 9 (2026-03-11) — Vision Pivot: Marketplace, Not SaaS

### Context
- User realized landing page and product framing positioned OpenPod as a SaaS tool ("Start a Project", "Your next startup is one prompt away")
- OpenPod is actually a marketplace/platform for AI agent labor — like Upwork for AI agents
- Any LLM agent (Claude, GPT, Gemini, open source) can register, apply for jobs, work, and get paid
- Even PM role is a job listing, not auto-assigned
- Inspired by Moltbook's Meta acquisition — building the rails AI agent economies run on

### Changes Made

**Landing page rewrite (`src/app/page.tsx`):**
- New hero: "Post a project. Agents compete to build it."
- Tagline: "The hiring platform for AI agents"
- 3-step how it works: Post vision → Agents apply → Work gets done
- New features: "Open Marketplace" (any LLM), "Escrow Payments" (commission model)
- New section: two-sided value prop (For Humans / For Agent Builders)
- CTA: "The future of work is agent-powered"

**Removed Goals feature:**
- Removed goals inputs from create wizard Step 1
- Removed goals from review summary Step 3
- Removed Goals section from project overview page
- Removed GoalItem component
- Removed goals from API route POST body
- Replaced Goals stat card with Tickets count

**Copy updates:**
- Wizard Step 1: "We'll post a PM position for agents to apply and run your project"
- Wizard Step 3: "A PM position will be posted for agents to apply"
- Overview empty tickets: "Once a PM agent is hired, they'll create and assign tasks"

### Files Changed (5)
- `src/app/page.tsx` — full rewrite (marketplace landing)
- `src/app/projects/new/page.tsx` — removed goals, updated copy
- `src/app/projects/[projectId]/page.tsx` — removed Goals section, fixed stats
- `src/app/api/projects/route.ts` — removed goals from request
- Docs: CHAT_LOG, STATUS, PROGRESS, openpod.md, MEMORY.md

### Architecture Decisions
- Goals table kept in DB (agents may use later via API), just removed from UI
- PM position still auto-created, but copy reframed as "posted for agents to apply"
- Revenue model: marketplace commission on x402 transactions (not subscription)
- **GitHub:** OAuth tokens → GitHub API. Agents read code, create branches, push commits, open PRs. No code stored on OpenPod ($0 hosting).
- **Payments:** x402 protocol (USDC stablecoins, Coinbase/Cloudflare). Machine-to-machine. OpenPod takes commission.
- **Target agents:** OpenClaw, AutoGPT, Claude Agent SDK, LangChain, custom. Any LLM with HTTP API access.
- **Zero storage cost:** Pure coordination layer. Code on GitHub, payments on x402.

---

## Session 1 (2026-03-11) — Original Build (as AgentBoard)

### Context
- User wants to build "Upwork for AI Agents" — a marketplace where humans post projects and AI agents get hired.
- Each project has: mini Jira (ticketing), long-term memory, mini Slack (chat), payments.

### Research
- Researched 20+ existing platforms. None match the full vision.
- Gap: nobody combines marketplace + workspace (ticketing, memory, chat, payments).

### Built (Phase 1 MVP)
- 30 source files: 10 pages, 14 infrastructure, 7 components
- Stack: Next.js 16 + Supabase + Tailwind v4
- TypeScript: 0 errors, ESLint: 0 warnings

---

## Session 2 (2026-03-11) — Uncodixify + Rename to OpenPod

### Uncodixify
- Copied AgentBoard → AgentBoard-uncodex, applied "Uncodixify" UI rules
- Carbon Elegance palette: #121212 bg, #bb86fc purple accent, #03dac6 secondary
- Rules: no blue, no glassmorphism, no rounded-xl, no animations, solid backgrounds
- 3 passes: strip codex patterns → restore functional visuals → fix wasted space → use space gracefully (max-w-7xl, centered hero, section headings, CTA)

### Rename
- AgentBoard → **OpenPod** (openpod.work domain)
- Renamed across all 11 files: source, config, schema, docs

### Space Usage Fix
- User feedback: "not tighter, use space more gracefully"
- Widened layouts from max-w-[960px] to max-w-7xl
- Added: centered hero (text-4xl sm:text-5xl), section headings, step cards as bg-surface cards, CTA section, py-16 sections
- Restored: py-8, mb-8, space-y-6, space-y-4 (original spacing)

### Next Steps
1. Create Supabase project, run schema, update .env.local
2. Enable Google OAuth
3. Test full flow locally
4. Deploy to Vercel → point openpod.work

---

## Session 3 (2026-03-11) — Supabase Connect + Rename Cleanup

### Context
- Continuation from S2. Goal: connect Supabase, run schema, finalize rename across context files.

### Supabase Setup
- Created Supabase project: `brzdcuapdvqitnfkvhwz` (penglabs org, Asia Pacific)
- User ran `schema.sql` in Supabase SQL Editor — "Success. No rows returned"
- User added service_role key to `.env.local` manually (Claude never reads .env files)

### Context File Cleanup
- Merged AgentBoard + AgentBoard-uncodex entries into single "OpenPod" entry in MEMORY.md
- Created `.context/projects/openpod.md` (replaced agentboard.md)
- Deleted `.context/projects/agentboard.md`
- Added OpenPod as project #7 in AGENT_CONTEXT.md registry + workspace structure

### Dev Server
- Killed zombie dev servers (PIDs 81918, 89893) on ports 3002/3003
- Dev server running: Next.js 16.1.6 (Turbopack) on localhost:3002, ready in 471ms

### Key Decision
- `.env*` files are restricted paths — Claude never reads, writes, or displays them. User manages env vars directly.

### Files Changed
- `.context/projects/openpod.md` (created)
- `.context/projects/agentboard.md` (deleted)
- `AGENT_CONTEXT.md` (updated)
- `MEMORY.md` (updated)

### Next Steps
1. Test auth flow (signup → dashboard redirect)
2. Configure Google OAuth in Supabase
3. Deploy to Vercel → point openpod.work

---

## Session 5 (2026-03-11) — Virtual Company Workspace Rework

### Context
- Phase 1 was too plain — just a "post and browse" marketplace. Reworked into a **virtual company** where each project is a funded startup with org hierarchy, tickets, chat, and shared memory.

### Vision
- Human = CEO/Client (pays, sets vision, observes)
- Agents = Workers (PM manages, leads coordinate, workers execute)
- 3-level hierarchy: PM Agent → Lead Agents → Worker Agents
- Memory system modeled after our local `.context/` system

### Schema Migration (schema-v2.sql)
- Added hierarchy columns to positions: `role_level`, `reports_to`, `sort_order`
- Uncommented ALL Phase 2 tables: agent_keys, applications, project_members, tickets, ticket_comments, knowledge_entries, knowledge_versions, channels, messages
- New tables: `goals` (hierarchical), `session_logs` (agent work sessions)
- Full RLS policies, indexes, triggers (auto-create #general channel on publish)

### Bug Fix
- Browse page didn't show created projects — root cause: projects created as `draft`, browse filters `status='open'`. Fixed: auto-publish as `open` on create.

### Create Wizard Rework
- Step 1: "Your Vision" (was "Basics") — project name, vision, goals
- Step 2: "Team Structure" — PM enforced as first position, then add Leads and Workers. Live org chart preview. "Reports to" dropdown.
- Step 4: "Review Your Company" — shows hierarchy tree

### Workspace Layout
- Project detail page → full workspace with sidebar (6 tabs)
- Header bar: project title + status badge
- Sidebar tabs: Overview, Tickets, Chat, Memory, Team, Settings

### Overview Tab (CEO Dashboard)
- Quick stats: positions filled, open roles, goals progress, budget
- Vision section with deadline
- Org chart: You (CEO) → PM → Leads → Workers with hierarchy lines
- Goal tree with status badges

### Workspace Tab Pages (placeholders)
- Tickets: Kanban columns (Todo, In Progress, In Review, Done)
- Chat: Channel list (#general) + message area
- Memory: Knowledge categories + session log + status sub-tabs
- Team: Open positions with hierarchy badges + applications section

### Files Changed
- `supabase/schema-v2.sql` (created — migration)
- `src/types/index.ts` (added Goal, SessionLog, hierarchy fields on Position)
- `src/lib/constants.ts` (added ROLE_LEVELS, GOAL_STATUSES with labels/colors)
- `src/app/api/projects/route.ts` (auto-publish + hierarchy fields)
- `src/app/projects/new/page.tsx` (full rewrite — hierarchy wizard)
- `src/app/projects/[projectId]/layout.tsx` (created — workspace shell)
- `src/app/projects/[projectId]/page.tsx` (full rewrite — CEO dashboard)
- `src/app/projects/[projectId]/tickets/page.tsx` (created)
- `src/app/projects/[projectId]/chat/page.tsx` (created)
- `src/app/projects/[projectId]/memory/page.tsx` (created)
- `src/app/projects/[projectId]/team/page.tsx` (created)
- `src/app/projects/[projectId]/settings/page.tsx` (simplified for workspace layout)
- `src/components/Project/WorkspaceSidebar.tsx` (created)
- 0 TypeScript errors

### Next Steps
1. Run `schema-v2.sql` in Supabase SQL Editor
2. Test full flow: create project with hierarchy → workspace renders
3. Enable Google OAuth
4. Deploy to Vercel

---

## Session 6 (2026-03-11) — Simplify Onboarding + Unified Overview + GitHub

### Context
- User feedback: onboarding too technical. Human shouldn't define team structure — just vision + goals.
- PM agent should auto-manage: analyze vision, create plan, hire team, assign work.
- Human just pays for compute, occasionally steers via Slack.
- Chat + tickets should be visible on Overview, not hidden in separate tabs.
- Need GitHub integration for agents to work with real repos.

### Schema Migration (schema-v3.sql)
- Added `github_repo text` column to projects table
- User ran in Supabase SQL Editor — "Success. No rows returned"

### Create Wizard Simplification
- **Before:** 4 steps (Vision, Team Structure, Settings, Review) — 700 lines
- **After:** 3 steps (Vision, Settings, Review) — 260 lines
- Removed: PositionDraft, all position management functions, PositionCard, ReviewPositionCard, Step 2 Team Structure UI
- Added: GitHub repo URL input in Settings step
- Review step: shows info callout about auto-PM creation

### API Route Changes
- Accepts `github_repo` in POST body
- Removed user-provided positions logic entirely
- Auto-creates PM position on project creation (title: "Project Manager", role_level: 'project_manager')

### Unified Overview Page
- **Before:** Org chart + goals + stats only
- **After:** Command center with 2-column layout:
  - Left (60%): org chart, ticket list (5 recent with priority/status badges), goals
  - Right (40%): chat feed (5 recent messages + QuickChatInput), memory highlights (3 recent entries), tags
- Section headers with "View All" links to detail pages
- Fetches from: projects, positions, goals, channels, messages, tickets, knowledge_entries

### New Component
- `QuickChatInput.tsx` — client component for sending messages to #general from overview
- Uses browser Supabase client, single-line input + send button

### Agent Context Templates
- Added `AGENT_CONTEXT_TEMPLATES` to constants.ts — pre-built system prompts for PM, Lead, Worker
- Added `interpolateTemplate()` helper for runtime `{placeholder}` substitution
- PM template includes: vision, goals, responsibilities, communication guidelines, project context

### GitHub Integration
- `github_repo` field on Project type
- Shows in: workspace header bar (layout.tsx), overview vision section, settings page, create wizard
- Clickable external link with GitHub icon

### Layout + Settings Updates
- `layout.tsx`: fetches `github_repo`, shows repo link in header bar (ml-auto, right-aligned)
- `settings/page.tsx`: added GitHub repo input field + save

### Files Changed
- `supabase/schema-v3.sql` (created — migration)
- `src/types/index.ts` (added github_repo to Project)
- `src/lib/constants.ts` (added AGENT_CONTEXT_TEMPLATES, interpolateTemplate)
- `src/app/api/projects/route.ts` (github_repo, auto-PM, removed positions)
- `src/app/projects/new/page.tsx` (full rewrite — 3-step wizard)
- `src/app/projects/[projectId]/page.tsx` (full rewrite — unified command center)
- `src/components/Project/QuickChatInput.tsx` (created)
- `src/app/projects/[projectId]/layout.tsx` (github link in header)
- `src/app/projects/[projectId]/settings/page.tsx` (github repo field)
- 0 TypeScript errors

### Next Steps
1. Delete old test projects (pre-rework, no auto-PM)
2. Test full flow: create project with just vision → verify workspace with auto-PM + chat + tickets
3. Enable Google OAuth
4. Build Agent API (the actual endpoints agents call)

---

## Session 7 (2026-03-11) — Build Workspace Tabs (Tickets, Chat, Memory)

### Context
- Sessions 5-6 built the workspace shell with 6 sidebar tabs and unified overview. But Tickets, Chat, and Memory tabs were empty placeholders.
- User requested: build out all 3 placeholder tabs with real CRUD.
- Memory system should be modeled after local `.context/` system (categories, append-only knowledge, session logs) with improvements (version history, tags).

### Architecture Pattern
- Server component (page.tsx) fetches initial data via server Supabase client
- Client components handle mutations via browser client, call `router.refresh()` after
- Same pattern used by existing `settings/page.tsx` and `QuickChatInput.tsx`

### Tickets Tab — Full Kanban Board
- **Server page** fetches all tickets + positions for the project
- **TicketBoard.tsx** — 4-column Kanban (Todo, In Progress, In Review, Done) with ticket cards (number, title, priority badge)
- **CreateTicketForm.tsx** — inline form (title, description, priority), auto-generates ticket number
- **TicketDetail.tsx** — slide-out panel (right side overlay) with editable title, description, status/priority dropdowns, comments section with add comment

### Chat Tab — Channel Messaging
- **Server page** fetches channels + messages for default channel (#general), passes to client
- **ChatArea.tsx** — left sidebar (channel list + create channel), right area (message feed + input)
- Channel switching: client-side fetch of messages per channel
- Message input with Enter key + send button (reuses QuickChatInput pattern)
- Agent vs human message styling (secondary color for bots, accent for humans)

### Memory Tab — Knowledge Base + Session Logs
- **Server page** fetches knowledge_entries + session_logs, uses searchParams for tab switching
- Tab switching via Next.js `Link` elements (URL-based: `/memory` vs `/memory?tab=sessions`)
- **KnowledgeTab.tsx** — category filter chips (All + 5 categories with counts), accordion entry list, expand to see full content + edit button
- **KnowledgeForm.tsx** — create/edit form (title, category dropdown, content, tags). Edit mode: bumps version, creates `knowledge_version` record
- **SessionLogTab.tsx** — chronological list of agent work sessions, expandable details (files_changed, decisions_made, blockers)

### Memory System Design (modeled after `.context/`)
- Categories: architecture, decisions, patterns, context, general (matches KNOWLEDGE_CATEGORIES in constants.ts)
- Append-only: new entries, not overwriting
- Version history: `knowledge_versions` table tracks every edit with changed_by
- Tags for cross-referencing
- Session logs: structured records (summary, files_changed, decisions_made, blockers)
- Improvements over local system: searchable by category/tags, version tracking, session traceability

### Files Changed
- `src/app/projects/[projectId]/tickets/page.tsx` (rewrite — server fetch → TicketBoard)
- `src/components/Project/TicketBoard.tsx` (created — Kanban board)
- `src/components/Project/CreateTicketForm.tsx` (created — inline create form)
- `src/components/Project/TicketDetail.tsx` (created — slide-out detail panel)
- `src/app/projects/[projectId]/chat/page.tsx` (rewrite — server fetch → ChatArea)
- `src/components/Project/ChatArea.tsx` (created — channels + messages)
- `src/app/projects/[projectId]/memory/page.tsx` (rewrite — server fetch → tabs)
- `src/components/Project/KnowledgeTab.tsx` (created — knowledge entries + filter)
- `src/components/Project/KnowledgeForm.tsx` (created — create/edit form)
- `src/components/Project/SessionLogTab.tsx` (created — session log list)
- 0 TypeScript errors

### Next Steps
1. Test full flow: create project → create ticket → send chat → add knowledge entry
2. Enable Google OAuth
3. Build Agent API (endpoints for agents to apply, get tasks, update tickets, post chat, write memory)
4. LLM agent simulation (real agents joining and working on projects)

---

## Session 8 (2026-03-11) — Design System Upgrade

### Context
- User felt the site looked "generic AI generated." Applied design principles to differentiate.
- Goal: establish a permanent design system standard for all pages.

### Design System — "Carbon Elegance v2"
- **Display font:** Space Grotesk (`font-display`) for all headings, brand text
- **Body font:** Inter (`font-sans`) unchanged
- **Visual depth:** `hero-glow` (radial gradient), `dot-grid` (subtle grid), `card-glow` (gradient border on hover), `accent-line` (gradient separator)
- **Typography:** Dramatic size contrast (text-7xl hero), extreme weight variation (font-light vs font-bold), left-aligned hero
- **Section labels:** `text-xs font-medium text-secondary tracking-widest uppercase` with icon
- **Cards:** `card-glow` class for hover gradient border, `bg-surface` base

### Changes
1. **layout.tsx** — Added Space Grotesk font as `--font-display`
2. **globals.css** — Added `hero-glow`, `accent-line`, `card-glow`, `dot-grid` utilities + font CSS vars
3. **page.tsx (landing)** — Full redesign: left-aligned hero, dramatic typography, section labels, gradient cards
4. **All pages** — Applied `font-display` to headings, `card-glow` to cards, `hero-glow` to auth pages, updated Navbar brand
5. **openpod.md** — Documented design system as permanent standard

### Files Changed
- `src/app/layout.tsx`, `globals.css`, `page.tsx` (landing redesign)
- `src/app/login/page.tsx`, `signup/page.tsx` (auth design)
- `src/app/dashboard/page.tsx`, `projects/page.tsx` (dashboard + browse)
- `src/app/projects/new/page.tsx`, `profile/page.tsx` (wizard + profile)
- `src/app/projects/[projectId]/layout.tsx`, `page.tsx`, `team/page.tsx`, `settings/page.tsx` (workspace)
- `src/components/Layout/Navbar.tsx`, `Project/WorkspaceSidebar.tsx` (components)

### Next Steps
1. Test full flow (create project → workspace renders with new design)
2. Enable Google OAuth
3. Build Agent API
4. Deploy to Vercel → openpod.work
