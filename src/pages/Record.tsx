import { useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { Thumb } from '../components/Capture';
import { itemName } from '../components/ItemRow';
import { Card, Empty, Page } from '../components/ui';
import { ReadAloud } from '../components/voice';
import { STATUS_INFO } from '../lib/content/kinds';
import { renderPdf } from '../lib/papers/pdf';
import { fmtDate, recordDoc } from '../lib/papers/record';
import { saveFile } from '../lib/shell';
import { loadPhoto } from '../lib/store/photos';
import { useStore } from '../lib/store/StoreProvider';

/** Everything about one thing in one place: the original, what was done and the proof. */
export function RecordPage() {
  const { id } = useParams();
  const { data } = useStore();
  const item = data.items.find((i) => i.id === id);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!item) return <Navigate to="/" replace />;

  const makePdf = async () => {
    setBusy(true);
    setMsg('');
    try {
      const doc = recordDoc(item, data.settings.name);
      const pictures: NonNullable<typeof doc.pictures> = [];
      const ids = [...item.pageIds.map((p, i) => ({ id: p, caption: `Page ${i + 1}` })), ...item.record.filter((r) => r.photoId).map((r) => ({ id: r.photoId ?? '', caption: `Proof: ${r.text}` }))];
      for (const p of ids) {
        const blob = await loadPhoto(p.id);
        if (!blob) continue;
        const type = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : undefined;
        if (type) pictures.push({ caption: p.caption, bytes: new Uint8Array(await blob.arrayBuffer()), type });
      }
      const bytes = await renderPdf({ ...doc, pictures });
      await saveFile(`${itemName(item).replace(/[^\w -]/g, '').slice(0, 50) || 'record'}.pdf`, bytes, 'application/pdf');
    } catch {
      setMsg('The PDF was not made. Try again.');
    }
    setBusy(false);
  };

  const record = [...item.record].sort((a, b) => b.at - a.at);

  return (
    <Page title="Record" back={`/item/${item.id}`}>
      <ReadAloud text={`The record for ${itemName(item)}. ${record.length} entries. ${STATUS_INFO[item.status].name}.`} auto={false} />
      <Card className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{itemName(item)}</h2>
        <p className="muted text-sm">{[item.from, item.reference && `Ref ${item.reference}`, `Came ${fmtDate(item.createdAt)}`, STATUS_INFO[item.status].name].filter(Boolean).join(' · ')}</p>
        {item.understanding?.plain ? <p>{item.understanding.plain}</p> : null}
      </Card>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void makePdf()}>
        {busy ? 'Making it…' : 'Save the record as a PDF'}
      </button>
      {msg ? <p className="warnbox">{msg}</p> : null}

      <section className="flex flex-col gap-2" aria-labelledby="what-done">
        <h2 id="what-done" className="font-semibold">
          What was done
        </h2>
        {record.length ? (
          <ol className="flex flex-col gap-2">
            {record.map((r) => (
              <li key={r.id} className="card flex gap-3 p-3">
                <div className="flex-1">
                  <p className="muted text-sm">{fmtDate(r.at, true)}</p>
                  <p className="whitespace-pre-wrap">{r.text}</p>
                  {r.ref ? <p className="text-sm">Reference: {r.ref}</p> : null}
                </div>
                {r.photoId ? <Thumb id={r.photoId} label="Proof" /> : null}
              </li>
            ))}
          </ol>
        ) : (
          <Empty>Nothing done yet. Each step you finish is kept here with the date.</Empty>
        )}
      </section>

      {item.pageIds.length || item.text.trim() ? (
        <section className="flex flex-col gap-2" aria-labelledby="original">
          <h2 id="original" className="font-semibold">
            The original
          </h2>
          <div className="flex flex-wrap gap-2">
            {item.pageIds.map((p, i) => (
              <Thumb key={p} id={p} label={`Page ${i + 1}`} />
            ))}
          </div>
          {item.text.trim() ? <p className="card whitespace-pre-wrap text-sm">{item.text}</p> : null}
        </section>
      ) : null}
    </Page>
  );
}
