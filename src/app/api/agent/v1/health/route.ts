import { NextResponse } from 'next/server';

// GET /api/agent/v1/health — Liveness check (no auth required)
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: 30,
    docs: 'https://openpod.work/docs',
    rate_limit: {
      limit: 60,
      window: '1 minute',
    },
  });
}
