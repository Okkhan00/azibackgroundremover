# Licenses

**BACKGROUND REMOVER by AZI CREATION** – application source code © AZI CREATION. The owner chooses the license for the app's own code (add a `LICENSE` file if you publish it). Everything below is third-party and keeps its own license.

## AI models (shipped in `public/models/`)

| Model | File(s) | License | Source |
|---|---|---|---|
| U²-Net-P (`u2netp`) | `u2netp.onnx` | Apache-2.0 | https://github.com/xuebinqin/U-2-Net |
| Silueta (reduced-size U²-Net) | `silueta.part0-2.bin` (one file split in 3 for hosting limits) | Derived from U²-Net (Apache-2.0). Distributed by rembg (MIT). **No separate license for the weights is published**; confirm before commercial use. | https://github.com/xuebinqin/U-2-Net/issues/295 |

Weights were downloaded from https://github.com/danielgatis/rembg/releases/tag/v0.0.0 (rembg, MIT). SHA-256 checksums are in `src/lib/models.ts` and `scripts/fetch-models.mjs`.

**Not used:** BRIA RMBG-1.4 / 2.0 (non-commercial / paid commercial license; its host was also unreachable while building). The app uses no paid API and needs no API key.

## Libraries (runtime)

ONNX Runtime Web 1.31 (MIT) · React 19 (MIT) · JSZip 3.10 (MIT OR GPL-3.0, used under MIT) · idb 8 (ISC) · lucide-react (ISC) · Capacitor 8 core, Android, App, Filesystem, Share, Splash Screen, Status Bar (MIT).

## Build tooling

Vite (MIT) · @vitejs/plugin-react (MIT) · Tailwind CSS 4 (MIT) · vite-plugin-pwa (MIT) · TypeScript (Apache-2.0) · Vitest (MIT) · @capacitor/cli and @capacitor/assets (MIT) · sharp (Apache-2.0) · Playwright (Apache-2.0).
