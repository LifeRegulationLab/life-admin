import type { Item, RecordKind } from '../model/types';
import { DAY } from './items';

/**
 * Looking back: what happened, month by month, from the person's own records. Counts of what was
 * done, never a score, an average or a comparison with anyone else.
 */

export interface Month {
  /** "2026-10". */
  key: string;
  /** "October 2026". */
  label: string;
  /** Things dealt with that month, newest first. */
  dealtWith: Item[];
  /** Things added that month. */
  added: number;
  sent: number;
  calls: number;
  paid: number;
  proofs: number;
}

function monthKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const COUNTED: Partial<Record<RecordKind, 'sent' | 'calls' | 'paid' | 'proofs'>> = { sent: 'sent', call: 'calls', paid: 'paid', proof: 'proofs' };

/** Every month with something in it, newest first. Months with nothing are left out, not shown as gaps. */
export function lookingBack(items: readonly Item[]): Month[] {
  const months = new Map<string, Month>();
  const get = (at: number): Month => {
    const key = monthKey(at);
    let m = months.get(key);
    if (!m) {
      const d = new Date(at);
      m = { key, label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), dealtWith: [], added: 0, sent: 0, calls: 0, paid: 0, proofs: 0 };
      months.set(key, m);
    }
    return m;
  };
  for (const item of items) {
    if (item.unsorted) continue;
    get(item.createdAt).added += 1;
    if (item.status === 'done' && item.doneAt !== undefined) get(item.doneAt).dealtWith.push(item);
    for (const r of item.record) {
      const field = COUNTED[r.kind];
      if (field) get(r.at)[field] += 1;
    }
  }
  for (const m of months.values()) m.dealtWith.sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  return [...months.values()].sort((a, b) => b.key.localeCompare(a.key));
}

/** "2 dealt with. 1 letter sent, 3 calls." Only the parts that happened. */
export function monthLine(m: Month): string {
  const n = (count: number, one: string, many: string) => (count ? `${count} ${count === 1 ? one : many}` : '');
  const did = [n(m.sent, 'thing sent', 'things sent'), n(m.calls, 'call', 'calls'), n(m.paid, 'payment', 'payments'), n(m.proofs, 'proof kept', 'proofs kept')].filter(Boolean).join(', ');
  return [m.dealtWith.length ? `${m.dealtWith.length} dealt with.` : '', did ? `${did[0]?.toUpperCase()}${did.slice(1)}.` : '', m.added ? `${n(m.added, 'thing', 'things')} added.` : ''].filter(Boolean).join(' ');
}

/** Open things, the one waiting longest first, so nothing old slips out of sight. */
export function openLongest(items: readonly Item[], now = Date.now(), limit = 3): { item: Item; days: number }[] {
  return items
    .filter((i) => i.status !== 'done' && !i.unsorted)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, limit)
    .map((item) => ({ item, days: Math.floor((now - item.createdAt) / DAY) }));
}

// ---------------------------------------------------------------------------------------------
// Weeks in a row

/** Monday 00:00 of the week `at` falls in. */
export function weekStart(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  const back = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - back);
  return d.getTime();
}

/**
 * Weeks in a row with something dealt with: a step done or a thing finished. Post does not come
 * every day, so the count is in weeks. A week with nothing open to deal with is a quiet week: it
 * holds the count without adding to it. This week never breaks it, and nothing is stored.
 */
export function weeksInARow(items: readonly Item[], now = Date.now()): number {
  const active = new Set<number>();
  for (const item of items) {
    for (const s of item.steps) if (s.done && s.doneAt !== undefined) active.add(weekStart(s.doneAt));
    if (item.doneAt !== undefined) active.add(weekStart(item.doneAt));
  }
  const openDuring = (start: number, end: number) =>
    items.some((i) => !i.unsorted && i.createdAt < end && (i.doneAt === undefined || i.doneAt >= start) && i.status !== 'waiting');
  let start = weekStart(now);
  let total = 0;
  for (let back = 0; back < 520; back++) {
    const end = start + 7 * DAY;
    if (active.has(start)) total += 1;
    else if (back > 0 && openDuring(start, end)) break;
    // Step back one week; setDate keeps clock changes from shifting the Monday.
    const d = new Date(start);
    d.setDate(d.getDate() - 7);
    start = d.getTime();
    if (start < Math.min(...items.map((i) => i.createdAt), now) - 7 * DAY) break;
  }
  return total;
}

/** "3 weeks in a row with something dealt with." Nothing at all for 0 or 1, so a lost run is never pointed out. */
export function weeksLine(n: number): string | undefined {
  return n >= 2 ? `${n} weeks in a row with something dealt with.` : undefined;
}
