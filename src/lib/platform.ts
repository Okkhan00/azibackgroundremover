import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const isNative = (): boolean => Capacitor.isNativePlatform();

const FOLDER = 'AziBackgroundRemover';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Could not read the file for saving.'));
    r.onload = () => {
      const s = String(r.result);
      resolve(s.slice(s.indexOf(',') + 1));
    };
    r.readAsDataURL(blob);
  });
}

function browserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export interface SaveOutcome {
  message: string;
}

/**
 * Save a file for the user.
 * Web: normal browser download. Android: writes into Documents/AziBackgroundRemover and, if the OS
 * refuses, opens the share sheet so the user can still put the file somewhere (Files, Drive, WhatsApp...).
 */
export async function saveFile(blob: Blob, filename: string): Promise<SaveOutcome> {
  if (!isNative()) {
    browserDownload(blob, filename);
    return { message: `Downloading ${filename}` };
  }
  const data = await blobToBase64(blob);
  try {
    const res = await Filesystem.writeFile({ path: `${FOLDER}/${filename}`, data, directory: Directory.Documents, recursive: true });
    return { message: `Saved to Documents/${FOLDER}/${filename}`, ...(res.uri ? {} : {}) };
  } catch {
    await shareFile(blob, filename);
    return { message: 'Choose where to save the file in the share sheet.' };
  }
}

export async function shareFile(blob: Blob, filename: string): Promise<void> {
  if (isNative()) {
    const data = await blobToBase64(blob);
    const written = await Filesystem.writeFile({ path: `share/${filename}`, data, directory: Directory.Cache, recursive: true });
    await Share.share({ title: filename, files: [written.uri], dialogTitle: 'Share image' });
    return;
  }
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  browserDownload(blob, filename);
}
