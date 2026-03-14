# OpenPod — Status

## Current Phase: Session 33 — 3 features built (FundProjectButton, SetupPayoutsButton, Admin Simulation) + 25 fixes across Rounds 8-10. 133+ total fixes across 10 QA rounds. All CRITICAL resolved. DEPLOYED. Admin simulation live (scripted, no OpenAI API).

## Positioning (REVISED Session 28)
**Human-first:** "Post your project. AI agents build it." — full workspace for managing AI agent teams.
**Agent-side:** "Connect your agent to OpenPod" — 40+ REST endpoints, any framework.
**0/0/0 problem SOLVED:** Admin simulation seeds 8 agents, org chart, tickets, chat, knowledge on any project.

## What's Working

### Full Feature Set (Sessions 1-33)
- **LIVE at openpod.work** — deployed on Vercel, auto-deploys from GitHub
- 40+ production API endpoints (agent registration, marketplace, projects, tickets, chat, memory, webhooks, GitHub, payments)
- Agent marketplace: browse, register, profile pages with tier system
- Project workspace: tickets (Kanban), chat (Realtime), knowledge, team, payments, settings
- Agent API: register → browse → apply → work → get paid (full lifecycle)
- **Stripe Connect LIVE** (Session 30-31): Express accounts, Checkout Sessions for escrow, auto-payout on ticket approval, webhook handler, env vars configured on Vercel
- **FundProjectButton** (Session 33): Project owners fund escrow via Stripe Checkout. Dollar input → cents conversion, $1-$1M range, escrow balance + status badge display
- **SetupPayoutsButton** (Session 33): Agent owners set up Stripe Connect on profile page. Per-agent onboarding status (not_started/pending/onboarded)
- **Admin Simulation** (Session 33): Admin-only scripted 12-step demo seeding. 8 SIM-prefixed agents, org chart, 6 tickets, chat, knowledge. Dual admin guard (env var + DB role). Comprehensive cleanup on failure. No OpenAI API needed.
- **x402 Protocol** (Session 30): Agent-to-agent USDC payments on Base, delegate tasks, invoke services, 10% commission (code built, wallet pending)
- Payment model: position = contract, approved deliverables → payout, 10% commission. Dual rails: Stripe (USD) + x402 (USDC) + ledger fallback
- Heartbeat endpoint: single polling call returns all pending work
- **GitHub App Integration** (Session 25-26): scoped tokens, PR listing, deliverable verification, auto-review
- **Session 27 features:** Reviews, search, onboarding, docs tutorial, webhook retry, Redis rate limiting, dependencies, CI/CD feedback, email notifications
- **Session 28:** Full framing rewrite (human-first copy across all public pages)
- **Session 29:** ClawHub skill published (`openpod@1.0.0`), promotion strategy documented
- **Session 30:** Dual payment system — Stripe Connect + x402 Protocol, schema v10, 13 new files
- **Session 31:** Stripe dashboard configured (live mode), webhook destination, Connect enabled (Marketplace), code deployed
- **Sessions 32-32g:** Deep QA rounds 1-7: 108+ fixes. All CRITICAL resolved.
- **Session 33:** 3 features (FundProjectButton, SetupPayoutsButton, Admin Simulation) + 25 fixes across rounds 8-10. Commit `b828423`. 21 files, 962 insertions.

### Infrastructure
- Schema v5-v13 ALL deployed on Supabase
- **Stripe Connect** — live mode, Marketplace model, Express accounts, webhook destination (4 events)
- **ADMIN_USER_ID** env var on Vercel — enables admin simulation
- **profile.role = 'admin'** set in Supabase for admin user
- GitHub App: OpenPod-Work (App ID: 3082144)
- GitHub repo: github.com/angpenghian/openpod
- Upstash Redis: main-primate-70673.upstash.io (us-east-1)
- Resend: openpod.work domain — **LIVE** (API key configured on Vercel)
- Design system: Space Grotesk + Hybrid dark theme (indigo #6366f1, teal #14b8a6, bg #0a0d14)
- 0 TypeScript errors
- Domain: openpod.work (live)
- **ClawHub:** `openpod@1.0.0` published (hash: `k974mgdhhq6ry0nd1es1g459xd82vckt`)
- **Payment libs:** stripe, ethers (npm)
- **Vercel env vars:** STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, RESEND_API_KEY, ADMIN_USER_ID configured

## What's NOT Working Yet
- **x402 not live** — platform wallet not created yet, env vars pending (OPENPOD_WALLET_ADDRESS, BASE_RPC_URL)
- No real agents using the platform (admin simulation provides demo content)
- ~~Resend account pending reactivation~~ **RESOLVED**
- ~~No FundProjectButton or SetupPayoutsButton~~ **BUILT (S33)**
- ~~0/0/0 stats — no demo content~~ **SOLVED via admin simulation (S33)**
- Stripe Connect "Go live" checklist not fully completed (identity verification etc.)

## Remaining Known Issues (LOW — deferred)
- x402 commission direction: on-chain payment goes entirely to target agent wallet, platform commission recorded but not collected (design-level, x402 not live)
- Ticket creation still client-side Supabase on human side (server endpoint exists for agent API)
- No refund mechanism for project owners (missing feature)
- No "leave project" feature for team members
- Ledger-only transactions have no settlement retry path
- escrow_status stuck at 'pending' if checkout abandoned (no expiry handler)
- Stripe processing fees not tracked in commission_cents

## Blockers
- **x402 wallet needed** — Ethereum address for platform commission, add to Vercel
- **Cold start problem** — demo content via simulation helps, but need real agents

## Next Steps (Session 34+)
1. **Create platform wallet** — Ethereum address for x402 commission, add to Vercel env
2. **Complete Stripe Go Live** — finish identity verification checklist in Stripe dashboard
3. **Test payment flows** — Fund project → approve ticket → Stripe transfer; Agent delegate → 402 → USDC settle
4. **Run simulation on a real project** — verify demo content renders correctly on openpod.work
5. **Promote** — OpenClaw Discord, awesome-openclaw-skills PR, HN, Product Hunt

## Roadmap

### Immediate
1. Configure x402 (wallet + env vars)
2. Complete Stripe Go Live checklist
3. Test both payment flows end-to-end
4. Run admin simulation on production project

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
