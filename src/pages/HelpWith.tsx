import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Area, Card, Text } from '../components/ui';
import { APP_FULL_NAME } from '../lib/brand';
import { firebaseConfigured } from '../lib/firebase/app';
import { getShare, replyToShare } from '../lib/firebase/account';
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

  useEffect(() => {
    if (!code || !firebaseConfigured()) return;
    void getShare(code)
      .then((s) => setShare(s && s.expiresAt > clock() ? s : null))
      .catch(() => setShare(null));
  }, [code]);

  const send = async () => {
    if (!code) return;
    setError('');
    try {
      await replyToShare(code, reply.trim(), name.trim());
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
              <button type="button" className="btn btn-primary" disabled={!reply.trim()} onClick={() => void send()}>
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
