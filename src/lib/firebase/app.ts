import { initializeApp, type FirebaseApp } from 'firebase/app';
import { Capacitor } from '@capacitor/core';
import { getAuth, indexedDBLocalPersistence, initializeAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

/**
 * Firebase, set up only when the build has the web app settings. The database is in London
 * (europe-west2). Records are cached on the device, so the app works with no signal and writes
 * are sent when the signal comes back.
 */

const env = import.meta.env;

export function firebaseConfigured(): boolean {
  return Boolean(env['VITE_FIREBASE_API_KEY'] && env['VITE_FIREBASE_PROJECT_ID'] && env['VITE_FIREBASE_APP_ID']);
}

let cached: { app: FirebaseApp; auth: Auth; db: Firestore } | undefined;

export function firebase(): { app: FirebaseApp; auth: Auth; db: Firestore } {
  if (cached) return cached;
  if (!firebaseConfigured()) throw new Error('Firebase is not set up in this build.');
  const app = initializeApp({
    apiKey: env['VITE_FIREBASE_API_KEY'],
    authDomain: env['VITE_FIREBASE_AUTH_DOMAIN'],
    projectId: env['VITE_FIREBASE_PROJECT_ID'],
    storageBucket: env['VITE_FIREBASE_STORAGE_BUCKET'],
    messagingSenderId: env['VITE_FIREBASE_MESSAGING_SENDER_ID'],
    appId: env['VITE_FIREBASE_APP_ID'],
  });
  let db: Firestore;
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    db = initializeFirestore(app, {});
  }
  // In the iPhone app, getAuth waits for a sign-in window the app never uses and can hang, so
  // sign-in is set up without it there.
  const auth = Capacitor.isNativePlatform() ? initializeAuth(app, { persistence: indexedDBLocalPersistence }) : getAuth(app);
  cached = { app, auth, db };
  return cached;
}
