import { useEffect, useState } from 'react';
import { addRecord, newItem } from '../../lib/logic/items';
import { moss, type ScriptFromMull } from '../../lib/moss/link';
import { useStore } from '../../lib/store/StoreProvider';
import { useMoss } from '../Moss';
import { Card } from '../ui';

/**
 * Call scripts you chose to send here from Mull. Nothing is added until you say so; Mull is told
 * once it has been kept, or that you said no.
 */
export function FromMull() {
  const { link } = useMoss();
  const { saveItem } = useStore();
  const [scripts, setScripts] = useState<ScriptFromMull[]>([]);
  useEffect(() => {
    if (!link) return;
    let live = true;
    void moss.scripts().then((s) => live && setScripts(s));
    return () => {
      live = false;
    };
  }, [link]);
  if (!link || !scripts.length) return null;

  const keep = async (s: ScriptFromMull) => {
    const item = newItem('call', { title: s.title, from: '' });
    const steps = item.steps.map((st) => (st.type === 'call' ? { ...st, draft: s.body } : st));
    await saveItem(addRecord({ ...item, steps }, 'note', 'Call script prepared in Mull.'));
    await moss.settle(s.id, 'added');
    setScripts((all) => all.filter((x) => x.id !== s.id));
  };
  const decline = async (s: ScriptFromMull) => {
    await moss.settle(s.id, 'declined');
    setScripts((all) => all.filter((x) => x.id !== s.id));
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby="from-mull">
      <h2 id="from-mull" className="text-lg font-semibold">
        From Mull
      </h2>
      {scripts.map((s) => (
        <Card key={s.id} className="flex flex-col gap-2">
          <p className="font-semibold">A call script: {s.title}</p>
          <p className="line-clamp-4 whitespace-pre-wrap text-sm">{s.body}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={() => void keep(s)}>
              Keep it as a call to make
            </button>
            <button type="button" className="btn" onClick={() => void decline(s)}>
              No thanks
            </button>
          </div>
        </Card>
      ))}
    </section>
  );
}
