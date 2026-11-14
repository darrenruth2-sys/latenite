import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { unsubToken } from '@/lib/email';

// Unsubscribe from SignedOn emails. GET shows a confirm button (so link scanners in inboxes can't unsubscribe
// people by accident); POST does it (that's also what email apps' one-click "Unsubscribe" sends).
const page = (body: string) => new NextResponse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe · SignedOn</title>
<style>body{margin:0;background:#07040F;color:#ECE8FF;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px}main{max-width:460px;border:3px solid #FF2D95;background:#120B24;padding:28px}h1{margin:0 0 12px;font-size:26px}button{background:#38E1FF;color:#07040F;border:2px solid #fff;font-weight:700;font-size:16px;padding:12px 20px;cursor:pointer}a{color:#38E1FF}</style></head><body><main>${body}</main></body></html>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

function check(req: NextRequest) {
  const e = (req.nextUrl.searchParams.get('e') || '').toLowerCase().slice(0, 254);
  const t = req.nextUrl.searchParams.get('t') || '';
  const want = unsubToken(e);
  const ok = !!e && t.length === want.length && timingSafeEqual(Buffer.from(t), Buffer.from(want));
  return ok ? e : null;
}

export function GET(req: NextRequest) {
  const e = check(req);
  if (!e) return page('<h1>That link doesn’t work</h1><p>It may be cut off. Use the full link from the email.</p>');
  return page(`<h1>Unsubscribe?</h1><p>Stop SignedOn emails to <b>${e.replace(/[<>&"]/g, '')}</b>.</p>
<form method="post"><button type="submit">Unsubscribe me</button></form><p style="font-size:13px;color:#A9A2C9">Changed your mind? Just close this page.</p>`);
}

export async function POST(req: NextRequest) {
  const e = check(req);
  if (!e) return page('<h1>That link doesn’t work</h1><p>It may be cut off. Use the full link from the email.</p>');
  await createAdminClient().rpc('waitlist_unsubscribe', { p_email: e });
  return page('<h1>You’re unsubscribed</h1><p>No more emails from SignedOn. <a href="/">Back to SignedOn</a></p>');
}
