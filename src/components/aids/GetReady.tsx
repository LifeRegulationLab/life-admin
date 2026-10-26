import { useState } from 'react';
import { getReady, readyTime } from '../../lib/logic/aids';
import { updateStep } from '../../lib/logic/items';
import type { Item, Step } from '../../lib/model/types';
import { useStore } from '../../lib/store/StoreProvider';
import { Card } from '../ui';
import { useEasy } from '../voice';

const MINUTES = [0, 2, 5, 10, 15, 20, 30];

/**
 * Get ready first: what to have in front of you before this step, found in the letter, plus your own
 * things, with getting ready timed apart from the step. Ticks are kept, so they are there on return.
 */
export function GetReady({ item, step }: { item: Item; step: Step }) {
  const { saveItem } = useStore();
  const easy = useEasy();
  const ready = getReady(item, step);
  const [adding, setAdding] = useState('');
  const [editing, setEditing] = useState(false);
  const ticked = new Set(step.readyTicked ?? []);
  const all = [...ready.found, ...ready.own];
  if (!all.length && !editing) {
    return (
      <button type="button" className="btn self-start" onClick={() => setEditing(true)}>
        Add things to get ready first
      </button>
    );
  }
  const save = (change: Partial<Step>) => void saveItem(updateStep(item, step.id, change));
  const tick = (line: string) => save({ readyTicked: ticked.has(line) ? [...ticked].filter((t) => t !== line) : [...ticked, line] });
  const add = () => {
    const text = adding.trim();
    if (!text) return;
    save({ ready: [...ready.own, text] });
    setAdding('');
  };
  const time = readyTime(ready, step);
  const allTicked = all.length > 0 && all.every((l) => ticked.has(l));

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h3 className="font-semibold">{easy ? 'Get these first' : 'Get ready first'}</h3>
        {time ? <p className="muted text-sm">{time}</p> : null}
      </div>
      <ul className="flex flex-col gap-2">
        {all.map((line) => (
          <li key={line}>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" checked={ticked.has(line)} onChange={() => tick(line)} />
              <span>{line}</span>
            </label>
            {editing && ready.own.includes(line) ? (
              <button type="button" className="muted ml-7 text-sm underline" onClick={() => save({ ready: ready.own.filter((o) => o !== line), readyTicked: [...ticked].filter((t) => t !== line) })}>
                Take this off
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {allTicked ? <p className="text-sm">Everything is ready.</p> : null}
      {editing ? (
        <div className="flex flex-col gap-2">
          <label className="block">
            <span className="label">Something else to have ready</span>
            <input className="field" value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          </label>
          <button type="button" className="btn self-start" disabled={!adding.trim()} onClick={add}>
            Add it
          </button>
          <fieldset>
            <legend className="label">Time to get ready</legend>
            <div className="flex flex-wrap gap-2">
              {MINUTES.map((m) => (
                <button key={m} type="button" className="chip" aria-pressed={ready.minutes === m} onClick={() => save({ readyMinutes: m })}>
                  {m === 0 ? 'None' : `${m} min`}
                </button>
              ))}
            </div>
          </fieldset>
          <button type="button" className="btn self-start" onClick={() => setEditing(false)}>
            Finished changing
          </button>
        </div>
      ) : (
        <button type="button" className="muted self-start text-sm underline" onClick={() => setEditing(true)}>
          Change the list or the time
        </button>
      )}
    </Card>
  );
}
