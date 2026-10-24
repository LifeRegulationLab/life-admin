import { describe, expect, it } from 'vitest';
import { completeStep, currentStep, lists, markDone, needsChasing, newItem, nothingToDo, pause, replyCame, startWaiting, whenWords } from '../lib/logic/items';
import { DAY, NOW } from './fixtures';

describe('dealing with a thing', () => {
  it('gives each kind its usual steps', () => {
    expect(newItem('letter', {}, NOW).steps.map((s) => s.type)).toEqual(['find', 'reply', 'send', 'proof', 'wait']);
    expect(newItem('bill', {}, NOW).steps.map((s) => s.type)).toEqual(['check', 'pay', 'proof']);
    expect(newItem('call', {}, NOW).steps.map((s) => s.type)).toEqual(['find', 'call', 'wait']);
  });

  it('moves one step at a time and keeps each in the record', () => {
    let item = newItem('bill', {}, NOW);
    const [a, b] = item.steps;
    item = completeStep(item, a?.id ?? '', NOW);
    expect(item.status).toBe('working');
    expect(currentStep(item)?.id).toBe(b?.id);
    item = completeStep({ ...item, steps: item.steps.map((s) => (s.id === b?.id ? { ...s, amount: '£40.00', how: 'online' as const } : s)) }, b?.id ?? '', NOW + 1);
    expect(item.record.at(-1)).toMatchObject({ kind: 'paid', text: 'Pay it: by online. £40.00' });
    item = completeStep(item, item.steps[2]?.id ?? '', NOW + 2);
    expect(item.status).toBe('done');
    expect(item.doneAt).toBe(NOW + 2);
  });

  it('keeps where I got to when stopping part way', () => {
    const item = pause(newItem('form', {}, NOW), ' Up to section 3 ', NOW);
    expect(item.pausedNote).toBe('Up to section 3');
    expect(item.status).toBe('working');
  });

  it('keeps waiting apart, and brings it back when it is time to chase', () => {
    const due = newItem('letter', { dueAt: NOW + 5 * DAY }, NOW);
    const later = newItem('letter', { dueAt: NOW + 20 * DAY }, NOW);
    const nodate = newItem('form', {}, NOW);
    const waiting = startWaiting(newItem('letter', {}, NOW), 'their decision', NOW + 14 * DAY, NOW);
    const l = lists([nodate, later, waiting, due], NOW);
    expect(l.next.map((i) => i.id)).toEqual([due.id, later.id, nodate.id]);
    expect(l.waiting.map((i) => i.id)).toEqual([waiting.id]);
    expect(needsChasing(waiting, NOW + 15 * DAY)).toBe(true);
    expect(lists([waiting], NOW + 15 * DAY).next.map((i) => i.id)).toEqual([waiting.id]);
  });

  it('finishes the wait step when their reply comes', () => {
    let item = newItem('call', {}, NOW);
    item = completeStep(item, item.steps[0]?.id ?? '', NOW);
    item = completeStep(item, item.steps[1]?.id ?? '', NOW);
    item = startWaiting(item, 'a call back', NOW + 3 * DAY, NOW);
    item = replyCame(item, 'They rang and fixed it', NOW + DAY);
    expect(item.status).toBe('done');
    expect(item.waiting).toBeUndefined();
    expect(item.record.some((r) => r.kind === 'received')).toBe(true);
  });

  it('files a thing that needs nothing as dealt with', () => {
    const item = nothingToDo(newItem('letter', {}, NOW), NOW);
    expect(item.status).toBe('done');
    expect(item.record.at(-1)?.text).toContain('Nothing needed');
    expect(markDone(newItem('other', {}, NOW), '', NOW).record.at(-1)?.text).toBe('Dealt with.');
  });

  it('keeps unsorted pile items out of the to-do list', () => {
    const pile = newItem('letter', { unsorted: true }, NOW);
    const l = lists([pile], NOW);
    expect(l.next).toEqual([]);
    expect(l.unsorted).toHaveLength(1);
  });

  it('says how near a date is in plain words', () => {
    expect(whenWords(undefined, NOW)).toBe('No date');
    expect(whenWords(NOW, NOW)).toBe('Due today');
    expect(whenWords(NOW + DAY, NOW)).toBe('Due tomorrow');
    expect(whenWords(NOW + 5 * DAY, NOW)).toBe('Due in 5 days');
    expect(whenWords(NOW - 3 * DAY, NOW)).toBe('3 days late');
  });
});
