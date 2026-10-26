import { Link } from 'react-router';
import { itemName } from '../components/ItemRow';
import { Card, Empty, Page } from '../components/ui';
import { ReadAloud } from '../components/voice';
import { lookingBack, monthLine, openLongest, weeksInARow, weeksLine } from '../lib/logic/history';
import { fmtDate } from '../lib/papers/record';
import { useStore } from '../lib/store/StoreProvider';
import { useNow } from '../lib/time';

/** Looking back: what you have dealt with, month by month, from your own records. Nothing is scored. */
export function LookingBack() {
  const { data } = useStore();
  const now = useNow();
  const months = lookingBack(data.items);
  const open = openLongest(data.items, now);
  const streak = data.settings.streaks ? weeksLine(weeksInARow(data.items, now)) : undefined;
  const spoken = [streak ?? '', ...months.slice(0, 3).map((m) => `${m.label}. ${monthLine(m)}`)].filter(Boolean).join(' ');

  return (
    <Page title="Looking back" back="/all">
      <ReadAloud text={spoken || 'Nothing to look back on yet.'} auto={false} />
      <p className="muted">What you have dealt with, month by month. Everything here comes from your own records.</p>
      {streak ? <p>{streak}</p> : null}
      {open.length ? (
        <Card className="flex flex-col gap-2">
          <h2 className="font-semibold">Open the longest</h2>
          <ul className="flex flex-col gap-1">
            {open.map(({ item, days }) => (
              <li key={item.id}>
                <Link to={`/item/${item.id}`} className="underline">
                  {itemName(item)}
                </Link>
                <span className="muted text-sm"> · added {days < 1 ? 'today' : `${fmtDate(item.createdAt)}`}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {months.length ? (
        months.map((m) => (
          <section key={m.key} className="flex flex-col gap-2" aria-labelledby={`m-${m.key}`}>
            <h2 id={`m-${m.key}`} className="text-lg font-semibold">
              {m.label}
            </h2>
            <p className="muted -mt-1 text-sm">{monthLine(m)}</p>
            {m.dealtWith.map((i) => (
              <Link key={i.id} to={`/item/${i.id}/record`} className="card flex items-center justify-between gap-3 no-underline">
                <span>
                  <span className="block font-semibold">{itemName(i)}</span>
                  <span className="muted text-sm">Dealt with {i.doneAt ? fmtDate(i.doneAt) : ''}</span>
                </span>
                <span aria-hidden="true" className="muted">
                  ›
                </span>
              </Link>
            ))}
          </section>
        ))
      ) : (
        <Empty>Nothing to look back on yet. What you deal with will show here, month by month.</Empty>
      )}
    </Page>
  );
}
