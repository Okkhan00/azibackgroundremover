// Downloads the open-source ONNX models into public/models and verifies SHA-256.
// Runs automatically when files are missing. Needs internet access to GitHub.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'models');
const BASE = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/';
const PART = 16 * 1024 * 1024;
const models = [
  { file: 'u2netp.onnx', sha256: '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8', split: false },
  { file: 'silueta.onnx', sha256: '75da6c8d2f8096ec743d071951be73b4a8bc7b3e51d9a6625d63644f90ffeedb', split: true },
];
mkdirSync(out, { recursive: true });
for (const m of models) {
  console.log('Downloading ' + m.file + ' ...');
  const res = await fetch(BASE + m.file);
  if (!res.ok) throw new Error('Download failed: HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  const sha = createHash('sha256').update(buf).digest('hex');
  if (sha !== m.sha256) throw new Error(m.file + ': checksum mismatch (' + sha + ')');
  if (!m.split) writeFileSync(join(out, m.file), buf);
  else {
    const base = m.file.replace('.onnx', '');
    for (let i = 0, n = 0; i < buf.length; i += PART, n++) {
      writeFileSync(join(out, base + '.part' + n + '.bin'), buf.subarray(i, i + PART));
    }
  }
  console.log('  OK sha256 ' + sha);
}
