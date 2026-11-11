import { clean, type Backend, type Collection, type DocName, type Identified } from './backend';
import type { KeyValue } from './local';

/**
 * Records in an account on the shared Life Regulation Lab server, with a copy on this device.
 *
 * The device copy is what the screens read, so the app opens and works with no signal. Every
 * change is written to the device first and put in a queue (and held in memory while the app is
 * open, in case the device refuses the write); the queue is sent in order when the
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
/** The phone refused to store it (full, or storage blocked) but the account has it. */
export const NOT_KEPT_HERE = 'This phone could not store a change, because its storage is full or blocked. It was saved to your account. Free some space, then reopen the app.';
/** Neither place has it yet. Said plainly, so nobody relies on a change that could vanish. */
export const NOT_SAVED_ANYWHERE = 'A change is not saved yet. This phone could not store it and your account could not be reached. Keep the app open and connect to the internet, and it will be sent.';

export class SyncedBackend implements Backend {
  readonly kind = 'shared' as const;
  private listeners = new Map<string, Set<Listener>>();
  private flushing: Promise<void> | null = null;
  /**
   * What is held while the app is open. The device's storage is a copy of this, written after
   * every change. If the device refuses a write, this still has the change and the queue, so the
   * change is still shown and still sent; it is only lost if the app closes before it is sent,
   * and the person is told so.
   */
  private held = new Map<string, unknown>();
  private storageFailed = false;

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
    if (this.held.has(name)) return this.held.get(name) as T;
    let raw: string | null = null;
    try {
      raw = this.storage.getItem(this.key(name));
    } catch {
      raw = null;
    }
    if (raw === null) return fallback;
    try {
      const value = JSON.parse(raw) as T;
      this.held.set(name, value);
      return value;
    } catch {
      return fallback;
    }
  }

  /** Writes the device copy. False when the device refused, so the caller can say so. */
  private persist(name: string, value: unknown): boolean {
    this.held.set(name, value);
    try {
      this.storage.setItem(this.key(name), JSON.stringify(value));
      return true;
    } catch {
      this.storageFailed = true;
      return false;
    }
  }

  private write(name: string, value: unknown): boolean {
    const kept = this.persist(name, value);
    for (const l of this.listeners.get(name) ?? []) l(value);
    return kept;
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

  private setQueue(ops: Op[]): boolean {
    return this.persist('queue', ops);
  }

  /** True once the device has refused to store something since the app was opened. */
  deviceStorageFailed(): boolean {
    return this.storageFailed;
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
    const kept = this.write(collection, items);
    await this.enqueue({ kind: 'put', collection, id: copy.id, data: copy }, kept);
  }

  async remove(collection: Collection, id: string) {
    const kept = this.write(
      collection,
      this.read<Identified[]>(collection, []).filter((x) => x.id !== id),
    );
    await this.enqueue({ kind: 'remove', collection, id }, kept);
  }

  listenDoc<T>(name: DocName, onChange: (value: T | undefined) => void) {
    onChange(this.read<T | undefined>(`doc:${name}`, undefined));
    const off = this.on(`doc:${name}`, (v) => onChange(v as T | undefined));
    void this.refreshDoc(name);
    return off;
  }

  async saveDoc<T>(name: DocName, value: T) {
    const copy = clean(value);
    const kept = this.write(`doc:${name}`, copy);
    await this.enqueue({ kind: 'doc', name, data: copy }, kept);
  }

  // Sending and fetching --------------------------------------------------------------------

  /**
   * Queues a change and tries to send it. `keptOnDevice` is whether the device stored the record
   * itself. When the device stored both the record and the queue, the change is safe and sending
   * carries on in the background. When it did not, sending is waited for, so that what the person
   * is told is true: saved to the account, or not saved anywhere yet.
   */
  private async enqueue(op: Op, keptOnDevice: boolean): Promise<void> {
    // A later change to the same thing replaces an earlier one still waiting.
    const same = (o: Op) =>
      op.kind === 'doc'
        ? o.kind === 'doc' && o.name === op.name
        : o.kind !== 'doc' && o.collection === op.collection && o.id === op.id;
    const queued = this.setQueue([...this.queue().filter((o) => !same(o)), op]);
    if (keptOnDevice && queued) {
      void this.flush();
      return;
    }
    await this.flush();
    const sent = !this.queue().some((o) => JSON.stringify(o) === JSON.stringify(op));
    this.onError(sent ? NOT_KEPT_HERE : NOT_SAVED_ANYWHERE);
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
        // With the device refusing writes, the caller says the fuller thing: not saved anywhere.
        if (!this.storageFailed) this.onError(NOT_SAVED);
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
      if (!this.held.has(collection) && this.safeGet(collection) === null) this.onError(NOT_LOADED);
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

  private safeGet(name: string): string | null {
    try {
      return this.storage.getItem(this.key(name));
    } catch {
      return null;
    }
  }

  /** When the signal is back, or the app comes to the front: send, then fetch everything again. */
  async sync(collections: readonly Collection[], docs: readonly DocName[]): Promise<void> {
    await this.flush();
    await Promise.all([...collections.map((c) => this.refresh(c)), ...docs.map((d) => this.refreshDoc(d))]);
  }

  /** Removes the device copy, on sign-out or after deleting the account. */
  forget(collections: readonly Collection[], docs: readonly DocName[]): void {
    for (const name of [...collections, ...docs.map((d) => `doc:${d}`), 'queue']) {
      this.held.delete(name);
      try {
        this.storage.removeItem(this.key(name));
      } catch {
        // Nothing was stored there to remove.
      }
    }
  }
}
