'use server';
import { createHash } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type FeedbackState = { ok?: boolean; error?: string };
const KINDS = ['idea', 'question', 'bug', 'other'] as const;
const LABEL: Record<string, string> = { idea: 'Idea', question: 'Question', bug: 'Bug', other: 'Message' };

/** Emails the founder when email sending is set up (Resend). The message is saved either way. */
async function emailFounder(subject: string, text: string, replyTo: string | null) {
  const key = process.env.RESEND_API_KEY, to = process.env.FEEDBACK_EMAIL_TO;
  if (!key || !to) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.FEEDBACK_EMAIL_FROM || 'SignedOn <feedback@signedon.social>', to: [to], subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
  } catch { /* saved in the inbox anyway */ }
}

export async function sendFeedback(_: FeedbackState, form: FormData): Promise<FeedbackState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in first.' };
  const kind = String(form.get('kind') || 'idea') as (typeof KINDS)[number];
  if (!KINDS.includes(kind)) return { error: 'Pick what this is about.' };
  const message = String(form.get('message') || '').trim().slice(0, 4000);
  if (message.length < 3) return { error: 'Write a little more so we know what you mean.' };
  const wantsReply = form.get('reply') === 'on';
  const email = wantsReply ? (user.email || null) : null;
  const page = String(form.get('page') || '').slice(0, 300);
  const salt = process.env.WAITLIST_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const source = createHash('sha256').update(`${salt}:feedback:${user.id}`).digest('hex').slice(0, 32);
  const { error } = await createAdminClient().rpc('submit_feedback', { p_user: user.id, p_kind: kind, p_message: message, p_email: email, p_page: page || null, p_source: source });
  if (error) return { error: /RATE_LIMIT/.test(error.message) ? 'That’s a lot of messages! Try again in an hour.' : 'Couldn’t send that. Try again.' };
  const { data: p } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();
  await emailFounder(`SignedOn ${LABEL[kind]} from @${p?.username ?? 'someone'}`,
    `${message}\n\n— @${p?.username ?? '?'}${email ? ` (reply to ${email})` : ' (didn’t ask for a reply)'}${page ? `\nSent from ${page}` : ''}`, email);
  return { ok: true };
}
