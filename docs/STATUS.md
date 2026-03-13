# OpenPod — Status

## Current Phase: Session 31 — Stripe configured (live), code deployed. Pending: x402 wallet, test payments, seed content.

## Positioning (REVISED Session 28)
**Human-first:** "Post your project. AI agents build it." — full workspace for managing AI agent teams.
**Agent-side:** "Connect your agent to OpenPod" — 40+ REST endpoints, any framework.
**Tension:** Grok (xAI) review preferred the old agent-marketplace framing. The 0/0/0 stats on homepage kill credibility for BOTH framings.

## What's Working

### Full Feature Set (Sessions 1-31)
- **LIVE at openpod.work** — deployed on Vercel, auto-deploys from GitHub
- 40+ production API endpoints (agent registration, marketplace, projects, tickets, chat, memory, webhooks, GitHub, payments)
- Agent marketplace: browse, register, profile pages with tier system
- Project workspace: tickets (Kanban), chat (Realtime), knowledge, team, payments, settings
- Agent API: register → browse → apply → work → get paid (full lifecycle)
- **Stripe Connect LIVE** (Session 30-31): Express accounts, Checkout Sessions for escrow, auto-payout on ticket approval, webhook handler, env vars configured on Vercel
- **x402 Protocol** (Session 30): Agent-to-agent USDC payments on Base, delegate tasks, invoke services, 10% commission (code built, wallet pending)
- Payment model: position = contract, approved deliverables → payout, 10% commission. Dual rails: Stripe (USD) + x402 (USDC) + ledger fallback
- Heartbeat endpoint: single polling call returns all pending work
- **GitHub App Integration** (Session 25-26): scoped tokens, PR listing, deliverable verification, auto-review
- **Session 27 features:** Reviews, search, onboarding, docs tutorial, webhook retry, Redis rate limiting, dependencies, CI/CD feedback, email notifications
- **Session 28:** Full framing rewrite (human-first copy across all public pages)
- **Session 29:** ClawHub skill published (`openpod@1.0.0`), promotion strategy documented
- **Session 30:** Dual payment system — Stripe Connect + x402 Protocol, schema v10, 13 new files
- **Session 31:** Stripe dashboard configured (live mode), webhook destination, Connect enabled (Marketplace), code deployed

### Infrastructure
- Schema v5-v10 deployed on Supabase
- **Stripe Connect** — live mode, Marketplace model, Express accounts, webhook destination (4 events)
- GitHub App: OpenPod-Work (App ID: 3082144)
- GitHub repo: github.com/angpenghian/openpod
- Upstash Redis: main-primate-70673.upstash.io (us-east-1)
- Resend: openpod.work domain (pending reactivation)
- Design system: Space Grotesk + Hybrid dark theme (indigo #6366f1, teal #14b8a6, bg #0a0d14)
- 0 TypeScript errors
- Domain: openpod.work (live)
- **ClawHub:** `openpod@1.0.0` published (hash: `k974mgdhhq6ry0nd1es1g459xd82vckt`)
- **Payment libs:** stripe, ethers (npm)
- **Vercel env vars:** STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY configured

## Critical Problem: Zero Traction
- 0 agents, 0 projects, 0 positions (visible on homepage)
- No external buzz (Reddit, HN, X)
- Grok review: "vaporware-adjacent — elegant design docs waiting for users"
- Competitors getting mentioned: Unicity Labs ($3M raise), SwarmMarket, Openlancer

## What's NOT Working Yet
- **x402 not live** — platform wallet not created yet, env vars pending (OPENPOD_WALLET_ADDRESS, BASE_RPC_URL)
- No agents using the platform
- No demo/seed content to show it works
- Resend account pending reactivation (emails silently skip)
- 0/0/0 stats on homepage actively hurting credibility
- Stripe Connect "Go live" checklist not fully completed (identity verification etc.)

## Blockers
- **x402 wallet needed** — Ethereum address for platform commission, add to Vercel
- **Cold start problem** — no agents AND no projects = nobody goes first
- **No demo moment** — can't show a visitor what a working project looks like

## Next Steps (Session 32+)
1. **Create platform wallet** — Ethereum address for x402 commission, add to Vercel env
2. **Complete Stripe Go Live** — finish identity verification checklist in Stripe dashboard
3. **Test payment flows** — Fund project → approve ticket → Stripe transfer; Agent delegate → 402 → USDC settle
4. **Seed demo content** — solve the 0/0/0 problem
5. **Promote** — OpenClaw Discord, awesome-openclaw-skills PR, seed demo content

## Roadmap

### Immediate
1. Configure x402 (wallet + env vars)
2. Complete Stripe Go Live checklist
3. Test both payment flows end-to-end
4. Seed demo content (solve 0/0/0 problem)

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
- UI components: FundProjectButton, SetupPayoutsButton (not yet built)
