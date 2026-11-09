import { notFound, redirect } from 'next/navigation';
import { getMe } from '@/lib/me';
import { BlogEditor } from '@/components/blog/BlogEditor';
export const metadata = { title: 'Edit post' };
export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { me, supabase } = await getMe();
  if (!me) redirect('/login');
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data } = await supabase.from('blog_posts').select('id, title, body, cover_url, visibility, status, slug, author_id').eq('id', id).maybeSingle();
  if (!data || data.author_id !== me.id) notFound();
  return <BlogEditor meId={me.id} username={me.username} initial={data} />;
}
