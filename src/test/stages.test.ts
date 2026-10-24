import { describe, expect, it } from 'vitest';
import { addRecord, completeStep, newItem, replyCame, startWaiting } from '../lib/logic/items';
import { stages } from '../lib/logic/stages';

describe('the stages of done', () => {
  it('follows a letter from reply to their response', () => {
    let item = newItem('letter', {}, 1);
    expect(stages(item).map((s) => s.key)).toEqual(['prepared', 'sent', 'proof', 'received']);
    expect(stages(item).every((s) => !s.done)).toBe(true);
    const step = (t: string) => item.steps.find((s) => s.type === t)?.id ?? '';
    item = completeStep(item, step('find'), 2);
    item = completeStep(item, step('reply'), 3);
    item = completeStep(item, step('send'), 4);
    item = addRecord(item, 'proof', 'Certificate of posting', { ref: 'AB123' }, 5);
    item = startWaiting(item, 'their decision', 100, 6);
    expect(stages(item).filter((s) => s.done).map((s) => s.key)).toEqual(['prepared', 'sent', 'proof']);
    item = replyCame(item, 'They agreed.', 7);
    expect(stages(item).every((s) => s.done)).toBe(true);
  });

  it('shows only the stages that apply', () => {
    expect(stages(newItem('bill', {}, 1)).map((s) => s.label)).toEqual(['Paid', 'Proof kept']);
    expect(stages(newItem('appointment', {}, 1))).toEqual([]);
  });
});
