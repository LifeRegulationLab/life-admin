import { describe, expect, it } from 'vitest';
import type { Collection, DocName } from './backend';
import { MemoryStorage } from './local';
import { NOT_LOADED, NOT_SAVED, SyncedBackend, type Remote, type RemoteRow } from './synced';

// The account on the shared server keeps a copy on the device, so the app works with no signal.

class FakeRemote implements Remote {
  rows = new Map<string, Map<string, unknown>>();
  docs = new Map<string, unknown>();
  online = true;
  calls: string[] = [];
  private check() {
    if (!this.online) throw new Error('offline');
  }
  async list(collection: Collection): Promise<RemoteRow[]> {
    this.check();
    return [...(this.rows.get(collection) ?? new Map<string, unknown>())].map(([id, data]) => ({ id, data }));
  }
  async put(collection: Collection, id: string, data: unknown) {
    this.calls.push(`put ${collection} ${id}`);
    this.check();
    const set = this.rows.get(collection) ?? new Map<string, unknown>();
    set.set(id, data);
    this.rows.set(collection, set);
  }
  async remove(collection: Collection, id: string) {
    this.calls.push(`remove ${collection} ${id}`);
    this.check();
    this.rows.get(collection)?.delete(id);
  }
  async getDoc(name: DocName) {
    this.check();
    return this.docs.get(name);
  }
  async putDoc(name: DocName, data: unknown) {
    this.check();
    this.docs.set(name, data);
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function setup() {
  const remote = new FakeRemote();
  const storage = new MemoryStorage();
  const errors: string[] = [];
  const backend = new SyncedBackend(remote, 'dw:u1', storage, (m) => errors.push(m));
  return { remote, storage, errors, backend };
}

describe('records in an account, with a copy on the device', () => {
  it('shows a save at once, sends it, and it is on the server', async () => {
    const { remote, backend } = setup();
    const seen: { id: string; title?: string }[][] = [];
    backend.listen<{ id: string; title?: string }>('items', (items) => seen.push(items));
    await backend.save('items', { id: 'a', title: 'Council tax letter' });
    expect(seen.at(-1)).toEqual([{ id: 'a', title: 'Council tax letter' }]);
    await backend.flush();
    expect(remote.rows.get('items')?.get('a')).toEqual({ id: 'a', title: 'Council tax letter' });
    expect(backend.pending()).toBe(0);
  });

  it('with no signal, keeps the change on the device, says so, and sends it when the signal is back', async () => {
    const { remote, storage, errors, backend } = setup();
    remote.online = false;
    await backend.save('items', { id: 'a', title: 'Typed offline' });
    await backend.flush();
    expect(backend.pending()).toBe(1);
    expect(errors).toContain(NOT_SAVED);

    // The app is closed and opened again: the change and the queue are still there.
    const again = new SyncedBackend(remote, 'dw:u1', storage);
    const seen: { id: string }[][] = [];
    again.listen('items', (items) => seen.push(items));
    expect(seen[0]).toEqual([{ id: 'a', title: 'Typed offline' }]);

    remote.online = true;
    await again.sync(['items'], ['settings']);
    expect(again.pending()).toBe(0);
    expect(remote.rows.get('items')?.get('a')).toEqual({ id: 'a', title: 'Typed offline' });
  });

  it('a change still waiting wins over an older copy from the server', async () => {
    const { remote, backend } = setup();
    remote.rows.set('items', new Map([['a', { id: 'a', title: 'Old' }], ['b', { id: 'b', title: 'Other phone' }]]));
    remote.online = false;
    await backend.save('items', { id: 'a', title: 'New' });
    await backend.remove('items', 'b');
    await backend.flush();
    // The list arrives while the changes cannot be sent.
    remote.online = true;
    const list = remote.list.bind(remote);
    remote.put = async () => { throw new Error('still failing'); };
    remote.remove = async () => { throw new Error('still failing'); };
    remote.list = list;
    const seen: { id: string; title?: string }[][] = [];
    backend.listen<{ id: string; title?: string }>('items', (items) => seen.push(items));
    await backend.refresh('items');
    expect(seen.at(-1)).toEqual([{ id: 'a', title: 'New' }]);
  });

  it('sends changes in order, and a later change to the same thing replaces one still waiting', async () => {
    const { remote, backend } = setup();
    remote.online = false;
    await backend.save('items', { id: 'a', n: 1 });
    await backend.save('renewals', { id: 'r', n: 1 });
    await backend.save('items', { id: 'a', n: 2 });
    await backend.flush();
    expect(backend.pending()).toBe(2);
    remote.calls = [];
    remote.online = true;
    await backend.flush();
    expect(remote.calls).toEqual(['put renewals r', 'put items a']);
    expect(remote.rows.get('items')?.get('a')).toEqual({ id: 'a', n: 2 });
  });

  it('brings in what another device saved, and drops what it removed', async () => {
    const { remote, backend } = setup();
    await backend.save('items', { id: 'a' });
    await backend.flush();
    remote.rows.get('items')?.delete('a');
    remote.rows.get('items')?.set('z', { title: 'From the web' });
    const seen: { id: string }[][] = [];
    backend.listen('items', (items) => seen.push(items));
    await tick();
    await tick();
    expect(seen.at(-1)).toEqual([{ title: 'From the web', id: 'z' }]);
  });

  it('says records could not be loaded only when there is no copy on the device', async () => {
    const first = setup();
    first.remote.online = false;
    await first.backend.refresh('items');
    expect(first.errors).toEqual([NOT_LOADED]);

    const second = setup();
    await second.backend.save('items', { id: 'a' });
    await second.backend.flush();
    second.remote.online = false;
    await second.backend.refresh('items');
    expect(second.errors).toEqual([]);
  });

  it('keeps settings the same way, and never lets an older server copy replace an unsent change', async () => {
    const { remote, backend } = setup();
    remote.docs.set('settings', { name: 'From server' });
    const seen: unknown[] = [];
    backend.listenDoc('settings', (v) => seen.push(v));
    await tick();
    expect(seen.at(-1)).toEqual({ name: 'From server' });
    remote.online = false;
    await backend.saveDoc('settings', { name: 'Changed offline' });
    await backend.flush();
    remote.online = true;
    remote.putDoc = async () => { throw new Error('still failing'); };
    await backend.refreshDoc('settings');
    expect(seen.at(-1)).toEqual({ name: 'Changed offline' });
  });

  it('keeps each person apart on one phone, and forgets the copy on sign-out', async () => {
    const { remote, storage, backend } = setup();
    await backend.save('items', { id: 'a' });
    await backend.flush();
    const other = new SyncedBackend(new FakeRemote(), 'dw:u2', storage);
    const seen: { id: string }[][] = [];
    other.listen('items', (items) => seen.push(items));
    expect(seen[0]).toEqual([]);
    backend.forget(['items', 'renewals', 'benefits', 'money'], ['settings']);
    const after: { id: string }[][] = [];
    remote.online = false;
    new SyncedBackend(remote, 'dw:u1', storage).listen('items', (items) => after.push(items));
    expect(after[0]).toEqual([]);
  });
});
