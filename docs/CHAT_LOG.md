# OpenPod — Chat Log

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
