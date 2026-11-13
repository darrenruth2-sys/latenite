'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { TopFriendsGrid, type TopFriend } from './TopFriends';
import { MusicEmbed } from './MusicEmbed';
import { createClient } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/upload';
import { SongPicker } from './SongPicker';
import { parseMusicUrl, PROVIDER_NAME } from '@/lib/music';
import { BG_SIZES, FONTS, PATTERNS, PRESETS, SECTION_LABELS, compactTheme, contrast, resolveTheme, themeVars, type FontKey, type Pattern, type ThemeTokens } from '@/lib/theme';
import { MOODS, moodColor } from '@/lib/moods';
import { CSS_MAX, SAFETY_CSS } from '@/lib/customCss';
import { friendlyError } from '@/lib/utils';

type Music = { provider: string; url: string; title?: string; artist?: string; art?: string; autoplay?: boolean } | null;
export type ProfileViewProps = {
  profile: { id: string; username: string; display_name: string; avatar_url: string | null; mood: string | null; mood_color: string | null; is_private: boolean };
  details: { theme: ThemeTokens; layout: string[]; top_count: number; top_hidden: boolean; music: Music; guestbook_policy: string; banner_url: string | null; headline: string | null };
  isMe: boolean; startEditing: boolean; online: boolean | null; statusLine?: string | null;
  top: TopFriend[]; pool: TopFriend[];
  slots: Record<string, React.ReactNode>;
  side: React.ReactNode; actions: React.ReactNode; badges?: React.ReactNode;
  /** Under the profile song: Last.fm "Now listening" and the "Report this song" link. */
  musicExtra?: React.ReactNode;
  themeGalleryEnabled?: boolean;
  customCss?: { raw: string; safe: string };
};

const ACCENTS = ['#FF4FA3', '#38E1FF', '#9B7BFF', '#5CFF8A', '#FFC23D', '#FF8A5C', '#D4146F', '#2457D6'];

