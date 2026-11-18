import { useEffect, useState } from 'react';
import { Download, Loader2, Share2 } from 'lucide-react';
import BackgroundPicker, { type BackgroundChoice } from '../components/BackgroundPicker';
import ZoomView from '../components/ZoomView';
import { PageTitle } from '../components/ui';
import { blobToBitmap, canvasToPngBlob, composeOnBackground, releaseCanvas, type BackgroundSpec } from '../lib/image';
import { baseName } from '../lib/names';
import { navigate } from '../lib/router';
import { saveFile, shareFile } from '../lib/platform';
import { useWorkspace } from '../state/workspace';

export default function EditorPage() {
  const { items, activeId, setActiveId, toast } = useWorkspace();
  const doneItems = items.filter((i) => i.status === 'done' && i.resultBlob && i.resultUrl);
  const item = doneItems.find((i) => i.id === activeId) ?? doneItems[0];
  const [bg, setBg] = useState<BackgroundChoice>({ kind: 'color', color: '#ffffff', label: 'White' });
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);

  useEffect(() => {
    return () => {
      if (bg.kind === 'image') URL.revokeObjectURL(bg.url);
    };
  }, [bg]);

  if (!item) {
    return (
      <div>
        <PageTitle title="Background Editor" subtitle="Replace the removed background with a colour or your own picture." />
        <div className="glass p-8 text-center">
          <p className="text-white/70">No processed image yet. Remove a background first, or open one from your history.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button className="btn btn-primary" onClick={() => navigate('remover')}>
              Remove a background
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('history')}>
              Open history
            </button>
          </div>
        </div>
      </div>
    );
  }

  const label = bg.kind === 'transparent' ? 'transparent' : bg.kind === 'color' ? bg.label.toLowerCase() : 'custom-bg';
  const filename = `${baseName(item.name)}-${label}.png`;

  const render = async (): Promise<Blob> => {
    if (bg.kind === 'transparent') return item.resultBlob!; // already a genuine transparent PNG, untouched
    const cut = await blobToBitmap(item.resultBlob!);
    let spec: BackgroundSpec;
    let bgBitmap: ImageBitmap | null = null;
    try {
      if (bg.kind === 'image') {
        bgBitmap = await createImageBitmap(bg.file, { imageOrientation: 'from-image' });
        spec = { kind: 'image', image: bgBitmap };
      } else spec = { kind: 'color', color: bg.color };
      const canvas = composeOnBackground(cut, spec);
      const blob = await canvasToPngBlob(canvas);
      releaseCanvas(canvas);
      return blob;
    } finally {
      cut.close();
      bgBitmap?.close();
    }
  };

  const run = async (mode: 'save' | 'share') => {
    setBusy(mode);
    try {
      const blob = await render();
      if (mode === 'save') toast((await saveFile(blob, filename)).message, 'success');
      else await shareFile(blob, filename);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Export failed.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const bgStyle: React.CSSProperties = bg.kind === 'color' ? { background: bg.color } : {};

  return (
    <div>
      <PageTitle title="Background Editor" subtitle="Pick a new background, preview it, then download at full resolution." />

      {doneItems.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="Choose image">
          {doneItems.map((i) => (
            <button
              key={i.id}
              onClick={() => setActiveId(i.id)}
              className={`checker h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${i.id === item.id ? 'border-gold-400' : 'border-transparent opacity-70'}`}
              title={i.name}
            >
              <img src={i.resultUrl} alt={i.name} className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      )}

      <ZoomView aspect={(item.width ?? 1) / (item.height ?? 1)} className="h-[52vh] min-h-72" label="Edited preview">
        <div className={`absolute inset-0 ${bg.kind === 'transparent' ? 'checker' : ''}`} style={bgStyle} data-testid="editor-bg">
          {bg.kind === 'image' && <img src={bg.url} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />}
        </div>
        <img src={item.resultUrl} alt="Cutout preview" draggable={false} className="absolute inset-0 h-full w-full select-none object-fill" />
      </ZoomView>

      <div className="glass mt-4 space-y-4 p-4">
        <p className="text-xs uppercase tracking-widest text-white/50">Background</p>
        <BackgroundPicker value={bg} onChange={setBg} onError={(m) => toast(m, 'error')} />
        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
          <button className="btn btn-primary" disabled={busy !== null} onClick={() => void run('save')} data-testid="editor-download">
            {busy === 'save' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} Download HD PNG
          </button>
          <button className="btn btn-ghost" disabled={busy !== null} onClick={() => void run('share')}>
            {busy === 'share' ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />} Share
          </button>
        </div>
        <p className="text-xs text-white/45">
          Exports at {item.width}×{item.height}px. Transparent keeps the alpha channel; colours and pictures are baked into the PNG.
        </p>
      </div>
    </div>
  );
}
