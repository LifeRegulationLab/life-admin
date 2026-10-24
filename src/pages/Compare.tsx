import { Navigate, useParams } from 'react-router';
import { itemName } from '../components/ItemRow';
import { Card, Page } from '../components/ui';
import { ReadAloud } from '../components/voice';
import { dueOf } from '../lib/logic/items';
import { readFacts } from '../lib/logic/facts';
import type { Item } from '../lib/model/types';
import { fmtDate } from '../lib/papers/record';
import { useStore } from '../lib/store/StoreProvider';

function rows(item: Item): Record<string, string> {
  const f = readFacts(item.text, new Date(item.createdAt));
  return {
    From: item.from,
    Reference: item.reference || f.references.map((r) => r.value).join(', '),
    Came: fmtDate(item.createdAt),
    'Due by': fmtDate(dueOf(item)),
    Amounts: f.amounts.map((a) => a.value).join(', '),
    'What they want': item.understanding?.ask ?? '',
  };
}

/** Two things side by side: what changed between an earlier letter and a later one. */
export function Compare() {
  const { a, b } = useParams();
  const { data } = useStore();
  const one = data.items.find((i) => i.id === a);
  const two = data.items.find((i) => i.id === b);
  if (!one || !two) return <Navigate to="/" replace />;
  const [first, second] = one.createdAt <= two.createdAt ? [one, two] : [two, one];
  const r1 = rows(first);
  const r2 = rows(second);
  const changed = Object.keys(r1).filter((k) => (r1[k] ?? '') !== (r2[k] ?? '') && (r1[k] || r2[k]));
  return (
    <Page title="Compare" back={`/item/${one.id}`}>
      <ReadAloud text={changed.length ? `What is different: ${changed.join(', ')}.` : 'Nothing different was found in the details.'} />
      <p className="muted text-sm">The earlier one is on the left. Details that differ are marked. Check anything important on the letters themselves.</p>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="p-1 text-left"></th>
              <th className="p-1 text-left">{itemName(first)}</th>
              <th className="p-1 text-left">{itemName(second)}</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(r1).map((k) => (
              <tr key={k} className={changed.includes(k) ? 'font-semibold' : ''}>
                <th scope="row" className="muted p-1 text-left align-top font-normal">
                  {k}
                  {changed.includes(k) ? <span className="block text-xs">Different</span> : null}
                </th>
                <td className="p-1 align-top">{r1[k] || '-'}</td>
                <td className="p-1 align-top">{r2[k] || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Page>
  );
}
