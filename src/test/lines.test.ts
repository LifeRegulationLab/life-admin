import { describe, expect, it } from 'vitest';
import { cropBox, findLine } from '../lib/logic/lines';
import type { PageLine } from '../lib/model/types';

const L = (text: string, top: number): PageLine => ({ page: 'p1', text, box: [0.1, top, 0.9, top + 0.02] });
const lines = [L('Brackenford Borough Council', 0.05), L('Please reply by 21 November 2026.', 0.4), L('Amount due £148.20', 0.5), L('Yours faithfully', 0.8)];

describe('show me on the letter', () => {
  it('finds the line a quote came from', () => {
    expect(findLine(lines, 'Please reply by 21 November 2026.')?.box[1]).toBe(0.4);
    expect(findLine(lines, 'The council says: please reply by 21 November 2026 or we may remove the discount.')?.box[1]).toBe(0.4);
    expect(findLine(lines, 'Amount due £148.20')?.box[1]).toBe(0.5);
  });

  it('shows nothing rather than a wrong line', () => {
    expect(findLine(lines, 'Your MOT is due')).toBeUndefined();
    expect(findLine(undefined, 'Please reply')).toBeUndefined();
    expect(findLine(lines, '')).toBeUndefined();
  });

  it('keeps the crop inside the page', () => {
    expect(cropBox([0, 0, 1, 1])).toEqual([0, 0, 1, 1]);
    const [l, t, r, b] = cropBox([0.2, 0.4, 0.8, 0.42]);
    expect(l).toBeLessThan(0.2);
    expect(t).toBeLessThan(0.4);
    expect(r).toBeGreaterThan(0.8);
    expect(b).toBeGreaterThan(0.42);
  });
});
