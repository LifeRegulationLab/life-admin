// Text recognition, done on the device: nothing is sent anywhere. The engine and its English data
// ship with the app (see ocrFiles in vite.config.ts), so it works with no signal too.
import type { Worker } from 'tesseract.js';
import type { PageLine } from './model/types';

let worker: Promise<Worker> | null = null;

const here = (path: string) => new URL(import.meta.env.BASE_URL + path, location.href).href;

function getWorker(): Promise<Worker> {
  worker ??= import('tesseract.js').then(({ createWorker, OEM }) =>
    createWorker('eng', OEM.LSTM_ONLY, {
      workerPath: here('ocr/worker.min.js'),
      corePath: here('ocr/'),
      langPath: here('ocr'),
      gzip: true,
      workerBlobURL: false,
    }),
  );
  return worker;
}

async function size(picture: Blob): Promise<{ w: number; h: number }> {
  try {
    const b = await createImageBitmap(picture);
    return { w: b.width, h: b.height };
  } catch {
    return { w: 0, h: 0 };
  }
}

/** Reads the words in a picture of a page, line by line, and where each line sits. */
export async function readPage(picture: Blob, pageId: string): Promise<{ text: string; lines: PageLine[] }> {
  const w = await getWorker();
  const [{ data }, dim] = await Promise.all([w.recognize(picture, {}, { blocks: true, text: false }), size(picture)]);
  const out: string[] = [];
  const lines: PageLine[] = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        const words = line.words.filter((x) => x.confidence > 30);
        const text = words
          .map((x) => x.text)
          .join(' ')
          .trim();
        if (!text) continue;
        out.push(text);
        if (dim.w && dim.h) {
          const b = line.bbox;
          lines.push({ page: pageId, text, box: [b.x0 / dim.w, b.y0 / dim.h, b.x1 / dim.w, b.y1 / dim.h] });
        }
      }
      out.push('');
    }
  }
  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n').trim(), lines };
}
