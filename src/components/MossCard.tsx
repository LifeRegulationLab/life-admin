import { useState } from 'react';
import { Card, Text } from './ui';
import { Moss, useMoss } from './Moss';
import { moss, MossError, mossLinkAvailable } from '../lib/moss/link';

/** Moss in Me: its name, whether it moves, and the optional link to Mull and Pace. */
export function MossCard() {
  const { settings, link } = useMoss();
  const [name, setName] = useState(settings.name);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'' | 'email' | 'code'>('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setMsg('');
    try {
      await job();
    } catch (e) {
      setMsg(e instanceof MossError ? e.message : 'That did not work. Try again.');
    }
    setBusy(false);
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Moss size={64} />
        <div>
          <h2 className="font-semibold">{settings.name}</h2>
          <p className="muted text-sm">Your companion across the Life Regulation Lab apps. It sits in the middle of Today and in the bottom corner of the other pages. Tap it for help finding your way.</p>
        </div>
      </div>
      <Text label="Its name" value={name} onChange={setName} />
      <button type="button" className="btn self-start" disabled={name.trim() === settings.name || !name.trim()} onClick={() => void moss.update({ name })}>
        Save the name
      </button>
      <label className="flex items-center gap-3">
        <input type="checkbox" checked={settings.show} onChange={(e) => void moss.update({ show: e.target.checked })} />
        <span>Show {settings.name}</span>
      </label>
      <label className="flex items-center gap-3">
        <input type="checkbox" checked={settings.motion} onChange={(e) => void moss.update({ motion: e.target.checked })} />
        <span>Let {settings.name} move</span>
      </label>
      <p className="muted text-sm">Show is for this device. {settings.name} also keeps still when your phone is set to reduce motion.</p>

      {!mossLinkAvailable() ? null : link ? (
        <>
          <p>Connected to the Moss in your Mull and Pace account ({link.email}). Its name and movement match there.</p>
          <p className="muted text-sm">Nothing from your letters, bills or forms is sent. What {settings.name} remembers stays in Mull and Pace and is not used here.</p>
          <button type="button" className="btn self-start" onClick={() => void moss.disconnect()}>
            Disconnect {settings.name}
          </button>
        </>
      ) : stage === '' ? (
        <>
          <p className="muted text-sm">If you use Mull or Pace, you can connect {settings.name} here so its name and movement match. This is optional and does not change your Dealt With account.</p>
          <button type="button" className="btn self-start" onClick={() => setStage('email')}>
            Connect {settings.name}
          </button>
        </>
      ) : stage === 'email' ? (
        <>
          <Text label="The email of your Mull or Pace account" type="email" value={email} onChange={setEmail} />
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" disabled={busy || !email.includes('@')} onClick={() => void run(async () => { await moss.sendCode(email); setStage('code'); })}>
              Send a code
            </button>
            <button type="button" className="btn" onClick={() => setStage('')}>
              Not now
            </button>
          </div>
        </>
      ) : (
        <>
          <Text label={`The six-digit code sent to ${email}`} value={code} onChange={setCode} />
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary" disabled={busy || code.replace(/\s/g, '').length < 6} onClick={() => void run(async () => { await moss.confirmCode(email, code); setStage(''); setCode(''); setName(moss.getSettings().name); })}>
              Connect
            </button>
            <button type="button" className="btn" onClick={() => setStage('email')}>
              Back
            </button>
          </div>
        </>
      )}
      {msg ? <p className="warnbox">{msg}</p> : null}
    </Card>
  );
}
