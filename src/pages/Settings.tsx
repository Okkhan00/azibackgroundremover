import { useState, type ReactNode } from 'react';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { PageTitle, ProgressBar } from '../components/ui';
import { clearHistory } from '../lib/db';
import { MODEL_LIST, MODELS } from '../lib/models';
import { segmenter } from '../lib/segmenter';
import { useWorkspace } from '../state/workspace';

function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-white/8 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="sm:max-w-md">
        <p className="font-medium">{title}</p>
        {hint && <p className="mt-0.5 text-xs text-white/55">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 rounded-full transition ${checked ? 'bg-royal-600' : 'bg-white/15'}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${checked ? 'left-[1.4rem]' : 'left-0.5'}`} />
    </button>
  );
}

const select = 'rounded-lg border border-white/15 bg-navy-800 px-3 py-2 text-sm';

export default function SettingsPage() {
  const { settings, updateSettings, toast } = useWorkspace();
  const [prep, setPrep] = useState<number | null>(null);

  const prepareModel = async () => {
    const m = MODELS[settings.model];
    setPrep(0);
    try {
      await segmenter.load(m, (l, t) => setPrep(Math.round((l / t) * 100)));
      toast(`${m.name} is ready and cached for offline use.`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not load the model.', 'error');
    } finally {
      setPrep(null);
    }
  };

  return (
    <div>
      <PageTitle title="Settings" subtitle="Everything is stored on this device only." />

      <section className="glass px-5">
        <Row title="AI model" hint="Quality is recommended. Choose Fast on older phones or to save data.">
          <div className="flex flex-col gap-2">
            {MODEL_LIST.map((m) => (
              <label key={m.id} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${settings.model === m.id ? 'border-gold-400 bg-gold-400/10' : 'border-white/10'}`}>
                <input type="radio" name="model" className="mt-1" checked={settings.model === m.id} onChange={() => updateSettings({ model: m.id })} />
                <span>
                  <span className="block font-semibold">{m.name}</span>
                  <span className="block text-xs text-white/55">{m.description}</span>
                  <span className="block text-[11px] text-white/40">License: {m.license}</span>
                </span>
              </label>
            ))}
          </div>
        </Row>

        <Row title="Prepare selected model now" hint="Loads the model so the next image starts instantly. The browser or app keeps it cached for offline use.">
          <button className="btn btn-ghost" onClick={prepareModel} disabled={prep !== null}>
            {prep !== null ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Load model
          </button>
          {prep !== null && (
            <div className="mt-2 w-48">
              <ProgressBar value={prep} />
            </div>
          )}
        </Row>

        <Row title="Refine edges" hint="Snaps the cut-out to real edges in your photo to keep hair and fur detail. Slightly slower.">
          <Toggle checked={settings.refineEdges} onChange={(v) => updateSettings({ refineEdges: v })} label="Refine edges" />
        </Row>

        <Row title={`Edge sharpness: ${settings.edgeSharpness.toFixed(1)}`} hint="Lower = softer, more natural blend. Higher = crisper outline.">
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={settings.edgeSharpness}
            onChange={(e) => updateSettings({ edgeSharpness: Number(e.target.value) })}
            className="w-48"
            aria-label="Edge sharpness"
          />
        </Row>

        <Row title="Maximum image size" hint="Images above this are scaled down before processing to avoid running out of memory. Lower it if the app crashes on large photos.">
          <select className={select} value={settings.maxMegapixels} onChange={(e) => updateSettings({ maxMegapixels: Number(e.target.value) })} aria-label="Maximum megapixels">
            {[8, 12, 16, 24, 36, 50].map((n) => (
              <option key={n} value={n}>
                {n} megapixels
              </option>
            ))}
          </select>
        </Row>

        <Row title="Start automatically after upload" hint="Single-image mode only.">
          <Toggle checked={settings.autoProcess} onChange={(v) => updateSettings({ autoProcess: v })} label="Auto process" />
        </Row>

        <Row title="Keep processing history" hint="Saves results in this browser's storage so you can reopen them. Nothing leaves your device.">
          <Toggle checked={settings.saveHistory} onChange={(v) => updateSettings({ saveHistory: v })} label="Keep history" />
        </Row>

        <Row title="History size" hint="Oldest items are removed beyond this number.">
          <select className={select} value={settings.historyLimit} onChange={(e) => updateSettings({ historyLimit: Number(e.target.value) })} aria-label="History limit">
            {[10, 25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n} images
              </option>
            ))}
          </select>
        </Row>

        <Row title="Delete all history" hint="Removes every saved result from this device.">
          <button
            className="btn btn-danger"
            onClick={async () => {
              if (window.confirm('Delete all history from this device?')) {
                await clearHistory();
                toast('History deleted.', 'success');
              }
            }}
          >
            <Trash2 size={16} /> Delete
          </button>
        </Row>
      </section>
    </div>
  );
}
