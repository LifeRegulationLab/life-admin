import { useState } from 'react';
import { EXTRA_STEPS, makeStep, STEP_PICTURE } from '../../lib/content/steps';
import type { Item } from '../../lib/model/types';
import { useStore } from '../../lib/store/StoreProvider';
import { Picture } from '../Picture';
import { clock } from '../../lib/time';
import { Card } from '../ui';

/** All the steps on one screen: jump to one, rename, reorder, remove or add. */
export function StepsEditor({ item, onOpen }: { item: Item; onOpen: (index: number) => void }) {
  const { saveItem } = useStore();
  const [adding, setAdding] = useState(false);
  const [own, setOwn] = useState('');

  const put = (steps: Item['steps']) => void saveItem({ ...item, steps, at: Math.min(item.at, steps.length), updatedAt: clock() });
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= item.steps.length) return;
    const steps = [...item.steps];
    const [s] = steps.splice(i, 1);
    if (s) steps.splice(j, 0, s);
    put(steps);
  };

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        {item.steps.map((s, i) => (
          <li key={s.id} className="card flex items-center gap-2 p-3">
            <Picture name={STEP_PICTURE[s.type]} size={22} />
            <button type="button" className="flex-1 text-left" onClick={() => onOpen(i)}>
              <span className={s.done ? 'muted line-through' : 'font-medium'}>{s.title}</span>
              {s.done ? <span className="muted block text-sm">Done</span> : null}
            </button>
            <button type="button" className="chip min-h-9 px-2" aria-label={`Move ${s.title} up`} onClick={() => move(i, -1)}>
              ↑
            </button>
            <button type="button" className="chip min-h-9 px-2" aria-label={`Move ${s.title} down`} onClick={() => move(i, 1)}>
              ↓
            </button>
            <button type="button" className="chip min-h-9 px-2" aria-label={`Remove ${s.title}`} onClick={() => put(item.steps.filter((x) => x.id !== s.id))}>
              ×
            </button>
          </li>
        ))}
      </ol>
      {adding ? (
        <Card className="flex flex-col gap-2">
          <p className="font-semibold">Add a step</p>
          <div className="flex flex-wrap gap-2">
            {EXTRA_STEPS.map((t) => (
              <button
                key={t.title}
                type="button"
                className="chip"
                onClick={() => {
                  put([...item.steps, makeStep(t)]);
                  setAdding(false);
                }}
              >
                {t.title}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="label">Or write your own</span>
            <input className="field" value={own} onChange={(e) => setOwn(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn self-start"
            disabled={!own.trim()}
            onClick={() => {
              put([...item.steps, makeStep({ type: 'custom', title: own.trim(), help: '', easyHelp: '' })]);
              setOwn('');
              setAdding(false);
            }}
          >
            Add it
          </button>
        </Card>
      ) : (
        <button type="button" className="btn self-start" onClick={() => setAdding(true)}>
          Add a step
        </button>
      )}
    </div>
  );
}
