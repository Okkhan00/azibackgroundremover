import { useRef, useState } from 'react';
import ZoomView, { type Frame } from './ZoomView';

interface Props {
  originalUrl: string;
  resultUrl: string;
  width: number;
  height: number;
  className?: string;
}

/** Original on the left, background-removed on the right, with a draggable divider. */
export default function BeforeAfter({ originalUrl, resultUrl, width, height, className = '' }: Props) {
  const [pos, setPos] = useState(0.5);
  const dragging = useRef(false);

  const handle = (f: Frame) => {
    const imgW = f.fitW * f.scale;
    const left = f.cw / 2 + f.tx - imgW / 2;
    const x = left + pos * imgW;
    const top = f.ch / 2 + f.ty - (f.fitH * f.scale) / 2;
    const imgH = f.fitH * f.scale;
    const setFromPointer = (clientX: number, el: HTMLElement) => {
      const rect = el.parentElement!.getBoundingClientRect();
      setPos(Math.min(1, Math.max(0, (clientX - rect.left - left) / imgW)));
    };
    return (
      <div
        role="slider"
        tabIndex={0}
        aria-label="Before and after comparison"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos * 100)}
        className="absolute z-10 flex w-10 -translate-x-1/2 cursor-ew-resize touch-none items-center justify-center outline-none"
        style={{ left: x, top: Math.max(0, top), height: Math.min(imgH, f.ch) }}
        onPointerDown={(e) => {
          e.stopPropagation();
          dragging.current = true;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => dragging.current && setFromPointer(e.clientX, e.currentTarget)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 0.03));
          if (e.key === 'ArrowRight') setPos((p) => Math.min(1, p + 0.03));
        }}
      >
        <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-gold-400 shadow-[0_0_10px_rgba(212,175,55,0.7)]" />
        <div className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-gold-400 bg-navy-900/90 text-gold-300 shadow-lg">
          <span className="text-sm font-bold leading-none">⇄</span>
        </div>
      </div>
    );
  };

  return (
    <ZoomView aspect={width / height} overlay={handle} onReset={() => setPos(0.5)} className={className} label="Before and after comparison">
      <img src={originalUrl} alt="Original" draggable={false} className="absolute inset-0 h-full w-full select-none object-fill" />
      <div className="checker absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos * 100}%)` }}>
        <img src={resultUrl} alt="Background removed" draggable={false} className="absolute inset-0 h-full w-full select-none object-fill" />
      </div>
      <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">Before</span>
      <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-royal-700/80 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">After</span>
    </ZoomView>
  );
}
