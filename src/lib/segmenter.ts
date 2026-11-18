import type { ModelDef } from './models';
import type { WorkerIn, WorkerOut } from '../workers/inference.worker';

type Pending = { resolve: (v: Float32Array) => void; reject: (e: Error) => void };

/** Thin client for the inference worker. Models load lazily on first use. */
class Segmenter {
  private worker: Worker | null = null;
  private loadedModel: string | null = null;
  private loading: Promise<void> | null = null;
  private loadingModel: string | null = null;
  private progressCb: ((loaded: number, total: number) => void) | null = null;
  private readyWaiter: { resolve: () => void; reject: (e: Error) => void } | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const w = new Worker(new URL('../workers/inference.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<WorkerOut>) => this.onMessage(e.data);
    w.onerror = (e) => {
      const err = new Error(e.message || 'The AI engine crashed unexpectedly.');
      this.failAll(err);
      this.worker?.terminate();
      this.worker = null;
      this.loadedModel = null;
    };
    this.worker = w;
    return w;
  }

  private failAll(err: Error) {
    this.readyWaiter?.reject(err);
    this.readyWaiter = null;
    this.pending.forEach((p) => p.reject(err));
    this.pending.clear();
  }

  private onMessage(m: WorkerOut) {
    switch (m.type) {
      case 'progress':
        this.progressCb?.(m.loaded, m.total);
        break;
      case 'ready':
        this.loadedModel = m.modelId;
        this.readyWaiter?.resolve();
        this.readyWaiter = null;
        break;
      case 'result': {
        const p = this.pending.get(m.id);
        this.pending.delete(m.id);
        p?.resolve(m.output);
        break;
      }
      case 'error': {
        const err = new Error(m.message);
        if (m.id !== undefined) {
          const p = this.pending.get(m.id);
          this.pending.delete(m.id);
          p?.reject(err);
        } else {
          this.readyWaiter?.reject(err);
          this.readyWaiter = null;
        }
        break;
      }
    }
  }

  isLoaded(modelId: string): boolean {
    return this.loadedModel === modelId;
  }

  async load(model: ModelDef, onProgress?: (loaded: number, total: number) => void): Promise<void> {
    if (this.loadedModel === model.id) return;
    if (this.loading && this.loadingModel === model.id) {
      this.progressCb = onProgress ?? null;
      return this.loading;
    }
    if (this.loading) await this.loading.catch(() => undefined);
    if (this.loadedModel === model.id) return;
    this.progressCb = onProgress ?? null;
    this.loadingModel = model.id;
    const worker = this.ensureWorker();
    this.loading = new Promise<void>((resolve, reject) => {
      this.readyWaiter = { resolve, reject };
      const msg: WorkerIn = {
        type: 'init',
        baseUrl: document.baseURI,
        model: { id: model.id, parts: model.parts, bytes: model.bytes, sha256: model.sha256, inputSize: model.inputSize },
      };
      worker.postMessage(msg);
    }).finally(() => {
      this.loading = null;
      this.loadingModel = null;
      this.progressCb = null;
    });
    return this.loading;
  }

  run(input: Float32Array): Promise<Float32Array> {
    const worker = this.ensureWorker();
    const id = this.nextId++;
    return new Promise<Float32Array>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const msg: WorkerIn = { type: 'run', id, input };
      worker.postMessage(msg, [input.buffer]);
    });
  }
}

export const segmenter = new Segmenter();
