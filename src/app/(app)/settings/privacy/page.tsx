import { redirect } from 'next/navigation';
import { getMe } from '@/lib/me';
import { PrivacyForm } from './PrivacyForm';
export const metadata = { title: 'Privacy & safety' };
export default async function Privacy() {
  const { me, supabase } = await getMe();
  if (!me) redirect('/login');
  const [{ data: p }, { data: s }, { data: blocked }] = await Promise.all([
    supabase.from('profiles').select('is_private, discoverable').eq('id', me.id).single(),
    supabase.from('profile_settings').select('*').eq('id', me.id).single(),
    supabase.rpc('my_blocked_users'),
  ]);
  return <PrivacyForm meId={me.id} profile={p!} settings={s!} blocked={(blocked || []) as { id: string; username: string; display_name: string }[]} />;
}
