/// <reference lib="webworker" />
// Runs model download + ONNX inference off the main thread so the UI never freezes.
import * as ort from 'onnxruntime-web/wasm';
// Vite emits this file once, with a content hash, and gives us its final URL.
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';

export interface InitMsg {
  type: 'init';
  baseUrl: string;
  model: { id: string; parts: string[]; bytes: number; sha256: string; inputSize: number };
}
export interface RunMsg {
  type: 'run';
  id: number;
  input: Float32Array;
}
export type WorkerIn = InitMsg | RunMsg;
export type WorkerOut =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'ready'; modelId: string }
  | { type: 'result'; id: number; output: Float32Array }
  | { type: 'error'; id?: number; message: string };

let session: ort.InferenceSession | null = null;
let sessionModel = '';
let inputSize = 320;
let ortConfigured = false;

const post = (m: WorkerOut, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(m, transfer);

function configureOrt() {
  if (ortConfigured) return;
  ort.env.wasm.wasmPaths = { wasm: new URL(wasmUrl, self.location.href).href };
  // Single thread: works everywhere, including Android WebView and hosts without cross-origin isolation.
  ort.env.wasm.numThreads = 1;
  ortConfigured = true;
}

async function sha256Hex(buf: Uint8Array): Promise<string | null> {
  if (!self.crypto?.subtle) return null;
  const digest = await self.crypto.subtle.digest('SHA-256', buf as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function downloadModel(baseUrl: string, m: InitMsg['model']): Promise<Uint8Array> {
  const out = new Uint8Array(m.bytes);
  let offset = 0;
  for (const part of m.parts) {
    const url = new URL(part, baseUrl).href;
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      throw new Error('Could not load the AI model file. Check your internet connection (first use only) and try again.');
    }
    if (!res.ok) throw new Error(`AI model file not found (HTTP ${res.status}) at ${part}.`);
    if (!res.body) {
      const buf = new Uint8Array(await res.arrayBuffer());
      if (offset + buf.length > out.length) throw new Error('AI model file has an unexpected size.');
      out.set(buf, offset);
      offset += buf.length;
      post({ type: 'progress', loaded: offset, total: m.bytes });
      continue;
    }
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.length > out.length) throw new Error('AI model file has an unexpected size.');
      out.set(value, offset);
      offset += value.length;
      post({ type: 'progress', loaded: offset, total: m.bytes });
    }
  }
  if (offset !== m.bytes) throw new Error(`AI model file is incomplete (${offset} of ${m.bytes} bytes). Please retry.`);
  const hash = await sha256Hex(out);
  if (hash && hash !== m.sha256) {
    throw new Error('AI model file failed its integrity check. The server may be returning the wrong file; clear the site cache and retry.');
  }
  return out;
}

async function init(msg: InitMsg) {
  if (session && sessionModel === msg.model.id) {
    post({ type: 'ready', modelId: msg.model.id });
    return;
  }
  configureOrt();
  if (session) {
    await session.release();
    session = null;
    sessionModel = '';
  }
  const bytes = await downloadModel(msg.baseUrl, msg.model);
  session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  sessionModel = msg.model.id;
  inputSize = msg.model.inputSize;
  post({ type: 'ready', modelId: msg.model.id });
}

async function run(msg: RunMsg) {
  if (!session) throw new Error('AI model is not loaded.');
  const tensor = new ort.Tensor('float32', msg.input, [1, 3, inputSize, inputSize]);
  const results = await session.run({ [session.inputNames[0]]: tensor });
  const out = results[session.outputNames[0]];
  const data = (out.data as Float32Array).slice();
  post({ type: 'result', id: msg.id, output: data }, [data.buffer]);
}

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') await init(msg);
    else if (msg.type === 'run') await run(msg);
  } catch (err) {
    post({ type: 'error', id: msg.type === 'run' ? msg.id : undefined, message: err instanceof Error ? err.message : String(err) });
  }
};
