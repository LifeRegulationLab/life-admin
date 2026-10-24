/**
 * The records the app keeps. A "thing to deal with" is an item: a letter, an email, a form, a bill,
 * a renewal, an appointment or a phone call. Each item has its steps and its record kept together.
 */

export const KINDS = ['letter', 'email', 'form', 'bill', 'renewal', 'appointment', 'call', 'other'] as const;
export type Kind = (typeof KINDS)[number];

/** Not started, working on it, waiting for them, done. Waiting is kept apart from what needs doing. */
export const STATUSES = ['new', 'working', 'waiting', 'done'] as const;
export type Status = (typeof STATUSES)[number];

export const STEP_TYPES = ['find', 'reply', 'send', 'proof', 'call', 'pay', 'book', 'attend', 'wait', 'check', 'custom'] as const;
export type StepType = (typeof STEP_TYPES)[number];

/** Does it ask you to do anything? */
export type Needs = 'yes' | 'no' | 'unclear';

export interface Understanding {
  /** What it is, in plain words. */
  plain: string;
  /** The same in easy-read: short sentences, one idea each. */
  easy: string;
  needs: Needs;
  /** What they want you to do. */
  ask: string;
  dueAt?: number;
  /** What happens if nothing is done. */
  consequence: string;
  /** The words in the original that each point came from, so nothing has to be taken on trust. */
  quotes: string[];
  by: 'helper' | 'me';
}

export interface Step {
  id: string;
  type: StepType;
  title: string;
  help: string;
  easyHelp: string;
  done: boolean;
  doneAt?: number;
  /** Notes made while doing it: who I spoke to, what I sent, where the proof is. */
  note: string;
  /** A drafted reply or a call script. */
  draft?: string;
  /** For 'book' and 'attend': when. */
  at?: number;
  /** For 'pay': the amount, as written. */
  amount?: string;
  /** For 'send': how it was sent. */
  how?: 'post' | 'email' | 'online' | 'in person' | 'phone';
}

export const RECORD_KINDS = ['note', 'sent', 'proof', 'call', 'paid', 'received', 'booked', 'done'] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

export interface RecordEntry {
  id: string;
  at: number;
  kind: RecordKind;
  text: string;
  /** A confirmation number, receipt number or reference. */
  ref?: string;
  /** A picture kept on this device, such as a receipt or a proof of posting. */
  photoId?: string;
}

export interface Waiting {
  since: number;
  /** What I am waiting for. */
  forWhat: string;
  /** When to chase if nothing has come. */
  chaseAt: number;
}

export interface Item {
  id: string;
  kind: Kind;
  title: string;
  /** Who it is from, or who it is with. */
  from: string;
  reference: string;
  /** The words of the letter, email or form, read from the photo or pasted in. */
  text: string;
  /** Pictures of the pages, kept on this device only. */
  pageIds: string[];
  status: Status;
  understanding?: Understanding;
  steps: Step[];
  /** The step on screen, so coming back opens where I stopped. */
  at: number;
  /** "Where I got to", written when stopping part way. */
  pausedNote: string;
  pausedAt?: number;
  waiting?: Waiting;
  record: RecordEntry[];
  dueAt?: number;
  /** Set when this item was made from a renewal. */
  renewalId?: string;
  /** Set by pile-of-post mode until the item has been sorted. */
  unsorted?: boolean;
  createdAt: number;
  updatedAt: number;
  doneAt?: number;
}

export interface Renewal {
  id: string;
  preset: string;
  title: string;
  /** Who it is with. */
  with: string;
  dueAt: number;
  /** 0 means it does not repeat. */
  everyMonths: number;
  /** How many days before the date it should turn into something to deal with. */
  daysBefore: number;
  notes: string;
  lastDoneAt?: number;
  /** The item made for this round, if one has been made. */
  itemId?: string;
}

export type TextSize = 'normal' | 'large' | 'larger';
export type ReadAloud = 'off' | 'button' | 'every';

export interface Settings {
  /** Used to sign drafted replies. */
  name: string;
  address: string;
  easyRead: boolean;
  pictures: boolean;
  textSize: TextSize;
  readAloud: ReadAloud;
  /** Use the phone's own voice when the recorded voice cannot be reached. Off unless chosen. */
  deviceVoice: boolean;
  helperOn: boolean;
  reminders: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  address: '',
  easyRead: false,
  pictures: true,
  textSize: 'normal',
  readAloud: 'button',
  deviceVoice: false,
  helperOn: false,
  reminders: true,
};

/** One step handed to someone else to help with. They see only this, never the rest. */
export interface Share {
  code: string;
  owner: string;
  itemId: string;
  stepId: string;
  /** What the helper sees. */
  title: string;
  help: string;
  /** Shown only when the person chose to include it. */
  extract: string;
  from: string;
  dueAt?: number;
  createdAt: number;
  expiresAt: number;
  /** Filled in by the helper. */
  reply?: string;
  repliedAt?: number;
  helperName?: string;
}
