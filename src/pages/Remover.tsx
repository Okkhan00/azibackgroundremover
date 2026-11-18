import { Download, Palette, RefreshCw, Share2, Upload } from 'lucide-react';
import BeforeAfter from '../components/BeforeAfter';
import DropZone from '../components/DropZone';
import { PageTitle, ProgressBar } from '../components/ui';
import { MODEL_LIST, MODELS } from '../lib/models';
import { cutoutName, formatBytes } from '../lib/names';
import { navigate } from '../lib/router';
import { saveFile, shareFile } from '../lib/platform';
import { useWorkspace } from '../state/workspace';

export default function RemoverPage() {
  const { items, activeId, addFiles, processItem, removeItem, settings, updateSettings, toast } = useWorkspace();
  const item = items.find((i) => i.id === activeId && i.group === 'single') ?? items.find((i) => i.group === 'single');

  const download = async () => {
    if (!item?.resultBlob) return;
    try {
      const out = await saveFile(item.resultBlob, cutoutName(item.name));
      toast(out.message, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save the file.', 'error');
    }
  };
  const share = async () => {
    if (!item?.resultBlob) return;
    try {
      await shareFile(item.resultBlob, cutoutName(item.name));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Sharing is not available here.', 'error');
    }
  };

  return (
    <div>
      <PageTitle title="Background Remover" subtitle="Drop in a photo. The subject is detected and the background removed automatically." />

      {!item ? (
        <DropZone title="Upload an image" onFiles={(f) => addFiles(f.slice(0, 1), 'single')} testId="remover-input" />
      ) : (
        <div className="space-y-4">
          {item.status === 'done' && item.resultUrl ? (
            item.srcUrl ? (
              <BeforeAfter originalUrl={item.srcUrl} resultUrl={item.resultUrl} width={item.width!} height={item.height!} className="h-[58vh] min-h-72" />
            ) : (
              <div className="checker flex h-[58vh] min-h-72 items-center justify-center rounded-2xl">
                <img src={item.resultUrl} alt="Background removed" className="max-h-full max-w-full object-contain" />
              </div>
            )
          ) : (
            <div className="glass overflow-hidden">
              {item.srcUrl && (
                <div className="checker flex h-[40vh] min-h-56 items-center justify-center">
                  <img src={item.srcUrl} alt="Original" className="max-h-full max-w-full object-contain" />
                </div>
              )}
              <div className="p-4">
                {item.status === 'processing' && <ProgressBar value={item.progress} label={item.stage} />}
                {item.status === 'queued' && <p className="text-sm text-white/65">Ready to process.</p>}
                {item.status === 'error' && (
                  <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
                    {item.error}
                  </p>
                )}
              </div>
            </div>
          )}

          {item.status === 'done' && (
            <p className="text-center text-xs text-white/55" data-testid="result-info">
              {item.width}×{item.height}px · {item.modelId ? MODELS[item.modelId as keyof typeof MODELS]?.name : ''} · {((item.ms ?? 0) / 1000).toFixed(1)}s · PNG {item.resultBlob ? formatBytes(item.resultBlob.size) : ''}
              {item.downscaled && ` · scaled down from ${item.originalWidth}×${item.originalHeight} (size limit in Settings)`}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {item.status === 'done' ? (
              <>
                <button className="btn btn-primary col-span-2" onClick={download} data-testid="download-png">
                  <Download size={18} /> Download HD PNG
                </button>
                <button className="btn btn-ghost" onClick={() => navigate('editor')}>
                  <Palette size={18} /> Edit background
                </button>
                <button className="btn btn-ghost" onClick={share}>
                  <Share2 size={18} /> Share
                </button>
              </>
            ) : (
              <button className="btn btn-primary col-span-2" disabled={item.status === 'processing'} onClick={() => void processItem(item.id)} data-testid="process-btn">
                <RefreshCw size={18} className={item.status === 'processing' ? 'animate-spin' : ''} />
                {item.status === 'error' ? 'Try again' : 'Remove background'}
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => removeItem(item.id)}>
              <Upload size={18} /> New image
            </button>
            {item.status === 'done' && item.file && (
              <button className="btn btn-ghost" onClick={() => void processItem(item.id)}>
                <RefreshCw size={18} /> Run again
              </button>
            )}
          </div>

          <div className="glass p-4">
            <p className="mb-2 text-xs uppercase tracking-widest text-white/50">AI model</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {MODEL_LIST.map((m) => (
                <button
                  key={m.id}
                  onClick={() => updateSettings({ model: m.id })}
                  aria-pressed={settings.model === m.id}
                  className={`rounded-xl border p-3 text-left text-sm transition ${
                    settings.model === m.id ? 'border-gold-400 bg-gold-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <span className="block font-semibold">{m.name}</span>
                  <span className="text-xs text-white/55">{m.description}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-white/45">Changing the model applies to the next run. Use “Run again” to redo this image.</p>
          </div>
        </div>
      )}
    </div>
  );
}
