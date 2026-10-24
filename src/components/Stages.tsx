import { stages } from '../lib/logic/stages';
import type { Item } from '../lib/model/types';
import { Picture } from './Picture';

/** The stages of done that apply to this thing, ticked when each is complete. */
export function Stages({ item }: { item: Item }) {
  const list = stages(item);
  if (!list.length) return null;
  return (
    <ol className="flex flex-col gap-1" aria-label="How far it has got">
      {list.map((s) => (
        <li key={s.key} className={`flex items-center gap-2 ${s.done ? '' : 'muted'}`}>
          {s.done ? <Picture name="check" size={18} /> : <span aria-hidden="true" className="inline-block h-[18px] w-[18px] rounded-full border border-[var(--line)]" />}
          <span>
            {s.label}
            <span className="sr-only">{s.done ? ': done' : ': not yet'}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
