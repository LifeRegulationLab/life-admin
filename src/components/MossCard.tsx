import { useEffect, useState } from 'react';
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
          <p>Connected to the Moss in your Mull and Pace account ({link.email}). These settings match there too.</p>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={settings.shortReplies} onChange={(e) => void moss.update({ shortReplies: e.target.checked })} />
            <span>Short replies</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={settings.oneQuestion} onChange={(e) => void moss.update({ oneQuestion: e.target.checked })} />
            <span>One question at a time</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={settings.voice} onChange={(e) => void moss.update({ voice: e.target.checked })} />
            <span>Read {settings.name}'s replies aloud in Mull</span>
          </label>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={settings.remember} onChange={(e) => void moss.update({ remember: e.target.checked })} />
            <span>{settings.name} can remember notes you choose</span>
          </label>
          {!settings.remember ? <p className="muted text-sm">No new notes are kept, in any app. Notes already kept stay until you delete them below.</p> : null}
          <MossKnows name={settings.name} />
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

const APP_NAMES: Record<string, string> = { mull: 'Mull', pace: 'Pace', 'dealt-with': 'Dealt With' };

/** What Moss knows: every note it keeps, which app it came from, and a way to delete each or all. */
function MossKnows({ name }: { name: string }) {
  const [notes, setNotes] = useState<{ id: string; text: string; sourceApp: string }[] | undefined>();
  const [sure, setSure] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let live = true;
    void moss.notes().then((n) => live && setNotes(n));
    return () => {
      live = false;
    };
  }, []);
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-[var(--line)] p-3" aria-labelledby="moss-knows">
      <h3 id="moss-knows" className="font-semibold">
        What {name} knows
      </h3>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
        <li>Shared with your other apps: its name, movement and the ways of talking above.</li>
        <li>Kept in Dealt With only: your letters, bills, forms, photos and the helper's replies. They are never sent to {name}.</li>
        <li>Passed to another app only when you press Send and see exactly what goes.</li>
      </ul>
      <h4 className="label">Notes {name} remembers</h4>
      {notes === undefined ? (
        <p className="muted text-sm">Looking…</p>
      ) : notes.length ? (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-2">
              <span>
                {n.text} <span className="muted text-sm">· from {APP_NAMES[n.sourceApp] ?? n.sourceApp}</span>
              </span>
              <button
                type="button"
                className="btn"
                onClick={() => void moss.deleteNote(n.id).then((ok) => (ok ? setNotes(notes.filter((x) => x.id !== n.id)) : setMsg('It was not deleted. Try again.')))}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted text-sm">No notes. Notes are only ever ones you chose to keep, in Mull or Pace.</p>
      )}
      {sure ? (
        <div className="warnbox flex flex-col gap-2">
          <p>This deletes {name}'s shared settings, every note and anything waiting to move between apps, in every app. It cannot be undone.</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-warn" onClick={() => void moss.forgetEverything().then((ok) => { setSure(false); if (ok) setNotes([]); setMsg(ok ? 'Done. Everything was forgotten.' : 'It did not work. Try again.'); })}>
              Forget everything
            </button>
            <button type="button" className="btn" onClick={() => setSure(false)}>
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-warn self-start" onClick={() => setSure(true)}>
          Forget everything {name} knows
        </button>
      )}
      {msg ? <p className="muted text-sm">{msg}</p> : null}
    </section>
  );
}
