import { NextRequest, NextResponse } from 'next/server';

// H7: CSRF origin check for cookie-authenticated state-changing endpoints
// Returns a 403 response if the origin doesn't match, or null if OK
export function checkCsrfOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');
  if (!origin) return null; // No origin = same-origin or non-browser
  const expectedOrigin = new URL(request.url).origin;
  if (origin !== expectedOrigin) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  }
  return null;
}
