import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, Text } from '../components/ui';
import { APP_NAME } from '../lib/brand';
import {
  accountKind,
  accountsOn,
  finishLink,
  importIntoAccount,
  passwordSignIn,
  resetPassword,
  sendCode,
  sendLink,
  socialSignIn,
  verifyCode,
  type Social,
} from '../lib/account';
import { COLLECTIONS, DOCS } from '../lib/store/backend';
import { useStore } from '../lib/store/StoreProvider';

/**
 * The first page: sign in or make an account, then the app opens, after moving anything already
 * on this phone into the account. With the shared Life Regulation Lab account that is Apple,
 * Google or a code sent by email. With this app's own account it is Apple, Google, a password or
 * a link sent by email.
 */

export const SHARED_NOTE = `This is your Life Regulation Lab account. The same sign-in works in Regulate, Pace, Mull and Head Untangled. What you keep in ${APP_NAME} stays in ${APP_NAME}.`;
export const OWN_NOTE = `This account is for ${APP_NAME} only. It is separate from any other Life Regulation Lab app.`;

/** Email, then the six-figure code sent to it. No password to remember and no link to open. */
export function CodeSignIn({
  busy,
  onSocial,
  onSend,
  onVerify,
}: {
  busy: boolean;
  onSocial: (which: Social) => void;
  onSend: (email: string) => Promise<boolean>;
  onVerify: (email: string, code: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-semibold">Sign in</h2>
      <button className="btn btn-primary" disabled={busy} onClick={() => onSocial('apple')}>
        Continue with Apple
      </button>
      <button className="btn" disabled={busy} onClick={() => onSocial('google')}>
        Continue with Google
      </button>
      <p className="muted text-center text-sm">or with your email</p>
      <Text label="Your email address" type="email" value={email} onChange={setEmail} />
      {sent ? (
        <>
          <Text label="The code from the email" hint="Six numbers. It works once and lasts an hour." value={code} onChange={setCode} />
          <button className="btn btn-primary" disabled={busy || code.trim().length < 6} onClick={() => onVerify(email.trim(), code)}>
            {busy ? 'One moment…' : 'Sign in'}
          </button>
          <button className="self-start text-sm underline" disabled={busy} onClick={() => void onSend(email.trim())}>
            Send a new code
          </button>
        </>
      ) : (
        <button className="btn" disabled={busy || !email.includes('@')} onClick={() => void onSend(email.trim()).then(setSent)}>
          Send me a code
        </button>
      )}
      <p className="muted text-sm">If you have not used a Life Regulation Lab app before, this makes your account.</p>
    </Card>
  );
}

export function SignIn() {
  const store = useStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'ask' | 'sent' | 'need-email' | 'moving' | 'error'>('ask');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [byLink, setByLink] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const names = [...COLLECTIONS, ...DOCS.map((d) => `doc:${d}`)];
  const held = store.device.dump(names);
  const hasDevice = COLLECTIONS.some((c) => Array.isArray(held[c]) && (held[c] as unknown[]).length > 0);

  const onShared = accountKind() === 'shared';

  useEffect(() => {
    // The emailed link belongs to this app's own account. The shared account uses a code.
    if (accountKind() !== 'own') return;
    void finishLink()
      .then((r) => {
        if (r === 'need-email') setState('need-email');
      })
      .catch(() => {
        setState('error');
        setError('That link did not work. It may have been used already or be more than an hour old. Ask for a new one.');
      });
  }, []);

  useEffect(() => {
    if (store.user && !hasDevice) navigate('/', { replace: true });
  }, [store.user, hasDevice, navigate]);

  const social = async (which: Social) => {
    setError('');
    setBusy(true);
    const e = await socialSignIn(which);
    setBusy(false);
    if (e) setError(e);
  };

  const send = async () => {
    setError('');
    try {
      await sendLink(email.trim());
      setState('sent');
    } catch {
      setError('The link was not sent. Check the email address and the signal.');
    }
  };

  const withPassword = async () => {
    setError('');
    setBusy(true);
    const e = await passwordSignIn(email.trim(), password, isNew);
    setBusy(false);
    if (e) setError(e);
  };

  const finishWithEmail = async () => {
    try {
      await finishLink(email.trim());
    } catch {
      setError('That did not work. Check it is the same email address the link was sent to.');
    }
  };

  const move = async () => {
    if (!store.user) return;
    setState('moving');
    try {
      await importIntoAccount(store.user.uid, held);
      store.device.clear(names);
      navigate('/');
    } catch {
      setState('error');
      setError('Moving did not finish. Nothing on this phone was removed. Try again with a better signal.');
    }
  };

  const sendTheCode = async (to: string) => {
    setError('');
    setBusy(true);
    const e = await sendCode(to);
    setBusy(false);
    if (e) setError(e);
    return !e;
  };

  const verifyTheCode = async (to: string, code: string) => {
    setError('');
    setBusy(true);
    const e = await verifyCode(to, code);
    setBusy(false);
    if (e) setError(e);
  };

  if (!accountsOn()) {
    return (
      <main className="mx-auto max-w-xl px-5 py-10">
        <p>Accounts are not switched on in this version. Everything stays on this phone.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-5 py-10">
      <h1 className="text-3xl font-semibold">{APP_NAME}</h1>
      {store.user ? (
        <Card className="flex flex-col gap-3">
          <p>Signed in as {store.user.email}.</p>
          {hasDevice ? (
            <>
              <p>There are things kept on this phone. Move them into your account so they are safe if you lose the phone.</p>
              <button className="btn btn-primary" disabled={state === 'moving'} onClick={() => void move()}>
                {state === 'moving' ? 'Moving…' : 'Move them into my account'}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              Carry on
            </button>
          )}
        </Card>
      ) : onShared ? (
        <CodeSignIn busy={busy} onSocial={(which) => void social(which)} onSend={sendTheCode} onVerify={(to, code) => void verifyTheCode(to, code)} />
      ) : state === 'sent' ? (
        <Card>
          <p>A sign-in link is on its way to {email}. Open it on this phone. It works once and lasts an hour.</p>
        </Card>
      ) : byLink || state === 'need-email' ? (
        <Card className="flex flex-col gap-3">
          <Text label="Your email address" type="email" value={email} onChange={setEmail} />
          <button className="btn btn-primary" disabled={!email.includes('@')} onClick={() => void (state === 'need-email' ? finishWithEmail() : send())}>
            {state === 'need-email' ? 'Finish signing in' : 'Send me a link'}
          </button>
          <p className="muted text-sm">{state === 'need-email' ? 'Type the email address the link was sent to.' : 'You get an email with a link. Open it on this phone.'}</p>
          {state !== 'need-email' ? (
            <button className="btn" onClick={() => setByLink(false)}>
              Use a password instead
            </button>
          ) : null}
        </Card>
      ) : (
        <Card className="flex flex-col gap-3">
          <h2 className="font-semibold">{isNew ? 'Make your account' : 'Sign in'}</h2>
          <button className="btn btn-primary" disabled={busy} onClick={() => void social('apple')}>
            Continue with Apple
          </button>
          <button className="btn" disabled={busy} onClick={() => void social('google')}>
            Continue with Google
          </button>
          <p className="muted text-center text-sm">or with your email</p>
          <Text label="Your email address" type="email" value={email} onChange={setEmail} />
          <Text label="Password" {...(isNew ? { hint: 'At least 8 characters.' } : {})} type="password" value={password} onChange={setPassword} />
          <button className="btn" disabled={!email.includes('@') || password.length < (isNew ? 8 : 1) || busy} onClick={() => void withPassword()}>
            {busy ? 'One moment…' : isNew ? 'Make my account' : 'Sign in'}
          </button>
          <button className="btn" onClick={() => setIsNew(!isNew)}>
            {isNew ? 'I have an account' : 'I need an account'}
          </button>
          {!isNew ? (
            <button
              className="self-start text-sm underline"
              disabled={!email.includes('@')}
              onClick={() => void resetPassword(email.trim()).then(() => setNote('A link to set a new password is on its way.'), () => setNote('That did not send. Check the email address.'))}
            >
              Forgotten your password?
            </button>
          ) : null}
          <button className="self-start text-sm underline" onClick={() => setByLink(true)}>
            Get a sign-in link by email instead
          </button>
          {note ? <p className="muted text-sm">{note}</p> : null}
        </Card>
      )}
      {error ? <p className="warnbox">{error}</p> : null}
      <p className="muted text-sm">{onShared ? SHARED_NOTE : OWN_NOTE}</p>
    </main>
  );
}
