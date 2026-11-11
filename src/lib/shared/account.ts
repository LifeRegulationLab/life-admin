import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { STORAGE_PREFIX } from '../brand';
import type { Share } from '../model/types';
import { clean, COLLECTIONS, DOCS, newId, type Backend } from '../store/backend';
import { deviceStorage } from '../store/local';
import { SyncedBackend } from '../store/synced';
import { inShell } from '../shell';
import { shared, sharedKey, sharedToken, sharedUrl } from './app';
import { RestRemote } from './remote';
import type { Json } from './types';

/**
 * The account on the shared Life Regulation Lab server: the same calls the pages made to this
 * app's own Firebase project, made to the shared one instead (docs/SHARED-SERVER.md).
 */

export interface AccountUser {
  uid: string;
  email: string | null;
}

export type Social = 'apple' | 'google';

export function watchUser(onChange: (user: AccountUser | null) => void): () => void {
  const tell = (u: { id: string; email?: string | undefined } | null | undefined) =>
    onChange(u ? { uid: u.id, email: u.email ?? null } : null);
  void shared()
    .auth.getSession()
    .then(({ data }) => tell(data.session?.user));
  const { data } = shared().auth.onAuthStateChange((_event, session) => tell(session?.user));
  return () => data.subscription.unsubscribe();
}

/** Sends a six-figure code to the email address. No password and no link to open. */
export async function sendCode(email: string): Promise<string | undefined> {
  const { error } = await shared().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (!error) return undefined;
  if (error.status === 429) return 'Too many codes asked for. Wait a minute and try again.';
  return 'The code was not sent. Check the email address and the signal.';
}

export async function verifyCode(email: string, code: string): Promise<string | undefined> {
  const { error } = await shared().auth.verifyOtp({ email, token: code.trim(), type: 'email' });
  return error ? 'That code did not work. Check it, or ask for a new one.' : undefined;
}

/**
 * Apple or Google. In the iPhone app the phone's own sign-in sheet is used and its result handed
 * to the shared server; on the web the person goes to Apple or Google and comes back to /signin.
 */
export async function socialSignIn(which: Social): Promise<string | undefined> {
  try {
    if (inShell()) {
      const r =
        which === 'apple'
          ? await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true })
          : await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
      const token = r.credential?.idToken;
      if (!token) return 'That did not finish. Try again.';
      const { error } = await shared().auth.signInWithIdToken({
        provider: which,
        token,
        ...(r.credential?.nonce ? { nonce: r.credential.nonce } : {}),
        ...(r.credential?.accessToken ? { access_token: r.credential.accessToken } : {}),
      });
      return error ? 'That did not work. Try again, or use your email.' : undefined;
    }
    const { error } = await shared().auth.signInWithOAuth({
      provider: which,
      options: { redirectTo: `${window.location.origin}/signin` },
    });
    return error ? 'That did not open. Try again, or use your email.' : undefined;
  } catch {
    return 'That did not finish. Try again.';
  }
}

function remote(): RestRemote {
  return new RestRemote({
    url: sharedUrl(),
    key: sharedKey(),
    token: async () => {
      const token = await sharedToken();
      if (!token) throw new Error('Not signed in.');
      return token;
    },
  });
}

const copyPrefix = (uid: string) => `${STORAGE_PREFIX}:shared:${uid}`;
let current: { uid: string; backend: SyncedBackend } | undefined;

/** Where a signed-in person's records live: the shared server, with a copy on this device. */
export function backendFor(uid: string, onError: (message: string) => void): Backend {
  const backend = new SyncedBackend(remote(), copyPrefix(uid), deviceStorage(), onError);
  current = { uid, backend };
  return backend;
}

/** When the signal is back or the app comes to the front: send what is waiting, fetch again. */
export function syncNow(): void {
  void current?.backend.sync(COLLECTIONS, DOCS);
}

/** Sends anything still waiting, removes this device's copy, and signs out. */
export async function signOut(): Promise<void> {
  if (current) {
    await current.backend.flush().catch(() => undefined);
    if (current.backend.pending() === 0) current.backend.forget(COLLECTIONS, DOCS);
    current = undefined;
  }
  await shared().auth.signOut();
}

