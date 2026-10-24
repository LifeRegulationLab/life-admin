import type { Item, Renewal } from '../model/types';
import { newId } from '../store/backend';
import { DAY, itemFromRenewal } from './items';

/**
 * Things that come round again. Each one turns into something to deal with a set number of days
 * before its date, then moves on to the next date once it is done.
 */

export interface Preset {
  code: string;
  title: string;
  everyMonths: number;
  daysBefore: number;
  notes: string;
}

export const PRESETS: Preset[] = [
  { code: 'mot', title: 'MOT', everyMonths: 12, daysBefore: 30, notes: 'You can have the MOT done up to a month before the date and keep the same renewal date.' },
  { code: 'car-tax', title: 'Car tax', everyMonths: 12, daysBefore: 14, notes: 'Renew on the official government website. Other sites may charge extra.' },
  { code: 'car-insurance', title: 'Car insurance', everyMonths: 12, daysBefore: 28, notes: 'Prices are often lower about three weeks before the renewal date. Compare before you renew.' },
  { code: 'home-insurance', title: 'Home insurance', everyMonths: 12, daysBefore: 28, notes: 'Compare before you renew. Ask them to match a lower price.' },
  { code: 'tv-licence', title: 'TV Licence', everyMonths: 12, daysBefore: 21, notes: 'Renew on the official TV Licensing website.' },
  { code: 'passport', title: 'Passport', everyMonths: 120, daysBefore: 180, notes: 'Some countries need six months left on a passport. Renew on the official government website.' },
  { code: 'driving-licence', title: 'Driving licence photo', everyMonths: 120, daysBefore: 60, notes: 'The photo card needs renewing every ten years.' },
  { code: 'boiler', title: 'Boiler service', everyMonths: 12, daysBefore: 30, notes: '' },
  { code: 'phone-contract', title: 'Phone contract ends', everyMonths: 0, daysBefore: 30, notes: 'When a contract ends you can often move to a cheaper deal.' },
  { code: 'energy-fix', title: 'Energy fixed deal ends', everyMonths: 0, daysBefore: 45, notes: 'Your supplier must tell you before it ends. Compare before it does.' },
  { code: 'blue-badge', title: 'Blue Badge', everyMonths: 36, daysBefore: 84, notes: 'Apply up to 12 weeks before it runs out.' },
  { code: 'other', title: '', everyMonths: 12, daysBefore: 21, notes: '' },
];

export function newRenewal(preset: Preset, dueAt: number): Renewal {
  return { id: newId(), preset: preset.code, title: preset.title, with: '', dueAt, everyMonths: preset.everyMonths, daysBefore: preset.daysBefore, notes: preset.notes };
}

export function addMonths(at: number, months: number): number {
  const d = new Date(at);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d.getTime();
}

/** True when the renewal should be on the list now. */
export function isDue(r: Renewal, now = Date.now()): boolean {
  return r.dueAt - r.daysBefore * DAY <= now;
}

/**
 * Renewals that need an item made for them. One item per round: a renewal that already has an
 * open item is left alone.
 */
export function renewalsNeedingItems(renewals: readonly Renewal[], items: readonly Item[], now = Date.now()): Item[] {
  const open = new Set(items.filter((i) => i.renewalId && i.status !== 'done').map((i) => i.renewalId));
  return renewals.filter((r) => isDue(r, now) && !open.has(r.id) && !(r.itemId && items.some((i) => i.id === r.itemId && i.status !== 'done'))).map((r) => itemFromRenewal(r, now));
}

/** When its item is dealt with, the renewal moves on to its next date, or ends if it does not repeat. */
export function roll(r: Renewal, doneAt: number): Renewal | undefined {
  if (r.everyMonths === 0) return undefined;
  let next = addMonths(r.dueAt, r.everyMonths);
  while (next < doneAt) next = addMonths(next, r.everyMonths);
  const { itemId: _i, ...rest } = r;
  void _i;
  return { ...rest, dueAt: next, lastDoneAt: doneAt };
}
