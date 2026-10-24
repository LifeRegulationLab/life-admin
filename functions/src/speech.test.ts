import { describe, expect, it, vi } from 'vitest';
import { handleSpeech, type SpeechDeps } from './speech';

const deps = (over: Partial<SpeechDeps> = {}): SpeechDeps => ({
  on: 'true',
  origins: ['capacitor://localhost'],
  verifyUser: async (t) => (t === 'good' ? 'u1' : undefined),
  hasPlus: async (uid) => uid === 'u1',
  speak: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
  ...over,
});

const post = (text: string, token = 'good') => new Request('https://x/speak', { method: 'POST', headers: { authorization: `Bearer ${token}`, origin: 'capacitor://localhost' }, body: JSON.stringify({ text }) });

describe('read aloud server', () => {
  it('is off unless switched on, needs a sign-in, and refuses empty or long text', async () => {
    expect((await handleSpeech(post('Hello'), deps({ on: 'false' }))).status).toBe(503);
    expect((await handleSpeech(post('Hello', 'bad'), deps())).status).toBe(401);
    expect((await handleSpeech(post(''), deps())).status).toBe(400);
    expect((await handleSpeech(post('a'.repeat(2600)), deps())).status).toBe(400);
  });

  it('needs Dealt With Plus, and never records without it', async () => {
    const d = deps({ hasPlus: async () => false });
    const r = await handleSpeech(post('Hello'), d);
    expect(r.status).toBe(402);
    expect(d.speak).not.toHaveBeenCalled();
  });

  it('returns the recorded voice', async () => {
    const d = deps();
    const r = await handleSpeech(post('Step one. Find the letter.'), d);
    expect(r.headers.get('content-type')).toBe('audio/mpeg');
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(d.speak).toHaveBeenCalledWith('Step one. Find the letter.');
  });
});
