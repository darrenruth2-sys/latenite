'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ReportButton } from '@/components/ReportButton';
import { friendlyError } from '@/lib/utils';

export function CommunityActions({ id, isPublic, role, loggedIn, invitable }: { id: string; isPublic: boolean; role: string | null; loggedIn: boolean; invitable: { id: string; display_name: string; username: string }[] }) {
  const router = useRouter(); const [err, setErr] = useState(''); const [pick, setPick] = useState('');
  const sb = createClient();
  if (!loggedIn) return <Link href="/login" className="btn-pink">Log in to join</Link>;
  async function join() { const { error } = await sb.rpc('join_community', { p_id: id }); if (error) setErr(friendlyError(error)); else router.refresh(); }
  async function leave() {
    if (!confirm('Leave this community?')) return;
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from('community_members').delete().eq('community_id', id).eq('user_id', user!.id);
    if (error) setErr(friendlyError(error)); else router.refresh();
  }
  async function add() { if (!pick) return; const { error } = await sb.rpc('add_community_member', { p_id: id, p_user: pick }); if (error) setErr(friendlyError(error)); else { setPick(''); router.refresh(); } }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!role && isPublic && <button className="btn-pink" onClick={join}>Join community</button>}
      {!role && !isPublic && <p className="text-sm text-dim">Private community. A moderator has to add you.</p>}
      {role && role !== 'owner' && <button className="btn-ghost" onClick={leave}>Leave</button>}
      {role === 'owner' && <span className="chip border-amber text-amber">You run this community</span>}
      {(role === 'owner' || role === 'mod') && invitable.length > 0 && (
        <span className="flex gap-1.5"><label htmlFor="cadd" className="sr-only">Add a friend</label>
          <select id="cadd" className="field min-h-10 w-auto" value={pick} onChange={(e) => setPick(e.target.value)}><option value="">Add a friend…</option>
            {invitable.map((f) => <option key={f.id} value={f.id}>{f.display_name}</option>)}</select>
          <button className="btn-cyan btn-sm" onClick={add} disabled={!pick}>Add</button></span>
      )}
      {err && <p role="alert" className="w-full text-sm text-[#FF8A8A]">{err}</p>}
    </div>
  );
}

export function CommunityComposer({ id, meId }: { id: string; meId: string }) {
  const [body, setBody] = useState(''); const [err, setErr] = useState(''); const router = useRouter();
  async function post(e: React.FormEvent) {
    e.preventDefault(); if (!body.trim()) return;
    const { error } = await createClient().from('community_posts').insert({ community_id: id, author_id: meId, body: body.trim() });
    if (error) setErr(friendlyError(error)); else { setBody(''); setErr(''); router.refresh(); }
  }
  return (
    <form onSubmit={post} className="panel-hard flex flex-col gap-2.5 p-4"><label htmlFor="cpost" className="label">Post to the community</label>
      <textarea id="cpost" className="field" rows={2} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="flex items-center gap-3"><button className="btn-pink" disabled={!body.trim()}>Post</button>{err && <span role="alert" className="text-sm text-[#FF8A8A]">{err}</span>}</div></form>
  );
}

export function CommunityPostMenu({ id, canDelete, meId, owner }: { id: string; canDelete: boolean; meId: string | null; owner: string }) {
  const router = useRouter();
  if (canDelete) return <button type="button" className="min-h-10 self-start px-1 text-sm text-dim hover:text-fg" onClick={async () => { if (confirm('Delete this post?')) { await createClient().from('community_posts').delete().eq('id', id); router.refresh(); } }}>Delete</button>;
  return <ReportButton type="community" id={id} owner={owner} meId={meId} className="self-start text-sm text-dim hover:text-fg" />;
}
