# OpenPod — Chat Log

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
