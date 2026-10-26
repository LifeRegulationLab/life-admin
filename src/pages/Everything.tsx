import { useState } from 'react';
import { Link } from 'react-router';
import { ItemRow } from '../components/ItemRow';
import { Choice, Empty, Page } from '../components/ui';
import { STATUS_INFO } from '../lib/content/kinds';
import { lists } from '../lib/logic/items';
import { useStore } from '../lib/store/StoreProvider';
import { useNow } from '../lib/time';

type Show = 'open' | 'waiting' | 'done' | 'all';

const SHOW: { code: Show; text: string }[] = [
  { code: 'open', text: 'To do' },
  { code: 'waiting', text: STATUS_INFO.waiting.name },
  { code: 'done', text: STATUS_INFO.done.name },
  { code: 'all', text: 'All' },
];

/** Everything, to find something again: search by name, who it is from, reference or words. */
export function Everything() {
  const { data } = useStore();
  const now = useNow();
  const [q, setQ] = useState('');
  const [show, setShow] = useState<Show>('all');
  const l = lists(data.items, now);
  const base = show === 'open' ? [...l.unsorted, ...l.next.filter((i) => i.status !== 'waiting')] : show === 'waiting' ? l.waiting : show === 'done' ? l.done : [...data.items].sort((a, b) => b.updatedAt - a.updatedAt);
  const term = q.trim().toLowerCase();
  const shown = term ? base.filter((i) => [i.title, i.from, i.reference, i.text, ...i.record.map((r) => r.text)].join(' ').toLowerCase().includes(term)) : base;

  return (
    <Page title="Everything">
      <label className="block">
        <span className="label">Search</span>
        <input className="field" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Council, a reference, a word in the letter" />
      </label>
      <Choice label="Show" options={SHOW} value={show} onChange={setShow} />
      <Link to="/looking-back" className="btn self-start">
        Looking back, month by month
      </Link>
      {shown.length ? shown.map((i) => <ItemRow key={i.id} item={i} now={now} />) : <Empty>{term ? 'Nothing matches that.' : 'Nothing here yet.'}</Empty>}
    </Page>
  );
}
