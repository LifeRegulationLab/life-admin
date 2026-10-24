import { describe, expect, it } from 'vitest';
import { icsText, toIcs } from '../lib/logic/calendar';
import { NOW } from './fixtures';

describe('calendar files', () => {
  it('escapes text and writes an all-day event and a timed one with a reminder', () => {
    expect(icsText('a, b; c\nd')).toBe('a\\, b\\; c\\nd');
    const ics = toIcs(
      [
        { id: 'r1', title: 'MOT', at: new Date(2026, 10, 3, 12).getTime(), minutes: 0, notes: '' },
        { id: 'a1', title: 'Dentist', at: NOW, minutes: 60, notes: 'Bring the letter', alarm: 1440 },
      ],
      NOW,
    );
    expect(ics).toContain('DTSTART;VALUE=DATE:20261103');
    expect(ics).toContain('DTEND;VALUE=DATE:20261104');
    expect(ics).toContain('TRIGGER:-PT1440M');
    expect(ics.split('\r\n').every((l) => l.length <= 75)).toBe(true);
    expect(ics).not.toMatch(/claude|anthropic|openai/i);
  });
});
