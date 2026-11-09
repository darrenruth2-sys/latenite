'use client';
/**
 * Resizes an image in the browser and re-encodes it as WebP. This also strips EXIF data
 * (GPS location etc.) before anything is uploaded.
 */
export async function prepareImage(file: File, maxSize = 1600, quality = 0.86): Promise<Blob> {
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) throw new Error('Use a PNG, JPG, WebP or GIF image.');
  if (file.size > 15 * 1024 * 1024) throw new Error('That image is over 15 MB.');
  if (file.type === 'image/gif' && file.size < 4 * 1024 * 1024) return file; // keep small GIFs animated
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not process image'))), 'image/webp', quality));
}

export function randomId() {
  return (crypto.randomUUID?.() || Math.random().toString(36).slice(2)) as string;
}
