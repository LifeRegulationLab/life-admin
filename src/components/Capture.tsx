import { useEffect, useRef, useState } from 'react';
import type { PageLine } from '../lib/model/types';
import { readPage } from '../lib/ocr';
import { loadPhoto, removePhoto, savePhoto, shrink } from '../lib/store/photos';
import { Picture } from './Picture';

/**
 * Getting the words in: photos of the pages (read on the phone, never uploaded), pasting an
 * email, or typing. The words can always be corrected by hand.
 */
export function Capture({
  text,
  onText,
  pageIds,
  onPages,
  lines = [],
  onLines,
  easy,
}: {
  text: string;
  onText: (t: string) => void;
  pageIds: string[];
  onPages: (ids: string[]) => void;
  lines?: PageLine[];
  onLines?: (lines: PageLine[]) => void;
  easy: boolean;
}) {
  const [mode, setMode] = useState<'photo' | 'paste' | 'type' | undefined>(pageIds.length ? 'photo' : text ? 'type' : undefined);
  const [reading, setReading] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setError('');
    const ids = [...pageIds];
    let words = text;
    let found: PageLine[] = [...lines];
    for (const [n, file] of Array.from(files).entries()) {
      setReading(`Reading page ${ids.length + 1}${files.length > 1 ? ` (${n + 1} of ${files.length})` : ''}…`);
      const small = await shrink(file);
      const id = await savePhoto(small);
      ids.push(id);
      onPages([...ids]);
      try {
        const read = await readPage(small, id);
        words = words ? `${words}\n\n${read.text}` : read.text;
        onText(words);
        found = [...found, ...read.lines];
        onLines?.(found);
      } catch {
        setError('The words on that page could not be read. You can type the important parts instead.');
      }
    }
    setReading('');
  };

  const pasteNow = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) onText(text ? `${text}\n\n${t}` : t);
    } catch {
      setError('Paste did not work here. Press and hold in the box below, then choose Paste.');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <fieldset>
        <legend className="label">{easy ? 'How do you want to add it?' : 'Add the words'}</legend>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" className="btn min-h-16 flex-col" aria-pressed={mode === 'photo'} onClick={() => { setMode('photo'); fileRef.current?.click(); }}>
            <Picture name="camera" />
            Photo
          </button>
          <button type="button" className="btn min-h-16 flex-col" aria-pressed={mode === 'paste'} onClick={() => { setMode('paste'); void pasteNow(); }}>
            <Picture name="paste" />
            Paste
          </button>
          <button type="button" className="btn min-h-16 flex-col" aria-pressed={mode === 'type'} onClick={() => setMode('type')}>
            <Picture name="type" />
            Type
          </button>
        </div>
      </fieldset>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        aria-label="Take or choose photos of the pages"
        onChange={(e) => {
          void addPhotos(e.target.files);
          e.target.value = '';
        }}
      />
      {pageIds.length ? (
        <div className="flex flex-wrap gap-2">
          {pageIds.map((id, i) => (
            <Thumb key={id} id={id} label={`Page ${i + 1}`} onRemove={() => { void removePhoto(id); onPages(pageIds.filter((x) => x !== id)); onLines?.(lines.filter((l) => l.page !== id)); }} />
          ))}
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Add a page
          </button>
        </div>
      ) : null}
      {reading ? <p role="status">{reading}</p> : null}
      {error ? <p className="warnbox">{error}</p> : null}
      {mode ? (
        <label className="block">
          <span className="label">{mode === 'photo' ? 'The words we read. Correct anything that looks wrong.' : 'The words'}</span>
          <textarea className="field" rows={8} value={text} onChange={(e) => onText(e.target.value)} />
        </label>
      ) : null}
      <p className="muted text-sm">Photos stay on this phone. The words are read on the phone too.</p>
    </div>
  );
}

export function Thumb({ id, label, onRemove }: { id: string; label: string; onRemove?: () => void }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let made: string | undefined;
    let live = true;
    void loadPhoto(id).then((b) => {
      if (!b || !live) return;
      made = URL.createObjectURL(b);
      setUrl(made);
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);
  return (
    <figure className="relative">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={label} className="h-24 w-20 rounded-lg border border-[var(--line)] object-cover" />
        </a>
      ) : (
        <div className="muted flex h-24 w-20 items-center justify-center rounded-lg border border-dashed text-xs">{label}</div>
      )}
      {onRemove ? (
        <button type="button" className="chip absolute -top-2 -right-2 min-h-8 px-2" aria-label={`Remove ${label}`} onClick={onRemove}>
          ×
        </button>
      ) : null}
    </figure>
  );
}
