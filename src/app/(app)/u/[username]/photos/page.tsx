import Link from 'next/link';
import type { Metadata } from 'next';
import { loadShell, SectionFrame } from '../shell';

type Params = { params: Promise<{ username: string }> };
export async function generateMetadata({ params }: Params): Promise<Metadata> { return { title: `@${decodeURIComponent((await params).username).toLowerCase()} · Photos` }; }

/** Every picture this person posted that you're allowed to see (the database applies the post's own visibility). */
export default async function PhotosSection({ params }: Params) {
  const s = await loadShell((await params).username);
  const { data } = s.canSee
    ? await s.supabase.from('posts').select('id, media, created_at').eq('author_id', s.p.id).is('hidden_at', null).neq('media', '[]').order('created_at', { ascending: false }).limit(200)
    : { data: [] };
  const photos = ((data || []) as { id: string; media: { url: string; alt?: string }[]; created_at: string }[])
    .flatMap((post) => (post.media || []).filter((m) => m?.url).map((m, i) => ({ key: `${post.id}-${i}`, post: post.id, url: m.url, alt: m.alt || '' })));
  const first = s.p.display_name.split(' ')[0];
  return (
    <SectionFrame s={s} active="photos" title={`${first}’s photos · ${photos.length}`}>
      {photos.length === 0 ? <p className="text-[var(--muted)]">No photos yet.</p> : (
        <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
          {photos.map((ph) => (
            <li key={ph.key}>
              <Link href={`/post/${ph.post}`} className="block aspect-square overflow-hidden border-2 border-[var(--text)] bg-[var(--card)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ph.url} alt={ph.alt || `Photo by ${s.p.display_name}`} loading="lazy" className="h-full w-full object-cover transition-transform hover:scale-105" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionFrame>
  );
}
