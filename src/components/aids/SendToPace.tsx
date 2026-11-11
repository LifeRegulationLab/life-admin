import { useEffect, useState } from 'react';
import { getReady, totalMinutes } from '../../lib/logic/aids';
import { moss, MossError, newHandoverId, type PaceProgress } from '../../lib/moss/link';
import { clearPace, keepForPace, PACE_LINES, PACE_NOT_CHECKED, PACE_NOT_SENT, sentToPace } from '../../lib/moss/pace';
import type { Item, Step } from '../../lib/model/types';
import { useStore } from '../../lib/store/StoreProvider';
import { itemName } from '../ItemRow';
import { useMoss } from '../Moss';
import { Card, Text } from '../ui';

/**
 * Put this into Pace: one step as a task, with what to get ready. The person sees exactly what moves
 * and can change it first. Only these lines go; nothing from the letter itself. Afterwards it says
 * where the step has got to in Pace. Finished there is never the same as done here.
 */
export function SendToPace({ item, step }: { item: Item; step: Step }) {
  const { link } = useMoss();
  const { saveItem } = useStore();
  const ready = getReady(item, step);
  const offered = [...ready.found, ...ready.own].filter((l) => !l.startsWith('No reference')).slice(0, 10);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(`${step.title}: ${itemName(item)}`);
  const [minutes, setMinutes] = useState(String(step.minutes ?? 15));
  const [lines, setLines] = useState(offered);
  const [progress, setProgress] = useState<PaceProgress | 'unknown' | undefined>();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const sentId = step.paceHandover && !step.paceUnsent ? step.paceHandover : undefined;
  useEffect(() => {
    if (!sentId) return;
    let live = true;
    const look = () => void moss.paceProgress([sentId]).then((p) => live && setProgress(p ? (p[sentId] ?? 'gone') : 'unknown'));
    look();
    // Coming back from Pace: look again, so "Finished in Pace" shows without reloading.
    const back = () => document.visibilityState === 'visible' && look();
    document.addEventListener('visibilitychange', back);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', back);
    };
  }, [sentId]);

  if (!link) return null;

  if (sentId) {
    if (progress === undefined) return <p className="muted text-sm">Checking Pace…</p>;
    if (progress === 'unknown') return <p className="muted text-sm">{PACE_NOT_CHECKED}</p>;
    return (
      <div className="flex flex-col items-start gap-2">
        <p className={progress === 'finished' ? 'text-sm font-semibold' : 'muted text-sm'}>{PACE_LINES[progress]}</p>
        {progress === 'gone' || progress === 'declined' ? (
          <button type="button" className="btn" onClick={() => void saveItem(clearPace(item, step.id)).then(() => setProgress(undefined))}>
            Send it again
          </button>
        ) : null}
      </div>
    );
  }

  if (!open && !step.paceUnsent) {
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
      // The id is kept with the step before anything is sent. If the reply is lost, trying again
      // sends the same id, and the server keeps only one.
      const id = step.paceHandover ?? newHandoverId();
      const kept = step.paceHandover ? item : keepForPace(item, step.id, id);
      if (kept !== item) await saveItem(kept);
      await moss.sendToPace({ title, minutes: Number(minutes) || totalMinutes(item, step) || 15, firstStep: step.title, ready: lines, readyMinutes: ready.minutes, source: item.id }, id);
      await saveItem(sentToPace(kept, step.id));
      setProgress('sent');
    } catch (e) {
      setMsg(e instanceof MossError ? e.message : 'It was not sent. Try again later.');
    }
    setBusy(false);
  };

  return (
    <Card className="flex flex-col gap-3">
      <h3 className="font-semibold">This is what goes to Pace</h3>
      {step.paceUnsent ? <p className="warnbox">{PACE_NOT_SENT}</p> : null}
      <Text label="The task" value={title} onChange={setTitle} />
      <Text label="Minutes for the task" type="number" value={minutes} onChange={setMinutes} />
      <p className="text-sm">First step: {step.title}</p>
      {ready.minutes ? <p className="text-sm">Getting ready: about {ready.minutes} minutes, placed before it.</p> : null}
      {offered.length ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="label">To get ready (untick any you do not want to send)</legend>
          {offered.map((l) => (
            <label key={l} className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1" checked={lines.includes(l)} onChange={() => setLines(lines.includes(l) ? lines.filter((x) => x !== l) : [...lines, l])} />
              <span>{l}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <p className="muted text-sm">Nothing else goes: not the letter, the photos or your notes. Pace is also told which page this is, so it can bring you back here.</p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" disabled={busy || !title.trim()} onClick={() => void send()}>
          {step.paceUnsent ? 'Send again' : 'Send to Pace'}
        </button>
        {step.paceUnsent ? null : (
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            Not now
          </button>
        )}
      </div>
      {msg ? <p className="warnbox">{msg}</p> : null}
    </Card>
  );
}
