'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { friendlyError } from '@/lib/utils';
import type { FormState } from './auth';

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const current = String(form.get('current') || '');
  const password = String(form.get('password') || '');
  if (password.length < 8) return { error: 'New password needs at least 8 characters.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { error: 'Please log in again.' };
  const check = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (check.error) return { error: 'Your current password is wrong.' };
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { error: friendlyError(error) } : { ok: 'Password changed.' };
}

export async function deleteAccount(_: FormState, form: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { error: 'Please log in again.' };
  const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
  if (String(form.get('confirm') || '').trim().toLowerCase() !== String(profile?.username)) return { error: 'Type your username exactly to confirm.' };
  const check = await supabase.auth.signInWithPassword({ email: user.email, password: String(form.get('password') || '') });
  if (check.error) return { error: 'Wrong password.' };
  const admin = createAdminClient();
  // Remove uploaded files (best effort), then the account. Everything else cascades in the database.
  try {
    const walk = async (prefix: string): Promise<string[]> => {
      const { data } = await admin.storage.from('media').list(prefix, { limit: 1000 });
      const out: string[] = [];
      for (const item of data || []) {
        const path = `${prefix}/${item.name}`;
        if (item.id) out.push(path); else out.push(...(await walk(path)));
      }
      return out;
    };
    const files = await walk(user.id);
    if (files.length) await admin.storage.from('media').remove(files);
  } catch { /* storage cleanup is best effort */ }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: 'Couldn’t delete your account. Try again or contact support.' };
  await supabase.auth.signOut();
  redirect('/?deleted=1');
}
