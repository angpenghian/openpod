# OpenPod — Chat Log

## Session 31 (2026-03-14) — Stripe Setup + Deploy

### What Happened
- Continued from Session 30 (dual payment system code complete, not yet deployed)
- User set up Stripe dashboard manually with Claude guiding via screenshots

### Stripe Dashboard Setup
1. **API Keys** — user navigated to Developers → API keys page (Stripe Workbench, new UI)
2. **Secret Key** — created new key ("Building your own integration" option)
3. **Webhook Destination** — created in Workbench → Event destinations (NOT old Developers → Webhooks)
   - 4 events: `checkout.session.completed`, `account.updated`, `transfer.created`, `transfer.reversed`
   - URL: `https://openpod.work/api/stripe/webhooks`
   - Note: `transfer.failed` doesn't exist in Stripe — replaced with `transfer.reversed`
4. **Stripe Connect** — enabled in sandbox first, then live
   - Model: **Marketplace** ("Sell to buyers yourself and send funds to recipients")
   - Account creation: Stripe-hosted onboarding
   - Account management: Express Dashboard
   - Confirmed liability for refunds/chargebacks
5. **Vercel env vars** — user added STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

### Code Change
- `src/app/api/stripe/webhooks/route.ts` — changed `transfer.failed` → `transfer.reversed` (event doesn't exist in Stripe)

### Deploy
- Committed Session 30 code: `b1801e6` — 26 files, 6346 insertions
- Pushed to `main` → Vercel auto-deploy triggered

### Key Learnings
- Stripe replaced "Developers Dashboard" with **Workbench**. Webhooks are now "Event destinations."
- `transfer.failed` is not a real Stripe event — use `transfer.reversed` instead
- Connect setup requires sandbox first, then go-live steps

### Files Changed
- `src/app/api/stripe/webhooks/route.ts` (transfer.failed → transfer.reversed)

---

## Session 30 (2026-03-14) — Dual Payment System (Stripe Connect + x402 Protocol)

### Context
- All non-payment features shipped (30+ endpoints). Payments were internal ledger only — "Real payouts coming soon with Stripe Connect."
- User wanted BOTH payment rails built: Stripe Connect (human→agent USD) AND x402 protocol (agent→agent USDC on Base).
- Plan approved: 4 phases, 13 new files, 9 modified files.

### What Was Built

#### Phase 1: Foundation
- **Schema v10** (`supabase/schema-v10.sql`) — deployed to Supabase
  - `agent_registry`: +stripe_account_id, +stripe_onboarded, +wallet_address
  - `projects`: +stripe_payment_intent_id, +escrow_amount_cents, +escrow_status (6 states)
  - `transactions`: +payment_rail (ledger/stripe/x402), +stripe_transfer_id, +x402_tx_hash, +settled, +settled_at
  - New tables: `stripe_events` (idempotent webhook processing), `x402_payments` (agent-to-agent log)
- **Types** (`src/types/index.ts`) — StripeEvent, X402Payment interfaces + payment fields on existing types
- **Constants** (`src/lib/constants.ts`) — ESCROW_STATUSES, PAYMENT_RAILS, 3 new webhook events
- **Bug fix** — TicketDetail.tsx was creating transactions CLIENT-SIDE with wrong amount (net vs gross). Replaced with server endpoint call to new `POST /api/projects/[projectId]/tickets/[ticketId]/approve` (cookie auth)
- **Dependencies** — `stripe`, `ethers` installed

#### Phase 2: Stripe Connect (Human → Agent)
- **Stripe lib** (`src/lib/stripe.ts`) — singleton, createExpressAccount, createCheckoutSession, settleStripeTransfer, constructEvent
- **Onboard route** (`POST /api/stripe/connect/onboard`) — creates Express account, returns Stripe onboarding URL
- **Status route** (`GET /api/stripe/connect/status`) — checks agent's Stripe onboarding status
- **Checkout route** (`POST /api/stripe/checkout`) — creates Checkout Session for project escrow funding (min $1)
- **Webhook route** (`POST /api/stripe/webhooks`) — handles checkout.session.completed, account.updated, transfer.failed. Idempotent via stripe_events table.
- **Approval route modified** (`POST /api/agent/v1/tickets/[ticketId]/approve`) — after transaction insert, attempts Stripe transfer if project funded + agent onboarded. Graceful fallback to ledger if not.

#### Phase 3: x402 Protocol (Agent → Agent)
- **x402 lib** (`src/lib/x402.ts`) — facilitator URL, network config, USDC balance reader (ethers.js), wallet validation, payment verification via Coinbase facilitator
- **Register route** — now accepts optional `wallet_address` (validated 0x + 40 hex)
- **Me route** — GET returns wallet_address + stripe_onboarded. New PATCH handler for profile updates.
- **Balance route** (`GET /api/agent/v1/me/balance`) — on-chain USDC balance + internal ledger totals + x402 earnings
- **Delegate route** (`POST /api/agent/v1/delegate`) — x402-gated task delegation (returns 402 → payment → settlement)
- **Invoke route** (`POST /api/agent/v1/services/[agentSlug]/invoke`) — x402-gated service call by slug

#### Phase 4: Polish
- **Email** — removed "Real payouts coming soon", replaced with actual settlement info
- **agents.json** — added x402-payments capability, agent-to-agent-payment + task-delegation flows
- **ai-plugin.json** — updated description with x402, wallet_address, 30+ endpoints
- **openapi.json** — updated to 30+ endpoints with payment rail mention

### TS Errors Fixed
1. Stripe API version mismatch: `'2025-04-30.basil'` → `'2026-02-25.clover'`
2. `event.data.object` type cast: double cast `as unknown as Record<string, unknown>`
3. `transfer.failed` not in Stripe event union: cast `event.type as string` + if/else instead of switch

### Files Created (13)
- `supabase/schema-v10.sql`, `src/lib/stripe.ts`, `src/lib/x402.ts`
- `src/app/api/stripe/connect/onboard/route.ts`, `src/app/api/stripe/connect/status/route.ts`
- `src/app/api/stripe/checkout/route.ts`, `src/app/api/stripe/webhooks/route.ts`
- `src/app/api/projects/[projectId]/tickets/[ticketId]/approve/route.ts`
- `src/app/api/agent/v1/me/balance/route.ts`, `src/app/api/agent/v1/delegate/route.ts`
- `src/app/api/agent/v1/services/[agentSlug]/invoke/route.ts`

### Files Modified (9)
- `src/types/index.ts`, `src/lib/constants.ts`, `src/components/Project/TicketDetail.tsx`
- `src/app/api/agent/v1/tickets/[ticketId]/approve/route.ts`, `src/app/api/agent/v1/register/route.ts`
- `src/app/api/agent/v1/me/route.ts`, `src/lib/email.ts`
- `src/app/.well-known/agents.json/route.ts`, `src/app/.well-known/ai-plugin.json/route.ts`

### Build
- 0 TypeScript errors, clean `next build`
- Schema v10 deployed to Supabase

### Deployment Steps (for user)
1. ~~Deploy schema v10 to Supabase SQL Editor~~ ✅ Done
2. Set up Stripe account + webhook endpoint
3. Create platform wallet for x402 commission
4. Add env vars to Vercel (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, OPENPOD_WALLET_ADDRESS, X402_NETWORK, BASE_RPC_URL)
5. Commit & push to trigger Vercel deploy
6. Test both payment flows

### Decisions
- **Express Connect** (not Custom) — less friction, Stripe handles KYC/taxes
- **Stripe Checkout** (not Payment Intents) — zero PCI scope, hosted page
- **Transfers** (not direct charges) — platform controls when money moves
- **No private keys stored** — agents bring their own wallets, OpenPod stores public address only
- **Ledger = source of truth** — Stripe/x402 are settlement rails on top of existing ledger
- **x402 per-route** (not global middleware) — only agent-to-agent endpoints are paid
- **10% commission on both rails** — same COMMISSION_RATE for consistency
- **Graceful fallback** — if Stripe not configured or agent not onboarded, stays as ledger

---

## Session 29 (2026-03-14) — ClawHub Skill + Promotion Strategy

### Context
- User wants to start promoting OpenPod. Friend suggested posting on ClawHub.
- Researched ClawHub ecosystem, SKILL.md format, publishing process, promotion channels.

### ClawHub Skill Published
- Built `OpenPod/clawhub-skill/SKILL.md` — wraps all 25 Agent API endpoints as an OpenClaw skill
- SKILL.md format: YAML frontmatter + curl/jq examples for every endpoint
- Covers: registration, discovery, applications, tickets, messages, knowledge, GitHub, webhooks
- Verified all curl examples match actual API routes (fixed 4 minor mismatches: response format docs, ticket transitions, GitHub token fields)
- **Published to ClawHub as `openpod@1.0.0`** (hash: `k974mgdhhq6ry0nd1es1g459xd82vckt`)

### Knowledge File Updated
- Updated `.context/knowledge/openclaw.md` with comprehensive promotion strategy:
  - ClawHub publishing process (CLI commands, prerequisites, version management)
  - Security pipeline (SHA-256, VirusTotal, Code Insight, verdicts)
  - 13-point security checklist
  - 12 promotion channels ranked by impact (ClawHub → awesome-openclaw-skills → Discord → Show HN → Product Hunt → Reddit → Dev.to → directories → X → GitHub Discussions → CoClaw → Indie Hackers)
  - 4 AI agent directories for free listings
  - OpenClaw community channels (Discord 141K, CoClaw, forums, newsletter)
  - Key X/Twitter accounts
  - Success stories (Larry Loop 500K views, 2M views agent, Moltbook launch)
  - Third-party registries (SkillHub, SkillsMP) for cross-posting
- Updated ClawHub skill count from 5,700+ → 13,000+

### Files Created
- `OpenPod/clawhub-skill/SKILL.md` — published OpenClaw skill

### Files Modified
- `.context/knowledge/openclaw.md` — promotion channels, publishing guide, success stories

### Decisions
- SKILL.md format (not TypeScript) — simpler, lower barrier, curl-based. Matches HubSpot/Confluence patterns.
- All 25 endpoints included — comprehensive skill, not a subset.

### Next Steps (promotion playbook)
1. Submit PR to awesome-openclaw-skills (VoltAgent GitHub list)
2. Post in OpenClaw Discord showcase (Friends of the Crustacean, 141K members)
3. Request Verified badge from ClawHub dashboard
4. Seed demo content on openpod.work (solve the 0/0/0 problem)

---

## Session 28 (2026-03-14) — Framing Rewrite + QA Round 3

### Context
- User wants OpenPod to succeed like Moltbook. Strategic assessment identified 7 gaps.
- User asked: "scan the whole code base and fix the framing for me"

### Framing Rewrite (commit `027afa5`)
Rewrote ALL public-facing copy from "protocol for agents" to "post your project, AI agents build it":
- **Landing page** — hero, how-it-works (3 steps human-first), features (practical), use cases, CTA
- **Global metadata** — title, description, OG, Twitter, keywords updated
- **Agents browse** — "Agent Marketplace" → "AI Agents Ready to Work"
- **Projects browse** — "Find Work" → "Open Projects"
- **Docs** — "API Documentation" → "Connect Your Agent to OpenPod"
- **Onboarding modal** — all 3 steps reframed human-first
- **Navbar** — link labels updated
- 9 files changed, 125 insertions, 128 deletions

### QA Round 3 + Security Audit
- Ran two parallel audit agents (API routes + UI components)
- [Results pending]

### Grok External Review
- User fed openpod.work to Grok (xAI). Grok noted:
  - 0 agents, 0 projects, 0 positions on homepage = credibility killer
  - Liked the agent marketplace framing ("protocol for agents")
  - Called it "vaporware-adjacent" due to zero traction
  - No external buzz (Reddit, HN, X)
  - Competitors mentioned: Unicity Labs, SwarmMarket, Openlancer

### Decisions
- Framing tension: Grok preferred agent-first framing, we shipped human-first. Need to decide which audience to lead with.

---

## Session 27 (2026-03-13) — All Non-Payment Features + Full QA Audit

### Features Implemented (10 items)
1. **Review Submission UI + API** — `ReviewForm.tsx` + `POST /api/reviews`. Star rating (1-5) + comment. Project owner on completed tickets only.
2. **Global Search** — `GlobalSearch.tsx` in navbar + `GET /api/search?q=`. Agents + public projects. Debounced 300ms.
3. **Onboarding Modal** — 3-step guided tour. localStorage flag. Skip button.
4. **Docs Tutorial** — Full agent lifecycle walkthrough with curl examples added to `/docs`.
5. **Webhook Retry + Delivery History** — 3 attempts, exponential backoff. `webhook_deliveries` table.
6. **Upstash Redis Rate Limiting** — Replaces in-memory Map. Fallback if no env vars.
7. **Task Dependencies** — `POST/GET/DELETE /api/projects/[id]/dependencies`. Circular check. Blocked indicators.
8. **CI/CD Feedback Loop** — `check_run.completed` + `pull_request_review.submitted` handlers.
9. **Email Notifications (Resend)** — 3 templates + preferences table + profile toggles.
10. **Full QA + Security Audit** — HTML injection, IDOR, URL validation, IPv6 SSRF, payout validation fixed.

### Schema v9: `webhook_deliveries`, `ticket_dependencies`, `notification_preferences`
### External: Upstash Redis (us-east-1) + Resend (pending reactivation, TXT DNS only)
### Commit: `4598416` — 24 files, 2169 insertions. Pushed to main.

---

## Session 27 (2026-03-13) — All Non-Payment Features + Full QA Audit

### Features (10 items)
1. **Review submission** — `ReviewForm.tsx` + `POST /api/reviews`. Star rating + comment. Project owner on completed tickets.
2. **Global search** — `GlobalSearch.tsx` in navbar + `GET /api/search?q=`. Agents + public projects. Debounced 300ms.
3. **Onboarding modal** — 3-step guided tour. localStorage flag. Skip button.
4. **Docs tutorial** — Full agent lifecycle walkthrough with curl examples.
5. **Webhook retry** — 3 attempts, exponential backoff. `webhook_deliveries` table.
6. **Upstash Redis rate limiting** — Replaces in-memory Map. Fallback if no env vars.
7. **Task dependencies** — `POST/GET/DELETE /api/projects/[id]/dependencies`. Circular check.
8. **CI/CD feedback** — `check_run.completed` + `pull_request_review.submitted` handlers.
9. **Email notifications** — Resend: 3 templates + preferences table + profile toggles.
10. **QA + security audit** — HTML injection, IDOR, URL validation, IPv6 SSRF, payout validation.

### Schema v9: `webhook_deliveries`, `ticket_dependencies`, `notification_preferences`
### External: Upstash Redis (us-east-1) + Resend (pending reactivation)
### Commit: `4598416` — 24 files, 2169 insertions

---

## Session 26 (2026-03-13) — GitHub UX Redesign + Deep QA/Security Audit

### Context
- Post-Session 25. GitHub App built but UX was broken — `project_id is required` error on GitHub callback.
- User tested flows end-to-end and reported multiple issues.

### What Was Fixed
- **`project_id is required` error:** GitHub callback URL had no `state` param when user installs from GitHub directly. Added Case 3 to setup route — returns HTML page with `window.close()` + fallback link.
- **GitHub UX redesign — no-redirect flow:**
  - Created `POST /api/github/connect` — auto-links installation by calling `findInstallationForRepo()`. No redirects.
  - Created `GET /api/github/repos` — lists repos accessible to GitHub App, filtered by user's GitHub identity.
  - Added `listAppInstallations()`, `listInstallationRepos()`, `findInstallationForRepo()` to `github.ts`.
  - Rewrote project creation page with repo picker dropdown (select from installed repos).
  - Rewrote settings page with inline "Connect GitHub" button (no redirect to GitHub).
  - Success banner on project overview when `?github=connected`.
- **Setup route now handles 3 cases:**
  1. OpenPod UI with `?project_id=xxx` → auto-connect or redirect to GitHub
  2. GitHub redirect with `?installation_id=xxx&state=xxx` → store and redirect to project
  3. GitHub redirect with `?installation_id=xxx` (no state) → auto-close tab HTML page

### Deep QA Results (23 bugs: 4 Critical, 5 High, 10 Medium, 4 Low)
- **CRIT:** Unauthenticated GitHub API calls in callback/setup (missing JWT header)
- **CRIT:** Auto-connect result not checked in project creation (always shows "connected")
- **CRIT:** Connect button reads stale DB (user must save repo URL before connecting)
- **HIGH:** Duplicate endpoints (callback + setup do identical work)
- **HIGH:** `setupAction=request` redirect skips auth check
- **HIGH:** Non-GitHub-OAuth users see ALL repos from ALL installations
- **HIGH:** Changing `github_repo` URL doesn't invalidate old installation
- See full report in session transcript

### Deep Security Results (13 vulns: 3 High, 5 Medium, 5 Low)
- **HIGH:** Open redirect — unvalidated `state` in redirects
- **HIGH:** Auth bypass — `setupAction=request` before auth check
- **HIGH:** Installation spoofing — `installation_id` not verified against repo
- **MED:** CSRF on POST `/api/github/connect`
- **MED:** Data leakage — non-GitHub users see all repos
- **MED:** No rate limiting on human-facing GitHub routes
- See full report in session transcript

### Files Changed
- Modified: `src/app/api/github/setup/route.ts` (3 cases + auto-close HTML)
- New: `src/app/api/github/connect/route.ts`, `src/app/api/github/repos/route.ts`
- Modified: `src/lib/github.ts` (3 new functions)
- Rewritten: `src/app/projects/new/page.tsx` (repo picker), `src/app/projects/[projectId]/settings/page.tsx` (inline connect)
- Modified: `src/components/Project/WorkspaceLiveOverview.tsx` (success banner)
- Commits: `96f2e8e`, `8b17281`, `b7ecb55`, `022612e`

### Bug Fixes Applied (all audit findings)
- **Deleted** `src/app/api/github/callback/route.ts` — duplicate dead code (H1)
- **Setup route** — UUID validation on state, integer bounds on installationId, auth-first (fixes auth bypass on setupAction=request), JWT-authenticated GitHub API call, CSP headers on HTML response (C1, H2, H5, M9, M10)
- **Repos route** — non-GitHub-OAuth users get empty list instead of all repos (H3, M5)
- **Connect route** — CSRF origin header check (M1)
- **Webhook route** — JSON.parse try/catch, `.single()` → `.limit(1).maybeSingle()` (M6, M7)
- **Settings page** — auto-save repo URL before connect (C3), disconnect error handling + `is_active` filter (M2), invalidate installation on repo URL change (H4), `useMemo` for supabase client
- **Project creation** — check auto-connect response before showing success (C2)
- **Build:** 0 TypeScript errors. Commit: `f152023`. Pushed to main.
- 11 files changed, 234 insertions, 156 deletions

### Security Round 2 (second audit pass)
- **Second deep QA** (18 bugs) + **second security audit** (13 vulns) — found 6 actionable issues missed in round 1
- **CRIT fixed:** PRStatusBadge called agent-only `/api/agent/v1/github/verify-deliverable` from browser → always 401. Created human-facing `POST /api/github/verify-pr` with cookie auth.
- **HIGH fixed:** UUID validation on `project_id` in connect route + 3 agent GitHub routes (token, prs, verify-deliverable)
- **HIGH fixed:** Owner/repo character validation (`^[a-zA-Z0-9._-]+$`) in all `github.ts` API functions (SSRF prevention)
- **HIGH fixed:** Insert error checks in connect route + setup Case 1
- **HIGH fixed:** `pr_url` defense-in-depth validation (`startsWith('https://github.com/')`) in verify-deliverable route
- **LOW fixed:** Error message in `generateAppJWT` no longer leaks env var names
- **Build:** 0 TypeScript errors. Commit: `c1546fd`. Pushed to main.
- 11 files changed, 197 insertions, 1 new file

---

## Session 25 (2026-03-13) — GitHub App Integration

### Context
- Phase 1.1 of approved roadmap: GitHub App Integration
- openpod.work live with 20 endpoints, needed real GitHub repo access for agents

### What Was Built
- **GitHub App created**: `OpenPod-Work` (App ID: 3082144, slug: openpod-work)
  - Permissions: contents (rw), pull_requests (rw), actions (read), checks (read), issues (rw)
  - Events: pull_request, push, check_run
  - Webhook: HMAC-SHA256 verified
- **3 new agent API endpoints**:
  - `GET /api/agent/v1/github/token` — short-lived installation access tokens for agents
  - `GET /api/agent/v1/github/prs` — list PRs for project repo (open/closed/all)
  - `POST /api/agent/v1/github/verify-deliverable` — verify PR URL + CI status
- **3 GitHub infrastructure routes**:
  - `GET /api/github/callback` — installation callback (stores install → project link)
  - `GET /api/github/setup` — redirects to GitHub App install page
  - `POST /api/github/webhook` — HMAC-verified webhook (PR merged → auto-review tickets)
- **GitHub utility lib** (`src/lib/github.ts`): JWT generation (RS256), installation tokens, PR/checks API
- **Schema v8**: `github_installations` table with RLS (owner-only policies)
- **UI updates**:
  - Project settings: Install/Disconnect GitHub App section with status
  - TicketDetail: PR deliverables show CI status badges (passed/failed/pending/merged/no_checks)
- **Docs**: 3 new endpoints documented + GitHub integration guide with example curl

### Decisions
- GitHub App (not OAuth App) for fine-grained per-repo permissions
- Installation tokens are short-lived (1 hour), agents request fresh ones per session
- PR merged webhook auto-moves linked tickets to `in_review` status
- Webhook secret: generated via `openssl rand -hex 32`

### Files Changed
- New: `src/lib/github.ts`, `src/app/api/agent/v1/github/{token,prs,verify-deliverable}/route.ts`, `src/app/api/github/{callback,setup,webhook}/route.ts`, `supabase/schema-v8.sql`
- Modified: `src/types/index.ts`, `src/app/projects/[projectId]/settings/page.tsx`, `src/components/Project/TicketDetail.tsx`, `src/app/docs/page.tsx`
- 12 files changed, 1107 insertions

### Env Vars Added
- `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`
- Added to both `.env.local` and Vercel

---

## Session 22 (2026-03-13) — Dev/Prod Split + Deployment Prep

### Context
- Continued from S21. Schema v7 deployed (had partial run error for duplicate policy — confirmed agent_webhooks table exists).
- User created GitHub repo (github.com/angpenghian/openpod). Pushed via SSH (HTTPS auth failed, no gh CLI).
- User decided: simulation is dev-only, production should NOT have OpenAI dependency.

### What Was Built
- **Cleaned up old folders**: Deleted AgentBoard (790MB) + AgentBoard-uncodex from Apps/
- **Created OpenPod-dev**: Full copy of codebase (rsync, excluding node_modules/.next/.git) — this is the dev version with simulation + OpenAI SDK
- **Stripped simulation from production OpenPod**:
  - Deleted `simulate-live/route.ts`, `simulate/route.ts`, `SimulationButton.tsx`
  - Removed `openai` from package.json dependencies
  - Cleaned WorkspaceLiveOverview: removed SimEvent handler, live ticket/knowledge/position state, useRouter (unused without sim)
  - Cleaned project overview page: removed hasSimulated query
- **Pushed to GitHub**: Committed "Remove agent simulation from production" → pushed to main
- **TypeScript verification**: 0 errors on production build

### Decisions
- **Dev/Prod split**: OpenPod = production (pushed to GitHub, deployed to Vercel). OpenPod-dev = development (local, has simulation, OpenAI SDK). All future development happens in OpenPod-dev, production changes synced manually.
- **No OPENAI_API_KEY in Vercel**: Production doesn't need it — simulation is dev-only.
- **Env vars for Vercel**: Only NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY needed.

### Files Changed
- Deleted: `src/app/api/projects/[projectId]/simulate-live/route.ts`, `src/app/api/projects/[projectId]/simulate/route.ts`, `src/components/Project/SimulationButton.tsx`
- Modified: `package.json`, `src/components/Project/WorkspaceLiveOverview.tsx`, `src/app/projects/[projectId]/page.tsx`
- Deleted from Apps/: `AgentBoard/`, `AgentBoard-uncodex/`
- Created: `OpenPod-dev/` (full copy)
