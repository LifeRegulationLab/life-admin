import { clean, type Backend, type Collection, type DocName, type Identified } from './backend';

/**
 * Records kept on this device only, in local storage. Used before an account exists and when
 * Firebase is not set up. Every write is saved straight away, so closing the app loses nothing.
 */

export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type Listener = (value: unknown) => void;

export class LocalBackend implements Backend {
  readonly kind = 'device' as const;
  private listeners = new Map<string, Set<Listener>>();

  constructor(
    private readonly prefix: string,
    private readonly storage: KeyValue,
  ) {}

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
    this.storage.setItem(this.key(name), JSON.stringify(value));
    for (const l of this.listeners.get(name) ?? []) l(value);
  }

  private on(name: string, listener: Listener): () => void {
    const set = this.listeners.get(name) ?? new Set();
    set.add(listener);
    this.listeners.set(name, set);
    return () => set.delete(listener);
  }

  listen<T extends Identified>(collection: Collection, onChange: (items: T[]) => void) {
    onChange(this.read<T[]>(collection, []));
    return this.on(collection, (v) => onChange(v as T[]));
  }

  async save<T extends Identified>(collection: Collection, item: T) {
    const items = this.read<T[]>(collection, []);
    const i = items.findIndex((x) => x.id === item.id);
    if (i >= 0) items[i] = clean(item);
    else items.push(clean(item));
    this.write(collection, items);
  }

  async remove(collection: Collection, id: string) {
    this.write(
      collection,
      this.read<Identified[]>(collection, []).filter((x) => x.id !== id),
    );
  }

  listenDoc<T>(name: DocName, onChange: (value: T | undefined) => void) {
    onChange(this.read<T | undefined>(`doc:${name}`, undefined));
    return this.on(`doc:${name}`, (v) => onChange(v as T | undefined));
  }

  async saveDoc<T>(name: DocName, value: T) {
    this.write(`doc:${name}`, clean(value));
  }

  /** Everything held, for moving to an account or exporting. */
  dump(names: readonly string[]): Record<string, unknown> {
    return Object.fromEntries(names.map((n) => [n, this.read<unknown>(n, null)]));
  }

  clear(names: readonly string[]): void {
    for (const n of names) {
      this.storage.removeItem(this.key(n));
      for (const l of this.listeners.get(n) ?? []) l(n.startsWith('doc:') ? undefined : []);
    }
  }
}

/** An in-memory store, for tests and for browsers that block local storage. */
export class MemoryStorage implements KeyValue {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

export function deviceStorage(): KeyValue {
  try {
    const probe = '__dealt_with_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return new MemoryStorage();
  }
}
