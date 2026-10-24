// Text recognition, done on the device: nothing is sent anywhere. The engine and its English data
// ship with the app (see ocrFiles in vite.config.ts), so it works with no signal too.
import type { Worker } from 'tesseract.js';

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

/** Reads the words in a picture of a page, line by line. */
export async function readPicture(picture: Blob): Promise<string> {
  const w = await getWorker();
  const { data } = await w.recognize(picture, {}, { blocks: true, text: false });
  const lines: string[] = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        const text = line.words
          .filter((x) => x.confidence > 30)
          .map((x) => x.text)
          .join(' ')
          .trim();
        if (text) lines.push(text);
      }
      lines.push('');
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
