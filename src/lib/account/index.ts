import { signInFirst as firebaseSignInFirst, firebase, firebaseConfigured } from '../firebase/app';
import * as own from '../firebase/account';
import { SharedBackend } from '../firebase/shared';
import { socialSignIn as ownSocial } from '../firebase/social';
import type { Share } from '../model/types';
import type { Backend } from '../store/backend';
import { sharedConfigured, sharedToken } from '../shared/app';
import * as onShared from '../shared/account';

/**
 * The account, wherever it lives. Pages call this and never the server's own code.
 *
 * A build with the shared server's address uses the shared Life Regulation Lab account
 * (docs/SHARED-SERVER.md). Any other build uses this app's own Firebase project, as before.
 */

export interface AccountUser {
  uid: string;
  email: string | null;
}
export type Social = 'apple' | 'google';

const useShared = sharedConfigured();

/** Which server this build's accounts are on. */
export function accountKind(): 'shared' | 'own' | 'none' {
  return useShared ? 'shared' : firebaseConfigured() ? 'own' : 'none';
}

/** Whether this build has accounts at all. */
export function accountsOn(): boolean {
  return accountKind() !== 'none';
}

/** Sign-in comes before anything else, except in the showcase build used for store pictures. */
export function signInFirst(): boolean {
  return useShared ? import.meta.env['VITE_SHOWCASE'] !== 'true' : firebaseSignInFirst();
}

export function watchUser(onChange: (user: AccountUser | null) => void): () => void {
  if (useShared) return onShared.watchUser(onChange);
  return own.watchUser((u) => onChange(u ? { uid: u.uid, email: u.email } : null));
}

export function socialSignIn(which: Social): Promise<string | undefined> {
  return useShared ? onShared.socialSignIn(which) : ownSocial(which);
}

export const sendCode = onShared.sendCode;
export const verifyCode = onShared.verifyCode;

export function signOut(): Promise<void> {
  return useShared ? onShared.signOut() : own.signOut();
}

export function backendFor(uid: string, onError: (message: string) => void): Backend {
  return useShared ? onShared.backendFor(uid, onError) : new SharedBackend(firebase().db, uid, onError);
}

/** Send what is waiting and fetch again. The Firebase store does this by itself. */
export function syncNow(): void {
  if (useShared) onShared.syncNow();
}

export function importIntoAccount(uid: string, data: Record<string, unknown>): Promise<void> {
  return useShared ? onShared.importIntoAccount(uid, data) : own.importIntoAccount(uid, data);
}

export function createShare(share: Omit<Share, 'code' | 'createdAt' | 'expiresAt'>, days: number): Promise<Share> {
  return useShared ? onShared.createShare(share, days) : own.createShare(share, days);
}
export function getShare(code: string): Promise<Share | undefined> {
  return useShared ? onShared.getShare(code) : own.getShare(code);
}
export function listenShares(uid: string, onChange: (shares: Share[]) => void): () => void {
  return useShared ? onShared.listenShares(uid, onChange) : own.listenShares(uid, onChange);
}
export function replyToShare(code: string, reply: string, helperName: string, extra: { photo?: string; done?: boolean } = {}): Promise<void> {
  return useShared ? onShared.replyToShare(code, reply, helperName, extra) : own.replyToShare(code, reply, helperName, extra);
}
export function markShareOpened(code: string): Promise<void> {
  return useShared ? onShared.markShareOpened(code) : own.markShareOpened(code);
}
export function removeShare(code: string): Promise<void> {
  return useShared ? onShared.removeShare(code) : own.removeShare(code);
}

/** Deletes everything Dealt With holds for the signed-in person. */
export async function deleteEverything(): Promise<void> {
  if (useShared) return onShared.deleteEverything();
  const user = firebase().auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  return own.deleteEverything(user);
}

export function watchPlan(uid: string, onChange: (plan: { active: boolean; paid: boolean }) => void): () => void {
  return useShared ? onShared.watchPlan(uid, onChange) : own.watchPlan(uid, onChange);
}

/** The signed-in person's token for the helper, read aloud and billing, or nothing when signed out. */
export async function accountToken(): Promise<string | undefined> {
  if (useShared) return sharedToken();
  if (!firebaseConfigured()) return undefined;
  return firebase().auth.currentUser?.getIdToken();
}

/** Opens Stripe's page to buy Plus ('checkout') or to change or cancel it ('portal'). Returns an error to show, if any. */
export async function openBilling(which: 'checkout' | 'portal'): Promise<string | undefined> {
  const token = await accountToken();
  const url = import.meta.env[which === 'checkout' ? 'VITE_CHECKOUT_URL' : 'VITE_PORTAL_URL'];
  if (!token || !url) return 'Plus is not on sale yet.';
  try {
    const res = await fetch(String(url), { method: 'POST', headers: { authorization: `Bearer ${token}` } });
    const body = (await res.json().catch(() => ({}))) as { url?: string; text?: string };
    if (res.ok && body.url) {
      window.location.assign(body.url);
      return undefined;
    }
    return body.text ?? 'That did not open. Try again later.';
  } catch {
    return 'No signal. Try again when you have one.';
  }
}

/** Asks the server to bring this person's plan up to date (testers get Plus this way). Quiet if it fails. */
export async function refreshPlan(): Promise<void> {
  const token = await accountToken();
  const url = import.meta.env['VITE_PLAN_URL'];
  if (!token || !url) return;
  await fetch(String(url), { method: 'POST', headers: { authorization: `Bearer ${token}` } }).catch(() => undefined);
}

// The password and emailed-link sign-in of this app's own Firebase project. The shared account
// uses a code instead (sendCode, verifyCode).
export const passwordSignIn = own.passwordSignIn;
export const resetPassword = own.resetPassword;
export const sendLink = own.sendLink;
export const finishLink = own.finishLink;
