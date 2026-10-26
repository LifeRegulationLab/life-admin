import { describe, expect, it } from 'vitest';
import { cleanName, DEFAULT_MOSS, Moss, MossError } from '../lib/moss/link';
import { MOSS_MOODS, POSES } from '../lib/moss/pose';

type Call = { url: string; init: RequestInit };

function memoryStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

function server(answers: ((c: Call) => Response | undefined)[]) {
  const calls: Call[] = [];
  const send = (url: string, init: RequestInit) => {
    const c = { url, init };
    calls.push(c);
    for (const a of answers) {
      const r = a(c);
      if (r) return Promise.resolve(r);
    }
    return Promise.resolve(new Response('[]', { status: 200 }));
  };
  return { calls, send };
}

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });
const session = { access_token: 'a1', refresh_token: 'r1', expires_in: 3600 };

describe('Moss', () => {
  it('has a pose for every state, with four dots', () => {
    for (const mood of MOSS_MOODS) expect(POSES[mood].dots).toHaveLength(4);
    expect(POSES.speaking.smile).toBeUndefined();
  });

  it('keeps a name short and never empty', () => {
    expect(cleanName('  ')).toBe('Moss');
    expect(cleanName('  Fern   the  helper ')).toBe('Fern the helper');
    expect(cleanName('x'.repeat(40))).toHaveLength(24);
  });

  it('starts with the defaults and keeps changes on the device when not connected', async () => {
    const store = memoryStore();
    const s = server([]);
    const m = new Moss(store, s.send);
    expect(m.getSettings()).toEqual(DEFAULT_MOSS);
    await m.update({ motion: false });
    expect(new Moss(store, s.send).getSettings()).toEqual({ ...DEFAULT_MOSS, motion: false });
    expect(s.calls).toHaveLength(0);
  });

  it('never makes an account when asking for a code', async () => {
    const s = server([]);
    await new Moss(memoryStore(), s.send).sendCode(' me@example.com ');
    expect(s.calls[0]?.url).toMatch(/\/auth\/v1\/otp$/);
    expect(JSON.parse(String(s.calls[0]?.init.body))).toEqual({ email: 'me@example.com', create_user: false });
  });

  it('says plainly when no Mull or Pace account uses the email', async () => {
    const s = server([() => json({ msg: 'Signups not allowed for otp' }, 422)]);
    await expect(new Moss(memoryStore(), s.send).sendCode('me@example.com')).rejects.toThrow(MossError);
  });

  it('connects with the code and takes the shared name and movement', async () => {
    const s = server([
      (c) => (c.url.includes('/verify') ? json(session) : undefined),
      (c) => (c.url.includes('moss_profiles?select') ? json([{ name: 'Fern', motion: false }]) : undefined),
    ]);
    const m = new Moss(memoryStore(), s.send, () => 1_000);
    await m.confirmCode('me@example.com', '123 456');
    expect(JSON.parse(String(s.calls[0]?.init.body))).toMatchObject({ token: '123456', type: 'email' });
    expect(m.getLink()?.email).toBe('me@example.com');
    expect(m.getSettings()).toEqual({ ...DEFAULT_MOSS, name: 'Fern', motion: false });
    expect((s.calls[1]?.init.headers as Record<string, string>)['Authorization']).toBe('Bearer a1');
  });

  it('sends only the shared ways Moss works, never Show, when a setting changes', async () => {
    const s = server([(c) => (c.url.includes('/verify') ? json(session) : undefined)]);
    const m = new Moss(memoryStore(), s.send, () => 1_000);
    await m.confirmCode('me@example.com', '123456');
    await m.update({ name: 'Fern' });
    const up = s.calls.at(-1);
    expect(up?.url).toMatch(/moss_profiles\?on_conflict=user_id$/);
    expect(Object.keys(JSON.parse(String(up?.init.body))).sort()).toEqual(['motion', 'name', 'one_question', 'remember', 'short_replies', 'updated_at', 'voice']);
  });

  it('renews the sign-in when it runs out, and lets go when it was ended elsewhere', async () => {
    let now = 1_000;
    const s = server([
      (c) => (c.url.includes('/verify') ? json(session) : undefined),
      (c) => (c.url.includes('grant_type=refresh_token') ? json({ msg: 'expired' }, 400) : undefined),
    ]);
    const m = new Moss(memoryStore(), s.send, () => now);
    await m.confirmCode('me@example.com', '123456');
    now += 4_000_000;
    await m.update({ motion: false });
    expect(m.getLink()).toBeUndefined();
    expect(m.getSettings().motion).toBe(false);
  });

  it('disconnects on this device only', async () => {
    const store = memoryStore();
    const s = server([(c) => (c.url.includes('/verify') ? json(session) : undefined)]);
    const m = new Moss(store, s.send, () => 1_000);
    await m.confirmCode('me@example.com', '123456');
    await m.disconnect();
    expect(m.getLink()).toBeUndefined();
    expect(s.calls.at(-1)?.url).toMatch(/logout\?scope=local$/);
    expect(new Moss(store, s.send).getLink()).toBeUndefined();
  });

  it('keeps Show Moss on this device: never sent, and kept when the shared settings arrive', async () => {
    const s = server([
      (c) => (c.url.includes('/verify') ? json(session) : undefined),
      (c) => (c.url.includes('moss_profiles?select') ? json([{ name: 'Fern', motion: true }]) : undefined),
    ]);
    const m = new Moss(memoryStore(), s.send, () => 1_000);
    await m.update({ show: false });
    expect(s.calls).toHaveLength(0);
    await m.confirmCode('me@example.com', '123456');
    expect(m.getSettings()).toEqual({ ...DEFAULT_MOSS, name: 'Fern', motion: true, show: false });
    await m.update({ name: 'Fern' });
    expect(JSON.parse(String(s.calls.at(-1)?.init.body))).not.toHaveProperty('show');
  });
});

