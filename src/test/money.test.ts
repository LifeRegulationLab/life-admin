import { describe, expect, it } from 'vitest';
import { benefitDates, benefitTask, expectedPayments, inPeriod, moneyCsv, monthPeriod, occurrence, parseMoney, totals, validBenefit, validDate, validEntry } from '../lib/logic/money';
import type { Benefit, MoneyEntry } from '../lib/model/money';
import { benefitRemindersFor, remindersFor } from '../lib/reminders';
import { COLLECTIONS } from '../lib/store/backend';
import { LocalBackend, MemoryStorage } from '../lib/store/local';

const benefit = (extra: Partial<Benefit> = {}): Benefit => ({ id: 'b1', name: 'Example benefit', jurisdiction: 'Guernsey', status: 'Awarded', reference: '', notes: '', itemId: '', periodStart: '2026-10-15', periodEnd: '2026-11-14', reportDue: '2026-11-15', reviewDue: '', paymentDate: '2026-11-01', paymentPence: 12000, frequency: 'weekly', archived: false, updatedAt: 1, ...extra });
const entry = (extra: Partial<MoneyEntry> = {}): MoneyEntry => ({ id: 'e1', kind: 'wages', title: 'Pay', pence: 30000, date: '2026-11-01', state: 'settled', benefitId: '', occurrenceDate: '', itemId: '', evidence: '', notes: '', archived: false, updatedAt: 1, ...extra });

