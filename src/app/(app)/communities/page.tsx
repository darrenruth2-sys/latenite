import Link from 'next/link';
import { getMe } from '@/lib/me';

export const metadata = { title: 'Communities' };
type C = { id: string; slug: string; name: string; description: string | null; accent: string; is_public: boolean; member_count: number };

export default async function Communities({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const { me, supabase } = await getMe();
  let query = supabase.from('communities').select('id, slug, name, description, accent, is_public, member_count').order('member_count', { ascending: false }).order('created_at', { ascending: false }).order('id').limit(60);
  if (q.trim()) query = query.ilike('name', `%${q.trim().replace(/[%_]/g, '')}%`);
  const [{ data }, mine] = await Promise.all([query, me ? supabase.from('community_members').select('community_id').eq('user_id', me.id) : Promise.resolve({ data: [] })]);
  const mineIds = new Set((mine.data || []).map((m: { community_id: string }) => m.community_id));
  const list = (data || []) as C[];
  const Card = ({ c }: { c: C }) => (
    <li><Link href={`/communities/${c.slug}`} className="flex h-full flex-col gap-2 border-2 border-line bg-panel p-5 transition-transform hover:-translate-y-1" style={{ borderTopColor: c.accent, borderTopWidth: 6 }}>
      <span className="font-display text-xl font-extrabold">{c.name}</span>
      {c.description && <span className="line-clamp-2 text-sm text-muted">{c.description}</span>}
      <span className="mt-auto pixel text-lg text-dim">{c.member_count} member{c.member_count === 1 ? '' : 's'}{!c.is_public && ' · PRIVATE'}{mineIds.has(c.id) && ' · JOINED'}</span>
    </Link></li>
  );
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="pixel text-xl text-violet">&gt; FIND YOUR PEOPLE</p><h1 className="font-display text-4xl font-extrabold">Communities</h1></div>
        {me && <Link href="/communities/new" className="btn-pink">Start a community</Link>}
      </div>
      <form className="flex gap-2" role="search"><label htmlFor="cq" className="sr-only">Search communities</label>
        <input id="cq" name="q" defaultValue={q} className="field" placeholder="Search communities" /><button className="btn-cyan">Search</button></form>
      {list.length === 0 ? <p className="panel p-6 text-muted">{q ? `No communities match “${q}”.` : 'No communities yet. Start the first one!'}</p> : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map((c) => <Card key={c.id} c={c} />)}</ul>
      )}
    </div>
  );
}
