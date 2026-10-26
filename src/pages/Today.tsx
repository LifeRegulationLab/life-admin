import { Link } from 'react-router';
import { FromMull } from '../components/aids/FromMull';
import { MossHome } from '../components/MossCompanion';
import { MOSS_ACTIONS, MOSS_SETTINGS } from '../lib/moss/actions';
import { itemName, ItemRow } from '../components/ItemRow';
import { Picture } from '../components/Picture';
import { Card, Empty, Page } from '../components/ui';
import { ReadAloud, useEasy } from '../components/voice';
import { lastTouched, whereLine, whereWasI } from '../lib/logic/aids';
import { weeksInARow, weeksLine } from '../lib/logic/history';
import { dueOf, lists, notToMiss, whenWords } from '../lib/logic/items';
import { fmtDate } from '../lib/papers/record';
import { useStore } from '../lib/store/StoreProvider';
import { useNow } from '../lib/time';

const SOON = 60 * 24 * 60 * 60 * 1000;

/** What needs doing, nearest date first. Waiting for them is kept apart, so it never looks like more to do. */
export function Today() {
  const { data, saveSettings } = useStore();
  const justNext = data.settings.justNext;
  const now = useNow();
  const easy = useEasy();
  const l = lists(data.items, now);
  const coming = data.renewals.filter((r) => !r.itemId && r.dueAt - now < SOON).sort((a, b) => a.dueAt - b.dueAt);
  const first = l.next[0];
  const onScreen = justNext ? l.next.slice(0, 1) : l.next;
  const dates = notToMiss(data.items, onScreen.map((i) => i.id), now);
  const back = lastTouched(data.items);
  const where = back ? whereWasI(back) : undefined;
  const streak = data.settings.streaks ? weeksLine(weeksInARow(data.items, now)) : undefined;

  const summary = [
    l.next.length === 0 ? 'Nothing to deal with just now.' : l.next.length === 1 ? 'One thing to deal with.' : `${l.next.length} things to deal with.`,
    first ? `The nearest is ${itemName(first)}. ${whenWords(dueOf(first), now)}.` : '',
    dates.length ? `${dates.length === 1 ? 'One date' : `${dates.length} dates`} not to miss.` : '',
    l.waiting.length ? `Waiting for a reply on ${l.waiting.length}.` : '',
    back && where ? `Where you were: ${itemName(back)}. ${whereLine(where)}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Page title="Today">
      <ReadAloud text={summary} />
      <MossHome actions={MOSS_ACTIONS} settingsTo={MOSS_SETTINGS} />
      {back && where ? (
        <Link to={`/item/${back.id}`} className="card flex flex-col gap-1 no-underline">
          <span className="font-semibold">Where was I? {itemName(back)}</span>
          <span className="text-sm">{whereLine(where)}</span>
          <span className="muted text-sm">Tap to carry on from there.</span>
        </Link>
      ) : null}
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

      {!justNext && l.unsorted.length ? (
        <Card className="flex items-center justify-between gap-3">
          <p>
            {l.unsorted.length === 1 ? 'One thing' : `${l.unsorted.length} things`} from the pile still to look at.
          </p>
          <Link to="/pile" className="btn btn-accent">
            Sort them
          </Link>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link to="/stuck" className="chip">
          Stuck? What is stopping me
        </Link>
        <Link to="/looking-back" className="chip">
          Looking back
        </Link>
      </div>
      {streak ? <p className="muted text-sm">{streak}</p> : null}

      <label className="flex items-center gap-3">
        <input type="checkbox" checked={justNext} onChange={(e) => void saveSettings({ ...data.settings, justNext: e.target.checked })} />
        <span>Low on energy today: show me just the next thing</span>
      </label>

      <FromMull />

      <section className="flex flex-col gap-3" aria-labelledby="todo">
        <h2 id="todo" className="text-lg font-semibold">
          {justNext ? 'Just the next thing' : easy ? 'Things to do' : 'To deal with'}
        </h2>
        {l.next.length ? (
          onScreen.map((i) => <ItemRow key={i.id} item={i} now={now} />)
        ) : (
          <Empty>Nothing to deal with. When a letter, bill or form comes, add it here.</Empty>
        )}
        {justNext && l.next.length > 1 ? <p className="muted text-sm">The others are kept safe. Untick the box above to see them.</p> : null}
      </section>

      {dates.length ? (
        <section className="flex flex-col gap-3" aria-labelledby="dates">
          <h2 id="dates" className="text-lg font-semibold">
            {dates.length === 1 ? 'A date not to miss' : 'Dates not to miss'}
          </h2>
          <p className="muted -mt-2 text-sm">{justNext ? 'Kept here even on a low day, because the date is close.' : 'Still in the pile to sort, but the date is close.'}</p>
          {dates.map((i) => (
            <ItemRow key={i.id} item={i} now={now} />
          ))}
        </section>
      ) : null}

      {!justNext && l.waiting.length ? (
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

      {!justNext && coming.length ? (
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
