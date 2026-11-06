import { APP_FULL_NAME } from '../brand';
import { makeStep } from '../content/steps';
import type { Benefit, Frequency, MoneyEntry, MoneyKind } from '../model/money';
import { BENEFIT_STATUSES, FREQUENCIES, JURISDICTIONS, MONEY_KINDS } from '../model/money';
import type { Item } from '../model/types';
import { newItem } from './items';

export function localDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00`);
  return Number.isFinite(d.getTime()) && localDate(d) === value;
}
export function showDate(value: string): string {
  return validDate(value) ? new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date set';
}
export function money(pence: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
}
export function parseMoney(value: string): number | null {
  const cleaned = value.trim().replace(/^£\s*/, '');
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const [pounds = '0', pennies = ''] = cleaned.replaceAll(',', '').split('.');
  const result = Number(pounds) * 100 + Number(pennies.padEnd(2, '0'));
  return Number.isSafeInteger(result) && result >= 0 && result <= 99999999999 ? result : null;
}
export function monthPeriod(date = localDate()): { start: string; end: string } {
  const d = new Date(`${date}T12:00:00`);
  return { start: localDate(new Date(d.getFullYear(), d.getMonth(), 1)), end: localDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
}
export function isOut(kind: MoneyKind): boolean { return kind === 'spending' || kind === 'businessExpense'; }
export function inPeriod(entries: readonly MoneyEntry[], start: string, end: string): MoneyEntry[] {
  if (!validDate(start) || !validDate(end) || start > end) return [];
  return entries.filter(e => !e.archived && e.date >= start && e.date <= end).sort((a, b) => b.date.localeCompare(a.date));
}
export function totals(entries: readonly MoneyEntry[]) {
  const sums: Record<MoneyKind, number> = { benefit: 0, wages: 0, businessIncome: 0, otherIncome: 0, spending: 0, businessExpense: 0 };
  let expectedIn = 0, expectedOut = 0;
  for (const e of entries) {
    if (e.archived) continue;
    if (e.state === 'settled') sums[e.kind] += e.pence;
    else if (isOut(e.kind)) expectedOut += e.pence;
    else expectedIn += e.pence;
  }
  const received = sums.benefit + sums.wages + sums.businessIncome + sums.otherIncome;
  const paid = sums.spending + sums.businessExpense;
  return { ...sums, received, paid, difference: received - paid, expectedIn, expectedOut };
}

/** Add from the original anchor, so Jan 31 -> Feb 28 -> Mar 31, never Mar 28. */
export function occurrence(anchor: string, frequency: Frequency, index: number): string | undefined {
  if (!validDate(anchor) || index < 0 || !Number.isInteger(index) || (frequency === 'once' && index > 0)) return undefined;
  const d = new Date(`${anchor}T12:00:00`);
  if (frequency === 'monthly') {
    const month = new Date(d.getFullYear(), d.getMonth() + index, 1, 12);
    month.setDate(Math.min(d.getDate(), new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()));
    return localDate(month);
  }
  const days = frequency === 'weekly' ? 7 : frequency === 'fortnightly' ? 14 : frequency === 'fourWeekly' ? 28 : 0;
  d.setDate(d.getDate() + index * days);
  return localDate(d);
}
export function expectedPayments(benefits: readonly Benefit[], entries: readonly MoneyEntry[], until: string) {
  const expected: { benefit: Benefit; date: string; pence: number }[] = [];
  for (const b of benefits) {
    if (b.archived || !['Awarded', 'Reviewing'].includes(b.status) || b.paymentPence === null || !validDate(b.paymentDate)) continue;
    for (let i = 0; i < 2400; i++) {
      const date = occurrence(b.paymentDate, b.frequency, i);
      if (!date || date > until) break;
      const recorded = entries.some(e => !e.archived && e.kind === 'benefit' && e.benefitId === b.id && e.occurrenceDate === date);
      if (!recorded) expected.push({ benefit: b, date, pence: b.paymentPence });
    }
  }
  return expected.sort((a, b) => a.date.localeCompare(b.date));
}
export function benefitDates(benefits: readonly Benefit[]) {
  return benefits.filter(b => !b.archived && b.status !== 'Stopped').flatMap(b => [
    ...(validDate(b.reportDue) ? [{ benefit: b, kind: 'report' as const, date: b.reportDue, label: 'Report income' }] : []),
    ...(validDate(b.reviewDue) ? [{ benefit: b, kind: 'review' as const, date: b.reviewDue, label: 'Review or renewal' }] : []),
  ]).sort((a, b) => a.date.localeCompare(b.date));
}

export function benefitTaskId(b: Benefit, kind: 'report' | 'review'): string {
  return `benefit-${b.id}-${kind}-${kind === 'report' ? b.reportDue : b.reviewDue}`;
}

/** Create an ordinary saved task so the existing step flow, notifications and proof apply. */
export function benefitTask(b: Benefit, kind: 'report' | 'review', now = Date.now()): Item {
  const date = kind === 'report' ? b.reportDue : b.reviewDue;
  const title = kind === 'report' ? `Report income for ${b.name}` : `Review ${b.name}`;
  const plan = kind === 'report' ? [
    ['check', 'Check the reporting dates', 'Use the exact start and end dates in your benefit account or letter.'],
    ['find', 'Get the records together', 'Open Money & benefits, then Prepare a report. Check every payment against your bank record, payslip or receipt.'],
    ['send', 'Report through the official service', 'Check which figures your benefit office needs. Saving a report here does not send it. Use the official service or contact your benefit office.'],
    ['proof', 'Keep the confirmation', 'Save the reference or proof of submission here. Then update the next reporting dates in My benefits.'],
  ] : [
    ['check', 'Read what the review asks for', 'Open the review letter. Check the date and what evidence is requested.'],
    ['find', 'Get the evidence together', 'Use the letter’s checklist. Keep the relevant documents with this task.'],
    ['send', 'Send the review', 'Check the form and use the official service or address from your letter.'],
    ['proof', 'Keep proof of sending', 'Save the reference or proof here. Update your review date when a new one is confirmed.'],
  ];
  return newItem('form', {
    id: benefitTaskId(b, kind), title, from: b.name, reference: b.reference, benefitId: b.id,
    ...(validDate(date) ? { dueAt: new Date(`${date}T23:59:59`).getTime() } : {}),
    understanding: { plain: title, easy: title, needs: 'yes', ask: title, consequence: 'Check your benefit letter or account for what happens if the date is missed.', quotes: [], by: 'me' },
    steps: plan.map(([type, stepTitle, help]) => makeStep({ type: type as 'check' | 'find' | 'send' | 'proof', title: stepTitle ?? '', help: help ?? '', easyHelp: help ?? '' })),
  }, now);
}

/** User-supplied text cannot become spreadsheet formulas. */
function cell(value: string | number) {
  let s = String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
export function moneyCsv(entries: readonly MoneyEntry[], benefits: readonly Benefit[], start: string, end: string, name: string): string {
  const rows: (string | number)[][] = [
    [APP_FULL_NAME], ['Name', name], ['Period start', start, 'Period end', end],
    ['Personal record only. Not a benefits calculation or a submitted report. Expected entries are excluded from received/paid totals.'],
    ['Date', 'Type', 'Description', 'Status', 'Money in GBP', 'Money out GBP', 'Benefit', 'Evidence / reference', 'Notes'],
  ];
  const selected = inPeriod(entries, start, end);
  for (const e of selected) rows.push([e.date, MONEY_KINDS[e.kind], e.title, e.state === 'settled' ? (isOut(e.kind) ? 'Paid' : 'Received') : 'Expected', isOut(e.kind) ? '' : (e.pence / 100).toFixed(2), isOut(e.kind) ? (e.pence / 100).toFixed(2) : '', benefits.find(b => b.id === e.benefitId)?.name ?? '', e.evidence, e.notes]);
  const t = totals(selected);
  rows.push([], ['Received total GBP', (t.received / 100).toFixed(2)], ['Paid total GBP', (t.paid / 100).toFixed(2)]);
  for (const k of Object.keys(MONEY_KINDS) as MoneyKind[]) rows.push([`${MONEY_KINDS[k]} (received/paid) GBP`, (t[k] / 100).toFixed(2)]);
  return '\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n');
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function validEntry(value: unknown): value is MoneyEntry {
  if (!record(value)) return false;
  const e = value;
  return ['id', 'title', 'kind', 'date', 'state', 'benefitId', 'occurrenceDate', 'itemId', 'evidence', 'notes'].every(k => typeof e[k] === 'string')
    && Boolean((e['title'] as string).trim()) && Object.hasOwn(MONEY_KINDS, e['kind'] as string)
    && typeof e['pence'] === 'number' && Number.isSafeInteger(e['pence']) && e['pence'] >= 0 && e['pence'] <= 99999999999
    && validDate(e['date'] as string) && ['expected', 'settled'].includes(e['state'] as string)
    && (!e['occurrenceDate'] || validDate(e['occurrenceDate'] as string))
    && typeof e['archived'] === 'boolean' && typeof e['updatedAt'] === 'number' && Number.isFinite(e['updatedAt']);
}
export function validBenefit(value: unknown): value is Benefit {
  if (!record(value)) return false;
  const b = value;
  return ['id', 'name', 'jurisdiction', 'status', 'reference', 'notes', 'itemId', 'frequency'].every(k => typeof b[k] === 'string')
    && Boolean((b['name'] as string).trim()) && (JURISDICTIONS as readonly string[]).includes(b['jurisdiction'] as string)
    && (BENEFIT_STATUSES as readonly string[]).includes(b['status'] as string) && Object.hasOwn(FREQUENCIES, b['frequency'] as string)
    && (b['paymentPence'] === null || (typeof b['paymentPence'] === 'number' && Number.isSafeInteger(b['paymentPence']) && b['paymentPence'] >= 0 && b['paymentPence'] <= 99999999999))
    && typeof b['archived'] === 'boolean' && typeof b['updatedAt'] === 'number' && Number.isFinite(b['updatedAt'])
    && ['periodStart', 'periodEnd', 'reportDue', 'reviewDue', 'paymentDate'].every(k => typeof b[k] === 'string' && (!b[k] || validDate(b[k] as string)))
    && Boolean(b['periodStart']) === Boolean(b['periodEnd'])
    && (!b['periodStart'] || (b['periodStart'] as string) <= (b['periodEnd'] as string))
    && Boolean(b['paymentDate']) === (b['paymentPence'] !== null);
}
