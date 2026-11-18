// Registry of the AI models. All files are served from this app's own origin (public/models),
// so no photo and no model request ever goes to a third-party server.

export type ModelId = 'quality' | 'fast';

export interface ModelDef {
  id: ModelId;
  name: string;
  description: string;
  /** File parts, relative to the app base URL. Parts are concatenated in order. */
  parts: string[];
  bytes: number;
  sha256: string;
  inputSize: number;
  license: string;
  source: string;
}

export const MODELS: Record<ModelId, ModelDef> = {
  quality: {
    id: 'quality',
    name: 'Quality (Silueta)',
    description: 'Best edges and fewest missed limbs. 44 MB, downloaded once and cached.',
    parts: ['models/silueta.part0.bin', 'models/silueta.part1.bin', 'models/silueta.part2.bin'],
    bytes: 44173029,
    sha256: '75da6c8d2f8096ec743d071951be73b4a8bc7b3e51d9a6625d63644f90ffeedb',
    inputSize: 320,
    license: 'Derived from U²-Net (Apache-2.0). Reduced-size weights distributed via rembg (MIT); no separate weight license is published, so confirm before commercial use.',
    source: 'https://github.com/xuebinqin/U-2-Net/issues/295 (weights: github.com/danielgatis/rembg/releases/tag/v0.0.0)',
  },
  fast: {
    id: 'fast',
    name: 'Fast (U²-Net-P)',
    description: 'Lightweight 4.6 MB model for older phones and quick previews. Less accurate on thin parts.',
    parts: ['models/u2netp.onnx'],
    bytes: 4574861,
    sha256: '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8',
    inputSize: 320,
    license: 'Apache-2.0 (U²-Net, Xuebin Qin et al.)',
    source: 'https://github.com/xuebinqin/U-2-Net',
  },
};

export const MODEL_LIST: ModelDef[] = [MODELS.quality, MODELS.fast];
