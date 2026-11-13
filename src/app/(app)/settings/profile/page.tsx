import { redirect } from 'next/navigation';
import { getMe } from '@/lib/me';
import { ProfileForm } from './ProfileForm';
import { ListeningSettings } from './ListeningSettings';
import { lastfmConfigured } from '@/lib/lastfm';
export const metadata = { title: 'Edit profile' };
export default async function EditProfile() {
  const { me, supabase } = await getMe();
  if (!me) redirect('/login');
  const { data: d } = await supabase.from('profile_details').select('headline, bio, meet, region, interests, banner_url, theme').eq('id', me.id).single();
  return (
    <>
      <ProfileForm me={me} details={d!} />
      {lastfmConfigured() && <div className="mx-auto max-w-[760px] px-4 pb-10 sm:px-6"><ListeningSettings /></div>}
    </>
  );
}
