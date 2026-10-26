import { useEffect, useState } from 'react';
import { getReady, totalMinutes } from '../../lib/logic/aids';
import { updateStep } from '../../lib/logic/items';
import { moss, MossError, type HandoverStatus } from '../../lib/moss/link';
import type { Item, Step } from '../../lib/model/types';
import { useStore } from '../../lib/store/StoreProvider';
import { itemName } from '../ItemRow';
import { useMoss } from '../Moss';
import { Card, Text } from '../ui';

const STATUS: Record<HandoverStatus, string> = {
  pending: 'Sent. Pace adds it to your to-do list the next time Pace is open. It is not in Pace yet.',
  added: 'Added to Pace.',
  declined: 'Pace did not add it.',
};

/**
 * Put this into Pace: one step as a task, with what to get ready. The person sees exactly what moves
 * and can change it first. Only these lines go; nothing from the letter itself.
 */
export function SendToPace({ item, step }: { item: Item; step: Step }) {
  const { link } = useMoss();
  const { saveItem } = useStore();
  const ready = getReady(item, step);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(`${step.title}: ${itemName(item)}`);
  const [minutes, setMinutes] = useState(String(step.minutes ?? 15));
  const [lines, setLines] = useState(() => [...ready.found, ...ready.own].filter((l) => !l.startsWith('No reference')).slice(0, 10));
  const [status, setStatus] = useState<HandoverStatus | undefined>();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = step.paceHandover;
    if (!id) return;
    let live = true;
    void moss.handoverStatus([id]).then((s) => live && setStatus(s[id] ?? 'pending'));
    return () => {
      live = false;
    };
  }, [step.paceHandover]);

  if (!link) return null;
  if (step.paceHandover) {
    return <p className="muted text-sm">{STATUS[status ?? 'pending']}</p>;
  }
  if (!open) {
    return (
      <button type="button" className="btn self-start" onClick={() => setOpen(true)}>
        Put this into Pace
      </button>
    );
  }
  const send = async () => {
    setBusy(true);
    setMsg('');
    try {
      const id = await moss.sendToPace({ title, minutes: Number(minutes) || totalMinutes(item, step) || 15, firstStep: step.title, ready: lines, readyMinutes: ready.minutes });
      await saveItem(updateStep(item, step.id, { paceHandover: id }));
      setStatus('pending');
    } catch (e) {
      setMsg(e instanceof MossError ? e.message : 'It was not sent. Try again later.');
    }
    setBusy(false);
  };
  return (
    <Card className="flex flex-col gap-3">
      <h3 className="font-semibold">This is what goes to Pace</h3>
      <Text label="The task" value={title} onChange={setTitle} />
      <Text label="Minutes for the task" type="number" value={minutes} onChange={setMinutes} />
      <p className="text-sm">First step: {step.title}</p>
      {ready.minutes ? <p className="text-sm">Getting ready: about {ready.minutes} minutes, placed before it.</p> : null}
      {lines.length ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="label">To get ready (untick any you do not want to send)</legend>
          {[...ready.found, ...ready.own].filter((l) => !l.startsWith('No reference')).slice(0, 10).map((l) => (
            <label key={l} className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1" checked={lines.includes(l)} onChange={() => setLines(lines.includes(l) ? lines.filter((x) => x !== l) : [...lines, l])} />
              <span>{l}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <p className="muted text-sm">Nothing else goes: not the letter, the photos or your notes.</p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" disabled={busy || !title.trim()} onClick={() => void send()}>
          Send to Pace
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Not now
        </button>
      </div>
      {msg ? <p className="warnbox">{msg}</p> : null}
    </Card>
  );
}
