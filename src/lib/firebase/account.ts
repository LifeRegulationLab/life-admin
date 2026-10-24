import {
  deleteUser,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { STORAGE_PREFIX } from '../brand';
import type { Share } from '../model/types';
import { clean, COLLECTIONS, DOCS, newId } from '../store/backend';
import { firebase } from './app';

const EMAIL_KEY = `${STORAGE_PREFIX}:sign-in-email`;

/** Sends a sign-in link. No password to remember. */
export async function sendLink(email: string): Promise<void> {
  const { auth } = firebase();
  await sendSignInLinkToEmail(auth, email, { url: `${window.location.origin}/signin`, handleCodeInApp: true });
  window.localStorage.setItem(EMAIL_KEY, email);
}

/** Finishes sign-in when the page was opened from the emailed link. */
export async function finishLink(emailIfAsked?: string): Promise<'done' | 'need-email' | 'not-a-link'> {
  const { auth } = firebase();
  if (!isSignInWithEmailLink(auth, window.location.href)) return 'not-a-link';
  const email = emailIfAsked ?? window.localStorage.getItem(EMAIL_KEY);
  if (!email) return 'need-email';
  await signInWithEmailLink(auth, email, window.location.href);
  window.localStorage.removeItem(EMAIL_KEY);
  return 'done';
}

export function watchUser(onChange: (user: User | null) => void): () => void {
  return onAuthStateChanged(firebase().auth, onChange);
}

export async function signOut(): Promise<void> {
  await fbSignOut(firebase().auth);
}

/** Copies records kept on the device into the account, the first time someone signs in. */
export async function importIntoAccount(uid: string, data: Record<string, unknown>): Promise<void> {
  const { db } = firebase();
  let batch = writeBatch(db);
  let count = 0;
  const flush = async () => {
    await batch.commit();
    batch = writeBatch(db);
    count = 0;
  };
  for (const name of COLLECTIONS) {
    const items = data[name];
    if (!Array.isArray(items)) continue;
    for (const item of items as { id: string }[]) {
      batch.set(doc(db, 'users', uid, name, item.id), clean(item));
      if (++count >= 400) await flush();
    }
  }
  for (const name of DOCS) {
    const value = data[`doc:${name}`];
    if (value) batch.set(doc(db, 'users', uid, 'docs', name), clean(value));
  }
  await flush();
}

/** One step handed to a supporter. The link works for a set number of days, then stops. */
export async function createShare(share: Omit<Share, 'code' | 'createdAt' | 'expiresAt'>, days: number): Promise<Share> {
  const code = `${newId()}${newId()}`.slice(0, 20);
  const now = Date.now();
  const value: Share = { ...share, code, createdAt: now, expiresAt: now + days * 24 * 60 * 60 * 1000 };
  await setDoc(doc(firebase().db, 'shares', code), clean(value));
  return value;
}

export async function getShare(code: string): Promise<Share | undefined> {
  const snap = await getDoc(doc(firebase().db, 'shares', code));
  return snap.exists() ? (snap.data() as Share) : undefined;
}

export function listenShares(uid: string, onChange: (shares: Share[]) => void): () => void {
  return onSnapshot(
    query(collection(firebase().db, 'shares'), where('owner', '==', uid)),
    (snap) => onChange(snap.docs.map((d) => d.data() as Share)),
    () => onChange([]),
  );
}

/** The supporter's answer. They can add a reply and their name, nothing else. */
export async function replyToShare(code: string, reply: string, helperName: string): Promise<void> {
  await updateDoc(doc(firebase().db, 'shares', code), { reply: reply.slice(0, 4000), helperName: helperName.slice(0, 80), repliedAt: Date.now() });
}

export async function removeShare(code: string): Promise<void> {
  await deleteDoc(doc(firebase().db, 'shares', code));
}

/**
 * Deletes this app's account and everything in it. Other Life Regulation Lab apps have their own
 * accounts and are not touched. Export first if a copy is wanted.
 */
export async function deleteEverything(user: User): Promise<void> {
  const { db } = firebase();
  for (const name of [...COLLECTIONS, 'docs']) {
    const snap = await getDocs(collection(db, 'users', user.uid, name));
    for (const d of snap.docs) await deleteDoc(d.ref);
  }
  const shares = await getDocs(query(collection(db, 'shares'), where('owner', '==', user.uid)));
  for (const d of shares.docs) await deleteDoc(d.ref);
  await deleteDoc(doc(db, 'users', user.uid)).catch(() => undefined);
  await deleteUser(user);
}
