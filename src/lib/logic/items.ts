import { makeStep, stepsFor } from '../content/steps';
import type { Item, Kind, RecordEntry, RecordKind, Renewal, Step, Waiting } from '../model/types';
import { newId } from '../store/backend';

/**
 * What happens to an item as it is dealt with. Plain functions that return a new item, so the
 * screens and the tests share one set of rules.
 */

const DAY = 24 * 60 * 60 * 1000;

export function newItem(kind: Kind, fields: Partial<Item> = {}, now = Date.now()): Item {
  return {
    id: newId(),
    kind,
    title: '',
    from: '',
    reference: '',
    text: '',
    pageIds: [],
    status: 'new',
    steps: stepsFor(kind),
    at: 0,
    pausedNote: '',
    record: [],
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
}

export function addRecord(item: Item, kind: RecordKind, text: string, extra: Partial<RecordEntry> = {}, now = Date.now()): Item {
  const entry: RecordEntry = { id: newId(), at: now, kind, text, ...extra };
  return { ...item, record: [...item.record, entry], updatedAt: now };
}

export function updateStep(item: Item, stepId: string, change: Partial<Step>, now = Date.now()): Item {
  return { ...item, steps: item.steps.map((s) => (s.id === stepId ? { ...s, ...change } : s)), updatedAt: now };
}

const RECORD_FOR: Partial<Record<Step['type'], RecordKind>> = {
  send: 'sent',
  proof: 'proof',
  call: 'call',
  pay: 'paid',
  book: 'booked',
};

/** Marks a step done, keeps what was done in the record, and moves on. */
export function completeStep(item: Item, stepId: string, now = Date.now()): Item {
  const step = item.steps.find((s) => s.id === stepId);
  if (!step) return item;
  let next = updateStep(item, stepId, { done: true, doneAt: now }, now);
  const kind = RECORD_FOR[step.type] ?? 'note';
  const detail = [step.how ? `by ${step.how}` : '', step.amount ?? '', step.note].filter(Boolean).join('. ');
  next = addRecord(next, kind, detail ? `${step.title}: ${detail}` : step.title, {}, now);
  if (step.type === 'reply' && step.draft) next = addRecord(next, 'note', `Reply written:\n${step.draft}`, {}, now);
  const index = next.steps.findIndex((s) => s.id === stepId);
  const after = next.steps.findIndex((s, i) => i > index && !s.done);
  const status = next.steps.every((s) => s.done) ? 'done' : next.status === 'waiting' ? 'waiting' : 'working';
  return {
    ...next,
    at: after === -1 ? next.steps.length : after,
    status,
    pausedNote: '',
    ...(status === 'done' ? { doneAt: now } : {}),
  };
}

export function reopenStep(item: Item, stepId: string, now = Date.now()): Item {
  const next = updateStep(item, stepId, { done: false }, now);
  const { doneAt: _drop, ...rest } = next;
  void _drop;
  return { ...rest, status: 'working', at: next.steps.findIndex((s) => s.id === stepId) };
}

/** Stopping part way. The note says where I got to; coming back opens on the same step. */
export function pause(item: Item, note: string, now = Date.now()): Item {
  return { ...item, pausedNote: note.trim(), pausedAt: now, status: item.status === 'new' ? 'working' : item.status, updatedAt: now };
}

/** Sent and now waiting for them. A chase date makes it come back into the list if nothing arrives. */
export function startWaiting(item: Item, forWhat: string, chaseAt: number, now = Date.now(), extra: Pick<Waiting, 'owes' | 'who' | 'agreed'> = {}): Item {
  const waitStep = item.steps.find((s) => s.type === 'wait' && !s.done);
  const kept = Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && v !== '')) as Partial<Waiting>;
  let next: Item = { ...item, status: 'waiting', waiting: { since: now, forWhat: forWhat.trim() || 'a reply', chaseAt, ...kept }, updatedAt: now };
  if (waitStep) next = updateStep(next, waitStep.id, { note: forWhat }, now);
  return addRecord(next, 'note', `Waiting for ${forWhat.trim() || 'a reply'}. Chase on ${new Date(chaseAt).toLocaleDateString('en-GB')}.`, {}, now);
}

/** Their reply came. The wait step is done and the item is ready for whatever comes next. */
export function replyCame(item: Item, what: string, now = Date.now()): Item {
  let next = addRecord(item, 'received', what.trim() || 'Their reply came.', {}, now);
  const waitStep = next.steps.find((s) => s.type === 'wait' && !s.done);
  if (waitStep) next = completeStep(next, waitStep.id, now);
  const { waiting: _w, ...rest } = next;
  void _w;
  return { ...rest, status: rest.steps.every((s) => s.done) ? 'done' : 'working' };
}

export function markDone(item: Item, note: string, now = Date.now()): Item {
  const next = addRecord(item, 'done', note.trim() || 'Dealt with.', {}, now);
  const { waiting: _w, ...rest } = next;
  void _w;
  return { ...rest, status: 'done', doneAt: now, at: rest.steps.length };
}

export function nothingToDo(item: Item, now = Date.now()): Item {
  return markDone({ ...item, steps: item.steps.map((s) => ({ ...s, done: true })) }, 'Read it. Nothing needed doing.', now);
}

