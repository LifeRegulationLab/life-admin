import { useEffect, useState } from 'react';
import { firebaseConfigured } from '../../lib/firebase/app';
import { createShare, listenShares, removeShare } from '../../lib/firebase/account';
import type { Item, Share, Step } from '../../lib/model/types';
import { fmtDate } from '../../lib/papers/record';
import { shareText } from '../../lib/shell';
import { useStore } from '../../lib/store/StoreProvider';
import { itemName } from '../ItemRow';
import { Picture } from '../Picture';
import { Card, Choice } from '../ui';

/**
 * Asking someone to help with one step. They see this step, its help and, only if you tick it,
 * the words of the letter. Nothing else. The link stops working after the days you choose, and
 * as soon as the step is done.
 */

const env = import.meta.env;

function shareLink(code: string): string {
  const base = String(env['VITE_PUBLIC_URL'] || window.location.origin).replace(/\/$/, '');
  return `${base}/with/${code}`;
}

export function useShares(): Share[] {
  const { user } = useStore();
  const [shares, setShares] = useState<Share[]>([]);
  useEffect(() => {
    if (!user || !firebaseConfigured()) return;
    return listenShares(user.uid, setShares);
  }, [user]);
  return user ? shares : [];
}

const DAYS = [
  { code: '3', text: '3 days' },
  { code: '7', text: 'A week' },
  { code: '14', text: 'Two weeks' },
] as const;

export function ShareStep({ item, step }: { item: Item; step: Step }) {
  const { user, data } = useStore();
  const shares = useShares().filter((s) => s.itemId === item.id && s.stepId === step.id);
  const [open, setOpen] = useState(false);
  const [withWords, setWithWords] = useState(false);
  const [days, setDays] = useState<'3' | '7' | '14'>('7');
  const [msg, setMsg] = useState('');
  const online = Boolean(user) && firebaseConfigured();

  const extract = withWords ? item.text.slice(0, 6000) : '';
  const text = [
    `Could you help me with one thing? ${itemName(item)}${item.from ? `, from ${item.from}` : ''}.`,
    `The step: ${step.title}.`,
    step.help,
    item.understanding?.dueAt ? `It needs doing by ${fmtDate(item.understanding.dueAt)}.` : '',
    extract ? `The words of it:\n${extract}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const sendLink = async () => {
    if (!user) return;
    setMsg('');
    try {
      const s = await createShare(
        {
          owner: user.uid,
          itemId: item.id,
          stepId: step.id,
          title: step.title,
          help: step.help,
          extract,
          from: item.from,
          ...(item.understanding?.dueAt ? { dueAt: item.understanding.dueAt } : {}),
          helperName: '',
        },
        Number(days),
      );
      const r = await shareText('Could you help with this?', `${data.settings.name || 'I'} would like help with one step. Open this link to see it: ${shareLink(s.code)}`);
      setMsg(r === 'copied' ? 'Link copied. Send it to them in a message.' : r === 'failed' ? `The link: ${shareLink(s.code)}` : 'Sent.');
    } catch {
      setMsg('The link was not made. Check the signal and try again.');
    }
  };

  const sendText = async () => {
    const r = await shareText('Could you help with this?', text);
    setMsg(r === 'copied' ? 'Copied. Paste it into a message.' : r === 'failed' ? 'That did not work.' : '');
  };

  return (
    <div className="flex flex-col gap-2">
      {shares.map((s) => (
        <Card key={s.code} className="flex flex-col gap-2">
          <p className="font-semibold">Shared with someone until {fmtDate(s.expiresAt)}</p>
          {s.reply ? (
            <p className="whitespace-pre-wrap">
              {s.helperName || 'They'} wrote: {s.reply}
            </p>
          ) : (
            <p className="muted text-sm">No answer from them yet.</p>
          )}
          <button type="button" className="btn self-start" onClick={() => void removeShare(s.code)}>
            Stop sharing
          </button>
        </Card>
      ))}
      {!open ? (
        <button type="button" className="btn self-start" onClick={() => setOpen(true)}>
          <Picture name="person" size={20} />
          Ask someone to help with this step
        </button>
      ) : (
        <Card className="flex flex-col gap-3">
          <p>They will see this step and its help. Nothing else, unless you tick below.</p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={withWords} onChange={(e) => setWithWords(e.target.checked)} />
            Also show them the words of the {item.kind === 'email' ? 'email' : 'letter'}
          </label>
          {online ? (
            <>
              <Choice label="The link works for" options={DAYS} value={days} onChange={setDays} />
              <button type="button" className="btn btn-primary self-start" onClick={() => void sendLink()}>
                Make a link to send
              </button>
              <p className="muted text-sm">They can write back to you on the link. It stops working when this step is done.</p>
            </>
          ) : (
            <button type="button" className="btn btn-primary self-start" onClick={() => void sendText()}>
              Send it to them
            </button>
          )}
          {msg ? <p className="muted text-sm">{msg}</p> : null}
        </Card>
      )}
    </div>
  );
}
