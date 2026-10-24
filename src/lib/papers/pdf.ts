import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import { APP_FULL_NAME } from '../brand';

/**
 * Turns a document into a plain, readable PDF: A4, large type, one column. The person's name is
 * the author. No tool names go in the file or its metadata.
 */

export interface DocSection {
  heading: string;
  /** Plain paragraphs. */
  paragraphs?: string[];
  /** Short lines shown as a list. */
  items?: string[];
  /** Label and value pairs, such as a contact list. */
  pairs?: [string, string][];
}

export interface Doc {
  title: string;
  subtitle?: string;
  intro?: string;
  sections: DocSection[];
  /** The footer on each page. */
  footer: string;
  author: string;
  /** Pictures of pages and receipts, each on its own page at the end. JPEG or PNG. */
  pictures?: { caption: string; bytes: Uint8Array; type: 'jpg' | 'png' }[];
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const INK = rgb(0.06, 0.08, 0.13);
const MUTED = rgb(0.34, 0.37, 0.45);
const ACCENT = rgb(0.95, 0.71, 0.27);

/** The standard PDF fonts only carry Western European characters; anything else is swapped or dropped. */
export function pdfSafe(text: string): string {
  return text
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\xA0/g, ' ')
    .replace(/\t/g, '  ')
    .replace(/[^\n\x20-\x7E¡-ÿ€]/g, '')
    .replace(/ +$/gm, '');
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of pdfSafe(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) <= width) line = next;
      else {
        if (line) out.push(line);
        line = w;
        while (font.widthOfTextAtSize(line, size) > width && line.length > 1) {
          let cut = line.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > width) cut -= 1;
          out.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      }
    }
    out.push(line);
  }
  return out;
}

export async function renderPdf(doc: Doc, now = new Date()): Promise<Uint8Array> {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = A4[0] - MARGIN * 2;
  let page: PDFPage = pdf.addPage(A4);
  let y = A4[1] - MARGIN;

  const newPage = () => {
    page = pdf.addPage(A4);
    y = A4[1] - MARGIN;
  };
  const need = (h: number) => {
    if (y - h < MARGIN + 24) newPage();
  };
  const text = (t: string, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; indent?: number; gap?: number }) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 11;
    const indent = opts.indent ?? 0;
    const lead = size * 1.45;
    for (const line of wrap(t, font, size, width - indent)) {
      need(lead);
      page.drawText(line, { x: MARGIN + indent, y: y - size, size, font, color: opts.color ?? INK });
      y -= lead;
    }
    y -= opts.gap ?? 0;
  };

  page.drawRectangle({ x: MARGIN, y: y - 4, width: 40, height: 4, color: ACCENT });
  y -= 18;
  text(doc.title, { font: bold, size: 22, gap: 4 });
  if (doc.subtitle) text(doc.subtitle, { size: 12, color: MUTED, gap: 6 });
  if (doc.intro) text(doc.intro, { size: 11, color: MUTED, gap: 10 });

  for (const s of doc.sections) {
    need(48);
    y -= 8;
    text(s.heading, { font: bold, size: 14, gap: 4 });
    for (const p of s.paragraphs ?? []) text(p, { gap: 6 });
    for (const item of s.items ?? []) {
      need(16);
      page.drawText('-', { x: MARGIN + 2, y: y - 11, size: 11, font: regular, color: MUTED });
      text(item, { indent: 14, gap: 3 });
    }
    for (const [label, value] of s.pairs ?? []) {
      text(label, { font: bold, size: 11 });
      text(value || '-', { indent: 0, gap: 5 });
    }
  }

  for (const pic of doc.pictures ?? []) {
    try {
      const img = pic.type === 'png' ? await pdf.embedPng(pic.bytes) : await pdf.embedJpg(pic.bytes);
      newPage();
      text(pic.caption, { font: bold, size: 12, gap: 6 });
      const scale = Math.min(width / img.width, (y - MARGIN - 30) / img.height, 1);
      page.drawImage(img, { x: MARGIN, y: y - img.height * scale, width: img.width * scale, height: img.height * scale });
    } catch {
      // A picture the PDF cannot hold is left out; the words are still there.
    }
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(pdfSafe(`${doc.footer}   Page ${i + 1} of ${pages.length}`), { x: MARGIN, y: 30, size: 8.5, font: regular, color: MUTED });
  });

  pdf.setTitle(pdfSafe(doc.title));
  pdf.setAuthor(pdfSafe(doc.author));
  pdf.setSubject(pdfSafe(doc.subtitle ?? doc.title));
  pdf.setCreator(APP_FULL_NAME);
  pdf.setProducer(APP_FULL_NAME);
  pdf.setCreationDate(now);
  pdf.setModificationDate(now);
  return pdf.save();
}
