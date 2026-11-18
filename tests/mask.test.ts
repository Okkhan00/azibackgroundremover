import { describe, expect, it } from 'vitest';
import {
  blend,
  boxFilter,
  fitLongestSide,
  fitToPixelBudget,
  guidedFilter,
  maskCoverage,
  normalizeMask,
  preprocessToTensor,
  resizeBilinear,
  sharpenAlpha,
} from '../src/lib/mask';
import { baseName, cutoutName, isSupportedImage, uniqueName } from '../src/lib/names';
import { buildZip } from '../src/lib/zip';
import JSZip from 'jszip';

describe('preprocessToTensor', () => {
  it('produces CHW layout with rembg normalisation', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
    const t = preprocessToTensor(rgba, 2);
    expect(t.length).toBe(12);
    expect(t[0]).toBeCloseTo((1 - 0.485) / 0.229, 4); // pure red pixel, red plane
    expect(t[4 + 1]).toBeCloseTo((1 - 0.456) / 0.224, 4); // green pixel, green plane
    expect(t[8 + 2]).toBeCloseTo((1 - 0.406) / 0.225, 4); // blue pixel, blue plane
  });
});

describe('normalizeMask', () => {
  it('maps min..max to 0..1', () => {
    const m = normalizeMask(new Float32Array([2, 4, 6]));
    expect(Array.from(m)).toEqual([0, 0.5, 1]);
  });
  it('returns zeros for flat output', () => {
    expect(Array.from(normalizeMask(new Float32Array([3, 3, 3])))).toEqual([0, 0, 0]);
  });
});

describe('resizeBilinear', () => {
  it('keeps constants and size', () => {
    const r = resizeBilinear(new Float32Array(16).fill(0.7), 4, 4, 9, 7);
    expect(r.length).toBe(63);
    r.forEach((v) => expect(v).toBeCloseTo(0.7, 5));
  });
  it('is the identity at equal size', () => {
    const src = new Float32Array([0, 1, 2, 3]);
    expect(Array.from(resizeBilinear(src, 2, 2, 2, 2))).toEqual([0, 1, 2, 3]);
  });
  it('interpolates monotonically across a ramp', () => {
    const r = resizeBilinear(new Float32Array([0, 1]), 2, 1, 8, 1);
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThanOrEqual(r[i - 1]);
  });
});

describe('boxFilter', () => {
  it('averages a window and clamps at borders', () => {
    const r = boxFilter(new Float32Array([0, 0, 9, 0, 0]), 5, 1, 1);
    expect(r[2]).toBeCloseTo(3, 5);
    expect(r[0]).toBeCloseTo(0, 5);
    expect(r[1]).toBeCloseTo(3, 5);
  });
  it('preserves a constant image', () => {
    boxFilter(new Float32Array(30).fill(2), 6, 5, 2).forEach((v) => expect(v).toBeCloseTo(2, 5));
  });
});

describe('guidedFilter', () => {
  it('moves a mis-positioned soft mask edge onto the guide edge', () => {
    const w = 64;
    const h = 8;
    const guide = new Float32Array(w * h);
    const soft = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        guide[y * w + x] = x < 32 ? 0.1 : 0.9; // crisp image edge at x=32
        soft[y * w + x] = Math.min(1, Math.max(0, (x - 28) / 16)); // blurry mask, 0.5 crossing at x=36
      }
    const out = guidedFilter(guide, soft, w, h, 5, 1e-3);
    const crossing = (a: Float32Array) => {
      const row = 4 * w;
      for (let x = 0; x < w; x++) if (a[row + x] >= 0.5) return x;
      return -1;
    };
    expect(crossing(soft)).toBe(36);
    expect(Math.abs(crossing(out) - 32)).toBeLessThan(Math.abs(crossing(soft) - 32));
  });
  it('stays within [0,1]', () => {
    const g = new Float32Array(100).map((_, i) => (i % 7) / 7);
    const p = new Float32Array(100).map((_, i) => (i % 3) / 3);
    guidedFilter(g, p, 10, 10, 2, 1e-3).forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });
});

describe('alpha helpers', () => {
  it('sharpenAlpha k=1 is identity and k>1 steepens', () => {
    expect(sharpenAlpha(new Float32Array([0.25]), 1)[0]).toBeCloseTo(0.25, 6);
    expect(sharpenAlpha(new Float32Array([0.25]), 2)[0]).toBeCloseTo(0, 6);
    expect(sharpenAlpha(new Float32Array([0.75]), 1.5)[0]).toBeCloseTo(0.875, 6);
  });
  it('blend interpolates', () => {
    expect(blend(new Float32Array([0]), new Float32Array([1]), 0.25)[0]).toBeCloseTo(0.25, 6);
  });
  it('maskCoverage reports foreground and background fractions', () => {
    const c = maskCoverage(new Float32Array([1, 1, 0, 0, 0.3]));
    expect(c.foreground).toBeCloseTo(0.4, 6);
    expect(c.background).toBeCloseTo(0.4, 6);
  });
});

describe('size helpers', () => {
  it('never scales when within budget', () => {
    expect(fitToPixelBudget(1000, 800, 2_000_000)).toEqual({ width: 1000, height: 800, scaled: false });
  });
  it('scales down to the pixel budget keeping aspect', () => {
    const r = fitToPixelBudget(8000, 6000, 12_000_000);
    expect(r.scaled).toBe(true);
    expect(r.width * r.height).toBeLessThanOrEqual(12_000_000);
    expect(Math.abs(r.width / r.height - 8000 / 6000)).toBeLessThan(0.01);
  });
  it('fitLongestSide limits the long edge only', () => {
    expect(fitLongestSide(3000, 1500, 1500)).toEqual({ width: 1500, height: 750 });
    expect(fitLongestSide(800, 600, 1500)).toEqual({ width: 800, height: 600 });
  });
});

describe('file naming', () => {
  it('accepts jpg/jpeg/png/webp only', () => {
    expect(isSupportedImage({ name: 'a.JPG', type: '' })).toBe(true);
    expect(isSupportedImage({ name: 'a.webp', type: 'image/webp' })).toBe(true);
    expect(isSupportedImage({ name: 'a.gif', type: 'image/gif' })).toBe(false);
    expect(isSupportedImage({ name: 'a.pdf', type: 'application/pdf' })).toBe(false);
  });
  it('builds safe output names', () => {
    expect(baseName('my:photo?.jpeg')).toBe('my_photo_');
    expect(cutoutName('cat.jpg')).toBe('cat-no-bg.png');
  });
  it('deduplicates names', () => {
    const used = new Set<string>();
    expect(uniqueName('a.png', used)).toBe('a.png');
    expect(uniqueName('a.png', used)).toBe('a (2).png');
    expect(uniqueName('a.png', used)).toBe('a (3).png');
  });
});

describe('buildZip', () => {
  it('packs every PNG with unique names and intact bytes', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
    const blob = await buildZip([
      { name: 'dog.jpg', png: new Blob([bytes]) },
      { name: 'dog.png', png: new Blob([bytes]) },
    ]);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual(['dog-no-bg (2).png', 'dog-no-bg.png']);
    const back = await zip.file('dog-no-bg.png')!.async('uint8array');
    expect(Array.from(back)).toEqual(Array.from(bytes));
  });
});
