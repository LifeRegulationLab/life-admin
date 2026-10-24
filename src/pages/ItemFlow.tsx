import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { useShares } from '../components/flow/ShareStep';
import { StepScreen } from '../components/flow/StepScreen';
import { StepsEditor } from '../components/flow/StepsEditor';
import { Understand } from '../components/flow/Understand';
import { itemName } from '../components/ItemRow';
import { Picture } from '../components/Picture';
import { Stages } from '../components/Stages';
import { Area, Card, fromLocalInput, Page, toDateInput } from '../components/ui';
import { ReadAloud, useEasy } from '../components/voice';
import { removeShare } from '../lib/firebase/account';
import { addRecord, currentStep, dueOf, markDone, pause, reopenStep, replyCame, whenWords } from '../lib/logic/items';
import { CHASE_STEP, makeStep } from '../lib/content/steps';
import type { Item } from '../lib/model/types';
import { fmtDate } from '../lib/papers/record';
import { savePhoto } from '../lib/store/photos';
import { useStore } from '../lib/store/StoreProvider';
import { clock, useNow } from '../lib/time';

type View = { name: 'understand' } | { name: 'step'; index: number } | { name: 'steps' } | { name: 'pause' } | { name: 'done' } | { name: 'waiting' };

function firstView(item: Item): View {
  if (item.status === 'done') return { name: 'done' };
  if (item.status === 'waiting') return { name: 'waiting' };
  if (!item.understanding && item.status === 'new') return { name: 'understand' };
  const step = currentStep(item);
  if (!step) return { name: 'done' };
  return { name: 'step', index: item.steps.indexOf(step) };
}

/** One thing, one step per screen. Stopping part way keeps the place; coming back opens on it. */
export function ItemFlow() {
  const { id } = useParams();
  const { data, undoTick } = useStore();
  const item = data.items.find((i) => i.id === id);
  if (!item) return <Navigate to="/" replace />;
  return <Flow key={`${item.id}:${undoTick}`} item={item} />;
}

