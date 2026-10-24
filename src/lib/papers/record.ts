import { APP_FULL_NAME } from '../brand';
import { KIND_INFO, STATUS_INFO } from '../content/kinds';
import { dueOf } from '../logic/items';
import type { Item, RecordKind } from '../model/types';
import type { Doc } from './pdf';

/**
 * The record of one thing: what it was, what was done, when, and the proof, all in one PDF. It is
 * the paper to show if they say they never got your reply.
 */

const RECORD_WORDS: Record<RecordKind, string> = {
  note: 'Note',
  sent: 'Sent',
  proof: 'Proof',
  call: 'Phone call',
  paid: 'Paid',
  received: 'Reply came',
  booked: 'Booked',
  done: 'Dealt with',
};

export function fmtDate(at: number | undefined, withTime = false): string {
  if (at === undefined) return '';
  const d = new Date(at);
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return withTime ? `${day}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : day;
}

export function recordDoc(item: Item, author: string, now = Date.now()): Doc {
  const u = item.understanding;
  const due = dueOf(item);
  const sections: Doc['sections'] = [
    {
      heading: 'What it is',
      pairs: [
        ['Kind', KIND_INFO[item.kind].name],
        ['From', item.from],
        ['Reference', item.reference],
        ['Date it came', fmtDate(item.createdAt)],
        ['Due by', fmtDate(due)],
        ['Where it is now', STATUS_INFO[item.status].name],
      ],
    },
  ];
  if (u) {
    sections.push({
      heading: 'What it says',
      paragraphs: [u.plain, u.ask ? `What they want: ${u.ask}` : '', u.consequence ? `If nothing is done: ${u.consequence}` : ''].filter(Boolean),
      items: u.quotes.map((q) => `"${q}"`),
    });
  }
  sections.push({
    heading: 'Steps',
    items: item.steps.map((s) => `${s.done ? 'Done' : 'Not done'}: ${s.title}${s.doneAt ? ` (${fmtDate(s.doneAt)})` : ''}${s.note ? `. ${s.note}` : ''}`),
  });
  if (item.waiting) sections.push({ heading: 'Waiting for', paragraphs: [`${item.waiting.forWhat}, since ${fmtDate(item.waiting.since)}. Chase on ${fmtDate(item.waiting.chaseAt)}.`] });
  if (item.record.length) {
    sections.push({
      heading: 'Record',
      pairs: [...item.record].sort((a, b) => a.at - b.at).map((r) => [`${fmtDate(r.at, true)}: ${RECORD_WORDS[r.kind]}`, `${r.text}${r.ref ? ` (reference ${r.ref})` : ''}`] as [string, string]),
    });
  }
  const drafts = item.steps.filter((s) => s.draft && s.type === 'reply');
  for (const s of drafts) sections.push({ heading: 'The reply', paragraphs: [s.draft ?? ''] });
  if (item.text.trim()) sections.push({ heading: 'The words of the original', paragraphs: [item.text.trim()] });
  return {
    title: item.title || KIND_INFO[item.kind].name,
    subtitle: [item.from, item.reference].filter(Boolean).join(', '),
    intro: `Made on ${fmtDate(now)}.`,
    sections,
    footer: `${item.title || KIND_INFO[item.kind].name}. ${APP_FULL_NAME}.`,
    author: author || 'Me',
  };
}
