import { useRef, useState, type ReactNode } from 'react';
import { Upload } from 'lucide-react';
import { ACCEPT_ATTR } from '../lib/names';

interface Props {
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  title: string;
  hint?: string;
  compact?: boolean;
  children?: ReactNode;
  testId?: string;
}

export default function DropZone({ multiple, onFiles, title, hint = 'JPG, JPEG, PNG or WEBP', compact, children, testId }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = (list: FileList | null) => {
    if (list && list.length) onFiles(Array.from(list));
  };

  return (
    <div
      className={`glass fade-up flex flex-col items-center justify-center text-center transition-colors ${compact ? 'gap-2 p-5' : 'gap-3 p-8 sm:p-12'} ${
        over ? '!border-gold-400 !bg-royal-600/15' : 'border-dashed'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-royal-600/25 text-royal-300">
        <Upload size={26} />
      </div>
      <div>
        <p className="font-display text-lg font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-white/55">{hint}. Drag and drop here, or choose from your device.</p>
      </div>
      <button className="btn btn-primary mt-1" onClick={() => input.current?.click()}>
        <Upload size={18} /> {multiple ? 'Choose images' : 'Choose image'}
      </button>
      <input
        ref={input}
        data-testid={testId}
        type="file"
        accept={ACCEPT_ATTR}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          take(e.target.files);
          e.target.value = ''; // allow picking the same file again
        }}
      />
      {children}
    </div>
  );
}
