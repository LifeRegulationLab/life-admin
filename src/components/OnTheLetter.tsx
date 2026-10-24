import { useEffect, useState } from 'react';
import { cropBox, findLine } from '../lib/logic/lines';
import type { Item, PageLine } from '../lib/model/types';
import { loadPhoto } from '../lib/store/photos';

/** Cuts one line out of the photo of the page, so the person sees the letter's own words. */
async function cut(line: PageLine): Promise<string | undefined> {
  const blob = await loadPhoto(line.page);
  if (!blob) return undefined;
  const bitmap = await createImageBitmap(blob);
  const [l, t, r, b] = cropBox(line.box);
  const sx = l * bitmap.width;
  const sy = t * bitmap.height;
  const sw = Math.max(1, (r - l) * bitmap.width);
  const sh = Math.max(1, (b - t) * bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  canvas.getContext('2d')?.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.9);
}

/**
 * "Show me on the letter": the picture of the line a fact was read from. Only offered when the
 * photo is on this phone and the line can be found; otherwise the quoted words are shown alone.
 */
export function OnTheLetter({ item, quote }: { item: Item; quote: string }) {
  const line = findLine(item.lines, quote);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>();

  useEffect(() => {
    if (!open || !line) return;
    let live = true;
    void cut(line)
      .then((u) => live && setUrl(u ?? null))
      .catch(() => live && setUrl(null));
    return () => {
      live = false;
    };
  }, [open, line]);

  if (!line) return null;
  return (
    <span className="flex flex-col gap-1">
      <button type="button" className="self-start text-sm underline" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide' : 'Show me on the letter'}
      </button>
      {open ? (
        url ? (
          <img src={url} alt={`The line on the letter: ${line.text}`} className="max-w-full rounded border border-[var(--line)]" />
        ) : url === null ? (
          <span className="muted text-sm">The photo is not on this phone.</span>
        ) : (
          <span className="muted text-sm">Finding it…</span>
        )
      ) : null}
    </span>
  );
}

/** A fact the app found, with the words it came from and an honest label. */
export function FoundFact({ item, label, value, quote, unsure, href }: { item: Item; label: string; value: string; quote?: string; unsure?: string | undefined; href?: string }) {
  return (
    <div className="flex flex-col gap-1 border-t border-[var(--line)] pt-2 first:border-0 first:pt-0">
      <p>
        <span className="muted">{label}: </span>
        {href ? <a href={href}>{value}</a> : <span className="font-semibold">{value}</span>}
      </p>
      {quote ? <blockquote className="quote text-sm">{quote}</blockquote> : null}
      <Unsure reason={unsure} />
      {quote ? <OnTheLetter item={item} quote={quote} /> : null}
    </div>
  );
}

/** "Check this", with the reason, when there is one. Otherwise the usual quiet line. */
export function Unsure({ reason }: { reason?: string | undefined }) {
  return reason ? <p className="warnbox text-sm">Check this: {reason}</p> : <p className="muted text-xs">Read by the app. Check this on the letter.</p>;
}
