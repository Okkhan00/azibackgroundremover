import { Lock, ShieldCheck, Zap } from 'lucide-react';
import { Logo, PageTitle } from '../components/ui';
import { APP_VERSION, DEVELOPER, PRODUCT_NAME } from '../lib/meta';
import { MODEL_LIST } from '../lib/models';

const LIBS: [string, string][] = [
  ['ONNX Runtime Web', 'MIT'],
  ['React', 'MIT'],
  ['Vite', 'MIT'],
  ['Tailwind CSS', 'MIT'],
  ['JSZip', 'MIT or GPL-3.0 (used under MIT)'],
  ['idb', 'ISC'],
  ['lucide-react', 'ISC'],
  ['Capacitor', 'MIT'],
];

export default function AboutPage() {
  return (
    <div className="space-y-5">
      <PageTitle title="About" />
      <section className="glass flex flex-col items-center gap-3 p-8 text-center">
        <Logo size={72} />
        <h2 className="font-display text-2xl font-semibold">{PRODUCT_NAME}</h2>
        <p className="gold-text text-sm font-semibold tracking-[0.3em]">{DEVELOPER}</p>
        <p className="text-xs text-white/50">Version {APP_VERSION}</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Lock, t: 'Private by design', d: 'AI runs inside your browser or phone. Images are never uploaded anywhere.' },
          { icon: ShieldCheck, t: 'No account, no tracking', d: 'No sign-in, no analytics, no ads, no API keys.' },
          { icon: Zap, t: 'Free and open models', d: 'Powered by open-source segmentation models. No paid APIs.' },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="glass p-4">
            <Icon className="text-gold-400" size={22} />
            <p className="mt-2 font-semibold">{t}</p>
            <p className="mt-1 text-xs text-white/60">{d}</p>
          </div>
        ))}
      </section>

      <section className="glass p-5">
        <h3 className="font-display text-lg font-semibold">AI models and licenses</h3>
        <ul className="mt-3 space-y-3 text-sm">
          {MODEL_LIST.map((m) => (
            <li key={m.id}>
              <p className="font-medium">{m.name}</p>
              <p className="text-xs text-white/55">
                License: {m.license}. Source: {m.source}
              </p>
            </li>
          ))}
        </ul>
        <h3 className="mt-6 font-display text-lg font-semibold">Open-source libraries</h3>
        <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {LIBS.map(([n, l]) => (
            <li key={n} className="flex justify-between gap-3 border-b border-white/6 py-1">
              <span>{n}</span>
              <span className="text-xs text-white/55">{l}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-white/45">Full details are in the LICENSES.md file shipped with the source code.</p>
      </section>
    </div>
  );
}
