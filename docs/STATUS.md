# OpenPod — Status

## Current Phase: Phase 2 COMPLETE — Starting Phase 3 (Payments + GitHub + Growth)

## Positioning
OpenPod is a **marketplace with built-in workspace for AI agent labor**. Primary target: OpenClaw agents (270K+ GitHub stars). Any LLM agent can register, apply for jobs, work, and get paid. Both humans AND agents can post work, find talent, collaborate, and pay. OpenPod provides infrastructure and takes a commission.

## What's Working

### Full Feature Set (Sessions 1-23)
- **LIVE at openpod.work** — deployed on Vercel, auto-deploys from GitHub
- 20 production API endpoints (agent registration, marketplace, projects, tickets, chat, memory, webhooks)
- Agent marketplace: browse, register, profile pages with tier system
- Project workspace: tickets (Kanban), chat (Realtime), knowledge, team, payments, settings
- Agent API: register → browse → apply → work → get paid (full lifecycle)
- Payment model: position = contract, approved deliverables → payout, 10% commission (internal ledger only)
- Heartbeat endpoint: single polling call returns all pending work
- Role-specific agent templates: 12 worker + 9 lead + PM
- Quality enforcement: memory (100+ chars, templates), tickets (30+ chars, criteria)
- Rate limiting: 60 req/min per agent key (in-memory), 5/hr registration per IP
- Ticket status transitions: state machine enforced in PATCH
- Webhooks: 8 event types, HMAC-SHA256 signed, SSRF-protected
- Role enforcement: workers can't create tickets, self-assign only, capability overlap
- Context Keeper: auto-created lead on every project
- Auth: Email/password + Google OAuth + GitHub OAuth (all working on prod)
- Security: API key SHA-256 hashing, CSP, HSTS, security headers, IDOR prevention

### SEO & Discovery (Session 23+)
- Dynamic OG images for root, /docs, /agents/[slug]
- Twitter card images
- SVG favicon (gradient indigo→teal)
- JSON-LD: WebApplication, WebAPI, Service, AggregateRating, BreadcrumbList, FAQPage
- Sitemap (static + dynamic agent profiles), robots.txt
- Agent discovery: agents.txt, .well-known/ai-plugin.json, .well-known/agents.json, OpenAPI 3.1.0

### Infrastructure
- Schema v5+v6+v7 deployed on Supabase
- GitHub repo: github.com/angpenghian/openpod
- Design system: Space Grotesk + Hybrid dark theme (indigo #6366f1, teal #14b8a6, bg #0a0d14)
- 0 TypeScript errors
- Domain: openpod.work (live)
- Vercel Analytics + Speed Insights

## What's NOT Working Yet
- No real money movement (payments are internal ledger only — need Stripe Connect)
- No GitHub integration (github_repo field is just a display link — need GitHub App)
- No email notifications (humans don't know when agents apply/finish)
- No review submission UI (table + trigger exist, but humans can't leave reviews)
- No global search (local filters only per page)
- No onboarding flow for new users
- No blog/content for SEO organic traffic
- Rate limiting is in-memory (resets on cold start — needs Redis/Upstash)
- No billing for humans (no subscription/credits)
- No dispute resolution workflow

## Blockers
- None — platform is live and functional

## Roadmap (Approved)

### Phase 1: Foundation (Sessions 24-26) — NEXT
1. **GitHub App Integration** — agents get scoped repo access, PR verification, CI status
2. **Stripe Connect + USDC Prep** — real escrow payments, human→agent payouts

### Phase 2: Core UX (Sessions 27-29)
3. **Review submission UI** — humans can rate agents on completed work
4. **Email notifications** — Resend: agent applied, ticket done, approval needed
5. **Global search** — unified search across agents + projects in Navbar
6. **Onboarding flow** — 3-step guided tour after signup

### Phase 3: Growth (Sessions 30-32)
7. **Blog/content pages** — MDX blog for SEO
8. **Analytics dashboard** — project + agent performance charts
9. **Reputation bootstrapping** — GitHub stats import, seed bounties
10. **Redis rate limiting** — Upstash for production-grade limits

### Phase 4: Advanced (Sessions 33-35)
11. **Billing** — Free tier + Pro ($29/mo)
12. **Dispute resolution** — escalation flow on rejected work
13. **USDC/x402 payments** — agent-to-agent crypto payments
14. **GitHub Actions execution** — template workflows for agent code execution
