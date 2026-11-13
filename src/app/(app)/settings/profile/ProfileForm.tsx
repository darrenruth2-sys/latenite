'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/upload';
import { friendlyError } from '@/lib/utils';
import { MOODS } from '@/lib/moods';
import { Avatar } from '@/components/Avatar';
import type { Me } from '@/lib/me';
import { Banner } from '@/components/profile/ProfileView';
import { resolveTheme, compactTheme, type ThemeTokens } from '@/lib/theme';

type Details = { headline: string | null; bio: string | null; meet: string | null; region: string | null; interests: string[]; banner_url: string | null; theme: ThemeTokens };

export function ProfileForm({ me, details }: { me: Me; details: Details }) {
  const [f, setF] = useState({ display_name: me.display_name, mood: me.mood || '', headline: details.headline || '', bio: details.bio || '', meet: details.meet || '', region: details.region || '', interests: details.interests.join(', ') });
  const [avatar, setAvatar] = useState(me.avatar_url);
  const [banner, setBanner] = useState(details.banner_url);
  const [busy, setBusy] = useState<string | null>(null);
  const saved = resolveTheme(details.theme);
  const [frame, setFrame] = useState({ banner_x: saved.banner_x, banner_y: saved.banner_y, banner_zoom: saved.banner_zoom });
  const [frameSaved, setFrameSaved] = useState(frame);
  const frameDirty = JSON.stringify(frame) !== JSON.stringify(frameSaved);
  async function saveFrame() {
    setBusy('frame'); setMsg({});
    // only the cover-photo framing changes; the rest of the theme stays as it is
    const { error } = await sb.from('profile_details').update({ theme: compactTheme({ ...resolveTheme(details.theme), ...frame }) }).eq('id', me.id);
    setBusy(null);
    if (error) setMsg({ error: friendlyError(error) }); else { setFrameSaved(frame); setMsg({ ok: 'Cover photo position saved.' }); router.refresh(); }
  }
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const router = useRouter();
  const sb = createClient();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function upload(kind: 'avatar' | 'banner', file?: File) {
    if (!file) return;
    setBusy(kind); setMsg({});
    try {
      const url = await uploadImage(me.id, file, kind, 'media', kind === 'avatar' ? 512 : 1800);
      const { error } = kind === 'avatar' ? await sb.from('profiles').update({ avatar_url: url }).eq('id', me.id) : await sb.from('profile_details').update({ banner_url: url }).eq('id', me.id);
      if (error) throw error;
      if (kind === 'avatar') setAvatar(url); else setBanner(url);
      setMsg({ ok: kind === 'avatar' ? 'Profile picture updated.' : 'Banner updated.' }); router.refresh();
    } catch (e) { setMsg({ error: e instanceof Error && /Upload|image|MB/.test(e.message) ? e.message : friendlyError(e) }); }
    finally { setBusy(null); }
  }
  async function removeImage(kind: 'avatar' | 'banner') {
    const { error } = kind === 'avatar' ? await sb.from('profiles').update({ avatar_url: null }).eq('id', me.id) : await sb.from('profile_details').update({ banner_url: null }).eq('id', me.id);
    if (!error) { if (kind === 'avatar') setAvatar(null); else setBanner(null); router.refresh(); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy('save'); setMsg({});
    const name = f.display_name.trim();
    if (!name) { setMsg({ error: 'Display name can’t be empty.' }); setBusy(null); return; }
    const interests = [...new Set(f.interests.split(',').map((s) => s.trim().toLowerCase().slice(0, 24)).filter(Boolean))].slice(0, 15);
    const mood = MOODS.find((m) => m.label === f.mood);
    const [a, b] = await Promise.all([
      sb.from('profiles').update({ display_name: name.slice(0, 40), mood: f.mood || null, mood_color: mood?.color || null }).eq('id', me.id),
      sb.from('profile_details').update({ headline: f.headline.trim() || null, bio: f.bio.trim() || null, meet: f.meet.trim() || null, region: f.region.trim() || null, interests }).eq('id', me.id),
    ]);
    setBusy(null);
    if (a.error || b.error) setMsg({ error: friendlyError(a.error || b.error) });
    else { setMsg({ ok: 'Saved. Your page is updated.' }); setF({ ...f, interests: interests.join(', ') }); router.refresh(); }
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-3xl font-extrabold">Edit profile</h2>
        <Link href={`/u/${me.username}?edit=1`} className="link inline-flex min-h-10 items-center text-sm">Theme, music &amp; layout live editor →</Link>
      </div>
      <section className="panel flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar user={{ ...me, avatar_url: avatar }} size={88} />
          <div className="flex flex-wrap gap-2">
            <label className="btn-cyan btn-sm cursor-pointer">{busy === 'avatar' ? 'Uploading…' : 'Upload picture'}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload('avatar', e.target.files?.[0])} disabled={!!busy} /></label>
            {avatar && <button type="button" className="btn-ghost btn-sm" onClick={() => removeImage('avatar')}>Remove</button>}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="label">Banner</span>
          <div className="border-2 border-line" style={banner ? undefined : { background: 'repeating-linear-gradient(45deg,#2B0F4D 0 14px,#3A1466 14px 28px)' }}>
            {banner ? <Banner url={banner} t={frame} editing className="h-36 sm:h-48" onMove={(x, y) => setFrame({ ...frame, banner_x: x, banner_y: y })} /> : <div className="h-36 sm:h-48" />}
          </div>
          {banner && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex min-w-[200px] flex-1 items-center gap-2 text-sm">Zoom
                <input type="range" min={100} max={300} value={frame.banner_zoom} onChange={(e) => setFrame({ ...frame, banner_zoom: Number(e.target.value) })} className="h-6 flex-1 accent-cyan" />
                <span className="w-12 text-dim">{frame.banner_zoom}%</span></label>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setFrame({ banner_x: 50, banner_y: 50, banner_zoom: 100 })}>Re-center</button>
              <button type="button" className="btn-cyan btn-sm" onClick={saveFrame} disabled={!frameDirty || busy === 'frame'}>{busy === 'frame' ? 'Saving…' : frameDirty ? 'Save position' : 'Position saved'}</button>
            </div>
          )}
          <div className="flex gap-2">
            <label className="btn-ghost btn-sm cursor-pointer">{busy === 'banner' ? 'Uploading…' : 'Upload banner'}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload('banner', e.target.files?.[0])} disabled={!!busy} /></label>
            {banner && <button type="button" className="btn-ghost btn-sm" onClick={() => removeImage('banner')}>Remove</button>}
          </div>
        </div>
      </section>
      <section className="panel grid gap-4 p-5 sm:grid-cols-2">
        <label className="flex flex-col gap-2"><span className="label">Display name</span><input className="field" value={f.display_name} onChange={set('display_name')} maxLength={40} required /></label>
        <label className="flex flex-col gap-2"><span className="label">Mood</span>
          <select className="field" value={f.mood} onChange={set('mood')}><option value="">no mood</option>{MOODS.map((m) => <option key={m.label}>{m.label}</option>)}</select></label>
        <label className="flex flex-col gap-2 sm:col-span-2"><span className="label">Headline</span><input className="field" value={f.headline} onChange={set('headline')} maxLength={140} placeholder="a quote, a lyric, a vibe" /></label>
        <label className="flex flex-col gap-2 sm:col-span-2"><span className="label">About me</span><textarea className="field" rows={5} value={f.bio} onChange={set('bio')} maxLength={3000} /></label>
        <label className="flex flex-col gap-2 sm:col-span-2"><span className="label">Who I&apos;d like to meet</span><textarea className="field" rows={3} value={f.meet} onChange={set('meet')} maxLength={2000} /></label>
        <label className="flex flex-col gap-2"><span className="label">Region</span><input className="field" value={f.region} onChange={set('region')} maxLength={60} placeholder="e.g. Ohio, USA" />
          <span className="text-xs text-dim">Keep it broad. Never put your address.</span></label>
        <label className="flex flex-col gap-2"><span className="label">Interests</span><input className="field" value={f.interests} onChange={set('interests')} placeholder="vinyl, night drives, horror movies" />
          <span className="text-xs text-dim">Separate with commas. Up to 15.</span></label>
      </section>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-pink" disabled={!!busy}>{busy === 'save' ? 'Saving…' : 'Save changes'}</button>
        <Link href={`/u/${me.username}`} className="btn-ghost">View my page</Link>
        {msg.ok && <span role="status" className="text-sm text-lime">{msg.ok}</span>}
        {msg.error && <span role="alert" className="text-sm text-[#FF8A8A]">{msg.error}</span>}
      </div>
    </form>
  );
}
