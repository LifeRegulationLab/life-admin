import { describe, expect, it } from 'vitest';
import { newItem, startWaiting } from '../lib/logic/items';
import { newRenewal, PRESETS } from '../lib/logic/renewals';
import { remindersFor } from '../lib/reminders';
import { DAY, NOW } from './fixtures';

describe('reminders', () => {
  it('reminds three days before and on the day, and on the chase date', () => {
    const due = newItem('bill', { title: 'Water', dueAt: NOW + 10 * DAY }, NOW);
    const waiting = startWaiting(newItem('letter', { title: 'Council' }, NOW), 'their decision', NOW + 5 * DAY, NOW);
    const done = { ...newItem('bill', { dueAt: NOW + 4 * DAY }, NOW), status: 'done' as const };
    const preset = PRESETS[0];
    if (!preset) throw new Error('no preset');
    const r = remindersFor([due, waiting, done], [newRenewal(preset, NOW + 60 * DAY)], NOW);
    expect(r.map((x) => x.title)).toEqual(['Time to chase: Council', 'Due in 3 days: Water', 'Due today: Water', 'Coming up: MOT']);
    expect(new Set(r.map((x) => x.id)).size).toBe(r.length);
    expect(r.every((x) => new Date(x.at).getHours() === 9)).toBe(true);
  });

  it('uses the days the person chose', () => {
    const due = newItem('bill', { title: 'Water', dueAt: NOW + 10 * DAY }, NOW);
    expect(remindersFor([due], [], NOW, [7, 1]).map((x) => x.title)).toEqual(['Due in 7 days: Water', 'Due tomorrow: Water']);
  });
});
