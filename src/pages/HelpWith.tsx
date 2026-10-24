import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Area, Card, Text } from '../components/ui';
import { APP_FULL_NAME } from '../lib/brand';
import { firebaseConfigured } from '../lib/firebase/app';
import { getShare, markShareOpened, replyToShare } from '../lib/firebase/account';
import { smallDataUrl } from '../lib/store/photos';
import type { Share } from '../lib/model/types';
import { clock } from '../lib/time';
import { fmtDate } from '../lib/papers/record';

/**
 * What the supporter sees: one step and its help, and the words only if they were shared.
 * No account needed. They can write back once; the link stops when the step is done.
 */
export function HelpWith() {
  const { code } = useParams();
  const [share, setShare] = useState<Share | null | undefined>(undefined);
  const [reply, setReply] = useState('');
  const [name, setName] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState<string>();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!code || !firebaseConfigured()) return;
    void getShare(code)
      .then((s) => {
        const live = s && s.expiresAt > clock() ? s : null;
        setShare(live);
        if (live && !live.openedAt) void markShareOpened(code);
      })
      .catch(() => setShare(null));
  }, [code]);

  const send = async () => {
    if (!code) return;
    setError('');
    try {
      await replyToShare(code, reply.trim() || (done ? 'Done.' : ''), name.trim(), { ...(photo ? { photo } : {}), done });
      setSent(true);
    } catch {
      setError('That was not sent. Check the signal and try again.');
    }
  };

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-5 py-10">
      {!firebaseConfigured() || share === null ? (
        <p>This link has ended or does not work. Ask the person who sent it for a new one.</p>
      ) : share === undefined ? (
        <p className="muted">Opening…</p>
      ) : (
        <>
          <p className="muted text-sm">Someone has asked you to help with one step.</p>
          <h1 className="text-2xl font-semibold">{share.title}</h1>
          {share.from ? <p>About something from {share.from}.</p> : null}
          {share.dueAt ? <p>It needs doing by {fmtDate(share.dueAt)}.</p> : null}
          {share.help ? (
            <Card>
              <p>{share.help}</p>
            </Card>
          ) : null}
          {share.plain ? (
            <Card className="flex flex-col gap-2">
              <h2 className="font-semibold">What it says</h2>
              <p>{share.plain}</p>
            </Card>
          ) : null}
          {share.details?.length ? (
            <Card className="flex flex-col gap-1">
              <h2 className="font-semibold">Details</h2>
              {share.details.map((d) => (
                <p key={d}>{d}</p>
              ))}
            </Card>
          ) : null}
          {share.pages?.length ? (
            <div className="flex flex-col gap-2">
              {share.pages.map((p, i) => (
                <img key={i} src={p} alt={`Page ${i + 1}`} className="max-w-full rounded border border-[var(--line)]" />
              ))}
            </div>
          ) : null}
          {share.extract ? (
            <Card className="flex flex-col gap-2">
              <h2 className="font-semibold">The words they shared</h2>
              <p className="whitespace-pre-wrap text-sm">{share.extract}</p>
            </Card>
          ) : null}
          {sent || share.reply ? (
            <Card>
              <p>Sent. They will see it next time they open this step.</p>
            </Card>
          ) : (
            <Card className="flex flex-col gap-3">
              <Area label="Write back to them" value={reply} onChange={setReply} rows={4} />
              <Text label="Your name" value={name} onChange={setName} />
              <label className="btn self-start">
                {photo ? 'Change the photo' : 'Add a photo (optional)'}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void smallDataUrl(f, 1200, 0.7).then((u) => setPhoto(u));
                  }}
                />
              </label>
              {photo ? <img src={photo} alt="What you are sending back" className="max-h-48 max-w-full self-start rounded border border-[var(--line)]" /> : null}
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} />
                My part is done
              </label>
              <button type="button" className="btn btn-primary" disabled={!reply.trim() && !done && !photo} onClick={() => void send()}>
                Send
              </button>
            </Card>
          )}
          {error ? <p className="warnbox">{error}</p> : null}
          <p className="muted text-sm">This link works until {fmtDate(share.expiresAt)}, or until the step is done. You cannot see anything else of theirs.</p>
        </>
      )}
      <p className="muted text-xs">{APP_FULL_NAME}</p>
    </main>
  );
}