export function ProfileView(props: ProfileViewProps) {
  const { profile, details, isMe } = props;
  const initial = useMemo(() => ({
    theme: resolveTheme(details.theme), layout: details.layout, topCount: details.top_count, topHidden: details.top_hidden,
    music: details.music, gb: details.guestbook_policy, mood: profile.mood || '', top: props.top, css: props.customCss?.raw || '',
  }), [details, profile.mood, props.top, props.customCss?.raw]);
  const [s, setS] = useState(initial);
  const [editing, setEditing] = useState(isMe && props.startEditing);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const router = useRouter();
  useEffect(() => { setS(initial); }, [initial]);
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // The song player goes up top on phones and in the sidebar on big screens. Only ONE is ever mounted:
  // two hidden-by-CSS copies would both autoplay, slightly out of sync.
  const [wide, setWide] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setWide(mq.matches); on();
    mq.addEventListener('change', on); return () => mq.removeEventListener('change', on);
  }, []);
  const t = s.theme;
  const vars = themeVars(t);
  // The person's CSS, cleaned. Saved CSS comes pre-cleaned from the server; while editing we clean it live in the browser.
  const [liveCss, setLiveCss] = useState<{ css: string; removed: string[] }>({ css: props.customCss?.safe || '', removed: [] });
  useEffect(() => {
    if (s.css === initial.css) { setLiveCss({ css: props.customCss?.safe || '', removed: [] }); return; }
    let off = false;
    const id = setTimeout(() => import('@/lib/customCss').then(({ sanitizeCss }) => { if (!off) setLiveCss(sanitizeCss(s.css)); }), 250);
    return () => { off = true; clearTimeout(id); };
  }, [s.css, initial.css, props.customCss?.safe]);
  const sections = s.layout.filter((k) => k === 'top' || props.slots[k] !== undefined);
  const setTheme = (patch: Partial<typeof t>) => { setS({ ...s, theme: { ...t, ...patch } }); setMsg({}); };

  async function save() {
    setSaving(true); setMsg({});
    const sb = createClient();
    const moodC = MOODS.find((m) => m.label === s.mood)?.color || null;
    const [a, b, c] = await Promise.all([
      sb.from('profile_details').update({ theme: compactTheme(t), layout: s.layout, top_count: s.topCount, top_hidden: s.topHidden, music: s.music, guestbook_policy: s.gb, ...(isMe ? { custom_css: s.css.trim() ? s.css.slice(0, CSS_MAX) : null } : {}) }).eq('id', profile.id),
      sb.from('profiles').update({ mood: s.mood || null, mood_color: moodC }).eq('id', profile.id),
      sb.rpc('set_top_friends', { p_ids: s.top.slice(0, 16).map((f) => f.id) }),
    ]);
    setSaving(false);
    const err = a.error || b.error || c.error;
    if (err) setMsg({ error: friendlyError(err) });
    else { setMsg({ ok: 'Saved. Your page is live.' }); router.refresh(); }
  }

  const header = (
    <section aria-label="Profile header" className="so-header overflow-hidden border-2 border-[var(--text)] bg-[var(--card)] rounded-[var(--radius)]" style={{ boxShadow: 'var(--shadow)' }}>
      <Banner url={details.banner_url} t={t} editing={editing} onMove={(x, y) => setTheme({ banner_x: x, banner_y: y })}>
        <span className="absolute right-3 top-3 bg-black/50 px-2.5 py-0.5 font-pixel text-xl text-white">{profile.display_name.split(' ')[0].toLowerCase()}&apos;s corner of the internet</span>
      </Banner>
      <div className="relative -mt-16 flex flex-wrap items-start gap-x-5 gap-y-3 px-5 pb-5 sm:px-7">
        <div className="so-avatar relative border-[5px] border-[var(--card)] rounded-[var(--radius)]"><Avatar user={profile} size={140} border="var(--text)" online={props.online} /></div>
        <div className="flex min-w-[240px] flex-1 flex-col gap-1.5 pb-1 sm:pt-[74px]">
          <h1 className="so-name text-[clamp(34px,5vw,48px)] font-extrabold leading-none tracking-tight" style={{ fontFamily: 'var(--head)' }}>{profile.display_name}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-[var(--muted)]">
            <span>@{profile.username}</span>
            {props.online != null && <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--text)]"><span className={`h-2.5 w-2.5 rounded-full ${props.online ? 'bg-lime' : 'bg-dim'}`} />{props.statusLine || (props.online ? 'Online now' : 'Offline')}</span>}
            {s.mood && <span className="font-pixel text-xl" style={{ color: t.accent }}>mood: {s.mood}</span>}
            {profile.is_private && <span className="border-2 border-[var(--muted)] px-1.5 text-xs font-semibold">Private page</span>}
          </div>
          {details.headline && <p className="so-headline italic">&ldquo;{details.headline}&rdquo;</p>}
          {props.badges}
        </div>
        <div className="so-safe flex flex-wrap items-center gap-2 pb-1 sm:pt-[74px]">{props.actions}</div>
      </div>
    </section>
  );

  // Autoplay is the owner's call (on unless they turned it off). Never while you're editing your own page.
  const player = s.music && parseMusicUrl(s.music.url)
    ? <MusicEmbed key={s.music.url} music={s.music} accent={t.accent} label="PROFILE SONG" autoplay={s.music.autoplay !== false && !editing} /> : null;
  const music = player || props.musicExtra ? <div className="flex flex-col gap-2">{player}{props.musicExtra}</div> : null;

  return (
    <div style={vars} className="so-page min-h-[calc(100dvh-64px)] text-[var(--text)]">
      {/* cleaned by sanitizeCss: scoped to this page, no outside URLs, '<' escaped */}
      {(liveCss.css || editing) && <style dangerouslySetInnerHTML={{ __html: liveCss.css + SAFETY_CSS }} />}
      <div className="mx-auto flex max-w-[1320px] flex-col gap-5 px-4 py-6 sm:px-6">
        {isMe && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">{editing ? 'Changes preview live. Nobody sees them until you save.' : 'This is your page as others see it.'}</p>
            <button type="button" onClick={() => setEditing((e) => !e)} className="btn border-[var(--text)] bg-[var(--accent)] text-[var(--on-accent)]" style={{ boxShadow: `4px 4px 0 var(--text)` }}>
              {editing ? 'Close editor' : 'Customize my page'}
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-start gap-6">
          <div className="so-css so-main flex min-w-0 flex-[999_1_620px] flex-col gap-6">
            {header}
            <nav aria-label="Jump to section" className="sticky top-[58px] z-10 -mx-4 flex gap-1.5 overflow-x-auto bg-[var(--pg)]/90 px-4 py-2 backdrop-blur lg:hidden">
              {sections.map((k) => <a key={k} href={`#sec-${k}`} className="shrink-0 border-2 border-[var(--text)] bg-[var(--card)] px-3 py-1.5 text-sm font-bold">{SECTION_LABELS[k] || k}</a>)}
            </nav>
            {music && wide === false && <div className="so-music">{music}</div>}
            {sections.map((k) => (
              <div key={k} id={`sec-${k}`} className={`so-section so-section-${k} scroll-mt-28`}>
                {k === 'top'
                  ? <TopFriendsGrid list={s.top} count={s.topCount} hidden={s.topHidden} editable={editing} pool={props.pool} ownerName={profile.display_name.split(' ')[0]}
                      onChange={editing ? (l) => setS({ ...s, top: l }) : undefined} />
                  : props.slots[k]}
              </div>
            ))}
          </div>
          <aside className="flex w-full min-w-0 flex-[1_1_320px] flex-col gap-6" aria-label="Sidebar">
            {editing && <Editor cssNotes={liveCss.removed} s={s} setS={setS} setTheme={setTheme} profileId={profile.id} save={save} saving={saving} dirty={dirty} msg={msg}
              reset={() => { setS(initial); setMsg({}); }} slots={Object.keys(props.slots)} themeGalleryEnabled={props.themeGalleryEnabled} />}
            <div className="so-css so-side flex flex-col gap-6">
              {music && wide === true && <div className="so-music">{music}</div>}
              {props.side}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

type S = { theme: ReturnType<typeof resolveTheme>; layout: string[]; topCount: number; topHidden: boolean; music: Music; gb: string; mood: string; top: TopFriend[]; css: string };

function Editor({ cssNotes, s, setS, setTheme, profileId, save, saving, dirty, msg, reset, slots, themeGalleryEnabled }:
  { cssNotes: string[]; s: S; setS: (s: S) => void; setTheme: (p: Partial<S['theme']>) => void; profileId: string; save: () => void; saving: boolean; dirty: boolean;
    msg: { ok?: string; error?: string }; reset: () => void; slots: string[]; themeGalleryEnabled?: boolean }) {
  const t = s.theme;
  const [musicErr, setMusicErr] = useState('');
  const [bgBusy, setBgBusy] = useState(false);
  const [publish, setPublish] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const lowContrast = contrast(t.text, t.card) < 4.5 || contrast(t.text, t.page) < 3;
  const allSections = ['top', 'about', 'guestbook', 'posts', 'friends', ...slots.filter((k) => !['about', 'guestbook', 'posts', 'friends'].includes(k))];
  const uniqSections = [...new Set(allSections)];

  async function uploadBg(file?: File) {
    if (!file) return; setBgBusy(true);
    try { setTheme({ bg_image: await uploadImage(profileId, file, 'theme', 'media', 2000) }); } catch (e) { setMusicErr(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setBgBusy(false); }
  }
  function move(i: number, d: number) {
    const l = [...s.layout]; const j = i + d; if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]]; setS({ ...s, layout: l });
  }
  async function publishTheme() {
    const name = prompt('Name your theme (shows in the gallery):', `${PRESETS[t.preset]?.name || 'My'} remix`);
    if (!name?.trim()) return;
    setPublish('busy');
    const { error } = await createClient().rpc('publish_theme', { p_name: name.trim().slice(0, 40), p_tokens: compactTheme(t) });
    setPublish(error ? 'error' : 'done');
  }
  const L = ({ children }: { children: React.ReactNode }) => <div className="font-pixel text-[19px] leading-none text-dim">{children}</div>;
  return (
    <section aria-labelledby="ed-h" className="so-editor sticky top-20 z-10 flex max-h-[calc(100dvh-100px)] flex-col gap-5 overflow-y-auto border-2 border-cyan bg-ink p-5 text-fg shadow-[8px_8px_0_var(--color-cyan)]" style={{ colorScheme: 'dark' }}>
      <div className="flex items-center justify-between"><h2 id="ed-h" className="font-display text-[22px] font-extrabold">Edit your page</h2>
        <span className="font-pixel text-lg text-lime"><span className="animate-blink">●</span> LIVE PREVIEW</span></div>

      <div className="flex flex-col gap-2"><L>THEME</L>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(PRESETS).map(([k, p]) => (
            <button key={k} type="button" aria-pressed={t.preset === k} onClick={() => setTheme({ ...p, bg_image: t.bg_image })}
              className={`flex min-h-12 items-center gap-2.5 border-2 bg-panel p-2 text-left text-sm font-semibold ${t.preset === k ? 'border-cyan' : 'border-line'}`}>
              <span className="h-8 w-8 shrink-0 border border-fg" style={{ background: `linear-gradient(135deg, ${p.page} 50%, ${p.accent} 50%)` }} />{p.name}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2"><L>ACCENT COLOR</L>
        <div className="flex flex-wrap gap-2">
          {ACCENTS.map((c) => <button key={c} type="button" aria-label={`Accent ${c}`} aria-pressed={t.accent === c} onClick={() => setTheme({ accent: c, on_accent: contrast(c, '#0A0A18') > contrast(c, '#FFFFFF') ? '#0A0A18' : '#FFFFFF' })}
            className={`h-10 w-10 border-[3px] ${t.accent === c ? 'border-fg' : 'border-ink'}`} style={{ background: c }} />)}
          <label className="flex h-10 items-center gap-1.5 border-2 border-line px-2 text-xs">Custom<input type="color" value={t.accent} onChange={(e) => setTheme({ accent: e.target.value.toUpperCase() })} className="h-6 w-8 cursor-pointer bg-transparent" /></label>
        </div>
      </div>

      <details className="flex flex-col gap-2"><summary className="cursor-pointer font-pixel text-[19px] text-dim">MORE COLORS</summary>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          {([['page', 'Background'], ['card', 'Boxes'], ['text', 'Text'], ['muted', 'Soft text'], ['banner_a', 'Banner 1'], ['banner_b', 'Banner 2']] as const).map(([k, l]) => (
            <label key={k} className="flex min-h-10 items-center justify-between gap-2 border-2 border-line px-2">{l}
              <input type="color" value={t[k]} onChange={(e) => setTheme({ [k]: e.target.value.toUpperCase() } as Partial<S['theme']>)} className="h-7 w-9 cursor-pointer bg-transparent" /></label>
          ))}
        </div>
      </details>
      {lowContrast && <p role="alert" className="border-2 border-amber px-2 py-1.5 text-sm text-amber">Heads up: your text color is hard to read on this background. Visitors might struggle.</p>}

      <div className="flex flex-col gap-2"><L>HEADING FONT</L>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FONTS) as FontKey[]).map((f) => <button key={f} type="button" aria-pressed={t.font === f} onClick={() => setTheme({ font: f })}
            className={`min-h-10 border-2 border-cyan px-3 text-base font-bold ${t.font === f ? 'bg-cyan text-ink' : ''}`} style={{ fontFamily: FONTS[f].stack }}>{FONTS[f].label}</button>)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5"><L>PATTERN</L>
          <select className="field min-h-10" value={t.pattern} onChange={(e) => setTheme({ pattern: e.target.value as Pattern, bg_image: null })}>{PATTERNS.map((p) => <option key={p}>{p}</option>)}</select></label>
        <label className="flex flex-col gap-1.5"><L>CORNERS</L>
          <select className="field min-h-10" value={t.radius} onChange={(e) => setTheme({ radius: e.target.value as S['theme']['radius'] })}><option value="none">sharp</option><option value="soft">soft</option><option value="round">round</option></select></label>
        <label className="flex flex-col gap-1.5"><L>SHADOW</L>
          <select className="field min-h-10" value={t.shadow} onChange={(e) => setTheme({ shadow: e.target.value as S['theme']['shadow'] })}><option value="hard">hard</option><option value="glow">glow</option><option value="none">none</option></select></label>
        <div className="flex flex-col gap-1.5"><L>BACKGROUND PIC</L>
          <div className="flex gap-1.5"><label className="btn-ghost btn-sm flex-1 cursor-pointer">{bgBusy ? '…' : 'Upload'}<input type="file" accept="image/*" className="sr-only" onChange={(e) => uploadBg(e.target.files?.[0])} /></label>
            {t.bg_image && <button type="button" className="btn-ghost btn-sm" onClick={() => setTheme({ bg_image: null })} aria-label="Remove background picture">×</button>}</div></div>
      </div>

      {t.bg_image && (
        <div className="flex flex-col gap-2.5 border-2 border-line p-3"><L>BACKGROUND PIC LAYOUT</L>
          <div role="group" aria-label="Background picture size" className="grid grid-cols-4 gap-1.5">
            {BG_SIZES.map((b) => <button key={b.key} type="button" aria-pressed={t.bg_size === b.key} onClick={() => setTheme({ bg_size: b.key })}
              className={`min-h-10 border-2 border-cyan text-sm font-bold ${t.bg_size === b.key ? 'bg-cyan text-ink' : ''}`}>{b.label}</button>)}
          </div>
          <Slider label="Left ↔ right" value={t.bg_x} min={0} max={100} onChange={(v) => setTheme({ bg_x: v })} />
          <Slider label="Up ↕ down" value={t.bg_y} min={0} max={100} onChange={(v) => setTheme({ bg_y: v })} />
          <Slider label="Fade into background color" value={t.bg_dim} min={0} max={80} unit="%" onChange={(v) => setTheme({ bg_dim: v })} />
          <label className="flex min-h-10 items-center gap-2.5 text-sm"><input type="checkbox" className="h-5 w-5 accent-cyan" checked={t.bg_fixed} onChange={(e) => setTheme({ bg_fixed: e.target.checked })} />Picture stays put while the page scrolls</label>
        </div>
      )}

      <div className="flex flex-col gap-2.5 border-2 border-line p-3"><L>COVER PHOTO</L>
        <p className="text-[13px] text-dim">Drag the cover photo at the top of your page to move it. Change the picture in <a className="link" href="/settings/profile">Edit profile</a>.</p>
        <Slider label="Zoom" value={t.banner_zoom} min={100} max={300} unit="%" onChange={(v) => setTheme({ banner_zoom: v })} />
        <button type="button" className="btn-ghost btn-sm self-start" onClick={() => setTheme({ banner_x: 50, banner_y: 50, banner_zoom: 100 })}>Re-center</button>
      </div>

      <label className="flex flex-col gap-1.5"><L>MOOD</L>
        <select className="field min-h-10" value={s.mood} onChange={(e) => setS({ ...s, mood: e.target.value })}><option value="">no mood</option>{MOODS.map((m) => <option key={m.label} style={{ color: moodColor(m.label) }}>{m.label}</option>)}</select></label>

      <div className="flex flex-col gap-2"><L>PROFILE SONG</L>
        <SongPicker current={s.music} onPick={(m) => setS({ ...s, music: m })} />
        {s.music && (
          <div className="grid grid-cols-2 gap-1.5">
            <input className="field min-h-9 text-sm" aria-label="Song title" placeholder="Title" maxLength={100} value={s.music.title || ''} onChange={(e) => setS({ ...s, music: { ...s.music!, title: e.target.value } })} />
            <input className="field min-h-9 text-sm" aria-label="Artist" placeholder="Artist" maxLength={100} value={s.music.artist || ''} onChange={(e) => setS({ ...s, music: { ...s.music!, artist: e.target.value } })} />
            <label className="col-span-2 flex min-h-10 items-center gap-2.5 text-sm"><input type="checkbox" className="h-5 w-5 accent-pink" checked={s.music.autoplay !== false}
              onChange={(e) => setS({ ...s, music: { ...s.music!, autoplay: e.target.checked } })} />Play automatically when people visit (old-school style)</label>
            {s.music.autoplay !== false && s.music.provider !== 'youtube' && (
              <p role="note" className="col-span-2 border-2 border-amber px-2 py-1.5 text-xs text-amber">{PROVIDER_NAME[s.music.provider as keyof typeof PROVIDER_NAME]} doesn&apos;t allow autoplay on other websites, so visitors press play. Songs from the search autoplay.</p>
            )}
            <p className="col-span-2 text-xs text-dim">From {PROVIDER_NAME[s.music.provider as keyof typeof PROVIDER_NAME]}.</p>
          </div>
        )}
        {musicErr && <p role="alert" className="text-sm text-[#FF8A8A]">{musicErr}</p>}
      </div>

      <div className="flex flex-col gap-2"><L>TOP FRIENDS</L>
        <div role="group" aria-label="How many Top Friends" className="flex gap-1.5">
          {[4, 8, 12, 16].map((n) => <button key={n} type="button" aria-pressed={s.topCount === n} onClick={() => setS({ ...s, topCount: n })}
            className={`min-h-10 flex-1 border-2 border-pink font-bold ${s.topCount === n ? 'bg-pink text-ink' : ''}`}>{n}</button>)}
        </div>
        <label className="flex min-h-10 items-center gap-2.5 text-sm"><input type="checkbox" className="h-5 w-5 accent-pink" checked={s.topHidden} onChange={(e) => setS({ ...s, topHidden: e.target.checked })} />Hide the order from visitors (A–Z, no numbers)</label>
      </div>

      <div className="flex flex-col gap-2"><L>SECTIONS</L>
        <ol className="flex flex-col gap-1.5">
          {s.layout.map((k, i) => (
            <li key={k} className="flex items-center gap-1.5 border-2 border-line bg-panel py-1 pl-3 pr-1">
              <span className="flex-1 text-sm font-semibold">{SECTION_LABELS[k] || k}</span>
              <button type="button" aria-label={`Move ${SECTION_LABELS[k]} up`} onClick={() => move(i, -1)} disabled={i === 0} className="h-9 w-9 border border-line disabled:opacity-30">↑</button>
              <button type="button" aria-label={`Move ${SECTION_LABELS[k]} down`} onClick={() => move(i, 1)} disabled={i === s.layout.length - 1} className="h-9 w-9 border border-line disabled:opacity-30">↓</button>
              <button type="button" aria-label={`Hide ${SECTION_LABELS[k]}`} onClick={() => setS({ ...s, layout: s.layout.filter((x) => x !== k) })} className="h-9 w-9 border border-line">×</button>
            </li>
          ))}
        </ol>
        {uniqSections.filter((k) => !s.layout.includes(k)).length > 0 && (
          <div className="flex flex-wrap gap-1.5">{uniqSections.filter((k) => !s.layout.includes(k)).map((k) => (
            <button key={k} type="button" className="btn-ghost btn-sm" onClick={() => setS({ ...s, layout: [...s.layout, k] })}>+ {SECTION_LABELS[k] || k}</button>))}</div>
        )}
      </div>

      <label className="flex flex-col gap-1.5"><L>WHO CAN SIGN MY GUESTBOOK</L>
        <select className="field min-h-10" value={s.gb} onChange={(e) => setS({ ...s, gb: e.target.value })}>
          <option value="friends">Friends</option><option value="everyone">Anyone logged in</option><option value="off">Nobody (closed)</option></select></label>

      <details className="flex flex-col gap-2" open={!!s.css}><summary className="cursor-pointer font-pixel text-[19px] text-dim">CUSTOM CSS (POWER USERS)</summary>
        <div className="mt-2 flex flex-col gap-2">
          <label htmlFor="ed-css" className="text-[13px] leading-relaxed text-dim">Style anything on your page. Handy hooks: <code className="text-fg">.so-header .so-banner .so-avatar .so-name .so-headline .so-section .so-section-top .so-section-guestbook .so-music</code>, and <code className="text-fg">body</code> means your whole page.</label>
          <textarea id="ed-css" spellCheck={false} maxLength={CSS_MAX} rows={10} value={s.css} onChange={(e) => setS({ ...s, css: e.target.value })}
            placeholder={'.so-name {\n  color: #FF4FA3;\n  text-shadow: 3px 3px 0 #38E1FF;\n}'}
            className="field min-h-40 font-mono text-[13px] leading-snug" />
          <p className="text-xs text-dim">{s.css.length.toLocaleString()} / {CSS_MAX.toLocaleString()}. Stays on your page only. Pictures must be ones you uploaded here. Can&apos;t cover the screen or hide the Report/Block buttons.</p>
          {cssNotes.length > 0 && <ul role="status" className="list-disc border-2 border-amber py-1.5 pl-6 pr-2 text-sm text-amber">{cssNotes.map((n) => <li key={n}>{n}</li>)}</ul>}
        </div>
      </details>

      <div className="sticky -bottom-5 -mx-5 -mb-5 flex flex-wrap items-center gap-2 border-t-2 border-line bg-ink px-5 py-3">
        <button type="button" onClick={save} disabled={saving || !dirty} className="btn-cyan">{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>
        <button type="button" onClick={reset} disabled={!dirty} className="btn-ghost">Discard</button>
        {themeGalleryEnabled && <button type="button" onClick={publishTheme} disabled={publish === 'busy'} className="btn-ghost btn-sm">{publish === 'done' ? 'Shared ✓' : 'Share theme'}</button>}
        <span role="status" className="w-full text-sm">{msg.ok && <span className="text-lime">{msg.ok}</span>}{msg.error && <span className="text-[#FF8A8A]">{msg.error}</span>}
          {publish === 'done' && <span className="text-lime"> Theme added to the gallery.</span>}{publish === 'error' && <span className="text-[#FF8A8A]"> Couldn&apos;t share the theme.</span>}</span>
      </div>
    </section>
  );
}

function Slider({ label, value, min, max, unit = '', onChange }: { label: string; value: number; min: number; max: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex justify-between"><span>{label}</span><span className="text-dim">{value}{unit}</span></span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-6 w-full accent-cyan" />
    </label>
  );
}

/** Cover photo. While editing, drag it to choose which part shows. */
export function Banner({ url, t, editing, onMove, children, className = 'h-36 sm:h-48' }: { url: string | null; t: { banner_x: number; banner_y: number; banner_zoom: number }; editing: boolean; onMove: (x: number, y: number) => void; children?: React.ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const canDrag = editing && !!url;
  function down(e: React.PointerEvent) {
    if (!canDrag) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: t.banner_x, y: t.banner_y };
  }
  function moveTo(e: React.PointerEvent) {
    const d = drag.current; const el = box.current; if (!d || !el) return;
    // dragging the picture down shows more of its top, like moving a photo behind a frame
    const k = 100 / (t.banner_zoom / 100);
    const x = Math.round(Math.min(100, Math.max(0, d.x - ((e.clientX - d.px) / el.clientWidth) * k)));
    const y = Math.round(Math.min(100, Math.max(0, d.y - ((e.clientY - d.py) / el.clientHeight) * k)));
    onMove(x, y);
  }
  function key(e: React.KeyboardEvent) {
    if (!canDrag) return;
    const step = e.shiftKey ? 10 : 2;
    const m: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const v = m[e.key]; if (!v) return; e.preventDefault();
    onMove(Math.min(100, Math.max(0, t.banner_x + v[0])), Math.min(100, Math.max(0, t.banner_y + v[1])));
  }
  return (
    <div ref={box} className={`so-banner relative overflow-hidden ${className} ${canDrag ? 'cursor-grab touch-none select-none active:cursor-grabbing' : ''}`}
      style={url ? undefined : { background: 'var(--banner)' }}
      onPointerDown={down} onPointerMove={moveTo} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
      tabIndex={canDrag ? 0 : undefined} onKeyDown={key} role={canDrag ? 'application' : undefined}
      aria-label={canDrag ? 'Cover photo. Drag, or use the arrow keys, to choose which part shows.' : undefined}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: `${t.banner_x}% ${t.banner_y}%`, transform: `scale(${t.banner_zoom / 100})`, transformOrigin: `${t.banner_x}% ${t.banner_y}%` }} />
      )}
      {children}
      {canDrag && <span aria-hidden="true" className="pointer-events-none absolute bottom-3 left-3 bg-black/70 px-2.5 py-1 text-sm font-bold text-white">✥ Drag to reposition</span>}
    </div>
  );
}
