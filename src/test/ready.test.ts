import { describe, expect, it } from 'vitest';
import { addRecord, newItem, notToMiss, startWaiting } from '../lib/logic/items';
import { haveReady } from '../lib/logic/ready';
import { COUNCIL_LETTER, DAY, NOW } from './fixtures';

describe('have ready for the call', () => {
  it('lists the reference, the number and what to write on, taken from the letter', () => {
    const item = newItem('letter', { text: COUNCIL_LETTER, reference: '6001 4482 7' }, NOW);
    const ready = haveReady(item, NOW);
    expect(ready[0]).toBe('Their reference: 6001 4482 7');
    expect(ready.filter((l) => l.includes('6001 4482 7'))).toHaveLength(1);
    expect(ready).toContain('Their number: 01632 960 412');
    expect(ready.at(-1)).toContain('Something to write on');
  });

  it('adds when it was sent and the last call, from the record', () => {
    let item = newItem('letter', { text: 'Our ref: WH/20931' }, NOW - 20 * DAY);
    item = addRecord(item, 'sent', 'Sent by post', { ref: 'KX123' }, NOW - 10 * DAY);
    item = addRecord(item, 'call', 'Spoke to Sam, they will look into it.', {}, NOW - 2 * DAY);
    const ready = haveReady(item, NOW);
    expect(ready.some((l) => l.startsWith('When you sent it: 14 October, reference KX123'))).toBe(true);
    expect(ready.some((l) => l.startsWith('Last call: 22 October. Spoke to Sam'))).toBe(true);
  });

  it('says plainly when there is no reference', () => {
    expect(haveReady(newItem('call', { title: 'Ring the bank' }, NOW), NOW)[0]).toContain('No reference found');
  });
});

describe('dates not to miss', () => {
  it('keeps a close date in sight when the list on screen does not show it', () => {
    const near = newItem('letter', { title: 'Near', dueAt: NOW + 2 * DAY }, NOW);
    const far = newItem('letter', { title: 'Far', dueAt: NOW + 20 * DAY }, NOW);
    const late = newItem('bill', { title: 'Late', dueAt: NOW - 3 * DAY }, NOW);
    const pile = { ...newItem('letter', { title: 'Pile', dueAt: NOW + DAY }, NOW), unsorted: true };
    const waiting = startWaiting(newItem('letter', { title: 'Waiting', dueAt: NOW + DAY }, NOW), 'their reply', NOW + 14 * DAY, NOW);
    const out = notToMiss([near, far, late, pile, waiting], [late.id], NOW);
    expect(out.map((i) => i.title)).toEqual(['Pile', 'Near']);
  });
});
