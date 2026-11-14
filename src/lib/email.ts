import 'server-only';
import { createHmac } from 'node:crypto';
import { LEGAL_ADDRESS, LEGAL_ENTITY } from '@/lib/legal';

/** Email through Resend. Does nothing (returns false) until RESEND_API_KEY is set. */
export const emailConfigured = () => !!process.env.RESEND_API_KEY;
const BASE = () => (process.env.RESEND_API_BASE || 'https://api.resend.com').replace(/\/$/, '');
const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://signedon.social').replace(/\/$/, '');
export const FROM = () => process.env.EMAIL_FROM || 'Darren at SignedOn <hello@signedon.social>';

export async function sendEmail(to: string, subject: string, html: string, text: string, opts: { replyTo?: string; unsubscribe?: string } = {}) {
  if (!emailConfigured()) return false;
  try {
    const res = await fetch(BASE() + '/emails', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM(), to: [to], subject, html, text,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
        ...(opts.unsubscribe ? { headers: { 'List-Unsubscribe': `<${opts.unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}),
      }),
    });
    return res.ok;
  } catch { return false; }
}

const secret = () => process.env.WAITLIST_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev';
export const unsubToken = (email: string) => createHmac('sha256', secret()).update('unsub:' + email.toLowerCase()).digest('hex').slice(0, 24);
export const unsubLink = (email: string) => `${SITE()}/unsubscribe?e=${encodeURIComponent(email.toLowerCase())}&t=${unsubToken(email)}`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** "You're in!" email with someone's personal beta key. */
export function inviteEmail(email: string, code: string, name?: string | null) {
  const link = `${SITE()}/join/${code}`;
  const unsub = unsubLink(email);
  const hi = name ? `Hey ${name},` : 'Hey there,';
  const footer = `You're getting this because you signed the guestbook at signedon.social. ${LEGAL_ENTITY}${LEGAL_ADDRESS ? `, ${LEGAL_ADDRESS}` : ''}.`;
  const subject = 'You’re in! Your SignedOn beta key 🔑';
  const text = `${hi}

Congrats, you’re one of the first people in! SignedOn is still in beta, so things might be a little rough around the edges, and that’s where you come in.

Your beta key: ${code}
Create your page: ${link}

A few ground rules:
- This key is yours. It works one time, for one account. Don’t share it or post it.
- SignedOn is 18+ only.
- Something broken, or got an idea? Tap Help or "Ideas & questions" inside. I read everything.

Want your friends on here with you? Have them go to signedon.social and sign the guestbook like you did. Maybe they’ll get lucky too.

See you on the inside,
Darren
Founder, SignedOn

${footer}
Don’t want these emails? ${unsub}`;
  const html = `<!doctype html><html><body style="margin:0;background:#07040F;font-family:Arial,Helvetica,sans-serif;color:#ECE8FF">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07040F;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#120B24;border:3px solid #FF2D95">
<tr><td style="padding:28px 28px 8px;font-family:'Courier New',monospace;color:#5CFF8A;font-size:16px;letter-spacing:1px">&gt; YOU’RE SIGNED ON</td></tr>
<tr><td style="padding:0 28px;font-size:30px;font-weight:bold;line-height:1.1;color:#FFFFFF">You’re in. 🎉</td></tr>
<tr><td style="padding:18px 28px 0;font-size:16px;line-height:1.55">${esc(hi)}<br><br>Congrats, you’re one of the first people in! SignedOn is still in <b>beta</b>, so things might be a little rough around the edges, and that’s where you come in.</td></tr>
<tr><td style="padding:22px 28px 0" align="center">
  <div style="font-family:'Courier New',monospace;font-size:13px;color:#A9A2C9;letter-spacing:1px">YOUR BETA KEY</div>
  <div style="margin-top:6px;display:inline-block;border:2px dashed #38E1FF;padding:10px 18px;font-family:'Courier New',monospace;font-size:26px;font-weight:bold;color:#38E1FF;letter-spacing:2px">${esc(code)}</div>
</td></tr>
<tr><td style="padding:22px 28px 0" align="center"><a href="${link}" style="display:inline-block;background:#FF2D95;color:#07040F;text-decoration:none;font-weight:bold;font-size:17px;padding:14px 26px;border:2px solid #FFFFFF">Create my page →</a></td></tr>
<tr><td style="padding:24px 28px 0;font-size:15px;line-height:1.55"><b>A few ground rules:</b>
<ul style="margin:8px 0 0;padding-left:20px"><li>This key is <b>yours</b>. It works one time, for one account. Don’t share it or post it.</li>
<li>SignedOn is <b>18+ only</b>.</li><li>Something broken, or got an idea? Tap <b>Help</b> or <b>Ideas &amp; questions</b> inside. I read everything.</li></ul></td></tr>
<tr><td style="padding:18px 28px 0;font-size:15px;line-height:1.55">Want your friends on here with you? Have them go to <a href="${SITE()}" style="color:#38E1FF">signedon.social</a> and sign the guestbook like you did. Maybe they’ll get lucky too. 😉</td></tr>
<tr><td style="padding:22px 28px 28px;font-size:15px;line-height:1.5">See you on the inside,<br><b>Darren</b><br><span style="color:#A9A2C9">Founder, SignedOn</span></td></tr>
</table>
<p style="max-width:560px;margin:14px auto 0;font-size:11px;line-height:1.5;color:#7D769C">${esc(footer)} <a href="${unsub}" style="color:#A9A2C9">Unsubscribe</a></p>
</td></tr></table></body></html>`;
  return { subject, html, text, unsub };
}

/** Claims and emails a key for one waitlist address. True if an email went out. */
export async function sendWaitlistKey(admin: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }, email: string) {
  if (!emailConfigured()) return false;
  const { data } = await admin.rpc('waitlist_claim_invite', { p_email: email });
  const claim = data as { code: string; name: string | null; email: string } | null;
  if (!claim?.code) return false;
  const m = inviteEmail(claim.email, claim.code, claim.name);
  const ok = await sendEmail(claim.email, m.subject, m.html, m.text, { unsubscribe: m.unsub });
  await admin.rpc('waitlist_invite_result', { p_email: claim.email, p_ok: ok });
  return ok;
}
