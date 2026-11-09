'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { uploadImage } from '@/lib/upload';
import { friendlyError } from '@/lib/utils';
import { MOODS } from '@/lib/moods';

export function PostComposer({ meId, name, defaultMood, allowTop = true, onPosted }: { meId: string; name: string; defaultMood?: string | null; allowTop?: boolean; onPosted?: () => void }) {
  const [body, setBody] = useState('');
  const [mood, setMood] = useState(defaultMood || '');
  const [visibility, setVisibility] = useState('friends');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && !files.length) { setErr('Write something or add a photo.'); return; }
    setBusy(true); setErr('');
    try {
      const media = [];
      for (const f of files) media.push({ url: await uploadImage(meId, f, 'posts'), alt: '' });
      const { error } = await createClient().from('posts').insert({
        author_id: meId, kind: media.length ? 'photo' : 'status', body: body.trim() || null, mood: mood || null, visibility, media,
      });
      if (error) throw error;
      setBody(''); setFiles([]); if (fileRef.current) fileRef.current.value = '';
      onPosted?.(); router.refresh();
    } catch (e) { setErr(e instanceof Error && e.message.startsWith('Upload') ? e.message : friendlyError(e)); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="panel-hard flex flex-col gap-3 p-4" aria-label="Post a status">
      <label htmlFor="compose" className="font-display text-[22px] font-extrabold">What&apos;s up, {name}?</label>
      <textarea id="compose" rows={2} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="status, thought, song stuck in your head…" className="field resize-y" />
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Photos to post">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 border-2 border-line px-2 py-1 text-sm">{f.name.slice(0, 24)}
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="px-1 text-dim hover:text-fg">×</button></li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="sr-only" htmlFor="c-mood">Mood</label>
        <select id="c-mood" value={mood} onChange={(e) => setMood(e.target.value)} className="field w-auto">
          <option value="">no mood</option>{MOODS.map((m) => <option key={m.label} value={m.label}>{m.label}</option>)}
        </select>
        <label className="sr-only" htmlFor="c-vis">Who can see this</label>
        <select id="c-vis" value={visibility} onChange={(e) => setVisibility(e.target.value)} className="field w-auto">
          <option value="friends">Friends</option>{allowTop && <option value="top">Top Friends only</option>}<option value="public">Public</option>
        </select>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="sr-only" id="c-photo"
          onChange={(e) => setFiles([...files, ...Array.from(e.target.files || [])].slice(0, 4))} />
        <label htmlFor="c-photo" className="btn-ghost btn-sm cursor-pointer">+ Photo</label>
        <button type="submit" disabled={busy} className="btn-pink ml-auto">{busy ? 'Posting…' : 'Post'}</button>
      </div>
      {err && <p role="alert" className="text-sm text-[#FF8A8A]">{err}</p>}
    </form>
  );
}
