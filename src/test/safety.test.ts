import { describe, expect, it } from 'vitest';
import { checkReply, gate, SUPPORT_TEXT } from '../lib/helper/safety';

describe('helper safety', () => {
  it.each(['I want to die', 'I can’t go on, I want to end it all', 'thinking about suicide', 'he hit me again'])('meets "%s" with the support line', (text) => {
    const g = gate(text);
    expect(g.send).toBe(false);
    if (!g.send) expect(g.reply).toBe(SUPPORT_TEXT);
  });

  it('lets ordinary worries through', () => {
    expect(gate('I am behind on my rent, what do I say?').send).toBe(true);
    expect(gate('This bill is killing me').send).toBe(true);
  });

  it('never shows a reply asking for secret numbers or claiming to be a professional', () => {
    expect(checkReply('Send them your PIN to confirm.').ok).toBe(false);
    expect(checkReply('I am a solicitor and you will win.').ok).toBe(false);
    expect(checkReply('Never give your PIN to anyone. Ring the bank on the number on your card.').ok).toBe(true);
    expect(checkReply('Ring them before the date!')).toEqual({ ok: true, text: 'Ring them before the date.' });
  });
});
