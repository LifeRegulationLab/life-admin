import { clean, type Backend, type Collection, type DocName, type Identified } from './backend';
import type { KeyValue } from './local';

/**
 * Records in an account on the shared Life Regulation Lab server, with a copy on this device.
 *
 * The device copy is what the screens read, so the app opens and works with no signal. Every
 * change is written to the device first and put in a queue; the queue is sent in order when the
 * server can be reached, and what the server holds is fetched again afterwards. A change that has
 * not been sent yet always wins over what the server says, so nothing typed offline is lost when
 * an older copy arrives.
 *
 * This file knows nothing about the server itself: `Remote` is the few calls it needs, made for
 * real in `src/lib/shared/remote.ts` and by a stand-in in the tests.
 */

export interface RemoteRow {
  id: string;
  data: unknown;
}

export interface Remote {
  /** Every record of one kind for the signed-in person. */
  list(collection: Collection): Promise<RemoteRow[]>;
  put(collection: Collection, id: string, data: unknown): Promise<void>;
  remove(collection: Collection, id: string): Promise<void>;
  getDoc(name: DocName): Promise<unknown>;
  putDoc(name: DocName, data: unknown): Promise<void>;
}

type Op =
  | { kind: 'put'; collection: Collection; id: string; data: unknown }
  | { kind: 'remove'; collection: Collection; id: string }
  | { kind: 'doc'; name: DocName; data: unknown };

type Listener = (value: unknown) => void;

export const NOT_LOADED = 'Some records could not be loaded. Check your connection and reopen the app before relying on the totals.';
export const NOT_SAVED = 'A change could not be saved to your account. It is kept on this phone and will be sent when there is a signal.';

export class SyncedBackend implements Backend {
  readonly kind = 'shared' as const;
  private listeners = new Map<string, Set<Listener>>();
  private flushing: Promise<void> | null = null;

  constructor(
    private readonly remote: Remote,
    /** Per person: a different account on the same phone never sees this copy. */
    private readonly prefix: string,
    private readonly storage: KeyValue,
    private readonly onError: (message: string) => void = () => undefined,
  ) {}

  // The device copy -------------------------------------------------------------------------

  private key(name: string): string {
    return `${this.prefix}:${name}`;
  }

