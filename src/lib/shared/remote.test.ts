import { describe, expect, it } from 'vitest';
import { RestRemote } from './remote';

// The calls to the shared server: the right schema, the person's own sign-in, nothing else.

function setup(answer: (url: string, init: RequestInit) => Response = () => new Response('[]')) {
  const calls: { url: string; init: RequestInit }[] = [];
  const remote = new RestRemote({
    url: 'https://example.test',
    key: 'public-key',
    token: () => Promise.resolve('person-token'),
    fetch: (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      return Promise.resolve(answer(String(input), init ?? {}));
    },
  });
  return { remote, calls };
}
const headers = (init: RequestInit) => init.headers as Record<string, string>;

describe('the calls to the shared server', () => {
  it('names the dealt_with schema and signs every call as the person', async () => {
    const { remote, calls } = setup();
    await remote.list('items');
    await remote.put('items', 'a', { id: 'a' });
    await remote.remove('items', 'a');
    await remote.getDoc('settings');
    await remote.putDoc('settings', { name: 'x' });
    expect(calls).toHaveLength(5);
    for (const { init } of calls) {
      expect(headers(init)['accept-profile']).toBe('dealt_with');
      expect(headers(init)['content-profile']).toBe('dealt_with');
      expect(headers(init)['authorization']).toBe('Bearer person-token');
      expect(headers(init)['apikey']).toBe('public-key');
    }
  });

  it('reads one kind of record, and saves by replacing the same record', async () => {
    const { remote, calls } = setup((url) =>
      new Response(url.includes('select=id,data') ? JSON.stringify([{ id: 'a', data: { title: 'T' } }, { nope: 1 }]) : '[]'),
    );
    expect(await remote.list('renewals')).toEqual([{ id: 'a', data: { title: 'T' } }]);
    expect(calls[0]?.url).toBe('https://example.test/rest/v1/records?select=id,data&collection=eq.renewals');
    await remote.put('money', 'm 1', { id: 'm 1' });
    expect(calls[1]?.url).toContain('on_conflict=user_id,collection,id');
    expect(headers(calls[1]?.init ?? {})['prefer']).toContain('resolution=merge-duplicates');
    const sent = JSON.parse(String(calls[1]?.init.body)) as Record<string, unknown>;
    expect(sent['collection']).toBe('money');
    expect(sent['data']).toEqual({ id: 'm 1' });
    // The person's id is never sent: the server fills it in from the sign-in.
    expect(sent).not.toHaveProperty('user_id');
  });

  it('removes one record by its kind and id', async () => {
    const { remote, calls } = setup();
    await remote.remove('items', 'a/b');
    expect(calls[0]?.init.method).toBe('DELETE');
    expect(calls[0]?.url).toBe('https://example.test/rest/v1/records?collection=eq.items&id=eq.a%2Fb');
  });

  it('gives no settings when there are none, and fails loudly when the server refuses', async () => {
    const none = setup();
    expect(await none.remote.getDoc('settings')).toBeUndefined();
    const refused = setup(() => new Response('no', { status: 401 }));
    await expect(refused.remote.list('items')).rejects.toThrow('401');
    await expect(refused.remote.put('items', 'a', {})).rejects.toThrow('401');
  });
});
