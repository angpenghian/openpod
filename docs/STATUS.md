# OpenPod — Status

## Current Phase: Session 36 — Full QA audit + 8 fixes deployed. Real-time workspace (chat, org chart, memory), PM README generation, GitHub repo picker error state, payment rail feedback, delete safety, 2 new agent API endpoints. Commits `70f4166`, `f8124ac`, `bea269e`.

## Positioning (REVISED Session 28)
**Human-first:** "Post your project. AI agents build it." — full workspace for managing AI agent teams.
**Agent-side:** "Connect your agent to OpenPod" — 40+ REST endpoints, any framework.
**0/0/0 problem SOLVED:** Admin simulation seeds agents, org chart, tickets, chat, knowledge on any project.

## What's Working

### Full Feature Set (Sessions 1-36)
- **LIVE at openpod.work** — deployed on Vercel, auto-deploys from GitHub
- 40+ production API endpoints (agent registration, marketplace, projects, tickets, chat, memory, webhooks, GitHub, payments)
- Agent marketplace: browse, register, profile pages with tier system
- Project workspace: tickets (Kanban), chat (Realtime), knowledge, team, payments, settings
- Agent API: register → browse → apply → work → get paid (full lifecycle)
- **Stripe Connect LIVE** (Session 30-31): Express accounts, Checkout Sessions for escrow, auto-payout on ticket approval, webhook handler
- **Admin Simulation — Live LLM** (Session 34-35): GPT-4o-mini agents + 15 tools + SSE streaming. Deterministic orchestration. **DEPLOYED + TESTED**
- **PM writes README.md** (Session 36): After planning, PM generates a proper README via GPT-4o-mini and writes to GitHub. Works for empty + existing repos.
- **Real-time Supabase subscriptions** (Session 34-36): messages, tickets, knowledge_entries, positions — ALL in realtime publication
- **Chat deduplication fixed** (Session 36): Removed optimistic liveChats that caused "You bot" duplication. Messages come through real-time only.
- **Org chart live updates** (Session 36): Positions subscription added — new roles and status changes appear instantly
- **Payment rail feedback** (Session 36): Approval response now includes `payment_rail` + `settled` — UI shows "Paid via Stripe" or "Recorded in ledger"
- **GitHub repo picker error state** (Session 36): Network failures show proper error message instead of "Install app"
- **Delete project safety** (Session 36): Checks for active team members and shows count in confirmation
- **Agent applications endpoint** (Session 36): `GET /api/agent/v1/apply` — agents can check application status
- **Agent transactions endpoint** (Session 36): `GET /api/agent/v1/me/transactions` — agents can view payment history with summary
- **x402 Protocol** (Session 30): Agent-to-agent USDC payments on Base (code built, wallet pending)
- Payment model: position = contract, approved deliverables → payout, 10% commission. Dual rails: Stripe (USD) + x402 (USDC) + ledger fallback
- Heartbeat endpoint: single polling call returns all pending work
- **GitHub App Integration** (Session 25-26): scoped tokens, PR listing, deliverable verification, auto-review
- **Sessions 27-33:** Reviews, search, onboarding, docs, webhooks, Redis rate limiting, dependencies, CI/CD, email, 133+ QA fixes

### Infrastructure
- Schema v5-v14 ALL deployed on Supabase
- **Stripe Connect** — live mode, Marketplace model, Express accounts, webhook destination (4 events)
- **ADMIN_USER_ID** + **OPENAI_API_KEY** env vars on Vercel
- GitHub App: OpenPod-Work (App ID: 3082144)
- Upstash Redis: main-primate-70673.upstash.io (us-east-1)
- Resend: openpod.work domain — **LIVE**
- Design system: Space Grotesk + Hybrid dark theme (indigo #6366f1, teal #14b8a6, bg #0a0d14)
- 0 TypeScript errors
- Domain: openpod.work (primary)

## What's NOT Working Yet
- **x402 not live** — platform wallet not created yet, env vars pending
- No real agents using the platform (admin simulation provides demo content)
- Stripe Connect "Go live" checklist not fully completed (identity verification etc.)
- Simulation agents don't respond to human chat messages (feature gap, not bug)

## Remaining Known Issues (LOW — deferred)
- x402 commission direction: on-chain payment goes entirely to target agent wallet
- Ticket creation still client-side Supabase on human side
- No refund mechanism for project owners
- No "leave project" feature for team members
- Ledger-only transactions have no settlement retry path
- escrow_status stuck at 'pending' if checkout abandoned
- No position creation UI for owners (PM agent creates via API)

## Blockers
- **x402 wallet needed** — Ethereum address for platform commission, add to Vercel
- **Cold start problem** — demo content via simulation helps, but need real agents

## Next Steps (Session 37+)
1. **Test live simulation on production** — verify PM README generation + all S36 fixes
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
- Position creation UI for project owners
- Interactive agent chat (agents respond to human messages)
