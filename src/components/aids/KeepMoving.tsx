import { useState } from 'react';
import { followUpDraft, owesLine, OWES_INFO } from '../../lib/logic/aids';
import { keepMoving } from '../../lib/logic/items';
import { OWES, type Item, type Owes } from '../../lib/model/types';
import { fmtDate } from '../../lib/papers/record';
import { shareText } from '../../lib/shell';
import { useStore } from '../../lib/store/StoreProvider';
import { Thumb } from '../Capture';
import { itemName } from '../ItemRow';
import { Area, Card, Choice, fromLocalInput, Text, toDateInput } from '../ui';

/**
 * Keep this moving: who owes the next action, what they agreed and when to follow up, with a
 * follow-up ready to send. The original and every proof are kept on the same screen.
 */
export function KeepMoving({ item }: { item: Item }) {
  const { saveItem, data } = useStore();
  const w = item.waiting;
  const [owes, setOwes] = useState<Owes>(w?.owes ?? 'them');
  const [who, setWho] = useState(w?.who ?? '');
  const [agreed, setAgreed] = useState(w?.agreed ?? '');
  const [chaseAt, setChaseAt] = useState(w?.chaseAt ?? 0);
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState('');
  if (!w) return null;
  const changed = owes !== (w.owes ?? 'them') || who !== (w.who ?? '') || agreed !== (w.agreed ?? '') || chaseAt !== w.chaseAt;
  const proofs = item.record.filter((r) => r.kind === 'sent' || r.kind === 'proof' || r.kind === 'paid');

  const copy = async () => {
    const r = await shareText(itemName(item), draft);
    setMsg(r === 'copied' ? 'Copied. Paste it into an email or a letter.' : r === 'failed' ? 'That did not work. Select the words and copy them.' : '');
  };

  return (
    <>
      <Card className="flex flex-col gap-3">
        <h3 className="font-semibold">Keep this moving</h3>
        <p>{owesLine(item)}</p>
        <Choice label="Who has the next step?" options={OWES.map((o) => ({ code: o, text: OWES_INFO[o] }))} value={owes} onChange={setOwes} />
        {owes === 'someone' ? <Text label="Who" value={who} onChange={setWho} /> : null}
        <Area label="What they said they would do, and by when (optional)" value={agreed} onChange={setAgreed} rows={2} />
        <label className="block">
          <span className="label">Follow up on</span>
          <input className="field" type="date" value={toDateInput(chaseAt)} onChange={(e) => e.target.value && setChaseAt(fromLocalInput(`${e.target.value}T09:00`))} />
        </label>
        <button type="button" className="btn self-start" disabled={!changed} onClick={() => void saveItem(keepMoving(item, { owes, who, agreed, chaseAt }))}>
          Save
        </button>
      </Card>

      <Card className="flex flex-col gap-3">
        <h3 className="font-semibold">A follow-up, ready to send</h3>
        {draft ? (
          <>
            <Area label="Your follow-up" value={draft} onChange={setDraft} rows={9} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn" onClick={() => void copy()}>
                Copy or share
              </button>
            </div>
            <p className="muted text-sm">Read it through before you send it. It is not sent from here.</p>
            {msg ? <p className="muted">{msg}</p> : null}
          </>
        ) : (
          <button type="button" className="btn self-start" onClick={() => setDraft(followUpDraft(item, data.settings))}>
            Write the follow-up for me
          </button>
        )}
      </Card>

      <Card className="flex flex-col gap-2">
        <h3 className="font-semibold">The original and your proof</h3>
        {item.understanding?.plain ? <p>{item.understanding.plain}</p> : item.text ? <p className="line-clamp-4 whitespace-pre-wrap">{item.text}</p> : null}
        {item.understanding?.ask ? <p className="muted text-sm">They asked you to: {item.understanding.ask}</p> : null}
        {proofs.length ? (
          <ul className="flex flex-col gap-2">
            {proofs.map((r) => (
              <li key={r.id} className="flex flex-col gap-1">
                <span className="text-sm">
                  {fmtDate(r.at)}: {r.text}
                  {r.ref ? ` (reference ${r.ref})` : ''}
                </span>
                {r.photoId ? <Thumb id={r.photoId} label={`Proof from ${fmtDate(r.at)}`} /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted text-sm">No proof kept yet..</p>
        )}
        {item.pageIds.length ? (
          <div className="flex flex-wrap gap-2">
            {item.pageIds.map((id, i) => (
              <Thumb key={id} id={id} label={`Page ${i + 1}`} />
            ))}
          </div>
        ) : null}
      </Card>
    </>
  );
}
