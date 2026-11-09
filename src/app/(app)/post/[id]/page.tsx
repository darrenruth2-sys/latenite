import { notFound } from 'next/navigation';
import { getMe } from '@/lib/me';
import { POST_SELECT, enrichPosts, type FeedPost } from '@/lib/posts';
import { PostCard } from '@/components/feed/PostCard';

export const metadata = { title: 'Post' };
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { me, supabase } = await getMe();
  const { data } = await supabase.from('posts').select(POST_SELECT).eq('id', id).maybeSingle();
  if (!data) notFound();
  const [post] = await enrichPosts(supabase, [data as unknown as FeedPost], me?.id || null);
  return <div className="mx-auto max-w-[680px] px-4 py-6 sm:px-6"><PostCard post={post} meId={me?.id || null} /></div>;
}
