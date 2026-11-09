'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { createClient } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/utils';

type V = { id: string; username: string; display_name: string; avatar_url: string | null; visited_at: string };

/** Records one visit per day (skipped server-side for private browsing, self, blocks). */
export function RecordVisit({ profileId }: { profileId: string }) {
  useEffect(() => { const t = setTimeout(() => { createClient().rpc('record_visit', { p_profile: profileId }).then(() => {}, () => {}); }, 1200); return () => clearTimeout(t); }, [profileId]);
  return null;
}

export function VisitorsBox({ isOwner, total, week, visitors, privateBrowsing, meId }:
  { isOwner: boolean; total: number; week: number | null; visitors: V[]; privateBrowsing: boolean; meId: string | null }) {
  const [priv, setPriv] = useState(privateBrowsing);
  const router = useRouter();
  async function toggle(v: boolean) {
    setPriv(v);
    const { error } = await createClient().from('profile_settings').update({ private_browsing: v }).eq('id', meId!);
    if (error) setPriv(!v); else router.refresh();
  }
  return (
    <section aria-labelledby="vis-h" className="flex flex-col gap-3 border-2 border-[var(--text)] bg-[var(--card)] p-5 rounded-[var(--radius)]">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="vis-h" className="text-[22px] font-extrabold" style={{ fontFamily: 'var(--head)' }}>{isOwner ? 'Who’s been by' : 'Visitor counter'}</h2>
        <span className="font-pixel text-xl text-[var(--accent)]">{isOwner && week != null ? `${week} this week` : ''}</span>
      </div>
      <div className="flex items-center gap-1" aria-label={`${total} visits`}>
        {String(total).padStart(6, '0').split('').map((d, i) => <span key={i} className="bg-ink px-1.5 font-pixel text-2xl leading-tight text-lime">{d}</span>)}
        <span className="ml-2 text-sm text-[var(--muted)]">visits</span>
      </div>
      {isOwner && (priv ? (
        <p className="border-2 border-dashed border-[var(--line)] p-3 text-sm leading-normal">You&apos;re browsing privately, so visitor names are hidden for you too. Fair&apos;s fair.</p>
      ) : visitors.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No visitors yet. Share your page!</p>
      ) : (
        <ul className="grid grid-cols-4 gap-2">
          {visitors.slice(0, 8).map((v) => (
            <li key={v.id}><Link href={`/u/${v.username}`} className="flex flex-col gap-1 text-xs">
              <Avatar user={v} size={64} border="var(--text)" className="!h-auto !w-full aspect-square" />
              <span className="truncate font-semibold">{v.display_name}</span><span suppressHydrationWarning className="text-[var(--muted)]">{timeAgo(v.visited_at).replace(' ago', '')}</span></Link></li>
          ))}
        </ul>
      ))}
      {meId && (
        <label className="flex min-h-10 items-start gap-2.5 text-sm leading-snug">
          <input type="checkbox" checked={priv} onChange={(e) => toggle(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-pink" />
          <span><b>Browse privately.</b> Pages you visit won&apos;t see you. While it&apos;s on, you won&apos;t see who visited you either.</span>
        </label>
      )}
    </section>
  );
}
