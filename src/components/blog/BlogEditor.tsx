'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { saveBlogPost, deleteBlogPost } from '@/app/actions/blog';
import { uploadImage } from '@/lib/upload';

type Initial = { id?: string; title: string; body: unknown; cover_url: string | null; visibility: 'friends' | 'public' | 'private'; status: string; slug?: string };

function Tool({ on, label, onClick, children }: { on?: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} aria-pressed={on} title={label} onMouseDown={(e) => e.preventDefault()} onClick={onClick}
    className={`flex h-10 min-w-10 items-center justify-center border-2 px-2 text-sm font-bold ${on ? 'border-cyan bg-cyan text-ink' : 'border-line text-fg hover:border-cyan'}`}>{children}</button>;
}

function Toolbar({ editor, meId, onErr }: { editor: Editor; meId: string; onErr: (s: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function addImage(f?: File) {
    if (!f) return; setBusy(true);
    try { const url = await uploadImage(meId, f, 'blog', 'media', 1800); editor.chain().focus().setImage({ src: url, alt: '' }).run(); }
    catch (e) { onErr(e instanceof Error ? e.message : 'Upload failed'); } finally { setBusy(false); }
  }
  function link() {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = prompt('Link address (https://…)', prev || 'https://');
    if (url === null) return;
    if (!url.trim() || url === 'https://') { editor.chain().focus().unsetLink().run(); return; }
    if (!/^https?:\/\//.test(url)) { onErr('Links need to start with https://'); return; }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }
  return (
    <div role="toolbar" aria-label="Formatting" className="sticky top-[58px] z-10 flex flex-wrap gap-1.5 border-b-2 border-line bg-ink py-2">
      <Tool label="Bold" on={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>B</Tool>
      <Tool label="Italic" on={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Tool>
      <Tool label="Strikethrough" on={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></Tool>
      <Tool label="Heading" on={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Tool>
      <Tool label="Subheading" on={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Tool>
      <Tool label="Bullet list" on={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</Tool>
      <Tool label="Numbered list" on={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</Tool>
      <Tool label="Quote" on={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>“ ”</Tool>
      <Tool label="Link" on={editor.isActive('link')} onClick={link}>Link</Tool>
      <Tool label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>—</Tool>
      <label className="flex h-10 cursor-pointer items-center border-2 border-line px-2 text-sm font-bold hover:border-cyan">{busy ? '…' : 'Image'}
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => { addImage(e.target.files?.[0]); e.target.value = ''; }} /></label>
      <Tool label="Undo" onClick={() => editor.chain().focus().undo().run()}>↶</Tool>
      <Tool label="Redo" onClick={() => editor.chain().focus().redo().run()}>↷</Tool>
    </div>
  );
}

export function BlogEditor({ initial, meId, username }: { initial: Initial; meId: string; username: string }) {
  const [title, setTitle] = useState(initial.title);
  const [visibility, setVisibility] = useState(initial.visibility);
  const [cover, setCover] = useState(initial.cover_url);
  const [id, setId] = useState(initial.id);
  const [status, setStatus] = useState(initial.status);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [dirty, setDirty] = useState(false);
  const router = useRouter();
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: false }), Link.configure({ openOnClick: false, autolink: true, protocols: ['https', 'http'] }),
      Image, Placeholder.configure({ placeholder: 'Tell your story. Poetry, 2am thoughts, the whole saga…' })],
    content: (initial.body as object) || '',
    editorProps: { attributes: { class: 'prose-ah min-h-[50vh] outline-none py-4', 'aria-label': 'Post body', role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: () => setDirty(true),
  });
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  async function save(publish: boolean) {
    if (!editor) return;
    setBusy(publish ? 'publish' : 'draft'); setMsg({});
    const r = await saveBlogPost({ id, title, body: editor.getJSON(), cover_url: cover, visibility, publish });
    setBusy(null);
    if (r.error) { setMsg({ error: r.error }); return; }
    setDirty(false); setId(r.id); setStatus(publish ? 'published' : 'draft');
    if (publish) router.push(`/blog/${r.username}/${r.slug}`);
    else { setMsg({ ok: 'Draft saved.' }); if (!id) router.replace(`/blog/edit/${r.id}`); }
  }
  async function remove() {
    if (!id || !confirm('Delete this post for good?')) return;
    const r = await deleteBlogPost(id);
    if (r.error) setMsg({ error: r.error }); else { setDirty(false); router.push(`/blog/${username}`); }
  }
  async function uploadCover(f?: File) {
    if (!f) return; setBusy('cover');
    try { setCover(await uploadImage(meId, f, 'blog', 'media', 2000)); setDirty(true); } catch (e) { setMsg({ error: e instanceof Error ? e.message : 'Upload failed' }); } finally { setBusy(null); }
  }
  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="pixel text-xl text-violet">{status === 'published' ? '> EDITING A PUBLISHED POST' : '> NEW BLOG POST · DRAFT'}</p>
        <a href={`/blog/${username}`} className="link text-sm">My blog</a>
      </div>
      {cover ? (
        <div className="relative h-48 border-2 border-fg" style={{ background: `center/cover url("${cover}")` }}>
          <button type="button" onClick={() => { setCover(null); setDirty(true); }} className="btn-ghost btn-sm absolute right-2 top-2 bg-ink">Remove cover</button>
        </div>
      ) : (
        <label className="btn-ghost btn-sm cursor-pointer self-start">{busy === 'cover' ? 'Uploading…' : '+ Cover image'}<input type="file" accept="image/*" className="sr-only" onChange={(e) => uploadCover(e.target.files?.[0])} /></label>
      )}
      <label htmlFor="bt" className="sr-only">Title</label>
      <input id="bt" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} maxLength={140} placeholder="Title"
        className="w-full bg-transparent font-serif text-[clamp(32px,5vw,48px)] font-extrabold leading-tight outline-none placeholder:text-line" />
      {editor ? <><Toolbar editor={editor} meId={meId} onErr={(e) => setMsg({ error: e })} /><EditorContent editor={editor} /></> : <p className="text-dim">Loading editor…</p>}
      <div className="sticky bottom-16 z-10 flex flex-wrap items-center gap-2.5 border-2 border-fg bg-panel p-3 md:bottom-3">
        <label htmlFor="bv" className="sr-only">Who can read it</label>
        <select id="bv" value={visibility} onChange={(e) => { setVisibility(e.target.value as Initial['visibility']); setDirty(true); }} className="field w-auto min-h-10">
          <option value="friends">Friends can read</option><option value="public">Anyone can read</option><option value="private">Only me (private journal)</option>
        </select>
        <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => save(false)}>{busy === 'draft' ? 'Saving…' : status === 'published' ? 'Unpublish to draft' : 'Save draft'}</button>
        <button type="button" className="btn-pink" disabled={!!busy} onClick={() => save(true)}>{busy === 'publish' ? 'Publishing…' : status === 'published' ? 'Update post' : 'Publish'}</button>
        {id && <button type="button" className="ml-auto text-sm text-dim hover:text-fg" onClick={remove}>Delete</button>}
        {msg.ok && <span role="status" className="w-full text-sm text-lime">{msg.ok}</span>}
        {msg.error && <span role="alert" className="w-full text-sm text-[#FF8A8A]">{msg.error}</span>}
      </div>
    </div>
  );
}
