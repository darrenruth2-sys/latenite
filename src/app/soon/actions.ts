'use server';
import { createClient } from '@/lib/supabase/server';

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
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('join_waitlist', { p_email: email, p_name: name || null, p_miss: miss || null });
  if (error) {
    if (error.message.includes('AH_RATE_LIMIT')) return { ok: false, message: 'Lots of people signing right now. Give it a minute and try again.' };
    return { ok: false, message: 'Something glitched (very 2006 of us). Try again in a sec.' };
  }
  const res = data as { new: boolean; count: number };
  const hi = name ? `Thanks, ${name}! ` : 'Thanks! ';
  return res.new
    ? { ok: true, count: res.count, message: `${hi}You’re one of the first ${res.count.toLocaleString('en-US')}. We’ll email you the second the doors open.` }
    : { ok: true, count: res.count, message: 'You’re already on the list — we haven’t forgotten you.' };
}
