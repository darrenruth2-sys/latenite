'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Toggle } from '@/components/Toggle';

type S = { private_browsing: boolean; notify_visits: boolean; allow_nudges: boolean; read_receipts: boolean; share_profile_updates: boolean; discover_feed: boolean; potw_opt_in: boolean };

export function PrivacyForm({ meId, profile, settings, blocked }: { meId: string; profile: { is_private: boolean; discoverable: boolean }; settings: S; blocked: { id: string; username: string; display_name: string }[] }) {
  const [p, setP] = useState(profile);
  const [s, setS] = useState(settings);
  const [status, setStatus] = useState('');
  const [list, setList] = useState(blocked);
  const sb = createClient();
  const router = useRouter();
  async function saveP(patch: Partial<typeof p>) {
    const next = { ...p, ...patch }; setP(next); setStatus('Saving…');
    const { error } = await sb.from('profiles').update(patch).eq('id', meId);
    setStatus(error ? 'Couldn’t save. Try again.' : 'Saved.'); if (error) setP(p); else router.refresh();
  }
  async function saveS(patch: Partial<S>) {
    const next = { ...s, ...patch }; setS(next); setStatus('Saving…');
    const { error } = await sb.from('profile_settings').update(patch).eq('id', meId);
    setStatus(error ? 'Couldn’t save. Try again.' : 'Saved.'); if (error) setS(s);
  }
  async function unblock(id: string) {
    const { error } = await sb.from('blocks').delete().eq('blocker_id', meId).eq('blocked_id', id);
    if (!error) setList(list.filter((b) => b.id !== id));
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between"><h2 className="font-display text-3xl font-extrabold">Privacy &amp; safety</h2>
        <span role="status" className="text-sm text-lime">{status}</span></div>
      <section className="panel flex flex-col gap-2 p-5" aria-labelledby="pv-page">
        <h3 id="pv-page" className="label mb-1">Your page</h3>
        <Toggle checked={p.is_private} onChange={(v) => saveP({ is_private: v })} label="Private page"
          help="Only friends see your page content, posts, guestbook and Top Friends. Everyone else sees your name, picture and an Add Friend button." />
        <Toggle checked={p.discoverable} onChange={(v) => saveP({ discoverable: v })} label="Show me in Discover"
          help="Lets people find you by interests and see your public posts in their Discover tab. Username search works either way." />
        <Toggle checked={s.share_profile_updates} onChange={(v) => saveS({ share_profile_updates: v })} label="Tell friends when I update my page"
          help="Posts a little note in your friends' feeds when you change your profile song or theme." />
        <Toggle checked={s.potw_opt_in} onChange={(v) => saveS({ potw_opt_in: v })} label="Consider me for Profile of the Week"
          help="Moderators may feature your public page on the Discover page for a week." />
      </section>
      <section className="panel flex flex-col gap-2 p-5" aria-labelledby="pv-visits">
        <h3 id="pv-visits" className="label mb-1">Who&apos;s been by</h3>
        <p className="border-2 border-dashed border-line p-3 text-sm leading-relaxed text-muted">
          <b className="text-fg">How visits work:</b> when you look at someone&apos;s page, they can see you visited (once a day, in their &ldquo;Who&apos;s been by&rdquo; box).
          Turn on private browsing and your visits aren&apos;t recorded at all — but then you can&apos;t see who visited you either. Same rule for everyone. We never show fake visits.
        </p>
        <Toggle checked={s.private_browsing} onChange={(v) => saveS({ private_browsing: v })} label="Browse privately"
          help="Pages you visit won't see you. While it's on, your own visitor list is hidden too." />
        <Toggle checked={s.notify_visits} onChange={(v) => saveS({ notify_visits: v })} label="Notify me about visitors" help="At most one visitor notification per person per day." />
      </section>
      <section className="panel flex flex-col gap-2 p-5" aria-labelledby="pv-msg">
        <h3 id="pv-msg" className="label mb-1">Messenger</h3>
        <Toggle checked={s.allow_nudges} onChange={(v) => saveS({ allow_nudges: v })} label="Allow nudges" help="Friends can shake your chat window. Limited to once every 10 seconds." />
        <Toggle checked={s.read_receipts} onChange={(v) => saveS({ read_receipts: v })} label="Read receipts" help="Show &ldquo;Seen&rdquo; when you've read a message. Turning it off also hides receipts from others for you." />
        <Toggle checked={s.discover_feed} onChange={(v) => saveS({ discover_feed: v })} label="Show the Discover tab in my feed" help="Public posts from discoverable people, kept separate from your friends feed." />
      </section>
      <section className="panel flex flex-col gap-3 p-5" aria-labelledby="pv-block">
        <h3 id="pv-block" className="label">Blocked people</h3>
        {list.length === 0 ? <p className="text-sm text-dim">You haven&apos;t blocked anyone.</p> : (
          <ul className="flex flex-col gap-1">
            {list.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 border-b border-line py-2"><span><b>{b.display_name}</b> <span className="text-dim">@{b.username}</span></span>
                <button className="btn-ghost btn-sm" onClick={() => unblock(b.id)}>Unblock</button></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
