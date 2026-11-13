import { NextResponse, type NextRequest } from 'next/server';

// The "Have an invite code?" box on the coming-soon page submits here.
export function GET(request: NextRequest) {
  const code = (request.nextUrl.searchParams.get('code') || '').toUpperCase().replace(/\s/g, '').slice(0, 20);
  return NextResponse.redirect(new URL(`/join/${encodeURIComponent(code || 'none')}`, request.url));
}
