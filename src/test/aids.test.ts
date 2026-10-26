import { describe, expect, it } from 'vitest';
import { followUpDraft, getReady, lastTouched, owesLine, readyTime, STUCK, STUCK_INFO, talkLink, whereLine, whereWasI } from '../lib/logic/aids';
import { lookingBack, monthLine, weeksInARow, weeksLine, weekStart } from '../lib/logic/history';
import { addRecord, completeStep, keepMoving, markDone, newItem, pause, startWaiting, stepBefore } from '../lib/logic/items';
import { COUNCIL_LETTER, DAY, NOW } from './fixtures';

describe('where was I?', () => {
  it('says nothing for a thing not started, so it opens plainly', () => {
    expect(whereWasI(newItem('letter', {}, NOW))).toBeUndefined();
  });

  it('gives the last step done, the next one and the reference', () => {
    let item = newItem('letter', { reference: '6001 4482 7', text: COUNCIL_LETTER }, NOW);
    item = completeStep(item, item.steps[0]?.id ?? '', NOW + 1);
    const w = whereWasI(item);
    expect(w?.last?.title).toBe('Get together what they ask for');
    expect(w?.next?.title).toBe('Write the reply');
    expect(w?.keep).toContain('Their reference: 6001 4482 7');
    expect(whereLine(w ?? { note: '', keep: [] })).toBe('You did: Get together what they ask for. Next is: Write the reply.');
  });

  it('keeps the note left when stopping, and finds the thing touched last', () => {
    const older = pause(newItem('form', {}, NOW - DAY), 'Up to section 3', NOW - DAY);
    const newer = pause(newItem('letter', {}, NOW), 'Found the account number', NOW);
    const untouched = newItem('bill', {}, NOW + 5);
    expect(whereWasI(newer)?.note).toBe('Found the account number');
    expect(lastTouched([older, untouched, newer])?.id).toBe(newer.id);
  });

  it('is not shown on things waiting or done', () => {
    let item = completeStep(newItem('letter', {}, NOW), newItem('letter').steps[0]?.id ?? '', NOW);
    item = startWaiting(item, 'their reply', NOW + 14 * DAY, NOW);
    expect(whereWasI(item)).toBeUndefined();
    expect(whereWasI(markDone(newItem('bill', {}, NOW), '', NOW))).toBeUndefined();
  });
});

describe('get ready first', () => {
  it('takes the reference and the amount from the letter for paying', () => {
    const item = newItem('bill', { text: 'Account number: AB123456\nAmount due: £84.20' }, NOW);
    const pay = item.steps.find((s) => s.type === 'pay');
    if (!pay) throw new Error('no pay step');
    const r = getReady(item, pay, NOW);
    expect(r.found[0]).toBe('The amount: £84.20');
    expect(r.found).toContain('Your bank card or banking app');
    expect(r.minutes).toBe(5);
    expect(readyTime(r, pay)).toBe('About 5 minutes to get ready, then about 10 minutes for the step.');
  });

  it('keeps your own items and time', () => {
    const item = newItem('appointment', {}, NOW);
    const attend = item.steps.find((s) => s.type === 'attend');
    if (!attend) throw new Error('no attend step');
    const r = getReady(item, { ...attend, ready: ['Glasses'], readyMinutes: 20 }, NOW);
    expect(r.own).toEqual(['Glasses']);
    expect(r.minutes).toBe(20);
    expect(readyTime(r, attend)).toBe('About 20 minutes to get ready.');
  });

  it('uses the call list for calls', () => {
    const item = newItem('call', { reference: 'WH/20931' }, NOW);
    const call = item.steps.find((s) => s.type === 'call');
    if (!call) throw new Error('no call step');
    expect(getReady(item, call, NOW).found[0]).toBe('Their reference: WH/20931');
  });
});

