'use server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { holdFiles } from '@/lib/sentinel';

type Found = { target_type: string; target_id: string; label: string };

/** What a pasted SignedOn link (or picture address) points to. */
function parseLink(raw: string): { kind: string; key: string; key2?: string } | null {
  let u: URL; try { u = new URL(raw.trim()); } catch { return null; }
  if (u.pathname.includes('/storage/v1/object/public/media/')) return { kind: 'image', key: u.origin + u.pathname };
  const p = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (p[0] === 'post' && p[1]) return { kind: 'post', key: p[1] };
  if (p[0] === 'blog' && p[1] && p[2]) return { kind: 'blog', key: p[1], key2: p[2] };
  if (p[0] === 'u' && p[1]) return { kind: 'profile', key: p[1] };
  return null;
}

/**
 * Takedown: actually removes what the request is about. Finds the content from the link, hides it (kept as
 * evidence, never destroyed), moves its picture files out of public storage, checks it's really gone, and only
 * then closes the request.
 */
export async function takedownRemove(id: string, link: string, pick?: { type: string; id: string }, note?: string):
  Promise<{ ok?: string; choose?: Found[]; error?: string }> {
  const supabase = await createClient();
  let target = pick;
  if (!target) {
    const l = parseLink(link);
    if (!l) return { error: 'Paste a SignedOn link (a post, a profile, a blog post) or a picture’s address.' };
    const { data, error } = await supabase.rpc('mod_find_content', { p_kind: l.kind, p_key: l.key, p_key2: l.key2 ?? null });
    if (error) return { error: error.message.includes('NOT_ALLOWED') ? 'Moderators only.' : 'Couldn’t look that up.' };
    const found = (data || []) as Found[];
    if (!found.length) return { error: 'Nothing on SignedOn matches that link. It may already be gone.' };
    if (found.length > 1) return { choose: found };
    target = { type: found[0].target_type, id: found[0].target_id };
  }
  const { data: res, error } = await supabase.rpc('mod_takedown_remove', { p_id: id, p_target_type: target.type, p_target_id: target.id, p_note: note || null });
  if (error) return { error: error.message.includes('NOT_FOUND') ? 'That content is already gone or hidden.' : error.message.includes('NOT_ALLOWED') ? 'Moderators only.' : 'Couldn’t remove it.' };
  const images = ((res as { images?: string[] })?.images || []).filter((u) => u.includes('/storage/v1/object/public/media/'));
  const admin = createAdminClient();
  const moved = images.length ? await holdFiles(admin, images, `takedown-${id}`) : 0;
  // check the files are really off public storage
  let stillPublic = 0;
  for (const u of images) {
    const path = u.split('/storage/v1/object/public/media/')[1];
    const { data } = await admin.storage.from('media').download(path);
    if (data) stillPublic++;
  }
  if (stillPublic) return { error: `Hidden from the site, but ${stillPublic} picture file(s) couldn’t be moved off public storage. Try again.` };
  return { ok: `Removed (${target.type}). ${moved ? `${moved} picture file(s) moved to private evidence storage. ` : ''}Request closed.` };
}
