'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { friendlyError } from '@/lib/utils';
import { captchaFrom } from '@/lib/captcha';

export type FormState = { error?: string; ok?: string; fields?: Record<string, string> } | undefined;

async function siteUrl() {
  const h = await headers();
  return process.env.NEXT_PUBLIC_SITE_URL || `${h.get('x-forwarded-proto') || 'http'}://${h.get('host')}`;
}

function ageOn(birth: Date) {
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') || '').trim();
  const password = String(form.get('password') || '');
  const username = String(form.get('username') || '').trim().toLowerCase();
  const display_name = String(form.get('display_name') || '').trim().slice(0, 40);
  const birthdate = String(form.get('birthdate') || '');
  const fields = { email, username, display_name, birthdate };
  if (!/^[a-z0-9._]{3,20}$/.test(username) || /^[._]|[._]$|\.\./.test(username))
    return { error: 'Usernames are 3–20 letters, numbers, dots or underscores (not at the start or end).', fields };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a real email address.', fields };
  if (password.length < 8) return { error: 'Password needs at least 8 characters.', fields };
  const b = new Date(birthdate + 'T00:00:00');
  if (!birthdate || isNaN(b.getTime()) || b.getFullYear() < 1900) return { error: 'Enter your birthday.', fields };
  if (ageOn(b) < 18) return { error: 'You need to be 18 or older to join SignedOn.', fields };
  if (form.get('agree') !== 'on') return { error: 'Please agree to the terms and community rules.', fields };

  const supabase = await createClient();
  const { data: available } = await supabase.rpc('username_available', { p_username: username });
  if (!available) return { error: `@${username} is taken. Try another.`, fields };

  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { captchaToken: captchaFrom(form), data: { username, display_name: display_name || username, birthdate }, emailRedirectTo: `${await siteUrl()}/auth/callback?next=/feed` },
  });
  if (error) return { error: friendlyError(error), fields };
  if (data.session) redirect('/feed');
  // GoTrue hides "already registered" behind a fake success: identities is empty in that case.
  if (data.user && data.user.identities && data.user.identities.length === 0)
    return { error: 'There’s already an account with that email. Try logging in.', fields };
  redirect(`/check-email?email=${encodeURIComponent(email)}`);
}

export async function logIn(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') || '').trim();
  const password = String(form.get('password') || '');
  const next = String(form.get('next') || '/feed');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken: captchaFrom(form) } });
  if (error) return { error: friendlyError(error), fields: { email } };
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/feed');
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function requestReset(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter the email you signed up with.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { captchaToken: captchaFrom(form), redirectTo: `${await siteUrl()}/auth/callback?next=/reset-password` });
  if (error && !/rate/i.test(error.message)) return { error: friendlyError(error) };
  // Same answer whether or not the account exists, so emails can't be probed.
  return { ok: 'If that email has an account, a reset link is on its way. Check your inbox.' };
}

export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get('password') || '');
  if (password.length < 8) return { error: 'Password needs at least 8 characters.' };
  if (password !== String(form.get('confirm') || '')) return { error: 'Passwords don’t match.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Your reset link expired. Request a new one.' };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: friendlyError(error) };
  redirect('/feed?notice=password');
}

export async function resendConfirmation(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') || '').trim();
  const supabase = await createClient();
  await supabase.auth.resend({ type: 'signup', email, options: { captchaToken: captchaFrom(form), emailRedirectTo: `${await siteUrl()}/auth/callback?next=/feed` } });
  return { ok: 'Sent again. Give it a minute.' };
}