describe('Moss passing things on', () => {
  async function connected(answers: ((c: Call) => Response | undefined)[]) {
    const s = server([(c) => (c.url.includes('/auth/v1/verify') ? json(session) : undefined), ...answers]);
    const m = new Moss(memoryStore(), s.send, () => 1_000);
    await m.confirmCode('me@example.com', '123456');
    return { m, s };
  }

  it('sends a task to Pace with only what was shown, and gets its id back', async () => {
    const { m, s } = await connected([(c) => (c.url.endsWith('/rest/v1/moss_handovers') ? json([{ id: 'h1' }], 201) : undefined)]);
    const id = await m.sendToPace({ title: '  Ring  the council ', minutes: 15, firstStep: 'Find the letter', ready: ['Reference 6001', ' '], readyMinutes: 5 });
    expect(id).toBe('h1');
    const sent = s.calls.find((c) => c.url.endsWith('/rest/v1/moss_handovers'));
    expect(JSON.parse(String(sent?.init.body))).toEqual({ from_app: 'dealt-with', to_app: 'pace', kind: 'task', title: 'Ring the council', minutes: 15, first_step: 'Find the letter', ready: ['Reference 6001'], ready_minutes: 5 });
  });

  it('will not send anything when Moss is not connected', async () => {
    const s = server([]);
    await expect(new Moss(memoryStore(), s.send).sendToPace({ title: 'Ring them' })).rejects.toThrow('Connect Moss first');
    expect(s.calls).toHaveLength(0);
  });

  it('reads call scripts from Mull and settles each once', async () => {
    const { m, s } = await connected([(c) => (c.url.includes('to_app=eq.dealt-with') ? json([{ id: 's1', title: 'Electricity company', body: 'Hello...', from_app: 'mull' }]) : undefined)]);
    expect(await m.scripts()).toEqual([{ id: 's1', title: 'Electricity company', body: 'Hello...', fromApp: 'mull' }]);
    await m.settle('s1', 'added');
    const settle = s.calls.find((c) => c.url.endsWith('/rest/v1/rpc/moss_settle_handover'));
    expect(JSON.parse(String(settle?.init.body))).toEqual({ handover: 's1', outcome: 'added' });
  });
});
