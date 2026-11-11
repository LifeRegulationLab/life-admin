import { describe, expect, it } from 'vitest';
import type { Item } from '../lib/model/types';
import { clearPace, keepForPace, PACE_LINES, pageFromLink, sentToPace } from '../lib/moss/pace';

const item = { id: 'i1', steps: [{ id: 's1', title: 'Ring them' }, { id: 's2', title: 'Wait' }], updatedAt: 1 } as unknown as Item;
const step = (i: Item) => i.steps.find((s) => s.id === 's1');

describe('a step put into Pace', () => {
  it('keeps the id with the step before it is sent, marked as not sent', () => {
    const kept = keepForPace(item, 's1', 'h1', 5);
    expect(step(kept)).toMatchObject({ paceHandover: 'h1', paceUnsent: true });
    expect(kept.steps[1]).toEqual(item.steps[1]);
    expect(kept.updatedAt).toBe(5);
  });

  it('keeps the same id once sent, so it is never a second task', () => {
    const sent = sentToPace(keepForPace(item, 's1', 'h1'), 's1');
    expect(step(sent)?.paceHandover).toBe('h1');
    expect(step(sent)).not.toHaveProperty('paceUnsent');
  });

  it('can be sent again as a new task only after Pace no longer has it', () => {
    const cleared = clearPace(sentToPace(keepForPace(item, 's1', 'h1'), 's1'), 's1');
    expect(step(cleared)).toEqual({ id: 's1', title: 'Ring them' });
  });

  it('says finished in Pace is not done here', () => {
    expect(PACE_LINES.finished).toContain('not marked done here');
    expect(PACE_LINES.added).toContain('not finished');
    expect(PACE_LINES.sent).toContain('not in Pace yet');
  });
});

describe('the way back from Pace', () => {
  it('opens the letter the step came from', () => {
    expect(pageFromLink('dealtwith://item/abc123def456ghi7')).toBe('/item/abc123def456ghi7');
  });
  it('opens nothing for any other address', () => {
    for (const url of ['dealtwith://item/', 'dealtwith://me', 'dealtwith://item/a/b', 'https://example.com/item/a', 'dealtwith://item/a?x=1', 'dealtwith://item/../me']) {
      expect(pageFromLink(url)).toBeUndefined();
    }
  });
});
