import { CALL_READY_TITLE } from '../content/steps';
import type { Item, Owes, Settings, Step, StepType } from '../model/types';
import { readFacts } from './facts';
import { currentStep } from './items';
import { haveReady } from './ready';

/**
 * The aids that hold things for the person: where they got to, what to have ready, what to do
 * when stuck, and keeping a thing moving while they wait. Plain functions, no helper, no signal.
 */

/** Long date, such as 12 October. The year is left out unless it is not this year. */
function day(at: number, now: number): string {
  const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear();
  return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
}

// ---------------------------------------------------------------------------------------------
// Where was I?

export interface WhereWasI {
  /** The step finished most recently. */
  last?: { title: string; at: number };
  /** The step to do next. */
  next?: Step;
  /** What the person wrote when they stopped. */
  note: string;
  /** Things that go with the next step: the reference, an amount, a photo of a page or proof. */
  keep: string[];
  /** A photo to show beside the card: the proof for the last step, or the first page. */
  photoId?: string;
}

/**
 * Where the person got to on one thing: the last step done, the next one, and what they need for
 * it. Nothing when nothing has been done yet and no note was left, so a new thing opens plainly.
 */
export function whereWasI(item: Item): WhereWasI | undefined {
  if (item.status === 'done' || item.status === 'waiting') return undefined;
  const done = item.steps.filter((s) => s.done && s.doneAt !== undefined).sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  const lastStep = done[0];
  const note = item.pausedNote.trim();
  if (!lastStep && !note) return undefined;
  const next = currentStep(item);
  const keep: string[] = [];
  if (item.reference) keep.push(`Their reference: ${item.reference}`);
  if (next?.type === 'pay') {
    const amount = next.amount ?? readFacts(item.text, new Date(item.createdAt)).amounts[0]?.value;
    if (amount) keep.push(`The amount: ${amount}`);
  }
  const proof = [...item.record].reverse().find((r) => r.photoId);
  const photoId = proof?.photoId ?? item.pageIds[0];
  return {
    ...(lastStep ? { last: { title: lastStep.title, at: lastStep.doneAt ?? item.updatedAt } } : {}),
    ...(next ? { next } : {}),
    note,
    keep,
    ...(photoId ? { photoId } : {}),
  };
}

/** "You did: Get together what they ask for. Next is: Write the reply." */
export function whereLine(w: WhereWasI): string {
  return [w.last ? `You did: ${w.last.title}.` : '', w.next ? `Next is: ${w.next.title}.` : 'Every step is done.'].filter(Boolean).join(' ');
}

