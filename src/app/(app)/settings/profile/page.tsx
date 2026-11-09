import { redirect } from 'next/navigation';
import { getMe } from '@/lib/me';
import { ProfileForm } from './ProfileForm';
export const metadata = { title: 'Edit profile' };
export default async function EditProfile() {
  const { me, supabase } = await getMe();
  if (!me) redirect('/login');
  const { data: d } = await supabase.from('profile_details').select('headline, bio, meet, region, interests, banner_url').eq('id', me.id).single();
  return <ProfileForm me={me} details={d!} />;
}
