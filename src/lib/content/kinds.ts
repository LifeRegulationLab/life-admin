import type { Kind, Status } from '../model/types';

/** Names for each kind of thing, with an easy-read name and the picture shown beside it. */
export const KIND_INFO: Record<Kind, { name: string; easy: string; picture: PictureName; hint: string }> = {
  letter: { name: 'Letter', easy: 'A letter', picture: 'letter', hint: 'Something that came in the post.' },
  email: { name: 'Email', easy: 'An email', picture: 'email', hint: 'An email or a message on a website.' },
  form: { name: 'Form', easy: 'A form to fill in', picture: 'form', hint: 'A form on paper or online.' },
  bill: { name: 'Bill', easy: 'A bill to pay', picture: 'bill', hint: 'Something asking you to pay.' },
  renewal: { name: 'Renewal', easy: 'Something to renew', picture: 'renew', hint: 'Insurance, a passport, a licence, the MOT.' },
  appointment: { name: 'Appointment', easy: 'An appointment', picture: 'calendar', hint: 'Something to book or go to.' },
  call: { name: 'Phone call', easy: 'A phone call to make', picture: 'phone', hint: 'Someone you need to ring.' },
  other: { name: 'Something else', easy: 'Something else', picture: 'other', hint: 'Anything else that needs sorting.' },
};

export const STATUS_INFO: Record<Status, { name: string; easy: string }> = {
  new: { name: 'Not started', easy: 'Not started' },
  working: { name: 'Working on it', easy: 'Started' },
  waiting: { name: 'Waiting for them', easy: 'Waiting for them' },
  done: { name: 'Dealt with', easy: 'Done' },
};

export const PICTURES = [
  'letter',
  'email',
  'form',
  'bill',
  'renew',
  'calendar',
  'phone',
  'other',
  'find',
  'write',
  'send',
  'proof',
  'pay',
  'wait',
  'check',
  'go',
  'camera',
  'paste',
  'type',
  'pile',
  'pause',
  'done',
  'person',
  'speaker',
] as const;
export type PictureName = (typeof PICTURES)[number];
