import { STORAGE_PREFIX } from '../brand';

/**
 * A small store for pictures and recorded speech on this device, in the browser's own database.
 * Nothing in it is uploaded.
 */

const DB = `${STORAGE_PREFIX}-files`;
export type Shelf = 'photos' | 'speech';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('photos');
      req.result.createObjectStore('speech');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open the file store'));
  });
}

async function run<T>(shelf: Shelf, mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(shelf, mode);
    const req = act(tx.objectStore(shelf));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('File store error'));
    tx.oncomplete = () => db.close();
  });
}

export async function put(shelf: Shelf, key: string, blob: Blob): Promise<void> {
  await run(shelf, 'readwrite', (s) => s.put(blob, key));
}

export async function get(shelf: Shelf, key: string): Promise<Blob | undefined> {
  try {
    return (await run<Blob | undefined>(shelf, 'readonly', (s) => s.get(key) as IDBRequest<Blob | undefined>)) ?? undefined;
  } catch {
    return undefined;
  }
}

export async function remove(shelf: Shelf, key: string): Promise<void> {
  try {
    await run(shelf, 'readwrite', (s) => s.delete(key));
  } catch {
    // Already gone.
  }
}

export async function clear(shelf: Shelf): Promise<void> {
  try {
    await run(shelf, 'readwrite', (s) => s.clear());
  } catch {
    // Nothing kept.
  }
}
