import { describe, expect, it } from 'vitest';
import { findAmounts, findDates, findPhones, findReferences, readFacts, scamSigns } from '../lib/logic/facts';
import { COUNCIL_LETTER, NOW } from './fixtures';

const today = new Date(NOW);
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();

describe('facts found on the device', () => {
  it('finds the deadline in the council letter, with the words it came from', () => {
    const f = readFacts(COUNCIL_LETTER, today);
    expect(f.deadline?.value).toBe(day(2026, 11, 21));
    expect(f.deadline?.quote).toContain('Please reply by 21 November 2026');
    expect(f.from).toBe('Brackenford Borough Council');
    expect(f.references[0]?.value).toBe('6001 4482 7');
    expect(f.phones[0]?.value).toBe('01632 960 412');
    expect(f.scam).toEqual([]);
  });

  it('reads UK date styles, day first', () => {
    expect(findDates('Due 03/04/2027', today)[0]?.value).toBe(day(2027, 4, 3));
    expect(findDates('by 5th Jan 2027', today)[0]?.value).toBe(day(2027, 1, 5));
    expect(findDates('on 12.12.26', today)[0]?.value).toBe(day(2026, 12, 12));
    expect(findDates('31/02/2027', today)).toEqual([]);
  });

  it('puts a date with no year in the coming year when it has passed', () => {
    expect(findDates('by 3 January', today)[0]?.value).toBe(day(2027, 1, 3));
  });

  it('finds amounts, references and phone numbers', () => {
    expect(findAmounts('Amount due £1,204.50 by direct debit').map((a) => a.value)).toEqual(['£1,204.50']);
    expect(findReferences('Our ref: WH/20931 thanks')[0]?.value).toBe('WH/20931');
    expect(findReferences('Reference number ABC')).toEqual([]);
    expect(findPhones('Call 0800 138 1111 or +44 20 7946 0000').map((p) => p.value)).toEqual(['0800 138 1111', '+44 20 7946 0000']);
  });

  it('warns about signs of a scam, but not about ordinary letters', () => {
    expect(scamSigns('Pay the fine today with iTunes gift cards')).toHaveLength(1);
    expect(scamSigns('Please confirm your PIN by reply')).toHaveLength(1);
    expect(scamSigns('You can set a password on your online account.')).toEqual([]);
    expect(scamSigns(COUNCIL_LETTER)).toEqual([]);
  });
});

describe('references', () => {
  it('reads a National Insurance number', () => {
    expect(findReferences('National Insurance number: QQ 12 34 56 C')[0]?.value).toBe('QQ 12 34 56 C');
  });
});

describe('within so many days', () => {
  it('counts from the date of the letter', async () => {
    const { findWithin, findDeadline } = await import('../lib/logic/facts');
    const today = new Date(2026, 9, 24, 12);
    const text = 'Date: 20 October 2026\nPlease send the form within 28 days of the date of this letter.';
    const w = findWithin(text, today);
    expect(new Date(w?.value ?? 0).toDateString()).toBe(new Date(2026, 10, 17).toDateString());
    expect(w?.quote).toContain('within 28 days');
    expect(findDeadline(text, today)?.value).toBe(w?.value);
  });

  it('understands words, weeks and working days', async () => {
    const { findWithin } = await import('../lib/logic/facts');
    const today = new Date(2026, 9, 24, 12);
    expect(new Date(findWithin('Dated 19 October 2026. Reply within fourteen days.', today)?.value ?? 0).toDateString()).toBe(new Date(2026, 10, 2).toDateString());
    expect(new Date(findWithin('Dated 19 October 2026. Reply within 2 weeks.', today)?.value ?? 0).toDateString()).toBe(new Date(2026, 10, 2).toDateString());
    // Friday 23 October plus 5 working days is Friday 30 October.
    expect(new Date(findWithin('Dated 23 October 2026. Pay within 5 working days.', today)?.value ?? 0).toDateString()).toBe(new Date(2026, 9, 30).toDateString());
    expect(findWithin('Please reply soon.', today)).toBeUndefined();
  });
});

describe('check this', () => {
  it('says when the day and month could be either way round, and not when they could not', () => {
    expect(findDates('Due 03/04/2027', today)[0]?.unsure).toContain('either way round');
    expect(findDates('Due 25/04/2027', today)[0]?.unsure).toBeUndefined();
    expect(findDates('Due 21 November 2026', today)[0]?.unsure).toBeUndefined();
  });

  it('says when the year is a guess', () => {
    expect(findDates('by 3 January', today)[0]?.unsure).toContain('No year');
  });

  it('says when there is more than one deadline date', async () => {
    const { findDeadline } = await import('../lib/logic/facts');
    const d = findDeadline('Reply by 21 November 2026. Payment is due by 30 November 2026.', today);
    expect(d?.value).toBe(day(2026, 11, 21));
    expect(d?.unsure).toContain('more than one date');
    expect(readFacts(COUNCIL_LETTER, today).deadline?.unsure).toBeUndefined();
  });

  it('says how a "within" deadline was counted', async () => {
    const { findWithin } = await import('../lib/logic/facts');
    expect(findWithin('Date: 20 October 2026\nReply within 28 days.', today)?.unsure).toContain('counted from the date on the letter');
    expect(findWithin('Reply within 28 days.', today)?.unsure).toContain('counted from the day it was added');
  });

  it('flags several amounts, and references with look-alike letters', () => {
    expect(findAmounts('Total £120.00, of which £20.00 is a fee')[0]?.unsure).toContain('more than one amount');
    expect(findAmounts('Amount due £1,204.50')[0]?.unsure).toBeUndefined();
    expect(findReferences('Our ref: WO/2O931')[0]?.unsure).toContain('look like numbers');
    expect(findReferences('Our ref: WH/20931')[0]?.unsure).toBeUndefined();
  });
});
