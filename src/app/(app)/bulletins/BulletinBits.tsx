'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/utils';

export function BulletinComposer({ meId }: { meId: string }) {
  const [body, setBody] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function post(e: React.FormEvent) {
    e.preventDefault(); if (!body.trim()) return; setBusy(true); setErr('');
    const { error } = await createClient().from('bulletins').insert({ author_id: meId, body: body.trim() });
    setBusy(false); if (error) setErr(friendlyError(error)); else { setBody(''); router.refresh(); }
  }
  return (
    <form onSubmit={post} className="panel-hard flex flex-col gap-3 p-4">
      <label htmlFor="bul" className="label">Post a bulletin</label>
      <textarea id="bul" className="field" rows={3} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="repost if you still remember your first screen name" />
      <div className="flex items-center gap-3"><button className="btn-pink" disabled={busy || !body.trim()}>{busy ? 'Posting…' : 'Post to all friends'}</button>
        {err && <span role="alert" className="text-sm text-[#FF8A8A]">{err}</span>}</div>
    </form>
  );
}
export function DeleteBulletin({ id }: { id: string }) {
  const router = useRouter();
  return <button type="button" className="min-h-10 self-start px-1 text-sm text-dim hover:text-fg" onClick={async () => { await createClient().from('bulletins').delete().eq('id', id); router.refresh(); }}>Delete</button>;
}
