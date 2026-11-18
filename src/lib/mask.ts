// Pure numeric helpers for the segmentation pipeline. No DOM access, so they are unit-testable in Node.

const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

/** RGBA pixels (size x size) -> CHW float tensor, using the U²-Net / rembg normalisation. */
export function preprocessToTensor(rgba: Uint8ClampedArray, size: number): Float32Array {
  const n = size * size;
  let max = 1;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (rgba[o] > max) max = rgba[o];
    if (rgba[o + 1] > max) max = rgba[o + 1];
    if (rgba[o + 2] > max) max = rgba[o + 2];
  }
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    out[i] = (rgba[o] / max - MEAN[0]) / STD[0];
    out[n + i] = (rgba[o + 1] / max - MEAN[1]) / STD[1];
    out[2 * n + i] = (rgba[o + 2] / max - MEAN[2]) / STD[2];
  }
  return out;
}

/** Min-max normalise a model output to [0,1]. */
export function normalizeMask(m: Float32Array): Float32Array {
  let mn = Infinity;
  let mx = -Infinity;
  for (let i = 0; i < m.length; i++) {
    const v = m[i];
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const out = new Float32Array(m.length);
  const range = mx - mn;
  if (!(range > 1e-8)) return out; // flat output: nothing detected
  for (let i = 0; i < m.length; i++) out[i] = (m[i] - mn) / range;
  return out;
}

/** Bilinear resize with half-pixel centres (same convention as canvas drawImage). */
export function resizeBilinear(src: Float32Array, sw: number, sh: number, dw: number, dh: number): Float32Array {
  if (sw === dw && sh === dh) return src.slice();
  const dst = new Float32Array(dw * dh);
  const xs = sw / dw;
  const ys = sh / dh;
  const x0s = new Int32Array(dw);
  const x1s = new Int32Array(dw);
  const fxs = new Float32Array(dw);
  for (let x = 0; x < dw; x++) {
    const fx = Math.min(Math.max((x + 0.5) * xs - 0.5, 0), sw - 1);
    const x0 = Math.floor(fx);
    x0s[x] = x0;
    x1s[x] = Math.min(x0 + 1, sw - 1);
    fxs[x] = fx - x0;
  }
  for (let y = 0; y < dh; y++) {
    const fy = Math.min(Math.max((y + 0.5) * ys - 0.5, 0), sh - 1);
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, sh - 1);
    const wy = fy - y0;
    const r0 = y0 * sw;
    const r1 = y1 * sw;
    const ro = y * dw;
    for (let x = 0; x < dw; x++) {
      const wx = fxs[x];
      const a = src[r0 + x0s[x]] * (1 - wx) + src[r0 + x1s[x]] * wx;
      const b = src[r1 + x0s[x]] * (1 - wx) + src[r1 + x1s[x]] * wx;
      dst[ro + x] = a * (1 - wy) + b * wy;
    }
  }
  return dst;
}

/** Mean filter with a (2r+1) window, clamped at the borders. O(N) via running sums. */
export function boxFilter(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const dst = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = 0; x <= Math.min(r, w - 1); x++) sum += src[row + x];
    for (let x = 0; x < w; x++) {
      const lo = Math.max(x - r, 0);
      const hi = Math.min(x + r, w - 1);
      tmp[row + x] = sum / (hi - lo + 1);
      if (x + r + 1 < w) sum += src[row + x + r + 1];
      if (x - r >= 0) sum -= src[row + x - r];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y <= Math.min(r, h - 1); y++) sum += tmp[y * w + x];
    for (let y = 0; y < h; y++) {
      const lo = Math.max(y - r, 0);
      const hi = Math.min(y + r, h - 1);
      dst[y * w + x] = sum / (hi - lo + 1);
      if (y + r + 1 < h) sum += tmp[(y + r + 1) * w + x];
      if (y - r >= 0) sum -= tmp[(y - r) * w + x];
    }
  }
  return dst;
}

/**
 * Guided filter (He et al.). Snaps a soft mask `p` to the edges of the grayscale guide `I`.
 * This is what recovers hair strands and sharp outlines from the model's low-resolution mask.
 */
export function guidedFilter(I: Float32Array, p: Float32Array, w: number, h: number, r: number, eps: number): Float32Array {
  const n = w * h;
  const Ip = new Float32Array(n);
  const II = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    Ip[i] = I[i] * p[i];
    II[i] = I[i] * I[i];
  }
  const meanI = boxFilter(I, w, h, r);
  const meanP = boxFilter(p, w, h, r);
  const corrIp = boxFilter(Ip, w, h, r);
  const corrII = boxFilter(II, w, h, r);
  const a = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const varI = corrII[i] - meanI[i] * meanI[i];
    const covIp = corrIp[i] - meanI[i] * meanP[i];
    a[i] = covIp / (varI + eps);
    b[i] = meanP[i] - a[i] * meanI[i];
  }
  const meanA = boxFilter(a, w, h, r);
  const meanB = boxFilter(b, w, h, r);
  const q = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = meanA[i] * I[i] + meanB[i];
    q[i] = v < 0 ? 0 : v > 1 ? 1 : v;
  }
  return q;
}

/** Linear blend of two equally sized arrays: out = a*(1-t) + b*t. */
export function blend(a: Float32Array, b: Float32Array, t: number): Float32Array {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] * (1 - t) + b[i] * t;
  return out;
}

/** Steepen the alpha transition around 0.5 (k=1 leaves it unchanged). */
export function sharpenAlpha(a: Float32Array, k: number): Float32Array {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    const v = 0.5 + (a[i] - 0.5) * k;
    out[i] = v < 0 ? 0 : v > 1 ? 1 : v;
  }
  return out;
}

/** Fraction of pixels that are clearly foreground (>0.5) and clearly background (<0.05). */
export function maskCoverage(a: Float32Array): { foreground: number; background: number } {
  let fg = 0;
  let bg = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] > 0.5) fg++;
    if (a[i] < 0.05) bg++;
  }
  return { foreground: fg / a.length, background: bg / a.length };
}

/** Luminance (0..1) from RGBA bytes. */
export function luminance(rgba: Uint8ClampedArray, n: number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    out[i] = (0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2]) / 255;
  }
  return out;
}

/** Size that fits inside `maxPixels` while keeping the aspect ratio. Never upscales. */
export function fitToPixelBudget(w: number, h: number, maxPixels: number): { width: number; height: number; scaled: boolean } {
  if (w * h <= maxPixels) return { width: w, height: h, scaled: false };
  const s = Math.sqrt(maxPixels / (w * h));
  return { width: Math.max(1, Math.floor(w * s)), height: Math.max(1, Math.floor(h * s)), scaled: true };
}

/** Size whose longest side is at most `maxSide`. Never upscales. */
export function fitLongestSide(w: number, h: number, maxSide: number): { width: number; height: number } {
  const longest = Math.max(w, h);
  if (longest <= maxSide) return { width: w, height: h };
  const s = maxSide / longest;
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}
