import 'server-only';
import { generateHTML } from '@tiptap/html/server';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import sanitizeHtml from 'sanitize-html';

const STORAGE = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '') + '/storage/v1/object/public/media/';
function isStorageUrl(u: string) { return !!u && u.startsWith(STORAGE) && !u.includes('..') && !/[\s"'<>]/.test(u); }

/** Blog bodies are stored as Tiptap JSON and turned into HTML here, then sanitized again. */
export function renderBlogHtml(doc: unknown): string {
  let html = '';
  try { html = generateHTML(doc as Parameters<typeof generateHTML>[0], [StarterKit.configure({ link: false }), Link.configure({ openOnClick: false }), Image]); }
  catch { return '<p>This post couldn’t be displayed.</p>'; }
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'h2', 'h3', 'strong', 'em', 's', 'u', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'hr'],
    allowedAttributes: { a: ['href', 'rel', 'target'], img: ['src', 'alt'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedSchemesByTag: { img: ['https', 'http'] },
    transformTags: {
      a: (tag, attribs) => ({ tagName: 'a', attribs: { href: attribs.href, rel: 'nofollow noopener noreferrer ugc', target: '_blank' } }),
      img: (tag, attribs) => ({ tagName: 'img', attribs: { src: attribs.src, alt: attribs.alt || '', loading: 'lazy' } as Record<string, string> }),
    },
    // Pictures only from SignedOn uploads: no outside images (shock content, or trackers logging readers' IPs).
    exclusiveFilter: (frame) => frame.tag === 'img' && !isStorageUrl(frame.attribs.src || ''),
  });
}

export function slugify(title: string) {
  return title.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'post';
}

/** Plain text excerpt from the document (first ~240 chars). */
export function excerptOf(doc: unknown) {
  const out: string[] = [];
  const walk = (n: { text?: string; content?: unknown[] }) => { if (n.text) out.push(n.text); (n.content as typeof n[] | undefined)?.forEach(walk); };
  try { walk(doc as { content?: unknown[] }); } catch { /* ignore */ }
  const t = out.join(' ').replace(/\s+/g, ' ').trim();
  return t.length > 240 ? t.slice(0, 237).replace(/\s+\S*$/, '') + '…' : t;
}