describe('exact amounts and local calendar dates', () => {
  it.each([['0', 0], ['10.01', 1001], ['£1,234.50', 123450], ['0.1', 10], [' 23 ', 2300]])('parses %s as whole pence', (input, expected) => expect(parseMoney(input)).toBe(expected));
  it.each(['', '-1', '1e3', '1.999', 'Infinity', '12,34', '£', '90000000000'])('rejects invalid amount %s', input => expect(parseMoney(input)).toBeNull());
  it('rejects overflowing dates and treats leap days correctly', () => {
    expect(validDate('2026-02-30')).toBe(false); expect(validDate('2028-02-29')).toBe(true); expect(validDate('2026-02-29')).toBe(false);
    expect(monthPeriod('2028-02-29')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });
  it('keeps monthly anchors through short months', () => {
    expect(occurrence('2026-01-31', 'monthly', 1)).toBe('2026-02-28'); expect(occurrence('2026-01-31', 'monthly', 2)).toBe('2026-03-31');
    expect(occurrence('2028-01-31', 'monthly', 1)).toBe('2028-02-29');
  });
  it('distinguishes four-weekly from monthly and handles year boundaries', () => {
    expect(occurrence('2026-01-31', 'fourWeekly', 1)).toBe('2026-02-28'); expect(occurrence('2026-01-31', 'fourWeekly', 2)).toBe('2026-03-28');
    expect(occurrence('2026-12-28', 'weekly', 1)).toBe('2027-01-04'); expect(occurrence('2026-12-28', 'once', 1)).toBeUndefined();
  });
});
describe('reporting figures', () => {
  it('uses inclusive exact date ranges, including a non-calendar assessment period', () => {
    const entries = ['2026-10-14', '2026-10-15', '2026-11-14', '2026-11-15'].map(date => entry({ id: date, date }));
    expect(inPeriod(entries, '2026-10-15', '2026-11-14').map(e => e.date)).toEqual(['2026-11-14', '2026-10-15']);
    expect(inPeriod(entries, '2026-11-15', '2026-10-15')).toEqual([]);
  });
  it('keeps benefits, wages, business income and both kinds of expenses apart', () => {
    const t = totals([entry(), entry({ kind: 'benefit', pence: 12000 }), entry({ kind: 'businessIncome', pence: 5000 }), entry({ kind: 'otherIncome', pence: 700 }), entry({ kind: 'spending', pence: 4000 }), entry({ kind: 'businessExpense', pence: 1000 }), entry({ pence: 99999, state: 'expected' }), entry({ pence: 55555, archived: true })]);
    expect(t).toMatchObject({ received: 47700, paid: 5000, difference: 42700, benefit: 12000, wages: 30000, businessIncome: 5000, otherIncome: 700, spending: 4000, businessExpense: 1000, expectedIn: 99999 });
  });
  it('handles empty periods and exact pennies without floating-point drift', () => {
    expect(totals([]).received).toBe(0); expect(totals([entry({ pence: 10 }), entry({ pence: 20 })]).received).toBe(30);
  });
  it('never counts an expected payment as received, even after its due date', () => {
    const e = entry({ kind: 'benefit', state: 'expected', date: '2020-01-01' }); expect(totals([e]).received).toBe(0);
  });
  it('exports dates, distinct categories and statuses while neutralising formulas and quoting text', () => {
    const csv = moneyCsv([entry({ title: '=HYPERLINK("bad")', evidence: '+SUM(1)', notes: 'line 1\nline 2, "quoted"' }), entry({ id: 'e2', state: 'expected', pence: 99900 })], [], '2026-11-01', '2026-11-30', 'Person');
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"'); expect(csv).toContain('"\'+SUM(1)"'); expect(csv).toContain('"Received total GBP","300.00"'); expect(csv).toContain('"Expected"'); expect(csv).toContain('Not a benefits calculation or a submitted report');
  });
});
describe('benefit payment reconciliation and reminders', () => {
  it('does not generate payments for pending, stopped or archived claims', () => {
    for (const change of [{ status: 'Applied' as const }, { status: 'Stopped' as const }, { archived: true }]) expect(expectedPayments([benefit(change)], [], '2026-11-30')).toEqual([]);
  });
  it('matches a received payment to its planned occurrence even when received late', () => {
    const recorded = entry({ kind: 'benefit', benefitId: 'b1', occurrenceDate: '2026-11-01', date: '2026-11-03', pence: 11800 });
    expect(expectedPayments([benefit()], [recorded], '2026-11-08').map(p => p.date)).toEqual(['2026-11-08']);
    expect(expectedPayments([benefit()], [{ ...recorded, archived: true }], '2026-11-08')).toHaveLength(2);
  });
  it('does not create a second schedule entry if a payment is already recorded as expected', () => {
    expect(expectedPayments([benefit()], [entry({ kind: 'benefit', benefitId: 'b1', occurrenceDate: '2026-11-01', state: 'expected' })], '2026-11-01')).toEqual([]);
  });
  it('creates stable reporting tasks with a proof step and exact deadline', () => {
    const a = benefitTask(benefit(), 'report'); const b = benefitTask(benefit(), 'report');
    expect(a.benefitId).toBe('b1');
    expect(a.id).toBe(b.id); expect(a.steps.map(s => s.type)).toEqual(['check', 'find', 'send', 'proof']); expect(new Date(a.dueAt ?? 0).getDate()).toBe(15);
  });
  it('does not duplicate a reminder once the date has its own task', () => {
    const b = benefit(); const task = benefitTask(b, 'report'); const now = new Date('2026-11-01T12:00:00').getTime();
    expect(benefitRemindersFor([b], [], now)).toHaveLength(2); expect(benefitRemindersFor([b], [task], now)).toEqual([]); expect(remindersFor([task], [], now)).toHaveLength(2);
    expect(benefitRemindersFor([b], [{ ...task, status: 'done' }], now)).toEqual([]);
  });
  it('removes automatic dates when archived or stopped', () => {
    expect(benefitDates([benefit({ archived: true }), benefit({ status: 'Stopped' })])).toEqual([]);
  });
});
describe('money persistence and import validation', () => {
  it('restores records across a fresh store and preserves them in account transfer data', async () => {
    const storage = new MemoryStorage(); const store = new LocalBackend('test', storage); await store.save('benefits', benefit()); await store.save('money', entry());
    const again = new LocalBackend('test', storage); let benefits: Benefit[] = [], entries: MoneyEntry[] = [];
    again.listen<Benefit>('benefits', v => { benefits = v; }); again.listen<MoneyEntry>('money', v => { entries = v; });
    expect(benefits[0]?.name).toBe('Example benefit'); expect(entries[0]?.pence).toBe(30000); expect(again.dump(COLLECTIONS)).toMatchObject({ benefits: [benefit()], money: [entry()] });
  });
  it('accepts existing complete records but rejects malformed imports', () => {
    expect(validBenefit(benefit())).toBe(true); expect(validEntry(entry())).toBe(true);
    for (const v of [null, [], 5, {}, { ...entry(), pence: -1 }, { ...entry(), kind: 'constructor' }, { ...entry(), evidence: null }, { ...entry(), date: '2026-02-31' }]) expect(validEntry(v)).toBe(false);
    for (const v of [null, {}, { ...benefit(), periodEnd: '2026-01-01' }, { ...benefit(), paymentPence: -1 }, { ...benefit(), frequency: 'constructor' }, { ...benefit(), name: 2 }]) expect(validBenefit(v)).toBe(false);
  });
});
