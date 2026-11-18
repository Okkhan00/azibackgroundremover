import { fitToPixelBudget } from './mask';
import { isSupportedImage } from './names';

export type Canvas2D = HTMLCanvasElement;

export function createCanvas(w: number, h: number): Canvas2D {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function releaseCanvas(c: Canvas2D | null | undefined) {
  if (!c) return;
  c.width = 0;
  c.height = 0;
}

export interface DecodedImage {
  canvas: Canvas2D;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  downscaled: boolean;
}

async function decodeToBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // 'from-image' applies the EXIF rotation so phone photos are not sideways.
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // Safe: decode() has completed, pixels are already in memory.
    URL.revokeObjectURL(url);
  }
}

/** Decode a file into a canvas, downscaling only if it exceeds the pixel budget. */
export async function decodeImage(file: File | Blob, maxPixels: number, fileName = (file as File).name ?? 'image'): Promise<DecodedImage> {
  if (file instanceof File && !isSupportedImage(file)) {
    throw new Error('Unsupported file type. Please use JPG, JPEG, PNG or WEBP images.');
  }
  let src: ImageBitmap | HTMLImageElement;
  try {
    src = await decodeToBitmap(file);
  } catch {
    throw new Error(`"${fileName}" could not be opened. The file may be corrupted or not a real image.`);
  }
  const ow = 'naturalWidth' in src ? src.naturalWidth : src.width;
  const oh = 'naturalHeight' in src ? src.naturalHeight : src.height;
  if (!ow || !oh) throw new Error(`"${fileName}" has no readable pixels.`);
  const fit = fitToPixelBudget(ow, oh, maxPixels);
  const canvas = createCanvas(fit.width, fit.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not allocate an image canvas (out of memory?). Try a smaller image or lower the size limit in Settings.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, fit.width, fit.height);
  if ('close' in src) src.close();
  return { canvas, width: fit.width, height: fit.height, originalWidth: ow, originalHeight: oh, downscaled: fit.scaled };
}

export function canvasToPngBlob(canvas: Canvas2D): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed (image too large for this device). Lower the size limit in Settings.'))), 'image/png');
  });
}

export async function blobToBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

export type BackgroundSpec =
  | { kind: 'transparent' }
  | { kind: 'color'; color: string }
  | { kind: 'image'; image: ImageBitmap | HTMLImageElement };

/** Draw an image so it covers the target box (like CSS object-fit: cover). */
function drawCover(ctx: CanvasRenderingContext2D, img: ImageBitmap | HTMLImageElement, w: number, h: number) {
  const iw = 'naturalWidth' in img ? img.naturalWidth : img.width;
  const ih = 'naturalHeight' in img ? img.naturalHeight : img.height;
  const s = Math.max(w / iw, h / ih);
  const dw = iw * s;
  const dh = ih * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/** Composite the transparent cutout over a background at full resolution. */
export function composeOnBackground(cutout: ImageBitmap, bg: BackgroundSpec): Canvas2D {
  const w = cutout.width;
  const h = cutout.height;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not allocate an export canvas.');
  if (bg.kind === 'color') {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, w, h);
  } else if (bg.kind === 'image') {
    drawCover(ctx, bg.image, w, h);
  }
  ctx.drawImage(cutout, 0, 0);
  return canvas;
}

/** Small JPEG-free thumbnail (PNG keeps transparency) for lists and history. */
export async function makeThumbnail(blob: Blob, size = 240): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const s = Math.min(1, size / Math.max(bmp.width, bmp.height));
  const c = createCanvas(Math.max(1, Math.round(bmp.width * s)), Math.max(1, Math.round(bmp.height * s)));
  const ctx = c.getContext('2d');
  if (!ctx) {
    bmp.close();
    throw new Error('Could not create a thumbnail.');
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const out = await canvasToPngBlob(c);
  releaseCanvas(c);
  return out;
}
