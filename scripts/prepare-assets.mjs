// Runs before `npm run dev` and `npm run build`.
// Makes sure the AI model files exist in public/models. Missing files are downloaded from the
// open-source rembg release on GitHub and verified with SHA-256 (see scripts/fetch-models.mjs).
// (The ONNX Runtime WebAssembly file is bundled by Vite itself.)
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const required = ['u2netp.onnx', 'silueta.part0.bin', 'silueta.part1.bin', 'silueta.part2.bin'];
const missing = () => required.filter((f) => !existsSync(join(root, 'public', 'models', f)));

if (missing().length) {
  console.log('prepare-assets: AI model files missing (' + missing().join(', ') + '). Downloading...');
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'fetch-models.mjs')], { stdio: 'inherit' });
  if (r.status !== 0 || missing().length) {
    console.error('ERROR: could not download the AI models. Check your internet connection and run "npm run models".');
    process.exit(1);
  }
}
console.log('prepare-assets: AI model files present.');
