/**
 * Get a visitor's photo ready to upload: check it's an image, then scale it
 * down and re-encode on the device so uploads stay small. Polaroid prints
 * are ~180 wall units wide, so 1200px is plenty even on large screens.
 */

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_EDGE = 1200;
const QUALITY = 0.85;

export class PhotoError extends Error {}

export async function preparePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new PhotoError('That file isn’t an image. Try a JPG or PNG.');
  if (file.size > MAX_FILE_BYTES) throw new PhotoError('That photo is over 10MB. Try a smaller one.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new PhotoError('We couldn’t open that photo. Try a JPG or PNG.');
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new PhotoError('We couldn’t process that photo.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) throw new PhotoError('We couldn’t process that photo.');
  return blob;
}
