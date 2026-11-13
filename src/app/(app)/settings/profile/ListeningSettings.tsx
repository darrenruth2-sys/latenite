'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/utils';

/** Connect Last.fm so your page shows what you're listening to (Spotify, Apple Music, YouTube Music…). */
export function ListeningSettings() {
  const sb = createClient();
  const [name, setName] = useState('');
  const [share, setShare] = useState(true);
  const [connected, setConnected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  useEffect(() => {
    sb.rpc('my_listening').then(({ data }) => {
      const row = (data as { lastfm_user: string; share: boolean }[] | null)?.[0];
      if (row) { setName(row.lastfm_user); setShare(row.share); setConnected(row.lastfm_user); }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function save(nextName: string, nextShare: boolean, done: string) {
    setBusy(true); setMsg({});
    const { error } = await sb.rpc('set_listening', { p_lastfm: nextName, p_share: nextShare });
    setBusy(false);
    if (error) { setMsg({ error: friendlyError(error) }); setShare(!nextShare); return; }
    setConnected(nextName.trim() || null); setShare(nextShare); setMsg({ ok: done });
  }
  return (
    <section aria-labelledby="listen-h" className="panel flex flex-col gap-3 p-5">
      <h2 id="listen-h" className="font-display text-2xl font-extrabold">🎧 Now listening</h2>
      <p className="text-sm leading-relaxed text-muted">
        Show what you&apos;re listening to on your page, live, like the old MSN status. It works through{' '}
        <a className="link" href="https://www.last.fm/join" target="_blank" rel="noopener noreferrer">Last.fm</a> (free): connect Spotify to Last.fm in its settings,
        or use a Last.fm scrobbler app for Apple Music or YouTube Music. Then put your Last.fm username here.
      </p>
      <div className="flex flex-wrap gap-2">
        <label htmlFor="lfm" className="sr-only">Last.fm username</label>
        <input id="lfm" className="field min-h-11 flex-1" placeholder="Last.fm username" value={name} maxLength={15} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        <button type="button" className="btn-cyan" disabled={busy || !name.trim()} onClick={() => save(name, share, 'Connected. Your page now shows what you’re playing.')}>{connected ? 'Update' : 'Connect'}</button>
      </div>
      {connected && (
        <>
          <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-pink" checked={!share} disabled={busy}
            onChange={(e) => { setShare(!e.target.checked); save(connected, !e.target.checked, e.target.checked ? 'Invisible: nobody sees what you’re playing.' : 'Sharing what you’re playing again.'); }} />
            Listen invisibly (hide what I&apos;m playing)</label>
          <button type="button" className="link self-start text-sm" disabled={busy} onClick={() => { setName(''); save('', true, 'Disconnected from Last.fm.'); }}>Disconnect Last.fm</button>
        </>
      )}
      <p className="text-xs text-dim">Only people who can see your page see this. Your Last.fm username isn&apos;t shown.</p>
      {msg.ok && <p role="status" className="text-sm text-lime">{msg.ok}</p>}
      {msg.error && <p role="alert" className="text-sm text-[#FF8A8A]">{msg.error}</p>}
    </section>
  );
}
