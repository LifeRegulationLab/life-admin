import type { Item } from '../model/types';

/**
 * The four stages of done, so "done" is never a guess: the reply prepared, sent, proof kept, and
 * their response received. Each item shows only the stages that apply to it.
 */

export type StageKey = 'prepared' | 'sent' | 'proof' | 'received';

export interface Stage {
  key: StageKey;
  label: string;
  done: boolean;
}

export function stages(item: Item): Stage[] {
  const types = new Set(item.steps.map((s) => s.type));
  const stepDone = (t: string) => item.steps.some((s) => s.type === t && s.done);
  const kinds = new Set(item.record.map((r) => r.kind));
  const out: Stage[] = [];
  if (types.has('reply')) out.push({ key: 'prepared', label: 'Reply prepared', done: stepDone('reply') || item.steps.some((s) => s.type === 'reply' && Boolean(s.draft)) });
  if (types.has('send') || types.has('pay')) {
    out.push({ key: 'sent', label: types.has('send') ? 'Sent' : 'Paid', done: stepDone('send') || stepDone('pay') || kinds.has('sent') || kinds.has('paid') });
  }
  if (out.length || types.has('proof')) {
    out.push({ key: 'proof', label: 'Proof kept', done: stepDone('proof') || item.record.some((r) => Boolean(r.photoId) || Boolean(r.ref)) });
  }
  if (types.has('wait') || kinds.has('received') || item.waiting) out.push({ key: 'received', label: 'Their response received', done: kinds.has('received') });
  return out;
}