  private read<T>(name: string, fallback: T): T {
    const raw = this.storage.getItem(this.key(name));
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private write(name: string, value: unknown): void {
    try {
      this.storage.setItem(this.key(name), JSON.stringify(value));
    } catch {
      // A full device: the screen still shows the change, and the queue still tries to send it.
    }
    for (const l of this.listeners.get(name) ?? []) l(value);
  }

  private on(name: string, listener: Listener): () => void {
    const set = this.listeners.get(name) ?? new Set();
    set.add(listener);
    this.listeners.set(name, set);
    return () => set.delete(listener);
  }

  private queue(): Op[] {
    return this.read<Op[]>('queue', []);
  }

  private setQueue(ops: Op[]): void {
    try {
      this.storage.setItem(this.key('queue'), JSON.stringify(ops));
    } catch {
      // As above.
    }
  }

  /** How many changes are waiting to be sent. */
  pending(): number {
    return this.queue().length;
  }

  // What the screens call -------------------------------------------------------------------

  listen<T extends Identified>(collection: Collection, onChange: (items: T[]) => void) {
    onChange(this.read<T[]>(collection, []));
    const off = this.on(collection, (v) => onChange(v as T[]));
    void this.refresh(collection);
    return off;
  }

  async save<T extends Identified>(collection: Collection, item: T) {
    const copy = clean(item);
    const items = this.read<Identified[]>(collection, []);
    const i = items.findIndex((x) => x.id === copy.id);
    if (i >= 0) items[i] = copy;
    else items.push(copy);
    this.write(collection, items);
    this.enqueue({ kind: 'put', collection, id: copy.id, data: copy });
  }

  async remove(collection: Collection, id: string) {
    this.write(
      collection,
      this.read<Identified[]>(collection, []).filter((x) => x.id !== id),
    );
    this.enqueue({ kind: 'remove', collection, id });
  }

  listenDoc<T>(name: DocName, onChange: (value: T | undefined) => void) {
    onChange(this.read<T | undefined>(`doc:${name}`, undefined));
    const off = this.on(`doc:${name}`, (v) => onChange(v as T | undefined));
    void this.refreshDoc(name);
    return off;
  }

  async saveDoc<T>(name: DocName, value: T) {
    const copy = clean(value);
    this.write(`doc:${name}`, copy);
    this.enqueue({ kind: 'doc', name, data: copy });
  }

  // Sending and fetching --------------------------------------------------------------------

  private enqueue(op: Op): void {
    // A later change to the same thing replaces an earlier one still waiting.
    const same = (o: Op) =>
      op.kind === 'doc'
        ? o.kind === 'doc' && o.name === op.name
        : o.kind !== 'doc' && o.collection === op.collection && o.id === op.id;
    this.setQueue([...this.queue().filter((o) => !same(o)), op]);
    void this.flush();
  }

  /** Sends what is waiting, oldest first. Stops at the first failure and keeps the rest. */
  flush(): Promise<void> {
    this.flushing ??= this.send().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async send(): Promise<void> {
    for (;;) {
      const [op] = this.queue();
      if (op === undefined) return;
      try {
        if (op.kind === 'put') await this.remote.put(op.collection, op.id, op.data);
        else if (op.kind === 'remove') await this.remote.remove(op.collection, op.id);
        else await this.remote.putDoc(op.name, op.data);
      } catch {
        this.onError(NOT_SAVED);
        return;
      }
      // Only this one is taken off: something may have joined the queue while it was sending,
      // and a newer change to the same thing must still go.
      const now = this.queue();
      const i = now.findIndex((o) => JSON.stringify(o) === JSON.stringify(op));
      if (i >= 0) this.setQueue([...now.slice(0, i), ...now.slice(i + 1)]);
    }
  }

  /** Fetches one kind of record again. What is waiting to be sent is laid over what comes back. */
  async refresh(collection: Collection): Promise<void> {
    let rows: RemoteRow[];
    try {
      rows = await this.remote.list(collection);
    } catch {
      // No signal with a copy on the device is ordinary. With no copy, say so.
      if (this.storage.getItem(this.key(collection)) === null) this.onError(NOT_LOADED);
      return;
    }
    const byId = new Map<string, Identified>();
    for (const row of rows) {
      if (typeof row.data === 'object' && row.data !== null) byId.set(row.id, { ...(row.data as object), id: row.id });
    }
    for (const op of this.queue()) {
      if (op.kind === 'doc' || op.collection !== collection) continue;
      if (op.kind === 'remove') byId.delete(op.id);
      else byId.set(op.id, { ...(op.data as object), id: op.id });
    }
    this.write(collection, [...byId.values()]);
  }

  async refreshDoc(name: DocName): Promise<void> {
    if (this.queue().some((o) => o.kind === 'doc' && o.name === name)) return;
    try {
      const data = await this.remote.getDoc(name);
      if (data !== undefined && data !== null) this.write(`doc:${name}`, data);
    } catch {
      // Settings on the device carry on being used.
    }
  }

  /** When the signal is back, or the app comes to the front: send, then fetch everything again. */
  async sync(collections: readonly Collection[], docs: readonly DocName[]): Promise<void> {
    await this.flush();
    await Promise.all([...collections.map((c) => this.refresh(c)), ...docs.map((d) => this.refreshDoc(d))]);
  }

  /** Removes the device copy, on sign-out or after deleting the account. */
  forget(collections: readonly Collection[], docs: readonly DocName[]): void {
    for (const name of [...collections, ...docs.map((d) => `doc:${d}`), 'queue']) this.storage.removeItem(this.key(name));
  }
}
