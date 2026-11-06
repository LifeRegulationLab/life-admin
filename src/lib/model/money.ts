/** Money is stored as whole pence. Dates are local calendar dates, never UTC timestamps. */
export const JURISDICTIONS = ['Guernsey', 'England', 'Scotland', 'Wales', 'Northern Ireland', 'Jersey', 'Other'] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];
export const BENEFIT_STATUSES = ['Preparing', 'Applied', 'Waiting for a decision', 'Awarded', 'Reviewing', 'Stopped'] as const;
export type BenefitStatus = (typeof BENEFIT_STATUSES)[number];
export const FREQUENCIES = { once: 'One payment', weekly: 'Every week', fortnightly: 'Every 2 weeks', fourWeekly: 'Every 4 weeks', monthly: 'Every month' } as const;
export type Frequency = keyof typeof FREQUENCIES;

export interface Benefit {
  id: string;
  name: string;
  jurisdiction: Jurisdiction;
  status: BenefitStatus;
  reference: string;
  notes: string;
  itemId: string;
  /** Copy these dates from the award letter or benefit account. No guessed assessment periods. */
  periodStart: string;
  periodEnd: string;
  reportDue: string;
  reviewDue: string;
  paymentDate: string;
  paymentPence: number | null;
  frequency: Frequency;
  archived: boolean;
  updatedAt: number;
}

export const MONEY_KINDS = {
  benefit: 'Benefit payment',
  wages: 'Take-home pay',
  businessIncome: 'Business income',
  otherIncome: 'Other money in',
  spending: 'Personal spending or bill',
  businessExpense: 'Business expense',
} as const;
export type MoneyKind = keyof typeof MONEY_KINDS;
export interface MoneyEntry {
  id: string;
  kind: MoneyKind;
  title: string;
  pence: number;
  date: string;
  state: 'expected' | 'settled';
  benefitId: string;
  /** The planned occurrence this receipt confirms; actual receipt date can differ. */
  occurrenceDate: string;
  itemId: string;
  evidence: string;
  notes: string;
  archived: boolean;
  updatedAt: number;
}
