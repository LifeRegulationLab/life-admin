import type { PageLine } from '../model/types';

/**
 * Finds the line on a photo that a quote came from, so the app can show the line itself rather than
 * ask the person to trust the reading. A line counts only if most of its words are in the quote.
 */

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9£.]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 1 || /\d/.test(w));
}

export function findLine(lines: readonly PageLine[] | undefined, quote: string): PageLine | undefined {
  const q = new Set(words(quote));
  if (!lines?.length || q.size === 0) return undefined;
  let best: { line: PageLine; score: number } | undefined;
  for (const line of lines) {
    const w = words(line.text);
    if (w.length < 2 && q.size > 1) continue;
    const hit = w.filter((x) => q.has(x)).length;
    const score = hit / Math.max(w.length, Math.min(q.size, 6));
    if (score > (best?.score ?? 0)) best = { line, score };
  }
  return best && best.score >= 0.6 ? best.line : undefined;
}

/** The area to cut from the photo: the line with a little room around it, kept inside the page. */
export function cropBox(box: PageLine['box'], pad = 0.012): PageLine['box'] {
  const [l, t, r, b] = box;
  const clamp = (n: number) => Math.min(1, Math.max(0, n));
  return [clamp(l - pad), clamp(t - pad * 1.5), clamp(r + pad), clamp(b + pad * 1.5)];
}
