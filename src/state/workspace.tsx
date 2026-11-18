import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { removeBackground } from '../lib/removeBackground';
import { addHistory, getTotalProcessed, incrementTotalProcessed, type HistoryRecord } from '../lib/db';
import { makeThumbnail } from '../lib/image';
import { isSupportedImage } from '../lib/names';
import { loadSettings, saveSettings, type Settings } from '../lib/settings';

export type ItemStatus = 'queued' | 'processing' | 'done' | 'error';
export type Group = 'single' | 'batch';

export interface Item {
  id: string;
  group: Group;
  name: string;
  file?: File;
  /** Object URL of the original (absent for items re-opened from history). */
  srcUrl?: string;
  status: ItemStatus;
  progress: number;
  stage: string;
  error?: string;
  resultBlob?: Blob;
  resultUrl?: string;
  width?: number;
  height?: number;
  originalWidth?: number;
  originalHeight?: number;
  downscaled?: boolean;
  modelId?: string;
  ms?: number;
}

export interface Toast {
  id: number;
  kind: 'info' | 'error' | 'success';
  text: string;
}

interface Ctx {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  items: Item[];
  addFiles: (files: File[], group: Group) => string[];
  addResultItem: (rec: HistoryRecord) => string;
  processItem: (id: string) => Promise<void>;
  processAll: (group: Group) => Promise<void>;
  cancelBatch: () => void;
  removeItem: (id: string) => void;
  clearGroup: (group: Group) => void;
  batchRunning: boolean;
  totalProcessed: number;
  historyVersion: number;
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  toasts: Toast[];
  toast: (text: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
}

const WorkspaceContext = createContext<Ctx | null>(null);

export function useWorkspace(): Ctx {
  const c = useContext(WorkspaceContext);
  if (!c) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return c;
}

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [items, setItems] = useState<Item[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [totalProcessed, setTotalProcessed] = useState(0);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const cancelRef = useRef(false);
  // One image at a time: WebAssembly inference is memory hungry and single threaded.
  const lockRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    getTotalProcessed().then(setTotalProcessed).catch(() => undefined);
  }, []);

  const patch = useCallback((id: string, p: Partial<Item>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));
  }, []);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 2200);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const updateSettings = useCallback((p: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...p };
      saveSettings(next);
      return next;
    });
  }, []);

  const revoke = (it: Item) => {
    if (it.srcUrl) URL.revokeObjectURL(it.srcUrl);
    if (it.resultUrl) URL.revokeObjectURL(it.resultUrl);
  };

  const processItem = useCallback(
    (id: string): Promise<void> => {
      const run = async () => {
        const it = itemsRef.current.find((x) => x.id === id);
        if (!it || !it.file) return;
        patch(id, { status: 'processing', progress: 1, stage: 'Starting', error: undefined });
        try {
          const s = settingsRef.current;
          const res = await removeBackground(it.file, s, (progress, stage) => patch(id, { progress, stage }), it.name);
          const url = URL.createObjectURL(res.png);
          const old = itemsRef.current.find((x) => x.id === id)?.resultUrl;
          if (old) URL.revokeObjectURL(old);
          patch(id, {
            status: 'done',
            progress: 100,
            stage: 'Done',
            resultBlob: res.png,
            resultUrl: url,
            width: res.width,
            height: res.height,
            originalWidth: res.originalWidth,
            originalHeight: res.originalHeight,
            downscaled: res.downscaled,
            modelId: res.modelId,
            ms: res.ms,
          });
          incrementTotalProcessed().then(setTotalProcessed).catch(() => undefined);
          if (s.saveHistory) {
            try {
              const thumb = await makeThumbnail(res.png);
              await addHistory(
                { id: newId(), name: it.name, createdAt: Date.now(), width: res.width, height: res.height, modelId: res.modelId, thumb, png: res.png },
                s.historyLimit,
              );
              setHistoryVersion((v) => v + 1);
            } catch {
              /* history is best effort; storage may be full or unavailable */
            }
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Something went wrong while processing this image.';
          patch(id, { status: 'error', progress: 0, stage: 'Failed', error: message });
          toast(`${it.name}: ${message}`, 'error');
        }
      };
      const next = lockRef.current.then(run, run);
      lockRef.current = next.catch(() => undefined);
      return next;
    },
    [patch, toast],
  );

  const addFiles = useCallback(
    (files: File[], group: Group): string[] => {
      const ok = files.filter(isSupportedImage);
      const rejected = files.length - ok.length;
      if (rejected > 0) toast(`${rejected} file${rejected > 1 ? 's were' : ' was'} skipped: only JPG, JPEG, PNG and WEBP are supported.`, 'error');
      if (ok.length === 0) return [];
      const created: Item[] = ok.map((file) => ({
        id: newId(),
        group,
        name: file.name,
        file,
        srcUrl: URL.createObjectURL(file),
        status: 'queued',
        progress: 0,
        stage: 'Waiting',
      }));
      setItems((prev) => {
        if (group === 'single') {
          // The single-image workspace holds one image at a time.
          prev.filter((p) => p.group === 'single').forEach(revoke);
          return [...prev.filter((p) => p.group !== 'single'), created[0]];
        }
        return [...prev, ...created];
      });
      const ids = group === 'single' ? [created[0].id] : created.map((c) => c.id);
      if (group === 'single') {
        setActiveId(created[0].id);
        if (settingsRef.current.autoProcess) setTimeout(() => void processItem(created[0].id), 0);
      }
      return ids;
    },
    [processItem, toast],
  );

  const addResultItem = useCallback((rec: HistoryRecord): string => {
    const id = newId();
    const url = URL.createObjectURL(rec.png);
    const item: Item = {
      id,
      group: 'single',
      name: rec.name,
      status: 'done',
      progress: 100,
      stage: 'Done',
      resultBlob: rec.png,
      resultUrl: url,
      width: rec.width,
      height: rec.height,
      modelId: rec.modelId,
    };
    setItems((prev) => {
      prev.filter((p) => p.group === 'single').forEach(revoke);
      return [...prev.filter((p) => p.group !== 'single'), item];
    });
    setActiveId(id);
    return id;
  }, []);

  const processAll = useCallback(
    async (group: Group) => {
      cancelRef.current = false;
      setBatchRunning(true);
      try {
        const todo = itemsRef.current.filter((i) => i.group === group && (i.status === 'queued' || i.status === 'error')).map((i) => i.id);
        for (const id of todo) {
          if (cancelRef.current) break;
          await processItem(id); // errors are captured per item, so one failure never stops the batch
        }
      } finally {
        setBatchRunning(false);
      }
    },
    [processItem],
  );

  const cancelBatch = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const it = prev.find((p) => p.id === id);
      if (it) revoke(it);
      return prev.filter((p) => p.id !== id);
    });
    setActiveId((a) => (a === id ? null : a));
  }, []);

  const clearGroup = useCallback((group: Group) => {
    setItems((prev) => {
      prev.filter((p) => p.group === group).forEach(revoke);
      return prev.filter((p) => p.group !== group);
    });
    setActiveId((a) => (itemsRef.current.find((i) => i.id === a)?.group === group ? null : a));
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      settings,
      updateSettings,
      items,
      addFiles,
      addResultItem,
      processItem,
      processAll,
      cancelBatch,
      removeItem,
      clearGroup,
      batchRunning,
      totalProcessed,
      historyVersion,
      activeId,
      setActiveId,
      toasts,
      toast,
      dismissToast,
    }),
    [settings, updateSettings, items, addFiles, addResultItem, processItem, processAll, cancelBatch, removeItem, clearGroup, batchRunning, totalProcessed, historyVersion, activeId, toasts, toast, dismissToast],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