function Flow({ item }: { item: Item }) {
  const { saveItem, removeItem, offerUndo } = useStore();
  const navigate = useNavigate();
  const easy = useEasy();
  const now = useNow();
  const shares = useShares();
  const [view, setView] = useState<View>(() => firstView(item));
  const [where, setWhere] = useState(item.pausedNote);
  const [came, setCame] = useState('');
  const [chaseAt, setChaseAt] = useState(item.waiting?.chaseAt ?? now);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const due = dueOf(item);

  const afterStep = async (next: Item) => {
    const doneStep = item.steps.find((s) => !s.done && next.steps.find((n) => n.id === s.id)?.done);
    if (doneStep) {
      // What the supporter sent back is kept in the record before their link ends.
      let kept = next;
      for (const s of shares.filter((x) => x.itemId === item.id && x.stepId === doneStep.id)) {
        if (s.reply || s.replyPhoto) {
          const photoId = s.replyPhoto ? await savePhoto(await (await fetch(s.replyPhoto)).blob()).catch(() => undefined) : undefined;
          kept = addRecord(kept, 'note', `${s.helperName || 'Your supporter'} helped with "${doneStep.title}": ${s.reply ?? ''}`.trim(), photoId ? { photoId } : {});
        }
        void removeShare(s.code);
      }
      if (kept !== next) await saveItem(kept);
    }
    setView(firstView(next));
    window.scrollTo({ top: 0 });
  };

  const stop = async () => {
    await saveItem(pause(item, where));
    offerUndo('Stopped here for now', item);
    navigate('/');
  };

  const chaseNow = async () => {
    const at = item.steps.findIndex((s) => !s.done);
    const chase = makeStep({ ...CHASE_STEP, title: `Chase ${item.from || 'them'}` });
    const steps = [...item.steps];
    steps.splice(at === -1 ? steps.length : at, 0, chase);
    const { waiting: _w, ...rest } = item;
    void _w;
    const next: Item = { ...rest, steps, status: 'working', at: steps.indexOf(chase), updatedAt: clock() };
    await saveItem(next);
    setView({ name: 'step', index: next.at });
  };

  const header = (
    <div className="flex flex-col gap-1">
      <p className="muted text-sm">
        {[item.from, item.reference && `Ref ${item.reference}`, item.status !== 'done' && due !== undefined ? whenWords(due, now) : ''].filter(Boolean).join(' · ')}
      </p>
      {view.name !== 'pause' && item.status !== 'done' ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="chip" onClick={() => setView({ name: 'pause' })}>
            <Picture name="pause" size={16} />
            Stop here
          </button>
          <button type="button" className="chip" aria-pressed={view.name === 'steps'} onClick={() => setView(view.name === 'steps' ? firstView(item) : { name: 'steps' })}>
            All steps
          </button>
          <button type="button" className="chip" aria-pressed={view.name === 'understand'} onClick={() => setView({ name: 'understand' })}>
            What it says
          </button>
          <Link to={`/item/${item.id}/record`} className="chip">
            Record
          </Link>
        </div>
      ) : null}
    </div>
  );

  return (
    <Page title={itemName(item)} back="/">
      {header}
      {item.pausedNote && view.name === 'step' ? (
        <Card>
          <p className="muted text-sm">Last time you got to:</p>
          <p>{item.pausedNote}</p>
        </Card>
      ) : null}

      {view.name === 'understand' ? <Understand item={item} onNext={() => setView(firstView({ ...item, status: 'working', understanding: item.understanding ?? { plain: '', easy: '', needs: 'yes', ask: '', consequence: '', quotes: [], by: 'me' } }))} onDone={() => setView({ name: 'done' })} /> : null}

      {view.name === 'step'
        ? (() => {
            const step = item.steps[view.index];
            if (!step) return null;
            return (
              <>
                <StepScreen key={step.id} item={item} step={step} index={view.index} onDone={(n) => void afterStep(n)} />
                {step.done ? (
                  <button type="button" className="btn" onClick={() => void saveItem(reopenStep(item, step.id))}>
                    This step is done. Do it again
                  </button>
                ) : null}
              </>
            );
          })()
        : null}

      {view.name === 'steps' ? <StepsEditor item={item} onOpen={(index) => setView({ name: 'step', index })} /> : null}

      {view.name === 'pause' ? (
        <Card className="flex flex-col gap-3">
          <ReadAloud text="Where did you get to? This will be here when you come back." />
          <Area label={easy ? 'Where did you get to?' : 'Where did you get to? This is shown when you come back.'} value={where} onChange={setWhere} rows={3} />
          <button type="button" className="btn btn-primary" onClick={() => void stop()}>
            Stop here for now
          </button>
          <button type="button" className="btn" onClick={() => setView(firstView(item))}>
            Carry on instead
          </button>
        </Card>
      ) : null}

      {view.name === 'waiting' && item.waiting ? (
        <div className="flex flex-col gap-4">
          <Picture name="wait" size={easy ? 64 : 44} />
          <ReadAloud text={`Waiting for ${item.waiting.forWhat}. Chase on ${fmtDate(item.waiting.chaseAt)}.`} />
          <Card className="flex flex-col gap-1">
            <p className="text-lg font-semibold">Waiting for {item.waiting.forWhat}</p>
            <p className="muted">Since {fmtDate(item.waiting.since)}. Chase on {fmtDate(item.waiting.chaseAt)}.</p>
            <Stages item={item} />
          </Card>
          <Card className="flex flex-col gap-3">
            <Area label="Has it come? Say what came (optional)" value={came} onChange={setCame} rows={2} />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const next = replyCame(item, came);
                void saveItem(next);
                offerUndo('Marked: their reply came', item);
                setView(firstView(next));
              }}
            >
              Their reply came
            </button>
          </Card>
          <button type="button" className="btn" onClick={() => void chaseNow()}>
            Nothing yet: chase them now
          </button>
          <Card className="flex flex-col gap-2">
            <label className="block">
              <span className="label">Change the chase date</span>
              <input className="field" type="date" value={toDateInput(chaseAt)} onChange={(e) => e.target.value && setChaseAt(fromLocalInput(`${e.target.value}T09:00`))} />
            </label>
            <button type="button" className="btn self-start" disabled={chaseAt === item.waiting.chaseAt} onClick={() => item.waiting && void saveItem({ ...item, waiting: { ...item.waiting, chaseAt }, updatedAt: clock() })}>
              Save the date
            </button>
          </Card>
          <button type="button" className="btn" onClick={() => void saveItem(markDone(item, 'Finished without waiting any longer.')).then(() => { offerUndo('Marked as dealt with', item); setView({ name: 'done' }); })}>
            It is finished: mark it dealt with
          </button>
        </div>
      ) : null}

      {view.name === 'done' ? (
        <div className="flex flex-col gap-4">
          <Picture name="done" size={easy ? 72 : 52} className="text-[var(--done)]" />
          <ReadAloud text="Dealt with. Everything about it is kept in the record." />
          <h2 className="text-2xl font-semibold">Dealt with</h2>
          <p>Everything about it is kept together in the record: what it said, what you did and the proof.</p>
          <Stages item={item} />
          <Link to={`/item/${item.id}/record`} className="btn btn-primary">
            See the record
          </Link>
          <Link to="/" className="btn">
            Back to Today
          </Link>
          {item.status !== 'done' ? null : (
            <button type="button" className="btn" onClick={() => void saveItem({ ...item, status: 'working', updatedAt: clock() }).then(() => setView({ name: 'steps' }))}>
              Open it again
            </button>
          )}
        </div>
      ) : null}

      {view.name === 'steps' ? (
        <div className="flex flex-col gap-2 pt-4">
          {confirmDelete ? (
            <div className="warnbox flex flex-col gap-2">
              <p>Delete this and its record? This cannot be undone.</p>
              <div className="flex gap-2">
                <button type="button" className="btn btn-warn" onClick={() => void removeItem(item.id).then(() => { offerUndo('Deleted', item); navigate('/'); })}>
                  Delete it
                </button>
                <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>
                  Keep it
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-warn self-start" onClick={() => setConfirmDelete(true)}>
              Delete this
            </button>
          )}
        </div>
      ) : null}
    </Page>
  );
}
