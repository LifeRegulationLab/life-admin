import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
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
  const [params, setParams] = useSearchParams();
  const selected = params.get('show');
  const show: Show = selected === 'open' || selected === 'waiting' || selected === 'done' ? selected : 'all';
  const setShow = (value: Show) => setParams(value === 'all' ? {} : { show: value }, { replace: true });
  const l = lists(data.items, now);
  const base = show === 'open' ? [...l.unsorted, ...l.next.filter((i) => i.status !== 'waiting')] : show === 'waiting' ? l.waiting : show === 'done' ? l.done : [...data.items].sort((a, b) => b.updatedAt - a.updatedAt);
  const term = q.trim().toLowerCase();
  const shown = term ? base.filter((i) => [i.title, i.from, i.reference, i.text, ...i.record.map((r) => r.text)].join(' ').toLowerCase().includes(term)) : base;

  return (
    <Page title="Your records">
      <p className="page-intro">Find a letter, pick up a task or check what has been dealt with.</p>
      <div className="feature-grid compact-grid"><Link to="/renewals" className="feature-card tone-blue"><strong>Renewals</strong><p>Insurance, documents and dates that repeat.</p></Link><Link to="/looking-back" className="feature-card tone-lilac"><strong>Looking back</strong><p>Your completed admin, month by month.</p></Link></div>
      <label className="block">
        <span className="label">Search</span>
        <input className="field" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Council, a reference, a word in the letter" />
      </label>
      <Choice label="Show" options={SHOW} value={show} onChange={setShow} />
      {shown.length ? shown.map((i) => <ItemRow key={i.id} item={i} now={now} />) : <Empty>{term ? 'Nothing matches that.' : 'Nothing here yet.'}</Empty>}
    </Page>
  );
}
