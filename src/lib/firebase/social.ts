import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { GoogleAuthProvider, OAuthProvider, signInWithCredential, signInWithPopup } from 'firebase/auth';
import { inShell } from '../shell';
import { firebase } from './app';

export type Social = 'apple' | 'google';

/**
 * Sign in with Apple or Google. In the iPhone app the phone's own sign-in sheet is used and the
 * result handed to Firebase; on the web a Firebase pop-up is used. Returns an error to show, if any.
 */
export async function socialSignIn(which: Social): Promise<string | undefined> {
  const { auth } = firebase();
  try {
    if (inShell()) {
      if (which === 'apple') {
        const r = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
        if (!r.credential?.idToken) return 'Apple did not finish signing in.';
        const cred = new OAuthProvider('apple.com').credential({ idToken: r.credential.idToken, ...(r.credential.nonce ? { rawNonce: r.credential.nonce } : {}) });
        await signInWithCredential(auth, cred);
      } else {
        const r = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
        if (!r.credential?.idToken) return 'Google did not finish signing in.';
        await signInWithCredential(auth, GoogleAuthProvider.credential(r.credential.idToken, r.credential.accessToken));
      }
    } else {
      const provider = which === 'apple' ? new OAuthProvider('apple.com') : new GoogleAuthProvider();
      if (provider instanceof OAuthProvider) provider.addScope('email');
      await signInWithPopup(auth, provider);
    }
    return undefined;
  } catch (e) {
    const code = (e as { code?: string; message?: string }).code ?? (e as { message?: string }).message ?? '';
    if (/cancel|closed-by-user|popup-closed|1001/i.test(code)) return undefined;
    if (code.includes('account-exists-with-different-credential')) return 'That email already has an account. Sign in with your email and password instead.';
    if (code.includes('operation-not-allowed')) return `Signing in with ${which === 'apple' ? 'Apple' : 'Google'} is not switched on yet.`;
    if (code.includes('network')) return 'No signal. Try again when you have one.';
    return 'That did not work. Try again.';
  }
}
