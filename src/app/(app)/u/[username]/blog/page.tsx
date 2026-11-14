import { redirect } from 'next/navigation';

// /u/name/blog is the same as the blog page at /blog/name.
export default async function BlogSection({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  redirect(`/blog/${encodeURIComponent(decodeURIComponent(username).toLowerCase())}`);
}
