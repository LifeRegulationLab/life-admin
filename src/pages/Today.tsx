import { Link } from 'react-router';
import { itemName, ItemRow } from '../components/ItemRow';
import { Picture } from '../components/Picture';
import { Card, Empty, Page } from '../components/ui';
import { ReadAloud, useEasy } from '../components/voice';
import { dueOf, lists, whenWords } from '../lib/logic/items';
import { fmtDate } from '../lib/papers/record';
import { useStore } from '../lib/store/StoreProvider';
import { useNow } from '../lib/time';

const SOON = 60 * 24 * 60 * 60 * 1000;

/** What needs doing, nearest date first. Waiting for them is kept apart, so it never looks like more to do. */
export function Today() {
  const { data } = useStore();
  const now = useNow();
  const easy = useEasy();
  const l = lists(data.items, now);
  const coming = data.renewals.filter((r) => !r.itemId && r.dueAt - now < SOON).sort((a, b) => a.dueAt - b.dueAt);
  const first = l.next[0];

  const summary = [
    l.next.length === 0 ? 'Nothing to deal with just now.' : l.next.length === 1 ? 'One thing to deal with.' : `${l.next.length} things to deal with.`,
    first ? `The nearest is ${itemName(first)}. ${whenWords(dueOf(first), now)}.` : '',
    l.waiting.length ? `Waiting for a reply on ${l.waiting.length}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Page title="Today">
      <ReadAloud text={summary} />
      <div className="grid grid-cols-2 gap-3">
        <Link to="/add" className="btn btn-primary min-h-16 flex-col">
          <Picture name="letter" />
          {easy ? 'Add a new thing' : 'Add something'}
        </Link>
        <Link to="/pile" className="btn min-h-16 flex-col">
          <Picture name="pile" />
          {easy ? 'A pile of post' : 'Pile of post'}
        </Link>
      </div>

      {l.unsorted.length ? (
        <Card className="flex items-center justify-between gap-3">
          <p>
            {l.unsorted.length === 1 ? 'One thing' : `${l.unsorted.length} things`} from the pile still to look at.
          </p>
          <Link to="/pile" className="btn btn-accent">
            Sort them
          </Link>
        </Card>
      ) : null}

      <section className="flex flex-col gap-3" aria-labelledby="todo">
        <h2 id="todo" className="text-lg font-semibold">
          {easy ? 'Things to do' : 'To deal with'}
        </h2>
        {l.next.length ? l.next.map((i) => <ItemRow key={i.id} item={i} now={now} />) : <Empty>Nothing to deal with. When a letter, bill or form comes, add it here.</Empty>}
      </section>

      {l.waiting.length ? (
        <section className="flex flex-col gap-3" aria-labelledby="waiting">
          <h2 id="waiting" className="text-lg font-semibold">
            Waiting for them
          </h2>
          <p className="muted -mt-2 text-sm">Nothing to do on these until they reply, or until the chase date.</p>
          {l.waiting.map((i) => (
            <ItemRow key={i.id} item={i} now={now} />
          ))}
        </section>
      ) : null}

      {coming.length ? (
        <section className="flex flex-col gap-3" aria-labelledby="coming">
          <h2 id="coming" className="text-lg font-semibold">
            Coming up
          </h2>
          {coming.map((r) => (
            <Link key={r.id} to={`/renewals/${r.id}`} className="card flex items-center gap-3">
              <Picture name="renew" />
              <span className="flex-1">
                <span className="block font-semibold">{r.title}</span>
                <span className="muted text-sm">{fmtDate(r.dueAt)}</span>
              </span>
            </Link>
          ))}
        </section>
      ) : null}
    </Page>
  );
}
