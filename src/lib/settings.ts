import type { ModelId } from './models';

export interface Settings {
  model: ModelId;
  /** Snap the mask to real image edges (hair, fur). */
  refineEdges: boolean;
  /** 1 = soft model output, higher = crisper transition. */
  edgeSharpness: number;
  /** Maximum working size in megapixels. Larger images are scaled down to fit. */
  maxMegapixels: number;
  autoProcess: boolean;
  saveHistory: boolean;
  historyLimit: number;
}

export const DEFAULT_SETTINGS: Settings = {
  model: 'quality',
  refineEdges: true,
  edgeSharpness: 1.5,
  maxMegapixels: 24,
  autoProcess: true,
  saveHistory: true,
  historyLimit: 50,
};

const KEY = 'azi-bgremover-settings-v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable (private mode): settings just won't persist */
  }
}
