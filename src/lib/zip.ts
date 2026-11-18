import JSZip from 'jszip';
import { cutoutName, uniqueName } from './names';

export interface ZipEntry {
  name: string;
  png: Blob;
}

/** Bundle PNGs into one ZIP. PNG is already compressed, so entries are stored without recompression. */
export async function buildZip(entries: ZipEntry[], onProgress?: (percent: number) => void): Promise<Blob> {
  const zip = new JSZip();
  const used = new Set<string>();
  for (const e of entries) zip.file(uniqueName(cutoutName(e.name), used), e.png, { compression: 'STORE', binary: true });
  return zip.generateAsync({ type: 'blob', compression: 'STORE', streamFiles: true }, (m) => onProgress?.(Math.round(m.percent)));
}
