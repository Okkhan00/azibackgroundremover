import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface HistoryRecord {
  id: string;
  name: string;
  createdAt: number;
  width: number;
  height: number;
  modelId: string;
  thumb: Blob;
  png: Blob;
}

interface AziDB extends DBSchema {
  history: { key: string; value: HistoryRecord; indexes: { 'by-date': number } };
  meta: { key: string; value: number };
}

let dbPromise: Promise<IDBPDatabase<AziDB>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<AziDB>('azi-background-remover', 1, {
      upgrade(d) {
        const h = d.createObjectStore('history', { keyPath: 'id' });
        h.createIndex('by-date', 'createdAt');
        d.createObjectStore('meta');
      },
    });
  }
  return dbPromise;
}

export async function addHistory(rec: HistoryRecord, limit: number): Promise<void> {
  const d = await db();
  await d.put('history', rec);
  const all = await d.getAllKeysFromIndex('history', 'by-date');
  const excess = all.length - Math.max(1, limit);
  for (let i = 0; i < excess; i++) await d.delete('history', all[i]);
}

export async function listHistory(): Promise<HistoryRecord[]> {
  const d = await db();
  const all = await d.getAllFromIndex('history', 'by-date');
  return all.reverse();
}

export async function getHistory(id: string): Promise<HistoryRecord | undefined> {
  return (await db()).get('history', id);
}

export async function deleteHistory(id: string): Promise<void> {
  await (await db()).delete('history', id);
}

export async function clearHistory(): Promise<void> {
  await (await db()).clear('history');
}

export async function incrementTotalProcessed(by = 1): Promise<number> {
  const d = await db();
  const tx = d.transaction('meta', 'readwrite');
  const cur = (await tx.store.get('totalProcessed')) ?? 0;
  const next = cur + by;
  await tx.store.put(next, 'totalProcessed');
  await tx.done;
  return next;
}

export async function getTotalProcessed(): Promise<number> {
  return (await (await db()).get('meta', 'totalProcessed')) ?? 0;
}