/** Copies records kept on the device into the account, the first time someone signs in. */
export async function importIntoAccount(_uid: string, data: Record<string, unknown>): Promise<void> {
  const to = remote();
  for (const name of COLLECTIONS) {
    const items = data[name];
    if (!Array.isArray(items)) continue;
    for (const item of items as { id: string }[]) await to.put(name, item.id, clean(item));
  }
  for (const name of DOCS) {
    const value = data[`doc:${name}`];
    if (value) await to.putDoc(name, clean(value));
  }
  syncNow();
}

/** One step handed to a supporter. The link works for a set number of days, then stops. */
export async function createShare(share: Omit<Share, 'code' | 'createdAt' | 'expiresAt'>, days: number): Promise<Share> {
  const code = `${newId()}${newId()}`.slice(0, 20);
  const now = Date.now();
  const value: Share = { ...share, code, createdAt: now, expiresAt: now + days * 24 * 60 * 60 * 1000 };
  const { error } = await shared()
    .from('shares')
    .insert({ code, data: clean(value) as unknown as Json, expires_at: new Date(value.expiresAt).toISOString() });
  if (error) throw new Error('The link was not made.');
  return value;
}

function asShare(value: unknown): Share | undefined {
  return typeof value === 'object' && value !== null && typeof Reflect.get(value, 'code') === 'string' ? (value as Share) : undefined;
}

/** Read by the supporter, who is not signed in: only this one share, by its code. */
export async function getShare(code: string): Promise<Share | undefined> {
  const { data, error } = await shared().rpc('share_get', { share_code: code });
  if (error) throw new Error('The link could not be opened.');
  return asShare(data);
}

const SHARES_EVERY_MS = 30_000;

/** The person's own shares, looked at again every half minute while a page is showing them. */
export function listenShares(_uid: string, onChange: (shares: Share[]) => void): () => void {
  let active = true;
  const look = async () => {
    const { data, error } = await shared().from('shares').select('data');
    if (!active) return;
    onChange(error || !Array.isArray(data) ? [] : data.flatMap((row: unknown) => asShare(Reflect.get(row as object, 'data')) ?? []));
  };
  void look();
  const timer = window.setInterval(() => void look(), SHARES_EVERY_MS);
  return () => {
    active = false;
    window.clearInterval(timer);
  };
}

/** The supporter's answer: a reply, their name, one photo and whether their part is done. Nothing else. */
export async function replyToShare(code: string, reply: string, helperName: string, extra: { photo?: string; done?: boolean } = {}): Promise<void> {
  const { data, error } = await shared().rpc('share_reply', {
    share_code: code,
    reply: reply.slice(0, 4000),
    helper_name: helperName.slice(0, 80),
    ...(extra.photo ? { photo: extra.photo } : {}),
    ...(extra.done !== undefined ? { done: extra.done } : {}),
  });
  if (error || data !== true) throw new Error('The reply was not sent.');
}

/** Notes, once, that the supporter opened the link. */
export async function markShareOpened(code: string): Promise<void> {
  await shared().rpc('share_opened', { share_code: code });
}

export async function removeShare(code: string): Promise<void> {
  const { error } = await shared().from('shares').delete().eq('code', code);
  if (error) throw new Error('The link was not removed.');
}

/**
 * Deletes everything Dealt With holds for this person. The sign-in itself goes too, unless
 * another Life Regulation Lab app still uses it; that app's records are never touched.
 */
export async function deleteEverything(): Promise<void> {
  const { error } = await shared().rpc('delete_my_account');
  if (error) throw new Error('The account was not deleted.');
  if (current) {
    current.backend.forget(COLLECTIONS, DOCS);
    current = undefined;
  }
  await shared().auth.signOut({ scope: 'local' }).catch(() => undefined);
}

const PLAN_EVERY_MS = 60_000;

/** Whether this person has Dealt With Plus. Only the server writes plans. */
export function watchPlan(_uid: string, onChange: (plan: { active: boolean; paid: boolean }) => void): () => void {
  let active = true;
  const look = async () => {
    const { data, error } = await shared().from('plans').select('active, customer').maybeSingle();
    if (!active) return;
    const row: unknown = error ? null : data;
    onChange({
      active: typeof row === 'object' && row !== null && Reflect.get(row, 'active') === true,
      paid: typeof row === 'object' && row !== null && typeof Reflect.get(row, 'customer') === 'string',
    });
  };
  void look();
  const timer = window.setInterval(() => void look(), PLAN_EVERY_MS);
  return () => {
    active = false;
    window.clearInterval(timer);
  };
}
