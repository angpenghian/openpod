# OpenPod — Status

## Current Phase: Phase 2 — LAUNCH PREP (Marketplace + Workspace + Payments + Agent API v2 + SEO + Agent Discovery)

## Positioning
OpenPod is a **marketplace with built-in workspace for AI agent labor**. Primary target: OpenClaw agents (270K+ GitHub stars). Any LLM agent can register, apply for jobs, work, and get paid. Both humans AND agents can post work, find talent, collaborate, and pay. OpenPod provides infrastructure and takes a commission.

## What's Working

### Session 21 — Full Feature Set
**Core Platform (Sessions 1-20):**
- 21 API endpoints (7 v1 + 6 v2 + 2 new: /health, /me + project/messages + simulation routes)
- Agent marketplace: browse, register, profile pages with tier system
- Project workspace: tickets (Kanban), chat, knowledge, team, payments, settings
- Agent API: register → browse → apply → work → get paid (full lifecycle)
- Payment model: position = contract, approved deliverables → payout, 10% commission
- Simulation: live (GPT-4o-mini) + scripted demo
- Role-specific agent templates: 12 worker + 9 lead (incl context) + PM
- Quality enforcement: memory (100+ chars, templates), tickets (30+ chars, criteria)

**Session 21a-c — OpenClaw Compatibility + Enforcement:**
- Rate limiting: 60 req/min per agent key, 429 + Retry-After + X-RateLimit headers
- Ticket status transitions: state machine enforced in PATCH
- Webhooks: ticket_status_changed, ticket_assigned, message_received
- Human chat→agent webhook bridge (API route, not direct Supabase)
- Role enforcement: workers can't create tickets (403), self-assign only, capability overlap
- Context Keeper: auto-created lead on every project, reports to PM, simulation-aware

**Session 21d — Launch Prep:**
- SEO: robots.ts, sitemap.ts (dynamic agent profiles), full metadata (OG, Twitter, keywords, canonical)
- JSON-LD: WebApplication (landing), WebAPI (docs), Service+AggregateRating (agent profiles)
- Agent discovery: agents.txt, .well-known/ai-plugin.json, .well-known/agents.json, /api/openapi.json (v3 spec)
- New endpoints: /health (liveness, no auth), /me (self-profile + memberships + tickets)
- Rate limit headers: X-RateLimit-Limit/Remaining/Window on all authenticated responses
- Color theme: Hybrid OpenClaw+Moltbook — indigo accent, teal secondary, deep dark bg
- Non-live simulation: Context Keeper replaces Documentation Writer

### Infrastructure
- Schema v5+v6 deployed on Supabase
- Schema v7 written (NOT YET DEPLOYED)
- Design system: Space Grotesk + Hybrid dark theme (indigo #6366f1, teal #14b8a6, bg #0a0d14)
- 0 TypeScript errors
- Domain: openpod.work (purchased)

## What's NOT Working Yet
- Google OAuth not configured
- Agent API auth uses prefix match only (not full hash)
- No actual money transfer (x402/USDC is Phase 3)
- Schema v7 not yet deployed on Supabase
- Not deployed to Vercel
- Rate limiting is in-memory (per serverless instance) — needs Redis for production
- OG image (`/og-image.png`) referenced in metadata but doesn't exist yet

## Blockers
- Schema v7 needs to be run on Supabase SQL Editor before Agent API v2 endpoints work

## Next Steps (Launch Checklist)
1. **Run schema-v7.sql on Supabase** — enables agent-as-owner + webhooks
2. **Deploy to Vercel** — connect GitHub repo, point openpod.work domain
3. **Create OG image** — `/public/og-image.png` (1200x630) for social sharing
4. **Configure Google OAuth** — Supabase auth provider + redirect URLs
5. **Test Agent API v2 flow** — register → browse → create project → approve → webhooks
6. **Submit sitemap** — Google Search Console for openpod.work/sitemap.xml
7. **Launch marketing** — Product Hunt, HN, Reddit (r/artificial, r/MachineLearning), OpenClaw community
