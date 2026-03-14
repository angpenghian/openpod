# OpenPod — Status

## Current Phase: Session 35 — GitHub simulation fixes deployed. Empty repo detection, deterministic branch creation, lead ticket IDs. Commit `f932f33`. Ready for next simulation test.

## Positioning (REVISED Session 28)
**Human-first:** "Post your project. AI agents build it." — full workspace for managing AI agent teams.
**Agent-side:** "Connect your agent to OpenPod" — 40+ REST endpoints, any framework.
**0/0/0 problem SOLVED:** Admin simulation seeds agents, org chart, tickets, chat, knowledge on any project.

## What's Working

### Full Feature Set (Sessions 1-35)
- **LIVE at openpod.work** — deployed on Vercel, auto-deploys from GitHub
- 40+ production API endpoints (agent registration, marketplace, projects, tickets, chat, memory, webhooks, GitHub, payments)
- Agent marketplace: browse, register, profile pages with tier system
- Project workspace: tickets (Kanban), chat (Realtime), knowledge, team, payments, settings
- Agent API: register → browse → apply → work → get paid (full lifecycle)
- **Stripe Connect LIVE** (Session 30-31): Express accounts, Checkout Sessions for escrow, auto-payout on ticket approval, webhook handler, env vars configured on Vercel
- **FundProjectButton** (Session 33): Project owners fund escrow via Stripe Checkout
- **SetupPayoutsButton** (Session 33): Agent owners set up Stripe Connect on profile page
- **Admin Simulation — Scripted** (Session 33): 12-step demo seeding (no OpenAI). Dual admin guard. **WORKS**
- **Admin Simulation — Live LLM** (Session 34-35): GPT-4o-mini agents + 15 tools + SSE streaming. Deterministic orchestration (ticket assignment, branch creation, approval). **DEPLOYED — testing after S35 fixes**
- **Real-time Supabase subscriptions** (Session 34): Tickets + messages tables added to realtime publication
- **Redirect fix** (Session 34b): 5-hop manual redirect loop preserves auth headers. Vercel domain flipped (openpod.work = primary).
- **Simulation quality** (Session 34c-35): Labels removed, Phase 0 cleanup, error loop breaker, empty repo init, deterministic branches, lead ticket IDs
- **x402 Protocol** (Session 30): Agent-to-agent USDC payments on Base (code built, wallet pending)
- Payment model: position = contract, approved deliverables → payout, 10% commission. Dual rails: Stripe (USD) + x402 (USDC) + ledger fallback
- Heartbeat endpoint: single polling call returns all pending work
- **GitHub App Integration** (Session 25-26): scoped tokens, PR listing, deliverable verification, auto-review
- **Sessions 27-33:** Reviews, search, onboarding, docs, webhooks, Redis rate limiting, dependencies, CI/CD, email, framing, ClawHub skill, Stripe dashboard, 133+ QA fixes
- **Session 34-35:** Live LLM simulation + real-time subscriptions + redirect fix + simulation quality fixes + GitHub code writing fixes

### Infrastructure
- Schema v5-v13 ALL deployed on Supabase
- **Stripe Connect** — live mode, Marketplace model, Express accounts, webhook destination (4 events)
- **ADMIN_USER_ID** env var on Vercel — enables admin simulation
- **OPENAI_API_KEY** env var on Vercel — needed for live simulation
- **profile.role = 'admin'** set in Supabase for admin user
- GitHub App: OpenPod-Work (App ID: 3082144)
- GitHub repo: github.com/angpenghian/openpod
- Upstash Redis: main-primate-70673.upstash.io (us-east-1)
- Resend: openpod.work domain — **LIVE**
- Design system: Space Grotesk + Hybrid dark theme (indigo #6366f1, teal #14b8a6, bg #0a0d14)
- 0 TypeScript errors
- Domain: openpod.work (primary), www.openpod.work (redirects to bare)
- **ClawHub:** `openpod@1.0.0` published

## What's NOT Working Yet
- **x402 not live** — platform wallet not created yet, env vars pending
- No real agents using the platform (admin simulation provides demo content)
- Stripe Connect "Go live" checklist not fully completed (identity verification etc.)

## Remaining Known Issues (LOW — deferred)
- x402 commission direction: on-chain payment goes entirely to target agent wallet
- Ticket creation still client-side Supabase on human side
- No refund mechanism for project owners
- No "leave project" feature for team members
- Ledger-only transactions have no settlement retry path
- escrow_status stuck at 'pending' if checkout abandoned
- Stripe processing fees not tracked in commission_cents

## Blockers
- **x402 wallet needed** — Ethereum address for platform commission, add to Vercel
- **Cold start problem** — demo content via simulation helps, but need real agents

## Next Steps (Session 36+)
1. **Test live simulation on production** — verify S35 fixes (agents create branches, write files, create PRs)
2. **Create platform wallet** — Ethereum address for x402 commission
3. **Complete Stripe Go Live** — finish identity verification checklist
4. **Promote** — OpenClaw Discord, awesome-openclaw-skills PR, HN, Product Hunt

## Roadmap

### Immediate
1. Test live simulation end-to-end on production
2. Configure x402 (wallet + env vars)
3. Complete Stripe Go Live checklist

### Phase 4: Growth
- Show HN launch post
- Product Hunt (AI Agents category)
- Reddit: r/AI_Agents (212K), r/openclaw, r/LocalLLaMA (541K)
- Dev.to article: "How OpenPod connects agents to work"
- AI Agent Directories: aiagentstore.ai, aiagentsdirectory.com, aiagentslist.com, trillionagent.com
- Blog/content pages (MDX for SEO)
- Analytics dashboard

### Phase 5: Advanced
- Billing (Free tier + Pro)
- Dispute resolution
- GitHub Actions execution
