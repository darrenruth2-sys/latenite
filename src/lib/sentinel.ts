import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Sentinel: automatic screening of new content with OpenAI's free moderation model (text + images).
 * Anything clearly against the rules is hidden (never destroyed) and lands in the moderator queue.
 * Does nothing until OPENAI_API_KEY is set.
 */
type Item = { qid: number; target_type: string; target_id: string; owner_id: string | null;
  content: { text?: string; images?: string[]; private_images?: string[] } | null };
type Verdict = { flagged: boolean; categories: string[]; error?: string };

const BASE = () => (process.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/$/, '');
export const sentinelConfigured = () => !!process.env.OPENAI_API_KEY;

async function moderate(input: unknown): Promise<Verdict> {
  const res = await fetch(BASE() + '/v1/moderations', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'omni-moderation-latest', input }),
  });
  if (!res.ok) throw new Error(`moderation ${res.status}`);
  const j = (await res.json()) as { results?: { flagged: boolean; categories: Record<string, boolean> }[] };
  const cats = new Set<string>(); let flagged = false;
  for (const r of j.results || []) {
    if (r.flagged) flagged = true;
    for (const [k, v] of Object.entries(r.categories || {})) if (v) cats.add(k);
  }
  return { flagged, categories: [...cats] };
}

/** Text in one call, each picture in its own call (the model takes one image at a time). */
async function check(item: Item, admin: ReturnType<typeof createAdminClient>): Promise<Verdict> {
  const c = item.content || {};
  const verdicts: Verdict[] = [];
  const text = (c.text || '').trim().slice(0, 8000);
  if (text) verdicts.push(await moderate(text));
  const images = (c.images || []).filter((u) => /^https?:\/\//.test(u)).slice(0, 4);
  for (const url of images) verdicts.push(await moderate([{ type: 'image_url', image_url: { url } }]));
  for (const path of (c.private_images || []).slice(0, 2)) {
    const { data } = await admin.storage.from('private-media').createSignedUrl(path, 300);
    if (data?.signedUrl) verdicts.push(await moderate([{ type: 'image_url', image_url: { url: data.signedUrl } }]));
  }
  const categories = [...new Set(verdicts.flatMap((v) => v.categories))];
  return { flagged: verdicts.some((v) => v.flagged), categories };
}

/** Moves public pictures out of the public bucket into private evidence storage (kept for law enforcement). */
export async function holdFiles(admin: ReturnType<typeof createAdminClient>, urls: string[], prefix: string) {
  let moved = 0;
  for (const url of urls) {
    const path = url.split('/storage/v1/object/public/media/')[1];
    if (!path || path.includes('..')) continue;
    const { data: blob } = await admin.storage.from('media').download(path);
    if (!blob) continue;
    const up = await admin.storage.from('private-media').upload(`legal-holds/${prefix}/${path}`, blob, { upsert: true, contentType: blob.type || undefined });
    if (up.error) continue;
    const rm = await admin.storage.from('media').remove([path]);
    if (!rm.error) moved++;
  }
  return moved;
}

/**
 * Works through the queue: batches of `limit`, 5 at a time, until it's empty or ~40 seconds have passed
 * (so one call keeps up even when lots of people post at once). Safe to call from anywhere; does nothing without a key.
 */
export async function runSentinel(limit = 20, budgetMs = 40000) {
  if (!sentinelConfigured()) return { configured: false, checked: 0, hidden: 0 };
  const admin = createAdminClient();
  const start = Date.now();
  let checked = 0, hidden = 0;
  const one = async (item: Item) => {
    let v: Verdict;
    try { v = await check(item, admin); } catch (e) { console.error('[sentinel]', item.target_type, item.target_id, e); return; } // retried after 5 min
    const { data: action } = await admin.rpc('sentinel_result', { p_qid: item.qid, p_flagged: v.flagged, p_categories: v.categories, p_detail: null });
    checked++;
    if (action === 'hidden') {
      hidden++;
      // Suspected child exploitation: get the picture files themselves off the public internet right away.
      if (v.categories.includes('sexual/minors')) await holdFiles(admin, item.content?.images || [], `sentinel-${item.qid}`);
    }
  };
  while (Date.now() - start < budgetMs) {
    const { data, error } = await admin.rpc('sentinel_claim', { p_limit: limit });
    if (error) throw new Error(error.message);
    const batch = (data || []) as Item[];
    if (!batch.length) break;
    for (let i = 0; i < batch.length; i += 5) await Promise.all(batch.slice(i, i + 5).map(one));
  }
  return { configured: true, checked, hidden };
}

let last = 0;
/** Cheap "run soon" used on page loads: at most once every 15 seconds per server instance. */
export async function nudgeSentinel() {
  if (!sentinelConfigured() || Date.now() - last < 15000) return;
  last = Date.now();
  await runSentinel().catch((e) => console.error('[sentinel]', e));
}
