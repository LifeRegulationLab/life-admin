import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { APP_FULL_NAME } from '../lib/brand';
import { completeStep, newItem } from '../lib/logic/items';
import { renderPdf } from '../lib/papers/pdf';
import { recordDoc } from '../lib/papers/record';
import { COUNCIL_LETTER, NOW } from './fixtures';

describe('the record', () => {
  it('keeps everything together and names only the app and the person in the file', async () => {
    let item = newItem('letter', { title: 'Council Tax discount review', from: 'Brackenford Borough Council', reference: '6001 4482 7', text: COUNCIL_LETTER }, NOW);
    item = completeStep(item, item.steps[0]?.id ?? '', NOW);
    const doc = recordDoc(item, 'Jo Taylor', NOW);
    expect(doc.sections.map((s) => s.heading)).toEqual(['What it is', 'Steps', 'Record', 'The words of the original']);
    const bytes = await renderPdf(doc, new Date(NOW));
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(pdf.getAuthor()).toBe('Jo Taylor');
    expect(pdf.getCreator()).toBe(APP_FULL_NAME);
    expect(pdf.getProducer()).toBe(APP_FULL_NAME);
    const raw = new TextDecoder('latin1').decode(bytes);
    expect(raw).not.toMatch(/pdf-lib|claude|anthropic|openai|elevenlabs/i);
  });
});
