'use server';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

export type TakedownState = { ok?: boolean; id?: string; error?: string };
const KINDS = ['intimate_image', 'child_safety', 'copyright', 'impersonation', 'privacy', 'other'] as const;

/** Server-side Turnstile check (only when TURNSTILE_SECRET_KEY is set in the environment). */
async function humanCheck(token: string, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    return ((await r.json()) as { success?: boolean }).success === true;
  } catch { return false; }
}

export async function submitTakedown(_: TakedownState, form: FormData): Promise<TakedownState> {
  const s = (k: string, max: number) => String(form.get(k) || '').trim().slice(0, max);
  const kind = s('kind', 30) as (typeof KINDS)[number];
  if (!KINDS.includes(kind)) return { error: 'Pick what kind of problem this is.' };
  const urls = s('urls', 4000), description = s('description', 5000), name = s('name', 200), email = s('email', 254);
  const contact = s('contact', 1000), signature = s('signature', 200);
  const isSubject = form.get('is_subject') === 'on', sworn = form.get('sworn') === 'on';
  if (!urls) return { error: 'Add the link(s) to the content, or the username.' };
  if (!description) return { error: 'Tell us what the problem is.' };
  if (!name || !email) return { error: 'Add your name and email so we can follow up.' };
  if (kind === 'intimate_image' && (!isSubject || !sworn || !signature)) return { error: 'For intimate images, confirm you’re the person shown (or acting for them), check the statement, and type your name as a signature.' };
  if (kind === 'copyright' && (!sworn || !signature || !contact)) return { error: 'Copyright notices need your mailing address and phone, the sworn statement, and your typed signature.' };

  const h = await headers();
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
  if (!(await humanCheck(String(form.get('cf-turnstile-response') || ''), ip))) return { error: 'Please complete the “are you human” check and try again.' };
  const salt = process.env.WAITLIST_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const source = createHash('sha256').update(`${salt}:takedown:${ip}`).digest('hex').slice(0, 32);

  const { data, error } = await createAdminClient().rpc('submit_takedown', {
    p_kind: kind, p_urls: urls, p_description: description, p_name: name, p_email: email, p_contact: contact || null,
    p_is_subject: isSubject, p_sworn: sworn, p_signature: signature || null, p_source: source,
  });
  if (error) {
    if (/RATE_LIMIT/.test(error.message)) return { error: 'Too many requests from your connection. Please wait an hour, or email us.' };
    if (/BAD_EMAIL/.test(error.message)) return { error: 'That email address doesn’t look right.' };
    return { error: 'Something went wrong sending your request. Please email us instead.' };
  }
  return { ok: true, id: String(data).slice(0, 8).toUpperCase() };
}
