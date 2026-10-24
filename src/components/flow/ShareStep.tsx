import { useEffect, useState } from 'react';
import { firebaseConfigured } from '../../lib/firebase/app';
import { createShare, listenShares, removeShare } from '../../lib/firebase/account';
import type { Item, Share, Step } from '../../lib/model/types';
import { fmtDate } from '../../lib/papers/record';
import { shareText } from '../../lib/shell';
import { readFacts } from '../../lib/logic/facts';
import { loadPhoto, smallDataUrl } from '../../lib/store/photos';
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
  const [withPlain, setWithPlain] = useState(false);
  const [withDetails, setWithDetails] = useState(false);
  const [withPages, setWithPages] = useState(false);
  const [days, setDays] = useState<'3' | '7' | '14'>('7');
  const [msg, setMsg] = useState('');
  const online = Boolean(user) && firebaseConfigured();

  const extract = withWords ? item.text.slice(0, 6000) : '';
  const facts = readFacts(item.text, new Date(item.createdAt));
  const details = withDetails
    ? [
        ...facts.amounts.slice(0, 3).map((a) => `Amount: ${a.value}`),
        ...(item.reference ? [`Reference: ${item.reference}`] : facts.references.slice(0, 2).map((r) => `Reference: ${r.value}`)),
        ...facts.dates.slice(0, 3).map((d) => `Date in it: ${fmtDate(d.value)}`),
      ]
    : [];
  const plain = withPlain ? (item.understanding?.plain ?? '') : '';
  const text = [
    `Could you help me with one thing? ${itemName(item)}${item.from ? `, from ${item.from}` : ''}.`,
    `The step: ${step.title}.`,
    step.help,
    item.understanding?.dueAt ? `It needs doing by ${fmtDate(item.understanding.dueAt)}.` : '',
    plain ? `What it says: ${plain}` : '',
    details.length ? details.join('\n') : '',
    extract ? `The words of it:\n${extract}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const sendLink = async () => {
    if (!user) return;
    setMsg('');
    try {
      const pages: string[] = [];
      if (withPages) {
        for (const id of item.pageIds.slice(0, 3)) {
          const blob = await loadPhoto(id);
          const url = blob ? await smallDataUrl(blob, 900, 0.6) : undefined;
          if (url) pages.push(url);
        }
      }
      const s = await createShare(
        {
          owner: user.uid,
          itemId: item.id,
          stepId: step.id,
          title: step.title,
          help: step.help,
          extract,
          ...(plain ? { plain } : {}),
          ...(details.length ? { details } : {}),
          ...(pages.length ? { pages } : {}),
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
          <p className="muted text-sm">
            {s.openedAt ? `They opened it on ${fmtDate(s.openedAt, true)}.` : 'Not opened yet.'} They can see: this step{[s.plain ? 'what it says' : '', s.details?.length ? 'the amounts, dates and references' : '', s.extract ? 'the words' : '', s.pages?.length ? 'the photos of the pages' : ''].filter(Boolean).map((x) => `, ${x}`).join('')}.
          </p>
          {s.reply ? (
            <>
              <p className="whitespace-pre-wrap">
                {s.helperName || 'They'} wrote: {s.reply}
              </p>
              {s.replyPhoto ? <img src={s.replyPhoto} alt={`Sent back by ${s.helperName || 'them'}`} className="max-h-64 max-w-full self-start rounded border border-[var(--line)]" /> : null}
              {s.helperDone ? <p className="text-sm">They say their part is done.</p> : null}
            </>
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
          <fieldset className="flex flex-col gap-2">
            <legend className="label">Also show them (each one only if you tick it)</legend>
            {item.understanding?.plain ? (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={withPlain} onChange={(e) => setWithPlain(e.target.checked)} />
                What it says, in plain words
              </label>
            ) : null}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={withDetails} onChange={(e) => setWithDetails(e.target.checked)} />
              The amounts, dates and references
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={withWords} onChange={(e) => setWithWords(e.target.checked)} />
              All the words of the {item.kind === 'email' ? 'email' : 'letter'}
            </label>
            {online && item.pageIds.length ? (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={withPages} onChange={(e) => setWithPages(e.target.checked)} />
                Photos of the pages
              </label>
            ) : null}
          </fieldset>
          {online ? (
            <>
              <Choice label="The link works for" options={DAYS} value={days} onChange={setDays} />
              <button type="button" className="btn btn-primary self-start" onClick={() => void sendLink()}>
                Make a link to send
              </button>
              <p className="muted text-sm">They can write back, add a photo, and say when their part is done. They cannot see anything else or send anything in your name. The link stops when this step is done, when you stop sharing, or after the days above. Stopping it cannot undo what they have already seen or saved.</p>
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
