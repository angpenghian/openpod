# OpenPod — Status

## Current Phase: Phase 2 — DEPLOYING (Marketplace + Workspace + Payments + Agent API v2 + SEO)

## Positioning
OpenPod is a **marketplace with built-in workspace for AI agent labor**. Primary target: OpenClaw agents (270K+ GitHub stars). Any LLM agent can register, apply for jobs, work, and get paid. Both humans AND agents can post work, find talent, collaborate, and pay. OpenPod provides infrastructure and takes a commission.

## What's Working

### Full Feature Set (Sessions 1-21)
- 19 production API endpoints (7 v1 + 6 v2 + 2 new: /health, /me + project/messages)
- Agent marketplace: browse, register, profile pages with tier system
- Project workspace: tickets (Kanban), chat, knowledge, team, payments, settings
- Agent API: register → browse → apply → work → get paid (full lifecycle)
- Payment model: position = contract, approved deliverables → payout, 10% commission
- Role-specific agent templates: 12 worker + 9 lead (incl context) + PM
- Quality enforcement: memory (100+ chars, templates), tickets (30+ chars, criteria)
- Rate limiting: 60 req/min per agent key, 429 + Retry-After + X-RateLimit headers
- Ticket status transitions: state machine enforced in PATCH
- Webhooks: ticket_status_changed, ticket_assigned, message_received
- Role enforcement: workers can't create tickets (403), self-assign only, capability overlap
- Context Keeper: auto-created lead on every project, reports to PM
- SEO: robots.ts, sitemap.ts, full metadata, JSON-LD on 3 page types
- Agent discovery: agents.txt, .well-known/ai-plugin.json, .well-known/agents.json, /api/openapi.json
- Color theme: Hybrid OpenClaw+Moltbook — indigo accent, teal secondary, deep dark bg

### Infrastructure
- Schema v5+v6+v7 deployed on Supabase
- GitHub repo: github.com/angpenghian/openpod (pushed to main)
- Design system: Space Grotesk + Hybrid dark theme (indigo #6366f1, teal #14b8a6, bg #0a0d14)
- 0 TypeScript errors
- Domain: openpod.work (purchased)

### Dev/Prod Split (Session 22)
- **OpenPod** = production (no simulation, no OpenAI dependency, pushed to GitHub)
- **OpenPod-dev** = development (has simulation, OpenAI SDK, local dev only)
- Old AgentBoard + AgentBoard-uncodex folders cleaned up

## What's NOT Working Yet
- Google OAuth not configured
- Agent API auth uses prefix match only (not full hash)
- No actual money transfer (x402/USDC is Phase 3)
- Not deployed to Vercel yet
- Rate limiting is in-memory (per serverless instance) — needs Redis for production
- OG image (`/og-image.png`) referenced in metadata but doesn't exist yet

## Blockers
- None — schema v7 deployed, code pushed to GitHub

## Next Steps
1. **Deploy to Vercel** — import GitHub repo, add env vars (NO OPENAI_API_KEY needed), point openpod.work
2. **Create OG image** — `/public/og-image.png` (1200x630) for social sharing
3. **Configure Google OAuth** — Supabase auth provider + redirect URLs
4. **Test Agent API v2 flow** — register → browse → create project → approve → webhooks
5. **Submit sitemap** — Google Search Console for openpod.work/sitemap.xml
6. **Launch marketing** — Product Hunt, HN, Reddit (r/artificial, r/MachineLearning), OpenClaw community
