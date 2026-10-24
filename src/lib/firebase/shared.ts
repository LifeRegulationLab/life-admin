import { collection as col, deleteDoc, doc, onSnapshot, setDoc, type Firestore } from 'firebase/firestore';
import { clean, type Backend, type Collection, type DocName, type Identified } from '../store/backend';

/**
 * Records in this app's own Firestore: users/{uid}/{collection}/{id}. Only the signed-in person
 * can read or write them. Writes are kept on the device and sent when there is a signal.
 */
export class SharedBackend implements Backend {
  readonly kind = 'shared' as const;

  constructor(
    private readonly db: Firestore,
    private readonly uid: string,
  ) {}

  listen<T extends Identified>(collection: Collection, onChange: (items: T[]) => void) {
    return onSnapshot(
      col(this.db, 'users', this.uid, collection),
      (snap) => onChange(snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }))),
      () => onChange([]),
    );
  }

  async save<T extends Identified>(collection: Collection, item: T) {
    // Not awaited past the local write: with no signal the write is queued and sent later.
    void setDoc(doc(this.db, 'users', this.uid, collection, item.id), clean(item));
  }

  async remove(collection: Collection, id: string) {
    void deleteDoc(doc(this.db, 'users', this.uid, collection, id));
  }

  listenDoc<T>(name: DocName, onChange: (value: T | undefined) => void) {
    return onSnapshot(
      doc(this.db, 'users', this.uid, 'docs', name),
      (snap) => onChange(snap.exists() ? (snap.data() as T) : undefined),
      () => onChange(undefined),
    );
  }

  async saveDoc<T>(name: DocName, value: T) {
    void setDoc(doc(this.db, 'users', this.uid, 'docs', name), clean(value) as Record<string, unknown>);
  }
}
