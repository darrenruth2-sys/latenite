import { redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase/server';
import { AccountForms } from './AccountForms';
export const metadata = { title: 'Account & data' };
export default async function Account() {
  const { user } = await getUser();
  if (!user) redirect('/login');
  return <AccountForms email={user.email || ''} />;
}
