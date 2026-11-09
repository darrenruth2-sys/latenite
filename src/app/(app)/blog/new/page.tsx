import { redirect } from 'next/navigation';
import { getMe } from '@/lib/me';
import { BlogEditor } from '@/components/blog/BlogEditor';
export const metadata = { title: 'New blog post' };
export default async function NewPost() {
  const { me } = await getMe();
  if (!me) redirect('/login?next=/blog/new');
  return <BlogEditor meId={me.id} username={me.username} initial={{ title: '', body: null, cover_url: null, visibility: 'friends', status: 'draft' }} />;
}
