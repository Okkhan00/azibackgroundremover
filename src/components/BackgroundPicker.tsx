import { useRef } from 'react';
import { ImagePlus } from 'lucide-react';
import { ACCEPT_ATTR, isSupportedImage } from '../lib/names';

export type BackgroundChoice =
  | { kind: 'transparent' }
  | { kind: 'color'; color: string; label: string }
  | { kind: 'image'; file: File; url: string };

export const PRESETS: { label: string; choice: BackgroundChoice }[] = [
  { label: 'Transparent', choice: { kind: 'transparent' } },
  { label: 'White', choice: { kind: 'color', color: '#ffffff', label: 'White' } },
  { label: 'Black', choice: { kind: 'color', color: '#000000', label: 'Black' } },
  { label: 'Red', choice: { kind: 'color', color: '#e11d1d', label: 'Red' } },
  { label: 'Blue', choice: { kind: 'color', color: '#1f4bff', label: 'Blue' } },
  { label: 'Green', choice: { kind: 'color', color: '#16a34a', label: 'Green' } },
];

interface Props {
  value: BackgroundChoice;
  onChange: (c: BackgroundChoice) => void;
  onError: (msg: string) => void;
}

const same = (a: BackgroundChoice, b: BackgroundChoice) => a.kind === b.kind && (a.kind !== 'color' || (b.kind === 'color' && a.color === b.color));

export default function BackgroundPicker({ value, onChange, onError }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const customColor = value.kind === 'color' && value.label === 'Custom' ? value.color : '#7c3aed';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Background">
        {PRESETS.map((p) => {
          const active = same(value, p.choice);
          return (
            <button
              key={p.label}
              role="radio"
              aria-checked={active}
              onClick={() => onChange(p.choice)}
              className={`flex w-[4.4rem] flex-col items-center gap-1.5 rounded-xl border p-2 text-[11px] transition ${
                active ? 'border-gold-400 bg-gold-400/10 text-gold-300' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              <span
                className={`h-9 w-9 rounded-lg border border-white/20 ${p.choice.kind === 'transparent' ? 'checker' : ''}`}
                style={p.choice.kind === 'color' ? { background: p.choice.color } : undefined}
              />
              {p.label}
            </button>
          );
        })}
        <label
          className={`flex w-[4.4rem] cursor-pointer flex-col items-center gap-1.5 rounded-xl border p-2 text-[11px] transition ${
            value.kind === 'color' && value.label === 'Custom' ? 'border-gold-400 bg-gold-400/10 text-gold-300' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
          }`}
        >
          <input
            type="color"
            aria-label="Custom background colour"
            value={customColor}
            onChange={(e) => onChange({ kind: 'color', color: e.target.value, label: 'Custom' })}
            className="h-9 w-9 cursor-pointer rounded-lg border border-white/20 bg-transparent p-0"
          />
          Custom
        </label>
        <button
          onClick={() => fileInput.current?.click()}
          className={`flex w-[4.4rem] flex-col items-center gap-1.5 rounded-xl border p-2 text-[11px] transition ${
            value.kind === 'image' ? 'border-gold-400 bg-gold-400/10 text-gold-300' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
          }`}
        >
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-white/20 bg-white/5">
            {value.kind === 'image' ? <img src={value.url} alt="" className="h-full w-full object-cover" /> : <ImagePlus size={18} />}
          </span>
          Image
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT_ATTR}
          className="hidden"
          data-testid="bg-image-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            if (!isSupportedImage(f)) {
              onError('Background image must be JPG, JPEG, PNG or WEBP.');
              return;
            }
            if (value.kind === 'image') URL.revokeObjectURL(value.url);
            onChange({ kind: 'image', file: f, url: URL.createObjectURL(f) });
          }}
        />
      </div>
    </div>
  );
}
