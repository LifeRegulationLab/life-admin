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
