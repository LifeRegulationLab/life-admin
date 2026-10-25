import { describe, expect, it } from 'vitest';
import { MOSS_TALK } from '../../components/MossCompanion';
import { MOSS_ACTIONS } from './actions';

describe('Moss actions', () => {
  it('starts with Talk to Moss, which only opens Mull and carries nothing from this app', () => {
    expect(MOSS_ACTIONS[0]).toBe(MOSS_TALK);
    expect(MOSS_TALK.href).toBe('coach://talk');
  });

  it('opens only pages of this app otherwise', () => {
    for (const a of MOSS_ACTIONS.slice(1)) expect(a.to?.startsWith('/')).toBe(true);
  });
});