describe('what is stopping me?', () => {
  it('has five answers in plain words, each with its own help', () => {
    expect(STUCK).toHaveLength(5);
    for (const s of STUCK) {
      expect(STUCK_INFO[s].line).not.toMatch(/!|journey|steady/i);
    }
    expect(talkLink('big')).toBe('coach://stuck?answer=big');
  });

  it('puts a smaller or missing step just before the one on screen, and opens it', () => {
    let item = newItem('letter', {}, NOW);
    item = completeStep(item, item.steps[0]?.id ?? '', NOW);
    const next = stepBefore(item, 'Find my National Insurance number', 'find', NOW + 1);
    expect(next.steps[1]?.title).toBe('Find my National Insurance number');
    expect(next.steps[2]?.title).toBe('Write the reply');
    expect(next.at).toBe(1);
  });
});

describe('keep this moving', () => {
  it('says who owes the next step and keeps changes in the record', () => {
    let item = startWaiting(newItem('letter', { from: 'Brackenford Council', reference: '6001 4482 7' }, NOW), 'their decision', NOW + 14 * DAY, NOW);
    expect(owesLine(item)).toBe('The next step is theirs: their decision.');
    item = keepMoving(item, { owes: 'someone', who: 'Sam at the council', agreed: 'Ring back by Friday' }, NOW + DAY);
    expect(owesLine(item)).toBe('Sam at the council owes the next step: their decision.');
    expect(item.record.at(-1)?.text).toBe('Next step now with Sam at the council. They agreed: Ring back by Friday.');
  });

  it('writes a follow-up with the reference, when it was sent and what they agreed', () => {
    let item = newItem('letter', { from: 'Brackenford Council', reference: '6001 4482 7' }, NOW - 20 * DAY);
    item = addRecord(item, 'sent', 'Sent by post', { ref: 'KX123' }, NOW - 14 * DAY);
    item = startWaiting(item, 'their decision', NOW, NOW - 14 * DAY, { agreed: 'A decision within ten working days' });
    const draft = followUpDraft(item, { name: 'Jo Taylor' }, NOW);
    expect(draft).toContain('Reference: 6001 4482 7');
    expect(draft).toContain('I wrote to you on 10 October (reference KX123)');
    expect(draft).toContain('You said: A decision within ten working days.');
    expect(draft.trim().endsWith('Jo Taylor')).toBe(true);
  });
});

describe('looking back', () => {
  it('groups what was dealt with by month, newest first, and counts only what happened', () => {
    let a = newItem('bill', {}, new Date(2026, 8, 3).getTime());
    a = addRecord(a, 'paid', 'Paid', {}, new Date(2026, 8, 4).getTime());
    a = markDone(a, '', new Date(2026, 8, 4).getTime());
    const b = markDone(newItem('letter', {}, new Date(2026, 9, 1).getTime()), '', new Date(2026, 9, 2).getTime());
    const months = lookingBack([a, b]);
    expect(months.map((m) => m.label)).toEqual(['October 2026', 'September 2026']);
    const sept = months[1];
    if (!sept) throw new Error('no September');
    expect(monthLine(sept)).toBe('1 dealt with. 1 payment. 1 thing added.');
  });
});

describe('weeks in a row', () => {
  const week = 7 * DAY;
  it('counts weeks with something dealt with, and a quiet week holds the count', () => {
    const start = weekStart(NOW);
    const done = (at: number) => markDone(newItem('bill', {}, at - DAY), '', at);
    // This week, last week, a quiet week with nothing open, then the week before.
    const items = [done(start + DAY), done(start - week + DAY), done(start - 3 * week + DAY)];
    expect(weeksInARow(items, NOW)).toBe(3);
    expect(weeksLine(3)).toBe('3 weeks in a row with something dealt with.');
  });

  it('stops at a week when something was open and nothing was done, without saying so', () => {
    const start = weekStart(NOW);
    const open = newItem('form', {}, start - 3 * week);
    const done = markDone(newItem('bill', {}, start - DAY), '', start + DAY);
    expect(weeksInARow([open, done], NOW)).toBe(1);
    expect(weeksLine(1)).toBeUndefined();
    expect(weeksLine(0)).toBeUndefined();
  });
});
