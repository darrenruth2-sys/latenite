import { redirect } from 'next/navigation';
import { getMe } from '@/lib/me';
import { MessengerApp } from './MessengerApp';

export const metadata = { title: 'Messenger' };

export default async function Messenger({ searchParams }: { searchParams: Promise<{ to?: string; c?: string }> }) {
  const { me, supabase } = await getMe();
  if (!me) redirect('/login?next=/messenger');
  const { to, c } = await searchParams;
  let startError = '';
  if (to) {
    const { data: other } = await supabase.from('profiles').select('id').eq('username', to.toLowerCase()).maybeSingle();
    if (other) {
      const { data: conv, error } = await supabase.rpc('start_dm', { p_other: other.id });
      if (!error && conv) redirect(`/messenger?c=${conv}`);
      startError = error?.message.includes('AH_NOT_FRIENDS') ? 'You can only message friends.' : 'Couldn’t start that chat.';
    } else startError = 'That person doesn’t exist.';
  }
  const [buddies, convs, presence, settings] = await Promise.all([
    supabase.rpc('buddy_list'), supabase.rpc('my_conversations'),
    supabase.from('presence').select('status, status_message, away_message, now_playing, show_now_playing').eq('user_id', me.id).maybeSingle(),
    supabase.from('profile_settings').select('allow_nudges, read_receipts').eq('id', me.id).single(),
  ]);
  return (
    <MessengerApp me={me} initialBuddies={buddies.data || []} initialConvs={convs.data || []} initialActive={c || null}
      presence={presence.data || { status: 'online', status_message: null, away_message: null, now_playing: null, show_now_playing: true }}
      settings={settings.data || { allow_nudges: true, read_receipts: true }} startError={startError} />
  );
}
