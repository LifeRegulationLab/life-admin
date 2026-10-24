import { useState } from 'react';
import { Link } from 'react-router';
import { link } from '../lib/logic/items';
import type { Item } from '../lib/model/types';
import { useStore } from '../lib/store/StoreProvider';
import { itemName } from './ItemRow';
import { Card } from './ui';

/** Things about the same matter, kept together, with a way to compare two side by side. */
export function Linked({ item }: { item: Item }) {
  const { data, saveItem } = useStore();
  const [adding, setAdding] = useState(false);
  const linked = data.items.filter((i) => item.links?.includes(i.id));
  const others = data.items.filter((i) => i.id !== item.id && !item.links?.includes(i.id)).sort((a, b) => b.createdAt - a.createdAt);
  const change = async (other: Item, on: boolean) => {
    const [a, b] = link(item, other, on);
    await saveItem(a);
    await saveItem(b);
    setAdding(false);
  };
  return (
    <Card className="flex flex-col gap-2">
      <h2 className="font-semibold">About the same thing</h2>
      {linked.length ? (
        <ul className="flex flex-col gap-2">
          {linked.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-2">
              <Link to={`/item/${o.id}`} className="flex-1">
                {itemName(o)}
              </Link>
              <Link to={`/compare/${item.id}/${o.id}`} className="chip">
                Compare
              </Link>
              <button type="button" className="chip" onClick={() => void change(o, false)}>
                Unlink
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted text-sm">Link an earlier letter or bill about the same thing, so they are kept together.</p>
      )}
      {adding ? (
        others.length ? (
          <label className="block">
            <span className="label">Which one?</span>
            <select className="field" defaultValue="" onChange={(e) => { const o = others.find((x) => x.id === e.target.value); if (o) void change(o, true); }}>
              <option value="" disabled>
                Choose
              </option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {itemName(o)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="muted text-sm">There is nothing else to link yet.</p>
        )
      ) : (
        <button type="button" className="btn self-start" onClick={() => setAdding(true)}>
          Link another
        </button>
      )}
    </Card>
  );
}
