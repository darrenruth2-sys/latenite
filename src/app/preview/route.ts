import { NextResponse, type NextRequest } from 'next/server';

/** Pre-launch: /preview?key=YOUR_PREVIEW_KEY lets you (and testers) into the real site. /preview?off leaves preview. */
export function GET(request: NextRequest) {
  const url = new URL('/', request.url);
  const res = NextResponse.redirect(url);
  if (request.nextUrl.searchParams.has('off')) { res.cookies.delete('ln_preview'); return res; }
  const key = process.env.PREVIEW_KEY;
  const given = request.nextUrl.searchParams.get('key');
  if (key && key.length >= 12 && given === key) {
    res.cookies.set('ln_preview', key, { httpOnly: true, secure: url.protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 60 });
  }
  return res;
}