/** The thing part way through that was touched last, for the "Where was I?" button. */
export function lastTouched(items: readonly Item[]): Item | undefined {
  return items
    .filter((i) => !i.unsorted && (i.status === 'working' || i.status === 'new') && whereWasI(i) !== undefined)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

// ---------------------------------------------------------------------------------------------
// Get ready first

/** What most steps of each type need, and roughly how long getting ready takes. */
export const READY_FOR: Record<StepType, { things: string[]; minutes: number }> = {
  find: { things: ['A place to put everything together', 'The letter, so you can see what they ask for'], minutes: 5 },
  reply: { things: ['The letter in front of you', 'Anything you are sending with it'], minutes: 5 },
  send: { things: ['Their address or email address, from the letter', 'An envelope and a stamp, if it goes by post'], minutes: 10 },
  proof: { things: ['Your phone, to take a photo', 'The receipt, email or certificate of posting'], minutes: 2 },
  call: { things: [], minutes: 5 },
  pay: { things: ['Your bank card or banking app', 'The payment reference'], minutes: 5 },
  book: { things: ['Your diary or calendar', 'The reference on the letter'], minutes: 5 },
  attend: { things: ['The letter or appointment card', 'Photo ID, if they ask for it', 'How you are getting there, and how long it takes'], minutes: 15 },
  wait: { things: [], minutes: 0 },
  check: { things: ['The letter or bill', 'The last one, to compare'], minutes: 5 },
  custom: { things: [], minutes: 0 },
};

export interface Ready {
  /** Taken from the letter and the step type; the person cannot remove these, only tick them. */
  found: string[];
  /** The person's own items. */
  own: string[];
  /** Minutes to get ready. */
  minutes: number;
}

/** What to have in front of you before a step, from the letter itself and the person's own list. */
export function getReady(item: Item, step: Step, now = Date.now()): Ready {
  const forCall = step.type === 'call' || step.title === CALL_READY_TITLE;
  const found = forCall ? haveReady(item, now) : [...READY_FOR[step.type].things];
  if (!forCall) {
    const facts = readFacts(item.text, new Date(item.createdAt));
    const ref = item.reference || facts.references[0]?.value;
    if (ref && ['reply', 'pay', 'book', 'send', 'check'].includes(step.type)) found.unshift(`Their reference: ${ref}`);
    if (step.type === 'pay' && facts.amounts[0]) found.unshift(`The amount: ${facts.amounts[0].value}`);
    if (step.type === 'find' && item.understanding?.ask) found.unshift(`What they ask for: ${item.understanding.ask}`);
  }
  return { found: [...new Set(found)], own: step.ready ?? [], minutes: step.readyMinutes ?? READY_FOR[step.type].minutes };
}

/** "About 5 minutes to get ready, then about 15 for the step." */
export function readyTime(ready: Ready, step: Step): string {
  const parts = [ready.minutes ? `About ${ready.minutes} minutes to get ready` : '', step.minutes ? `${ready.minutes ? 'then about' : 'About'} ${step.minutes} minutes for the step` : ''].filter(Boolean);
  return parts.length ? `${parts.join(', ')}.` : '';
}

/** Getting ready and doing the step, together. */
export function totalMinutes(item: Item, step: Step): number | undefined {
  const r = getReady(item, step);
  const total = r.minutes + (step.minutes ?? 0);
  return total || undefined;
}

// ---------------------------------------------------------------------------------------------
// What is stopping me?

export const STUCK = ['unclear', 'big', 'worried', 'energy', 'missing'] as const;
export type Stuck = (typeof STUCK)[number];

/** The five answers, in the person's words, and what each one offers here. */
export const STUCK_INFO: Record<Stuck, { label: string; easy: string; line: string }> = {
  unclear: { label: 'Unclear', easy: 'I do not understand it', line: 'Let us find what is unclear. Start with what it says, in plain words.' },
  big: { label: 'Too big', easy: 'It is too much', line: 'Do just one small part. The rest stays here.' },
  worried: { label: 'Worried', easy: 'It worries me', line: 'You do not have to do this alone. Someone can help with one step, or you can get free advice first.' },
  energy: { label: 'No energy', easy: 'I am too tired', line: 'Stopping is fine. Your place is kept for when you come back.' },
  missing: { label: 'Missing something', easy: 'I need something first', line: 'Say what is missing. It becomes the next step, so the rest can wait for it.' },
};

/** Mull's own link for talking it through. Only the answer goes with it; nothing about the letter. */
export function talkLink(answer: Stuck): string {
  return `coach://stuck?answer=${answer}`;
}

// ---------------------------------------------------------------------------------------------
// Keep this moving

export const OWES_INFO: Record<Owes, string> = {
  them: 'Them',
  me: 'Me',
  someone: 'Someone else',
};

/** "Waiting on them to reply." or "Waiting on you: send the form." */
export function owesLine(item: Item): string {
  const w = item.waiting;
  if (!w) return '';
  const owes = w.owes ?? 'them';
  if (owes === 'me') return `The next step is yours: ${w.forWhat}.`;
  if (owes === 'someone') return `${w.who?.trim() || 'Someone else'} owes the next step: ${w.forWhat}.`;
  return `The next step is theirs: ${w.forWhat}.`;
}

/**
 * A follow-up ready to send, with their reference, when it was sent and what was agreed, so
 * chasing takes one tap to copy. The person reads it through first.
 */
export function followUpDraft(item: Item, settings: Pick<Settings, 'name'>, now = Date.now()): string {
  const w = item.waiting;
  const sent = [...item.record].reverse().find((r) => r.kind === 'sent');
  const since = sent?.at ?? w?.since;
  const lines = [
    `Dear ${item.from || 'Sir or Madam'}`,
    '',
    item.reference ? `Reference: ${item.reference}` : '',
    '',
    since ? `I wrote to you on ${day(since, now)}${sent?.ref ? ` (reference ${sent.ref})` : ''} and have not yet had ${w?.forWhat ? w.forWhat.replace(/^(a|an|the|their)\s+/i, 'a ') : 'a reply'}.` : `I am still waiting for ${w?.forWhat || 'a reply'}.`,
    w?.agreed ? `You said: ${w.agreed.trim().replace(/\.$/, '')}.` : '',
    'Please could you tell me when I will hear from you, or what you need from me.',
    '',
    'Yours faithfully',
    settings.name || '[your name]',
  ];
  return lines.filter((l, i, all) => !(l === '' && all[i - 1] === '')).join('\n');
}
