import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

export interface Frame {
  /** Container size. */
  cw: number;
  ch: number;
  /** Size of the image box at scale 1 ("fit to screen"). */
  fitW: number;
  fitH: number;
  scale: number;
  tx: number;
  ty: number;
}

interface Props {
  /** width / height of the content */
  aspect: number;
  children: ReactNode;
  /** Rendered above the zoomed content, in container space (for the comparison handle). */
  overlay?: (f: Frame) => ReactNode;
  onReset?: () => void;
  className?: string;
  label?: string;
}

const MIN = 1;
const MAX = 10;

/** Zoom + pan container: wheel / pinch / buttons to zoom, drag to pan. */
export default function ZoomView({ aspect, children, overlay, onReset, className = '', label = 'Image preview' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 300, h: 300 });
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastDist = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const safeAspect = aspect > 0 && isFinite(aspect) ? aspect : 1;
  const fitW = Math.max(1, Math.min(size.w, size.h * safeAspect));
  const fitH = fitW / safeAspect;

  const clamp = useCallback(
    (scale: number, tx: number, ty: number) => {
      const s = Math.min(MAX, Math.max(MIN, scale));
      const mx = Math.max(0, (fitW * s - size.w) / 2 + 40);
      const my = Math.max(0, (fitH * s - size.h) / 2 + 40);
      return { scale: s, tx: s === MIN ? 0 : Math.min(mx, Math.max(-mx, tx)), ty: s === MIN ? 0 : Math.min(my, Math.max(-my, ty)) };
    },
    [fitW, fitH, size.w, size.h],
  );

  const zoomBy = useCallback(
    (factor: number) => setView((v) => clamp(v.scale * factor, v.tx * factor, v.ty * factor)),
    [clamp],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      lastDist.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastDist.current > 0) zoomBy(dist / lastDist.current);
      lastDist.current = dist;
    } else if (pointers.current.size === 1) {
      setView((v) => (v.scale > 1 ? clamp(v.scale, v.tx + dx, v.ty + dy) : v));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    lastDist.current = 0;
  };

  const fit = () => setView({ scale: 1, tx: 0, ty: 0 });
  const reset = () => {
    fit();
    onReset?.();
  };

  const frame: Frame = { cw: size.w, ch: size.h, fitW, fitH, scale: view.scale, tx: view.tx, ty: view.ty };

  return (
    <div className={`relative ${className}`}>
      <div
        ref={ref}
        role="img"
        aria-label={label}
        className="checker relative h-full w-full touch-none select-none overflow-hidden rounded-2xl"
        style={{ cursor: view.scale > 1 ? 'grab' : 'default' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => (view.scale > 1 ? fit() : zoomBy(2.5))}
      >
        <div
          className="absolute"
          style={{
            width: fitW,
            height: fitH,
            left: (size.w - fitW) / 2,
            top: (size.h - fitH) / 2,
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
            transformOrigin: 'center center',
          }}
        >
          {children}
        </div>
        {overlay?.(frame)}
      </div>

      <div className="absolute bottom-2 right-2 flex gap-1 rounded-xl border border-white/10 bg-navy-900/85 p-1 backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
        <button className="btn btn-ghost !min-h-10 !px-2.5" onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out" title="Zoom out">
          <ZoomOut size={18} />
        </button>
        <span className="flex min-w-12 items-center justify-center text-xs tabular-nums text-white/70">{Math.round(view.scale * 100)}%</span>
        <button className="btn btn-ghost !min-h-10 !px-2.5" onClick={() => zoomBy(1.3)} aria-label="Zoom in" title="Zoom in">
          <ZoomIn size={18} />
        </button>
        <button className="btn btn-ghost !min-h-10 !px-2.5" onClick={fit} aria-label="Fit to screen" title="Fit to screen">
          <Maximize2 size={18} />
        </button>
        <button className="btn btn-ghost !min-h-10 !px-2.5" onClick={reset} aria-label="Reset preview" title="Reset preview">
          <RotateCcw size={18} />
        </button>
      </div>
    </div>
  );
}
