'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { excerptOf, slugify } from '@/lib/blog';
import { friendlyError } from '@/lib/utils';

export type BlogInput = { id?: string; title: string; body: unknown; cover_url?: string | null; visibility: 'friends' | 'public' | 'private'; publish: boolean };

export async function saveBlogPost(input: BlogInput): Promise<{ id?: string; slug?: string; username?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Please log in again.' };
  const title = input.title.trim().slice(0, 140);
  if (!title) return { error: 'Give your post a title.' };
  if (!input.body || typeof input.body !== 'object' || (input.body as { type?: string }).type !== 'doc') return { error: 'That post couldn’t be read.' };
  if (JSON.stringify(input.body).length > 280_000) return { error: 'That post is too long. Try splitting it in two.' };
  if (!['friends', 'public', 'private'].includes(input.visibility)) return { error: 'Pick who can read it.' };
  const excerpt = excerptOf(input.body) || null;
  const { data: prof } = await supabase.from('profiles').select('username').eq('id', user.id).single();
  const fields = { title, body: input.body, excerpt, cover_url: input.cover_url || null, visibility: input.visibility, status: input.publish ? 'published' : 'draft' };
  if (input.id) {
    const { data, error } = await supabase.from('blog_posts').update(fields).eq('id', input.id).eq('author_id', user.id).select('id, slug').single();
    if (error) return { error: friendlyError(error) };
    revalidatePath(`/blog/${prof?.username}`);
    return { id: data.id, slug: data.slug, username: String(prof?.username) };
  }
  const base = slugify(title);
  for (let i = 0; i < 6; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const { data, error } = await supabase.from('blog_posts').insert({ ...fields, author_id: user.id, slug }).select('id, slug').single();
    if (!error) return { id: data.id, slug: data.slug, username: String(prof?.username) };
    if (!/duplicate key/.test(error.message)) return { error: friendlyError(error) };
  }
  return { error: 'Couldn’t pick a link for that title. Try changing it a little.' };
}

export async function deleteBlogPost(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('blog_posts').delete().eq('id', id);
  return error ? { error: friendlyError(error) } : { ok: true };
}
