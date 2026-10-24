import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { Picture } from '../components/Picture';
import { Area, Card, Empty, fromLocalInput, Page, Text, toDateInput } from '../components/ui';
import { ReadAloud } from '../components/voice';
import { toIcs } from '../lib/logic/calendar';
import { DAY } from '../lib/logic/items';
import { newRenewal, PRESETS } from '../lib/logic/renewals';
import type { Renewal } from '../lib/model/types';
import { fmtDate } from '../lib/papers/record';
import { saveFile } from '../lib/shell';
import { clock } from '../lib/time';
import { useStore } from '../lib/store/StoreProvider';

/** Things that come round again: MOT, insurance, passport. Each turns into something to deal with when it is near. */
export function Renewals() {
  const { data, saveRenewal } = useStore();
  const navigate = useNavigate();
  const list = [...data.renewals].sort((a, b) => a.dueAt - b.dueAt);
  const [adding, setAdding] = useState(false);

  const add = async (code: string) => {
    const preset = PRESETS.find((p) => p.code === code);
    if (!preset) return;
    const r = newRenewal(preset, clock() + 90 * DAY);
    await saveRenewal(r);
    navigate(`/renewals/${r.id}`);
  };

  const calendar = async () => {
    const ics = toIcs(list.map((r) => ({ id: r.id, title: r.title, at: r.dueAt, minutes: 0, notes: r.notes, alarm: r.daysBefore * 24 * 60 })));
    await saveFile('renewals.ics', new TextEncoder().encode(ics), 'text/calendar');
  };

  return (
    <Page title="Renewals">
      <ReadAloud text={list.length ? `${list.length} renewals. The next is ${list[0]?.title}, on ${fmtDate(list[0]?.dueAt)}.` : 'No renewals yet. Add the things that come round every year.'} />
      {list.length ? (
        list.map((r) => (
          <Link key={r.id} to={`/renewals/${r.id}`} className="card flex items-center gap-3">
            <Picture name="renew" />
            <span className="flex-1">
              <span className="block font-semibold">{r.title || 'Renewal'}</span>
              <span className="muted text-sm">
                {fmtDate(r.dueAt)}
                {r.with ? ` · ${r.with}` : ''}
                {r.itemId ? ' · on your list now' : ''}
              </span>
            </span>
          </Link>
        ))
      ) : (
        <Empty>Add the things that come round again. Each one goes on your list a few weeks before its date.</Empty>
      )}
      {adding ? (
        <Card className="flex flex-col gap-2">
          <p className="font-semibold">What is it?</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.code} type="button" className="chip" onClick={() => void add(p.code)}>
                {p.title || 'Something else'}
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
          Add a renewal
        </button>
      )}
      {list.length ? (
        <button type="button" className="btn" onClick={() => void calendar()}>
          <Picture name="calendar" size={20} />
          Put them all in my calendar
        </button>
      ) : null}
    </Page>
  );
}

export function RenewalEdit() {
  const { id } = useParams();
  const { data } = useStore();
  const r = data.renewals.find((x) => x.id === id);
  if (!r) return <Navigate to="/renewals" replace />;
  return <EditOne key={r.id} renewal={r} />;
}

const REPEATS = [
  { months: 0, text: 'Once' },
  { months: 12, text: 'Every year' },
  { months: 24, text: 'Every 2 years' },
  { months: 36, text: 'Every 3 years' },
  { months: 120, text: 'Every 10 years' },
];

function EditOne({ renewal }: { renewal: Renewal }) {
  const { saveRenewal, removeRenewal, data } = useStore();
  const navigate = useNavigate();
  const [r, setR] = useState(renewal);
  const [sure, setSure] = useState(false);
  const item = r.itemId ? data.items.find((i) => i.id === r.itemId) : undefined;
  const set = (change: Partial<Renewal>) => setR((x) => ({ ...x, ...change }));

  return (
    <Page title={r.title || 'Renewal'} back="/renewals">
      {item ? (
        <Link to={`/item/${item.id}`} className="btn btn-accent">
          It is on your list now: open it
        </Link>
      ) : null}
      <Card className="flex flex-col gap-3">
        <Text label="What it is" value={r.title} onChange={(v) => set({ title: v })} />
        <Text label="Who it is with (optional)" value={r.with} onChange={(v) => set({ with: v })} />
        <label className="block">
          <span className="label">The date it is due</span>
          <input className="field" type="date" value={toDateInput(r.dueAt)} onChange={(e) => e.target.value && set({ dueAt: fromLocalInput(`${e.target.value}T12:00`) })} />
        </label>
        <fieldset>
          <legend className="label">How often</legend>
          <div className="flex flex-wrap gap-2">
            {REPEATS.map((x) => (
              <button key={x.months} type="button" className="chip" aria-pressed={r.everyMonths === x.months} onClick={() => set({ everyMonths: x.months })}>
                {x.text}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="label">Put it on my list this many days before</span>
          <input className="field" type="number" min={1} max={365} value={r.daysBefore} onChange={(e) => set({ daysBefore: Math.max(1, Math.min(365, Number(e.target.value) || 1)) })} />
        </label>
        <Area label="Notes" value={r.notes} onChange={(v) => set({ notes: v })} />
      </Card>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          void saveRenewal(r);
          navigate('/renewals');
        }}
      >
        Save
      </button>
      {sure ? (
        <div className="warnbox flex flex-col gap-2">
          <p>Remove this renewal?</p>
          <button type="button" className="btn btn-warn self-start" onClick={() => void removeRenewal(r.id).then(() => navigate('/renewals'))}>
            Remove it
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-warn self-start" onClick={() => setSure(true)}>
          Remove
        </button>
      )}
    </Page>
  );
}