/** The step to open: where I stopped, or the first one not done. */
export function currentStep(item: Item): Step | undefined {
  const at = item.steps[item.at];
  if (at && !at.done) return at;
  return item.steps.find((s) => !s.done);
}

export function needsChasing(item: Item, now = Date.now()): boolean {
  return item.status === 'waiting' && item.waiting !== undefined && item.waiting.chaseAt <= now;
}

export interface Lists {
  /** Things to do, nearest date first; things with no date after. */
  next: Item[];
  /** Waiting for them, kept apart. Ones due a chase are in `next` too. */
  waiting: Item[];
  /** From pile-of-post mode, not yet looked at. */
  unsorted: Item[];
  done: Item[];
}

export function dueOf(item: Item): number | undefined {
  return item.understanding?.dueAt ?? item.dueAt;
}

export function lists(items: readonly Item[], now = Date.now()): Lists {
  const byDue = (a: Item, b: Item) => (dueOf(a) ?? Infinity) - (dueOf(b) ?? Infinity) || a.createdAt - b.createdAt;
  return {
    next: items.filter((i) => !i.unsorted && (i.status === 'new' || i.status === 'working' || needsChasing(i, now))).sort(byDue),
    waiting: items.filter((i) => i.status === 'waiting').sort((a, b) => (a.waiting?.chaseAt ?? 0) - (b.waiting?.chaseAt ?? 0)),
    unsorted: items.filter((i) => i.unsorted && i.status !== 'done').sort((a, b) => a.createdAt - b.createdAt),
    done: items.filter((i) => i.status === 'done').sort((a, b) => (b.doneAt ?? b.updatedAt) - (a.doneAt ?? a.updatedAt)),
  };
}

/**
 * Dates that must not slip out of sight on a calm screen: things not yet dealt with whose date has
 * passed or is within three days, which the list on screen does not already show. Pile-of-post
 * items still to sort are included, because a deadline found in them is real before they are sorted.
 */
export function notToMiss(items: readonly Item[], shown: readonly string[], now = Date.now(), days = 3): Item[] {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const limit = end.getTime() + days * DAY;
  return items
    .filter((i) => i.status !== 'done' && i.status !== 'waiting' && !shown.includes(i.id))
    .filter((i) => {
      const due = dueOf(i);
      return due !== undefined && due <= limit;
    })
    .sort((a, b) => (dueOf(a) ?? 0) - (dueOf(b) ?? 0));
}

/** Words for how near a date is. */
export function whenWords(due: number | undefined, now = Date.now()): string {
  if (due === undefined) return 'No date';
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(due).setHours(0, 0, 0, 0) - start.getTime()) / DAY);
  // A passed date is said plainly, without counting missed days.
  if (days < -1) return `The date was ${new Date(due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  if (days === -1) return 'The date was yesterday';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days < 14) return `Due in ${days} days`;
  return `Due ${new Date(due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

export function isLate(due: number | undefined, now = Date.now()): boolean {
  if (due === undefined) return false;
  return new Date(due).setHours(23, 59, 59, 999) < now;
}

export function itemFromRenewal(r: Renewal, now = Date.now()): Item {
  return newItem('renewal', { title: r.title, from: r.with, dueAt: r.dueAt, renewalId: r.id, text: r.notes }, now);
}

export { DAY };

/** Links two things both ways, or unlinks them. Returns both, changed. */
export function link(a: Item, b: Item, on: boolean, now = Date.now()): [Item, Item] {
  const set = (x: Item, id: string): Item => {
    const links = new Set(x.links ?? []);
    if (on) links.add(id);
    else links.delete(id);
    return { ...x, links: [...links], updatedAt: now };
  };
  return [set(a, b.id), set(b, a.id)];
}

/** Changes who owes the next step, what was agreed or the follow-up date, and notes it in the record. */
export function keepMoving(item: Item, change: Partial<Pick<Waiting, 'owes' | 'who' | 'agreed' | 'chaseAt'>>, now = Date.now()): Item {
  if (!item.waiting) return item;
  const waiting: Waiting = { ...item.waiting, ...change };
  const said = [
    change.owes !== undefined && change.owes !== item.waiting.owes ? `Next step now with ${change.owes === 'me' ? 'me' : change.owes === 'someone' ? waiting.who || 'someone else' : 'them'}` : '',
    change.agreed !== undefined && change.agreed.trim() && change.agreed !== item.waiting.agreed ? `They agreed: ${change.agreed.trim()}` : '',
    change.chaseAt !== undefined && change.chaseAt !== item.waiting.chaseAt ? `Follow up on ${new Date(change.chaseAt).toLocaleDateString('en-GB')}` : '',
  ].filter(Boolean);
  const next: Item = { ...item, waiting, updatedAt: now };
  return said.length ? addRecord(next, 'note', `${said.join('. ')}.`, {}, now) : next;
}

/** Puts a new step just before the one on screen and opens it, for "too big" and "missing something". */
export function stepBefore(item: Item, title: string, type: Step['type'] = 'custom', now = Date.now()): Item {
  const at = currentStep(item);
  const index = at ? item.steps.indexOf(at) : item.steps.length;
  const step = makeStep({ type, title: title.trim(), help: 'A step you added. Do just this part.', easyHelp: 'Do just this part.' });
  const steps = [...item.steps];
  steps.splice(index, 0, step);
  return { ...item, steps, at: index, status: item.status === 'new' ? 'working' : item.status, updatedAt: now };
}
