'use client';
import { createClient } from '@/lib/supabase/client';
import { prepareImage, randomId } from '@/lib/images';

/** Uploads an image into `bucket/<userId>/<folder>/...` and returns its public URL. */
export async function uploadImage(userId: string, file: File, folder: string, bucket = 'media', maxSize = 1600) {
  const blob = await prepareImage(file, maxSize);
  const ext = blob.type === 'image/gif' ? 'gif' : 'webp';
  const path = `${userId}/${folder}/${randomId()}.${ext}`;
  const sb = createClient();
  const { error } = await sb.storage.from(bucket).upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: '31536000' });
  if (error) throw new Error('Upload failed: ' + error.message);
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
