export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ACCEPT_ATTR = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

export function isSupportedImage(file: { name: string; type: string }): boolean {
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

export function baseName(name: string): string {
  const cleaned = name.replace(/\.[^./\\]+$/, '').replace(/[\\/:*?"<>|]+/g, '_').trim();
  return cleaned || 'image';
}

export function cutoutName(name: string, suffix = 'no-bg'): string {
  return `${baseName(name)}-${suffix}.png`;
}

/** Returns `name`, or `name (2)`, `name (3)` ... if it is already used. Records the result in `used`. */
export function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 2;
  while (used.has(`${stem} (${i})`.concat(ext))) i++;
  const result = `${stem} (${i})${ext}`;
  used.add(result);
  return result;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}
