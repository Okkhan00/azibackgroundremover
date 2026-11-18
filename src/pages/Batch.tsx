import { useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Loader2, Play, Square, Trash2, X } from 'lucide-react';
import DropZone from '../components/DropZone';
import { PageTitle, ProgressBar } from '../components/ui';
import { cutoutName } from '../lib/names';
import { saveFile } from '../lib/platform';
import { buildZip } from '../lib/zip';
import { useWorkspace, type Item } from '../state/workspace';

function StatusChip({ item }: { item: Item }) {
  const base = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium';
  if (item.status === 'done') return <span className={`${base} bg-emerald-500/15 text-emerald-300`}><CheckCircle2 size={12} /> Done</span>;
  if (item.status === 'error') return <span className={`${base} bg-red-500/15 text-red-300`}><AlertCircle size={12} /> Failed</span>;
  if (item.status === 'processing') return <span className={`${base} bg-royal-500/20 text-royal-300`}><Loader2 size={12} className="animate-spin" /> Processing</span>;
  return <span className={`${base} bg-white/10 text-white/65`}>Waiting</span>;
}

export default function BatchPage() {
  const { items, addFiles, processAll, processItem, cancelBatch, removeItem, clearGroup, batchRunning, toast } = useWorkspace();
  const list = items.filter((i) => i.group === 'batch');
  const done = list.filter((i) => i.status === 'done' && i.resultBlob);
  const pending = list.filter((i) => i.status === 'queued' || i.status === 'error');
  const [zipping, setZipping] = useState(false);
  const [zipPct, setZipPct] = useState(0);

  const overall = list.length ? (list.reduce((s, i) => s + (i.status === 'done' || i.status === 'error' ? 100 : i.progress), 0) / (list.length * 100)) * 100 : 0;

  const downloadOne = async (i: Item) => {
    if (!i.resultBlob) return;
    try {
      toast((await saveFile(i.resultBlob, cutoutName(i.name))).message, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save the file.', 'error');
    }
  };

  const downloadZip = async () => {
    setZipping(true);
    setZipPct(0);
    try {
      const blob = await buildZip(
        done.map((i) => ({ name: i.name, png: i.resultBlob! })),
        setZipPct,
      );
      toast((await saveFile(blob, 'background-removed-AZI-CREATION.zip')).message, 'success');
    } catch (e) {
      toast(e instanceof Error ? `ZIP failed: ${e.message}` : 'ZIP failed.', 'error');
    } finally {
      setZipping(false);
    }
  };

  return (
    <div>
      <PageTitle title="Batch Processing" subtitle="Add many images, process them one after another, then download everything as a ZIP." />

      <DropZone multiple compact title={list.length ? 'Add more images' : 'Upload multiple images'} onFiles={(f) => addFiles(f, 'batch')} testId="batch-input" />

      {list.length > 0 && (
        <div className="mt-5 space-y-4">
          <div className="glass space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-white/70" data-testid="batch-summary">
                {list.length} image{list.length > 1 ? 's' : ''} · {done.length} done · {list.filter((i) => i.status === 'error').length} failed
              </p>
              <div className="flex flex-wrap gap-2">
                {batchRunning ? (
                  <button className="btn btn-danger" onClick={cancelBatch}>
                    <Square size={16} /> Stop after current
                  </button>
                ) : (
                  <button className="btn btn-primary" disabled={pending.length === 0} onClick={() => void processAll('batch')} data-testid="batch-process-all">
                    <Play size={16} /> Remove backgrounds ({pending.length})
                  </button>
                )}
                <button className="btn btn-gold" disabled={done.length === 0 || zipping} onClick={downloadZip} data-testid="batch-zip">
                  {zipping ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  {zipping ? `Zipping ${zipPct}%` : `Download ZIP (${done.length})`}
                </button>
                <button className="btn btn-ghost" disabled={batchRunning} onClick={() => clearGroup('batch')}>
                  <Trash2 size={16} /> Clear
                </button>
              </div>
            </div>
            {(batchRunning || (overall > 0 && overall < 100)) && <ProgressBar value={overall} label="Overall progress" />}
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((i) => (
              <li key={i.id} className="glass fade-up overflow-hidden" data-testid="batch-item" data-status={i.status}>
                <div className="checker relative flex h-40 items-center justify-center">
                  <img src={i.status === 'done' && i.resultUrl ? i.resultUrl : i.srcUrl} alt={i.name} className="max-h-full max-w-full object-contain" loading="lazy" />
                  <button
                    className="absolute right-2 top-2 rounded-lg bg-black/55 p-1.5 text-white/80 hover:text-white disabled:opacity-40"
                    onClick={() => removeItem(i.id)}
                    disabled={i.status === 'processing'}
                    aria-label={`Remove ${i.name}`}
                  >
                    <X size={15} />
                  </button>
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium" title={i.name}>
                      {i.name}
                    </p>
                    <StatusChip item={i} />
                  </div>
                  {i.status === 'processing' && <ProgressBar value={i.progress} label={i.stage} />}
                  {i.status === 'error' && <p className="text-xs text-red-300">{i.error}</p>}
                  <div className="flex gap-2">
                    {i.status === 'done' ? (
                      <button className="btn btn-ghost !min-h-9 flex-1 !text-xs" onClick={() => void downloadOne(i)}>
                        <Download size={14} /> PNG
                      </button>
                    ) : (
                      <button className="btn btn-ghost !min-h-9 flex-1 !text-xs" disabled={i.status === 'processing' || batchRunning} onClick={() => void processItem(i.id)}>
                        <Play size={14} /> {i.status === 'error' ? 'Retry' : 'Process'}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
