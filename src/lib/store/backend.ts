/**
 * Where the records live. Two kinds: on this device only (no account), and this app's own Firebase
 * database (an account, so records follow you to a new phone). Screens only ever see this interface.
 * The account belongs to this app alone; no other Life Regulation Lab app can read or delete it.
 */

export const COLLECTIONS = ['items', 'renewals'] as const;
export type Collection = (typeof COLLECTIONS)[number];

export const DOCS = ['settings'] as const;
export type DocName = (typeof DOCS)[number];

export interface Identified {
  id: string;
}

export type Unsubscribe = () => void;

export interface Backend {
  /** 'device' or 'shared', for the settings page. */
  kind: 'device' | 'shared';
  listen<T extends Identified>(collection: Collection, onChange: (items: T[]) => void): Unsubscribe;
  save<T extends Identified>(collection: Collection, item: T): Promise<void>;
  remove(collection: Collection, id: string): Promise<void>;
  listenDoc<T>(name: DocName, onChange: (value: T | undefined) => void): Unsubscribe;
  saveDoc<T>(name: DocName, value: T): Promise<void>;
}

export function newId(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
}

/** Firestore refuses `undefined`; JSON-safe copies keep both backends the same. */
export function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
