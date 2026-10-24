import { newId } from './backend';
import { clear, get, put, remove } from './blobs';

/**
 * Pictures of pages and receipts, kept on this device only. They are never uploaded. The words
 * read from them are kept with the item, which is what follows an account to a new phone.
 */

export async function savePhoto(blob: Blob): Promise<string> {
  const id = newId();
  await put('photos', id, blob);
  return id;
}

export const loadPhoto = (id: string) => get('photos', id);
export const removePhoto = (id: string) => remove('photos', id);
export const clearPhotos = () => clear('photos');

/** Shrinks a photo before keeping it: a long side of 2000 pixels is plenty to read and to recognise text. */
export async function shrink(file: Blob, longSide = 2000): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, longSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.85));
  } catch {
    return file;
  }
}

/** A small copy of a picture as text, for sending inside a supporter link. */
export async function smallDataUrl(blob: Blob, longSide = 900, quality = 0.7): Promise<string | undefined> {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, longSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return undefined;
  }
}
