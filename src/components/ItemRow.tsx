import { Link } from 'react-router';
import { KIND_INFO, STATUS_INFO } from '../lib/content/kinds';
import { currentStep, dueOf, isLate, needsChasing, whenWords } from '../lib/logic/items';
import type { Item } from '../lib/model/types';
import { useSettings } from '../lib/store/StoreProvider';
import { Picture } from './Picture';

export function itemName(item: Item): string {
  return item.title || (item.from ? `${KIND_INFO[item.kind].name} from ${item.from}` : KIND_INFO[item.kind].name);
}

/** One thing in a list: what it is, how near its date is, and the next step. */
export function ItemRow({ item, now }: { item: Item; now: number }) {
  const settings = useSettings();
  const due = dueOf(item);
  const late = item.status !== 'done' && isLate(due, now);
  const chase = needsChasing(item, now);
  const step = currentStep(item);
  return (
    <Link to={`/item/${item.id}`} className="card flex items-start gap-3 no-underline">
      {settings.pictures || settings.easyRead ? <Picture name={KIND_INFO[item.kind].picture} size={settings.easyRead ? 40 : 28} className="mt-0.5" /> : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold">{itemName(item)}</span>
        <span className={`text-sm ${late ? 'late' : 'muted'}`}>
          {item.status === 'done'
            ? STATUS_INFO.done.name
            : item.status === 'waiting'
              ? chase
                ? `Time to chase. Waiting for ${item.waiting?.forWhat ?? 'a reply'}`
                : `Waiting for ${item.waiting?.forWhat ?? 'a reply'}`
              : whenWords(due, now)}
        </span>
        {item.status !== 'done' && item.status !== 'waiting' && step ? <span className="text-sm">Next: {step.title}</span> : null}
        {item.pausedNote && item.status !== 'done' ? <span className="muted text-sm">Where I got to: {item.pausedNote}</span> : null}
      </span>
      <span aria-hidden="true" className="muted">
        ›
      </span>
    </Link>
  );
}
