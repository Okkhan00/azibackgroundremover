import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Images, Layers, Palette, Scissors, Upload, History as HistoryIcon } from 'lucide-react';
import { Logo } from '../components/ui';
import { ACCEPT_ATTR } from '../lib/names';
import { listHistory, type HistoryRecord } from '../lib/db';
import { navigate, type Route } from '../lib/router';
import { PRODUCT_NAME } from '../lib/meta';
import { useWorkspace } from '../state/workspace';

export default function HomePage() {
  const { addFiles, totalProcessed, historyVersion, addResultItem } = useWorkspace();
  const single = useRef<HTMLInputElement>(null);
  const batch = useRef<HTMLInputElement>(null);
  const [recent, setRecent] = useState<{ rec: HistoryRecord; url: string }[]>([]);

  useEffect(() => {
    let urls: string[] = [];
    let alive = true;
    listHistory()
      .then((all) => {
        if (!alive) return;
        const six = all.slice(0, 6).map((rec) => ({ rec, url: URL.createObjectURL(rec.thumb) }));
        urls = six.map((s) => s.url);
        setRecent(six);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      urls.forEach(URL.revokeObjectURL);
    };
  }, [historyVersion]);

  const cards: { route: Route; title: string; text: string; icon: typeof Scissors }[] = [
    { route: 'remover', title: 'Background Remover', text: 'One image, instant before/after preview.', icon: Scissors },
    { route: 'batch', title: 'Batch Processing', text: 'Many images, one ZIP download.', icon: Layers },
    { route: 'editor', title: 'Background Editor', text: 'Solid colours or your own picture.', icon: Palette },
    { route: 'history', title: 'History', text: 'Everything you processed, kept on this device.', icon: HistoryIcon },
  ];

  return (
    <div className="space-y-8">
      <section className="glass fade-up relative overflow-hidden p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-royal-600/30 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <Logo size={72} />
          <div className="flex-1">
            <p className="gold-text text-xs font-semibold tracking-[0.3em]">AZI CREATION</p>
            <h1 className="mt-1 font-display text-2xl font-semibold leading-tight sm:text-4xl">{PRODUCT_NAME}</h1>
            <p className="mt-2 max-w-xl text-sm text-white/65 sm:text-base">
              Remove backgrounds with AI that runs right on your device. Your photos are never uploaded. No account, no limits.
            </p>
          </div>
        </div>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-2">
          <button className="btn btn-primary !min-h-14 text-base" onClick={() => single.current?.click()} data-testid="home-upload">
            <Upload size={20} /> Upload Image
          </button>
          <button className="btn btn-gold !min-h-14 text-base" onClick={() => batch.current?.click()}>
            <Images size={20} /> Batch Upload
          </button>
        </div>
        <input
          ref={single}
          type="file"
          accept={ACCEPT_ATTR}
          className="hidden"
          data-testid="home-single-input"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length && addFiles(files.slice(0, 1), 'single').length) navigate('remover');
          }}
        />
        <input
          ref={batch}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length && addFiles(files, 'batch').length) navigate('batch');
          }}
        />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="glass col-span-2 flex items-center justify-between p-4 sm:col-span-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/50">Total images processed</p>
            <p className="font-display text-3xl font-semibold tabular-nums" data-testid="total-processed">
              {totalProcessed}
            </p>
          </div>
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">100% on-device</span>
        </div>
        {cards.map(({ route, title, text, icon: Icon }) => (
          <button key={route} onClick={() => navigate(route)} className="glass fade-up group flex flex-col items-start gap-2 p-4 text-left transition hover:border-royal-400/50">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-royal-600/25 text-royal-300">
              <Icon size={20} />
            </span>
            <span className="font-semibold">{title}</span>
            <span className="text-xs text-white/55">{text}</span>
            <ArrowRight size={16} className="mt-auto text-gold-400 transition group-hover:translate-x-1" />
          </button>
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-xl font-semibold">Recent</h2>
          {recent.length > 0 && (
            <button className="text-sm text-royal-300 hover:underline" onClick={() => navigate('history')}>
              View all
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="glass p-6 text-center text-sm text-white/55">Nothing yet. Your processed images will appear here.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {recent.map(({ rec, url }) => (
              <button
                key={rec.id}
                className="checker aspect-square overflow-hidden rounded-xl border border-white/10 transition hover:border-gold-400/60"
                onClick={() => {
                  addResultItem(rec);
                  navigate('editor');
                }}
                title={`Open ${rec.name} in the editor`}
              >
                <img src={url} alt={rec.name} className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
