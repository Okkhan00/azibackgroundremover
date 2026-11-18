import { MODELS } from './models';
import { segmenter } from './segmenter';
import { canvasToPngBlob, createCanvas, decodeImage, releaseCanvas } from './image';
import {
  blend,
  fitLongestSide,
  guidedFilter,
  luminance,
  maskCoverage,
  normalizeMask,
  preprocessToTensor,
  resizeBilinear,
  sharpenAlpha,
} from './mask';
import type { Settings } from './settings';

export interface RemoveResult {
  png: Blob;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  downscaled: boolean;
  modelId: string;
  ms: number;
}

export type ProgressFn = (percent: number, stage: string) => void;

const REFINE_MAX_SIDE = 1536;

/**
 * Full pipeline: decode -> AI segmentation -> edge refinement -> transparent PNG at working resolution.
 * Throws a human-readable Error when anything fails. Never returns the unchanged input.
 */
export async function removeBackground(file: File | Blob, settings: Settings, onProgress: ProgressFn, fileName?: string): Promise<RemoveResult> {
  const t0 = performance.now();
  const model = MODELS[settings.model];
  const S = model.inputSize;

  onProgress(3, 'Reading image');
  const img = await decodeImage(file, settings.maxMegapixels * 1_000_000, fileName);
  const { canvas, width: W, height: H } = img;

  try {
    // 1. Load the model (lazy, cached after first use).
    if (!segmenter.isLoaded(model.id)) {
      onProgress(6, 'Preparing AI model');
      await segmenter.load(model, (loaded, total) => {
        onProgress(6 + Math.round((loaded / total) * 34), `Downloading AI model ${Math.round((loaded / total) * 100)}%`);
      });
    }

    // 2. Run segmentation on a model-sized copy.
    onProgress(44, 'Detecting subject');
    const small = createCanvas(S, S);
    const sctx = small.getContext('2d', { willReadFrequently: true });
    if (!sctx) throw new Error('Could not allocate a canvas for the AI input.');
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(canvas, 0, 0, S, S);
    const tensor = preprocessToTensor(sctx.getImageData(0, 0, S, S).data, S);
    releaseCanvas(small);

    const raw = await segmenter.run(tensor);
    if (raw.length < S * S) throw new Error('The AI model returned an unexpected result.');
    const coarse = normalizeMask(raw.subarray(0, S * S));

    // 3. Upscale + refine the mask at a bounded resolution, then scale to full size.
    onProgress(62, 'Refining edges');
    const ref = fitLongestSide(W, H, REFINE_MAX_SIDE);
    let alpha = resizeBilinear(coarse, S, S, ref.width, ref.height);

    if (settings.refineEdges) {
      const rc = createCanvas(ref.width, ref.height);
      const rctx = rc.getContext('2d', { willReadFrequently: true });
      if (!rctx) throw new Error('Could not allocate a canvas for edge refinement.');
      rctx.imageSmoothingQuality = 'high';
      rctx.drawImage(canvas, 0, 0, ref.width, ref.height);
      const guide = luminance(rctx.getImageData(0, 0, ref.width, ref.height).data, ref.width * ref.height);
      releaseCanvas(rc);
      const radius = Math.max(3, Math.round(Math.max(ref.width, ref.height) * 0.008));
      const refined = guidedFilter(guide, alpha, ref.width, ref.height, radius, 1e-3);
      alpha = blend(alpha, refined, 0.85);
    }
    alpha = sharpenAlpha(alpha, settings.edgeSharpness);

    const cov = maskCoverage(alpha);
    if (cov.foreground > 0.995) {
      throw new Error('The whole picture looks like foreground, so nothing was removed. Try the other AI model in Settings or a photo with a clearer subject.');
    }
    if (cov.foreground < 0.002) {
      throw new Error('No clear subject was detected in this image. Try the other AI model in Settings or a photo with a more distinct subject.');
    }

    // 4. Apply alpha at full resolution.
    onProgress(80, 'Creating transparent PNG');
    const ac = createCanvas(ref.width, ref.height);
    const actx = ac.getContext('2d');
    if (!actx) throw new Error('Could not allocate a canvas for the mask.');
    const aImg = actx.createImageData(ref.width, ref.height);
    for (let i = 0, n = ref.width * ref.height; i < n; i++) {
      const v = Math.round(alpha[i] * 255);
      const o = i * 4;
      aImg.data[o] = v;
      aImg.data[o + 1] = v;
      aImg.data[o + 2] = v;
      aImg.data[o + 3] = 255;
    }
    actx.putImageData(aImg, 0, 0);

    let maskData: Uint8ClampedArray;
    if (ref.width === W && ref.height === H) {
      maskData = actx.getImageData(0, 0, W, H).data;
      releaseCanvas(ac);
    } else {
      const fc = createCanvas(W, H);
      const fctx = fc.getContext('2d', { willReadFrequently: true });
      if (!fctx) throw new Error('Could not allocate a full-size mask canvas.');
      fctx.imageSmoothingEnabled = true;
      fctx.imageSmoothingQuality = 'high';
      fctx.drawImage(ac, 0, 0, W, H);
      releaseCanvas(ac);
      maskData = fctx.getImageData(0, 0, W, H).data;
      releaseCanvas(fc);
    }

    const out = createCanvas(W, H);
    const octx = out.getContext('2d');
    if (!octx) throw new Error('Could not allocate the output canvas.');
    octx.drawImage(canvas, 0, 0);
    const pixels = octx.getImageData(0, 0, W, H);
    const d = pixels.data;
    for (let i = 0, n = W * H; i < n; i++) d[i * 4 + 3] = maskData[i * 4];
    octx.putImageData(pixels, 0, 0);

    onProgress(92, 'Encoding PNG');
    const png = await canvasToPngBlob(out);
    releaseCanvas(out);
    onProgress(100, 'Done');

    return {
      png,
      width: W,
      height: H,
      originalWidth: img.originalWidth,
      originalHeight: img.originalHeight,
      downscaled: img.downscaled,
      modelId: model.id,
      ms: Math.round(performance.now() - t0),
    };
  } finally {
    releaseCanvas(canvas);
  }
}
