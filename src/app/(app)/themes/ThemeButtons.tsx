'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/utils';

export function UseThemeButton({ id, preset }: { id?: string; preset?: string }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const router = useRouter();
  async function use() {
    if (!confirm('Put this theme on your page? Your current look is saved in Memories.')) return;
    setBusy(true); const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    const { error } = id ? await sb.rpc('use_theme', { p_id: id }) : await sb.from('profile_details').update({ theme: { preset } }).eq('id', user!.id);
    setBusy(false);
    if (error) { setErr(friendlyError(error)); return; }
    const { data: p } = await sb.from('profiles').select('username').eq('id', user!.id).single();
    router.push(`/u/${p!.username}?edit=1`);
  }
  return <><button type="button" className="btn-pink btn-sm" onClick={use} disabled={busy}>{busy ? '…' : 'Use this'}</button>{err && <span role="alert" className="text-xs text-[#FF8A8A]">{err}</span>}</>;
}
export function DeleteThemeButton({ id }: { id: string }) {
  const router = useRouter();
  return <button type="button" className="btn-ghost btn-sm" onClick={async () => { if (confirm('Remove from the gallery?')) { await createClient().from('profile_themes').delete().eq('id', id); router.refresh(); } }}>Remove</button>;
}
