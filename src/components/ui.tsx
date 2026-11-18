import { useId } from 'react';
import { X } from 'lucide-react';
import { useWorkspace } from '../state/workspace';

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div className="w-full" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? 'Progress'}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-royal-600 via-royal-400 to-gold-400 transition-[width] duration-300" style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </div>
      {label && (
        <p className="mt-1.5 flex justify-between text-xs text-white/60">
          <span>{label}</span>
          <span className="tabular-nums">{Math.round(value)}%</span>
        </p>
      )}
    </div>
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  // Unique ids: a hidden (display:none) copy of the logo must not own the gradients another copy uses.
  const uid = useId().replace(/:/g, '');
  const g1 = `lg1-${uid}`;
  const g2 = `lg2-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={g1} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#5b21b6" />
        </linearGradient>
        <linearGradient id={g2} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0d98a" />
          <stop offset="1" stopColor="#d4af37" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${g1})`} />
      <circle cx="32" cy="24" r="9" fill="none" stroke={`url(#${g2})`} strokeWidth="3.5" />
      <path d="M14 50c2-11 10-16 18-16s16 5 18 16" fill="none" stroke={`url(#${g2})`} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M12 12l5 0M12 12l0 5M52 12l-5 0M52 12l0 5" stroke="#fff" strokeOpacity=".55" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="mt-10 pb-4 text-center text-xs tracking-[0.25em] text-white/40">
      <span className="gold-text font-semibold">AZI CREATION</span>
    </footer>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useWorkspace();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 p-3 safe-top" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto fade-up flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur ${
            t.kind === 'error' ? 'border-red-400/40 bg-red-950/85 text-red-100' : t.kind === 'success' ? 'border-emerald-400/40 bg-emerald-950/85 text-emerald-100' : 'border-white/15 bg-navy-800/95 text-white'
          }`}
          role={t.kind === 'error' ? 'alert' : 'status'}
        >
          <span className="flex-1 break-words">{t.text}</span>
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-white/60">{subtitle}</p>}
    </div>
  );
}
