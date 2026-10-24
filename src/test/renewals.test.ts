import { describe, expect, it } from 'vitest';
import { newItem } from '../lib/logic/items';
import { addMonths, isDue, newRenewal, PRESETS, renewalsNeedingItems, roll } from '../lib/logic/renewals';
import { DAY, NOW } from './fixtures';

const mot = PRESETS.find((p) => p.code === 'mot');

describe('renewals', () => {
  it('goes on the list the set number of days before', () => {
    if (!mot) throw new Error('missing preset');
    const r = newRenewal(mot, NOW + 40 * DAY);
    expect(isDue(r, NOW)).toBe(false);
    expect(isDue(r, NOW + 11 * DAY)).toBe(true);
  });

  it('makes one item per round, never two', () => {
    if (!mot) throw new Error('missing preset');
    const r = newRenewal(mot, NOW + 10 * DAY);
    const made = renewalsNeedingItems([r], [], NOW);
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({ kind: 'renewal', title: 'MOT', renewalId: r.id });
    expect(renewalsNeedingItems([r], made, NOW)).toEqual([]);
  });

  it('moves on to the next date once done, or ends if it does not repeat', () => {
    if (!mot) throw new Error('missing preset');
    const r = { ...newRenewal(mot, NOW), itemId: newItem('renewal', {}, NOW).id };
    const next = roll(r, NOW + DAY);
    expect(new Date(next?.dueAt ?? 0).getFullYear()).toBe(2027);
    expect(next?.itemId).toBeUndefined();
    expect(roll({ ...r, everyMonths: 0 }, NOW)).toBeUndefined();
  });

  it('adds months without spilling into the next month', () => {
    expect(new Date(addMonths(new Date(2027, 0, 31).getTime(), 1)).getDate()).toBe(28);
  });
});
