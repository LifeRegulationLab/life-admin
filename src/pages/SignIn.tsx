import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, Text } from '../components/ui';
import { APP_NAME } from '../lib/brand';
import { firebaseConfigured } from '../lib/firebase/app';
import { finishLink, importIntoAccount, passwordSignIn, resetPassword, sendLink } from '../lib/firebase/account';
import { COLLECTIONS, DOCS } from '../lib/store/backend';
import { useStore } from '../lib/store/StoreProvider';

/**
 * Make an account or sign in, with a password (works in the app on a home screen) or a link sent
 * by email. Then move anything already on this phone into the account.
 */
export function SignIn() {
  const store = useStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'ask' | 'sent' | 'need-email' | 'moving' | 'error'>('ask');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [isNew, setIsNew] = useState(true);
  const [byLink, setByLink] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const names = [...COLLECTIONS, ...DOCS.map((d) => `doc:${d}`)];
  const held = store.device.dump(names);
  const hasDevice = COLLECTIONS.some((c) => Array.isArray(held[c]) && (held[c] as unknown[]).length > 0);

  useEffect(() => {
    if (!firebaseConfigured()) return;
    void finishLink()
      .then((r) => {
        if (r === 'need-email') setState('need-email');
      })
      .catch(() => {
        setState('error');
        setError('That link did not work. It may have been used already or be more than an hour old. Ask for a new one.');
      });
  }, []);

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

  if (!firebaseConfigured()) {
    return (
      <main className="mx-auto max-w-xl px-5 py-10">
        <p>Accounts are not switched on in this version. Everything stays on this phone.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-5 py-10">
      <h1 className="text-2xl font-semibold">Your {APP_NAME} account</h1>
      <p className="muted text-sm">This account is for {APP_NAME} only. It is separate from any other Life Regulation Lab app.</p>
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
          <Text label="Your email address" type="email" value={email} onChange={setEmail} />
          <Text label="Password" {...(isNew ? { hint: 'At least 8 characters.' } : {})} type="password" value={password} onChange={setPassword} />
          <button className="btn btn-primary" disabled={!email.includes('@') || password.length < (isNew ? 8 : 1) || busy} onClick={() => void withPassword()}>
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
      <button className="btn self-start" onClick={() => navigate('/')}>
        Back
      </button>
    </main>
  );
}
