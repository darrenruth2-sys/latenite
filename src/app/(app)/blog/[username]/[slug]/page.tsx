import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMe } from '@/lib/me';
import { renderBlogHtml } from '@/lib/blog';
import { resolveTheme, themeVars } from '@/lib/theme';
import { Avatar } from '@/components/Avatar';
import { PostCard } from '@/components/feed/PostCard';
import { POST_SELECT, enrichPosts, type FeedPost } from '@/lib/posts';

type P = { params: Promise<{ username: string; slug: string }> };
export async function generateMetadata({ params }: P) { const { slug } = await params; return { title: slug.replace(/-/g, ' ') }; }

export default async function BlogPost({ params }: P) {
  const { username, slug } = await params;
  const { me, supabase } = await getMe();
  const { data: p } = await supabase.from('profiles').select('id, username, display_name, avatar_url').eq('username', username.toLowerCase()).maybeSingle();
  if (!p) notFound();
  const { data: b } = await supabase.from('blog_posts').select('*').eq('author_id', p.id).eq('slug', slug).maybeSingle();
  if (!b || (b.status !== 'published' && me?.id !== p.id)) notFound();
  const [{ data: d }, postRes] = await Promise.all([
    supabase.from('profile_details').select('theme').eq('id', p.id).maybeSingle(),
    b.post_id ? supabase.from('posts').select(POST_SELECT).eq('id', b.post_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const t = resolveTheme(d?.theme);
  const card = postRes.data ? (await enrichPosts(supabase, [postRes.data as unknown as FeedPost], me?.id || null))[0] : null;
  const html = renderBlogHtml(b.body);
  return (
    <div style={themeVars(t)} className="min-h-[calc(100dvh-64px)] text-[var(--text)]">
      <article className="mx-auto flex max-w-[760px] flex-col gap-6 px-4 py-10 sm:px-6">
        {b.cover_url && <div className="h-56 border-2 border-[var(--text)] sm:h-72" style={{ background: `center/cover url("${b.cover_url}")` }} />}
        <header className="flex flex-col gap-3">
          <Link href={`/blog/${p.username}`} className="font-pixel text-xl text-[var(--accent)]">&lt; {p.display_name.toUpperCase()}&apos;S BLOG</Link>
          <h1 className="font-serif text-[clamp(34px,6vw,58px)] font-extrabold leading-[1.05]">{b.title}</h1>
          <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
            <Avatar user={p} size={36} border="var(--text)" />
            <span><Link href={`/u/${p.username}`} className="font-semibold text-[var(--text)]">{p.display_name}</Link> · {b.published_at ? new Date(b.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Draft'}</span>
            {me?.id === p.id && <Link href={`/blog/edit/${b.id}`} className="ml-auto underline">Edit</Link>}
          </div>
        </header>
        <div className="prose-ah border-2 border-[var(--text)] bg-[var(--card)] p-6 rounded-[var(--radius)] sm:p-9" dangerouslySetInnerHTML={{ __html: html }} />
        {card ? <section aria-label="Comments" className="themed-feed"><h2 className="mb-3 text-2xl font-extrabold" style={{ fontFamily: 'var(--head)' }}>Comments &amp; likes</h2><PostCard post={card} meId={me?.id || null} /></section>
          : b.visibility === 'private' ? <p className="text-sm text-[var(--muted)]">Private journal entry — only you can see it.</p> : null}
      </article>
    </div>
  );
}
