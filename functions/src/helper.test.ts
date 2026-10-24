import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { handleHelper, readUnderstood, type HelperDeps } from './helper';
import { SUPPORT_TEXT } from './safety';

const LETTER = 'Brackenford Borough Council\nPlease confirm that you still live alone.\nPlease reply by 21 November 2026.\nWe may remove the discount from your account.';

const deps = (over: Partial<HelperDeps> = {}): HelperDeps => ({
  on: 'true',
  origins: ['capacitor://localhost'],
  verifyUser: async (t) => (t === 'good' ? 'u1' : undefined),
  model: vi.fn(async () => ({ text: 'Dear Sir or Madam! I still live alone.', refused: false })),
  ...over,
});

const post = (body: unknown, token = 'good') =>
  new Request('https://x/helper', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', origin: 'capacitor://localhost' },
    body: JSON.stringify(body),
  });

describe('helper server', () => {
  it('uses the same safety rules as the app', () => {
    const app = readFileSync(join(__dirname, '../../src/lib/helper/safety.ts'), 'utf8');
    const copy = readFileSync(join(__dirname, 'safety.ts'), 'utf8');
    expect(copy.split('\n').slice(1).join('\n')).toBe(app);
  });

  it('is off unless switched on, and needs a sign-in', async () => {
    expect((await handleHelper(post({ job: 'draft', text: LETTER }), deps({ on: undefined }))).status).toBe(503);
    expect((await handleHelper(post({ job: 'draft', text: LETTER }, 'bad'), deps())).status).toBe(401);
    expect((await handleHelper(post({ job: 'nonsense', text: LETTER }), deps())).status).toBe(400);
  });

  it('meets distress in what the person wrote with the support line, and never calls the model', async () => {
    const d = deps();
    const r = await handleHelper(post({ job: 'draft', text: LETTER, note: 'I want to end it all' }), d);
    expect(await r.json()).toEqual({ text: SUPPORT_TEXT, support: true });
    expect(d.model).not.toHaveBeenCalled();
  });

  it('drafts a reply and takes out exclamation marks', async () => {
    const r = await handleHelper(post({ job: 'draft', text: LETTER, note: 'yes I live alone' }), deps());
    expect(await r.json()).toEqual({ text: 'Dear Sir or Madam. I still live alone.' });
  });

  it('keeps only quotes that are really in the letter, and only real dates', () => {
    const raw = `Here: {"plain":"The council is checking your discount.","easy":"The council wants to check.","needs":"yes","ask":"Confirm you live alone","due":"2026-11-21","consequence":"They may remove the discount.","quotes":["Please reply by 21 November 2026.","You owe £900"],"from":"Brackenford Borough Council","reference":"","steps":[{"type":"reply","title":"Reply online"},{"type":"teleport","title":"Odd"}]}`;
    const u = readUnderstood(raw, LETTER);
    expect(u?.quotes).toEqual(['Please reply by 21 November 2026.']);
    expect(u?.due).toBe('2026-11-21');
    expect(u?.steps.map((s) => s.type)).toEqual(['reply', 'custom']);
    expect(readUnderstood('{"plain":"x","due":"21/11/2026"}', LETTER)?.due).toBe('');
    expect(readUnderstood('no json', LETTER)).toBeUndefined();
  });

  it('returns the explanation through the reply check', async () => {
    const model = async () => ({ text: '{"plain":"The council wants to check!","easy":"","needs":"yes","ask":"","due":"","consequence":"","quotes":[],"from":"","reference":"","steps":[]}', refused: false });
    const r = await handleHelper(post({ job: 'understand', text: LETTER }), deps({ model }));
    expect((await r.json()).understood.plain).toBe('The council wants to check.');
  });

  it('hides replies that ask for a PIN', async () => {
    const r = await handleHelper(post({ job: 'ask', text: LETTER, note: 'What now?' }), deps({ model: async () => ({ text: 'Tell them your PIN.', refused: false }) }));
    expect((await r.json()).text).toContain('could not do that');
  });
});
