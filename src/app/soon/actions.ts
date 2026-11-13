'use server';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

export type WaitlistState = { ok: boolean; message: string; count?: number } | undefined;

export async function joinWaitlist(_prev: WaitlistState, form: FormData): Promise<WaitlistState> {
  // Honeypot: real people never see or fill this field.
  if (String(form.get('website') || '')) return { ok: true, message: 'Thanks! You’re on the list.' };
  const email = String(form.get('email') || '').trim();
  const name = String(form.get('name') || '').trim().slice(0, 40);
  const miss = String(form.get('miss') || '').trim().slice(0, 280);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) {
    return { ok: false, message: 'That email doesn’t look right. Try again?' };
  }
  // Rate limits are per visitor. We only ever store a salted one-way hash of the network address, never the address.
  const h = await headers();
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
  const salt = process.env.WAITLIST_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const source = createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('join_waitlist', { p_email: email, p_name: name || null, p_miss: miss || null, p_source: source });
  if (error) {
    if (error.message.includes('AH_RATE_LIMIT')) return { ok: false, message: 'Whoa, that’s a lot of tries. Give it a few minutes and try again.' };
    return { ok: false, message: 'Something glitched (very 2006 of us). Try again in a sec.' };
  }
  const res = data as { new: boolean; count: number };
  const hi = name ? `Thanks, ${name}! ` : 'Thanks! ';
  return res.new
    ? { ok: true, count: res.count, message: `${hi}You’re one of the first ${res.count.toLocaleString('en-US')}. We’ll email you the second the doors open.` }
    : { ok: true, count: res.count, message: 'You’re already on the list — we haven’t forgotten you.' };
}
