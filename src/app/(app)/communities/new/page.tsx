'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/utils';

export default function NewCommunity() {
  const [name, setName] = useState(''); const [slug, setSlug] = useState(''); const [touched, setTouched] = useState(false);
  const [desc, setDesc] = useState(''); const [pub, setPub] = useState(true); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const router = useRouter();
  const auto = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
  const s = touched ? slug : auto;
  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (name.trim().length < 3) return setErr('Name needs at least 3 characters.');
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) || s.length < 3) return setErr('Link needs 3–30 lowercase letters, numbers or dashes.');
    setBusy(true);
    const { error } = await createClient().rpc('create_community', { p_slug: s, p_name: name.trim(), p_description: desc.trim(), p_public: pub });
    setBusy(false);
    if (error) setErr(/duplicate/.test(error.message) ? 'That link is taken. Try another.' : friendlyError(error)); else router.push(`/communities/${s}`);
  }
  return (
    <form onSubmit={create} className="mx-auto flex max-w-[620px] flex-col gap-4 px-4 py-8 sm:px-6">
      <h1 className="font-display text-4xl font-extrabold">Start a community</h1>
      <label className="flex flex-col gap-2"><span className="label">Name</span><input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required /></label>
      <label className="flex flex-col gap-2"><span className="label">Link</span>
        <div className="flex items-center border-2 border-line bg-ink focus-within:border-cyan"><span className="pl-3 text-dim">/communities/</span>
          <input className="min-h-11 flex-1 bg-transparent px-1 outline-none" value={s} onChange={(e) => { setTouched(true); setSlug(e.target.value.toLowerCase()); }} maxLength={30} /></div></label>
      <label className="flex flex-col gap-2"><span className="label">What&apos;s it about?</span><textarea className="field" rows={3} maxLength={500} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
      <fieldset className="flex flex-col gap-1"><legend className="label mb-2">Who can see it</legend>
        <label className="flex min-h-10 items-center gap-3"><input type="radio" checked={pub} onChange={() => setPub(true)} className="h-4 w-4 accent-pink" />Public — anyone can find and join</label>
        <label className="flex min-h-10 items-center gap-3"><input type="radio" checked={!pub} onChange={() => setPub(false)} className="h-4 w-4 accent-pink" />Private — members only; you add friends</label></fieldset>
      {err && <p role="alert" className="text-sm text-[#FF8A8A]">{err}</p>}
      <button className="btn-pink self-start" disabled={busy}>{busy ? 'Creating…' : 'Create community'}</button>
    </form>
  );
}
