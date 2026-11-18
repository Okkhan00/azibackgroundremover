import { useCallback, useEffect, useState } from 'react';
import { Download, Palette, Trash2 } from 'lucide-react';
import { PageTitle } from '../components/ui';
import { clearHistory, deleteHistory, listHistory, type HistoryRecord } from '../lib/db';
import { cutoutName, formatBytes } from '../lib/names';
import { navigate } from '../lib/router';
import { saveFile } from '../lib/platform';
import { useWorkspace } from '../state/workspace';

export default function HistoryPage() {
  const { historyVersion, addResultItem, toast } = useWorkspace();
  const [rows, setRows] = useState<{ rec: HistoryRecord; url: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let urls: string[] = [];
    let alive = true;
    listHistory()
      .then((all) => {
        if (!alive) return;
        const r = all.map((rec) => ({ rec, url: URL.createObjectURL(rec.thumb) }));
        urls = r.map((x) => x.url);
        setRows(r);
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
        toast('History is unavailable in this browser mode (private browsing blocks local storage).', 'error');
      });
    return () => {
      alive = false;
      urls.forEach(URL.revokeObjectURL);
    };
  }, [historyVersion, version, toast]);

  const remove = useCallback(async (id: string) => {
    await deleteHistory(id);
    setVersion((v) => v + 1);
  }, []);

  return (
    <div>
      <PageTitle title="Processing History" subtitle="Saved only on this device. Turn this off in Settings if you prefer nothing to be kept." />
      {loaded && rows.length > 0 && (
        <div className="mb-4 flex justify-end">
          <button
            className="btn btn-danger"
            onClick={async () => {
              if (window.confirm('Delete all history from this device?')) {
                await clearHistory();
                setVersion((v) => v + 1);
              }
            }}
          >
            <Trash2 size={16} /> Clear all
          </button>
        </div>
      )}
      {loaded && rows.length === 0 ? (
        <p className="glass p-8 text-center text-sm text-white/60">No history yet. Processed images are listed here.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map(({ rec, url }) => (
            <li key={rec.id} className="glass fade-up overflow-hidden" data-testid="history-item">
              <div className="checker flex h-36 items-center justify-center">
                <img src={url} alt={rec.name} className="max-h-full max-w-full object-contain" loading="lazy" />
              </div>
              <div className="space-y-2 p-3">
                <p className="truncate text-sm font-medium" title={rec.name}>
                  {rec.name}
                </p>
                <p className="text-[11px] text-white/50">
                  {new Date(rec.createdAt).toLocaleString()} · {rec.width}×{rec.height} · {formatBytes(rec.png.size)}
                </p>
                <div className="flex gap-1.5">
                  <button
                    className="btn btn-ghost !min-h-9 flex-1 !px-2"
                    title="Open in editor"
                    aria-label="Open in editor"
                    onClick={() => {
                      addResultItem(rec);
                      navigate('editor');
                    }}
                  >
                    <Palette size={15} />
                  </button>
                  <button
                    className="btn btn-ghost !min-h-9 flex-1 !px-2"
                    title="Download PNG"
                    aria-label="Download PNG"
                    onClick={async () => {
                      try {
                        toast((await saveFile(rec.png, cutoutName(rec.name))).message, 'success');
                      } catch (e) {
                        toast(e instanceof Error ? e.message : 'Could not save the file.', 'error');
                      }
                    }}
                  >
                    <Download size={15} />
                  </button>
                  <button className="btn btn-danger !min-h-9 flex-1 !px-2" title="Delete" aria-label="Delete" onClick={() => void remove(rec.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
