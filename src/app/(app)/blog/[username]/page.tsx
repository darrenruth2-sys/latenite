import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMe } from '@/lib/me';
import { resolveTheme, themeVars } from '@/lib/theme';

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params; return { title: `@${username}'s blog` };
}

export default async function BlogIndex({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const { me, supabase } = await getMe();
  const { data: p } = await supabase.from('profiles').select('id, username, display_name').eq('username', username.toLowerCase()).maybeSingle();
  if (!p) notFound();
  const isMe = me?.id === p.id;
  const [{ data: d }, { data: posts }] = await Promise.all([
    supabase.from('profile_details').select('theme, blog_title').eq('id', p.id).maybeSingle(),
    supabase.from('blog_posts').select('id, title, slug, excerpt, cover_url, status, visibility, published_at, updated_at').eq('author_id', p.id)
      .order('published_at', { ascending: false, nullsFirst: true }).limit(100),
  ]);
  const t = resolveTheme(d?.theme);
  return (
    <div style={themeVars(t)} className="min-h-[calc(100dvh-64px)] text-[var(--text)]">
      <div className="mx-auto flex max-w-[860px] flex-col gap-6 px-4 py-10 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b-4 border-[var(--text)] pb-5">
          <div><p className="font-pixel text-xl text-[var(--accent)]">THE BLOG OF</p>
            <h1 className="text-[clamp(36px,6vw,64px)] font-extrabold leading-none" style={{ fontFamily: 'var(--head)' }}>{d?.blog_title || `${p.display_name}'s blog`}</h1>
            <Link href={`/u/${p.username}`} className="mt-1 inline-block text-sm underline">@{p.username}&apos;s page</Link></div>
          {isMe && <Link href="/blog/new" className="btn border-[var(--text)] bg-[var(--accent)] text-[var(--on-accent)]">Write a post</Link>}
        </header>
        {!posts?.length ? <p className="text-[var(--muted)]">{isMe ? 'No posts yet. Your first one is a click away.' : 'No posts you can read yet.'}</p> : (
          <ol className="flex flex-col gap-5">
            {posts.map((b) => (
              <li key={b.id}>
                <article className="flex flex-col gap-2 border-2 border-[var(--text)] bg-[var(--card)] p-5 rounded-[var(--radius)]">
                  {b.cover_url && <div className="-mx-5 -mt-5 mb-2 h-40 border-b-2 border-[var(--text)]" style={{ background: `center/cover url("${b.cover_url}")` }} />}
                  <div className="flex flex-wrap gap-2 font-pixel text-lg text-[var(--muted)]">
                    <span>{b.published_at ? new Date(b.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'DRAFT'}</span>
                    {b.visibility === 'private' && <span>· PRIVATE</span>}{b.status === 'draft' && b.published_at && <span>· UNPUBLISHED</span>}
                  </div>
                  <h2 className="font-serif text-3xl font-extrabold leading-tight">
                    <Link href={b.status === 'published' ? `/blog/${p.username}/${b.slug}` : `/blog/edit/${b.id}`} className="hover:underline">{b.title}</Link></h2>
                  {b.excerpt && <p className="leading-relaxed text-[var(--muted)]">{b.excerpt}</p>}
                  {isMe && <Link href={`/blog/edit/${b.id}`} className="self-start text-sm underline">Edit</Link>}
                </article>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
