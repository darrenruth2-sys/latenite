import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getMe } from '@/lib/me';
import { ModActions, FeatureButton, TakedownActions } from './ModActions';
import { timeAgo } from '@/lib/utils';
import { Avatar } from '@/components/Avatar';

export const metadata = { title: 'Moderation' };
type T = { id: string; created_at: string; kind: string; urls: string; description: string; requester_name: string; requester_email: string;
  requester_contact: string | null; is_subject: boolean; sworn: boolean; signature: string | null; status: string; due_at: string | null; note: string | null };
const URGENT = ['child_safety', 'intimate_image'];
function clock(due: string | null) {
  if (!due) return null;
  const h = Math.round((new Date(due).getTime() - Date.now()) / 36e5);
  return h > 0 ? `${h}h left of the 48h legal deadline` : `OVERDUE by ${-h}h, act now`;
}
type R = { id: string; created_at: string; reason: string; details: string | null; status: string; target_type: string; target_id: string;
  reporter: { username: string } | null; owner: { id: string; username: string; display_name: string; suspended: boolean } | null; preview: string | null; open_reports_on_target: number };

export default async function Mod({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { me, supabase } = await getMe();
  if (!me?.isModerator) notFound();
  const { status = 'open' } = await searchParams;
  const tStatus = status === 'open' ? 'open' : status === 'dismissed' ? 'rejected' : 'removed';
  const [{ data }, { data: cands }, { data: tds }] = await Promise.all([supabase.rpc('mod_reports', { p_status: status, p_limit: 200 }), supabase.rpc('mod_potw_candidates'),
    supabase.rpc('mod_takedowns', { p_status: tStatus })]);
  const list = (data || []) as R[];
  const takedowns = (tds || []) as T[];
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="pixel text-xl text-amber">&gt; STAFF ONLY</p><h1 className="font-display text-4xl font-extrabold">Moderation</h1></div>
        <nav className="flex gap-2" aria-label="Report status">{['open', 'actioned', 'dismissed'].map((s) => <Link key={s} href={`/mod?status=${s}`} className={s === status ? 'btn-cyan btn-sm' : 'btn-ghost btn-sm'}>{s}</Link>)}</nav>
      </div>
      <section aria-labelledby="td-h" className="flex flex-col gap-3">
        <h2 id="td-h" className="label text-amber">Takedown requests ({takedowns.length})</h2>
        {takedowns.length === 0 ? <p className="text-sm text-dim">None {status === 'open' ? 'waiting' : 'here'}.</p> : (
          <ul className="flex flex-col gap-3">{takedowns.map((t) => (
            <li key={t.id} className={`panel flex flex-col gap-2 p-4 ${URGENT.includes(t.kind) && t.status === 'open' ? 'border-[#FF5A5A]' : ''}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`chip ${URGENT.includes(t.kind) ? 'border-[#FF5A5A] text-[#FF8A8A]' : 'border-amber text-amber'}`}>{t.kind.replace('_', ' ')}</span>
                <span className="text-dim">#{t.id.slice(0, 8).toUpperCase()} · {timeAgo(t.created_at)}</span>
                {t.status === 'open' && clock(t.due_at) && <b className="text-[#FF8A8A]">{clock(t.due_at)}</b>}
              </div>
              <p className="whitespace-pre-wrap break-words border-l-4 border-line pl-3 text-sm">{t.urls}</p>
              <p className="whitespace-pre-wrap break-words text-sm">{t.description}</p>
              <p className="text-sm text-muted">From {t.requester_name} · <a className="link" href={`mailto:${t.requester_email}?subject=${encodeURIComponent('Your SignedOn request #' + t.id.slice(0, 8).toUpperCase())}`}>{t.requester_email}</a>
                {t.requester_contact && <> · {t.requester_contact}</>}{t.is_subject && ' · says they’re the person shown'}{t.sworn && ` · signed “${t.signature}”`}</p>
              {t.kind === 'child_safety' && t.status === 'open' && <p className="text-sm text-[#FF8A8A]">Don’t delete anything. Find the content, use “Preserve evidence + suspend” on a report of it (or suspend the account), file at report.cybertip.org, then mark it reported.</p>}
              {t.kind === 'intimate_image' && t.status === 'open' && <p className="text-sm text-[#FF8A8A]">Remove the content and any identical copies, suspend the account that shared it, then email the requester.</p>}
              {t.note && <p className="text-sm text-dim">Note: {t.note}</p>}
              {t.status === 'open' && <TakedownActions id={t.id} kind={t.kind} />}
            </li>))}</ul>
        )}
      </section>
      <h2 className="label text-amber">User reports</h2>
      {list.length === 0 ? <p className="panel p-6 text-muted">No {status} reports. Nice and quiet.</p> : (
        <ul className="flex flex-col gap-3">
          {list.map((r) => (
            <li key={r.id} className="panel flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`chip ${URGENT.includes(r.reason) ? 'border-[#FF5A5A] text-[#FF8A8A]' : 'border-amber text-amber'}`}>{r.reason.replace('_', ' ')}</span>
                {URGENT.includes(r.reason) && status === 'open' && <b className="text-[#FF8A8A]">{clock(new Date(new Date(r.created_at).getTime() + 48 * 36e5).toISOString())}</b>}<span className="chip">{r.target_type}</span>
                {r.open_reports_on_target > 1 && <span className="chip border-pink text-pink">{r.open_reports_on_target} reports</span>}
                <span className="text-dim">{timeAgo(r.created_at)} · reported by @{r.reporter?.username || 'deleted'}</span>
              </div>
              <p className="whitespace-pre-wrap break-words border-l-4 border-line pl-3">{r.preview || <span className="text-dim">(already removed)</span>}</p>
              {r.details && <p className="text-sm text-muted">Reporter says: {r.details}</p>}
              {r.owner && <p className="text-sm">Owner: <Link href={`/u/${r.owner.username}`} className="link">@{r.owner.username}</Link>{r.owner.suspended && <span className="ml-2 text-[#FF8A8A]">SUSPENDED</span>}</p>}
              {status === 'open' && <ModActions reportId={r.id} ownerId={r.owner?.id || null} reason={r.reason} />}
            </li>
          ))}
        </ul>
      )}
      <section aria-labelledby="potw" className="flex flex-col gap-3">
        <h2 id="potw" className="label text-amber">Profile of the Week — opted-in pages</h2>
        {!cands?.length ? <p className="text-sm text-dim">Nobody has opted in yet.</p> : (
          <ul className="grid gap-3 sm:grid-cols-3">{(cands as { id: string; username: string; display_name: string; avatar_url: string | null; friends: number }[]).map((c) => (
            <li key={c.id} className="panel flex items-center gap-3 p-3"><Avatar user={c} size={44} /><Link href={`/u/${c.username}`} className="min-w-0 flex-1 truncate font-semibold">{c.display_name}</Link><FeatureButton id={c.id} /></li>))}</ul>
        )}
      </section>
    </div>
  );
}
