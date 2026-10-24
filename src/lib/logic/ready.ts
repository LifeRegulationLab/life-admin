import type { Item } from '../model/types';
import { readFacts } from './facts';

/** Long date, such as 12 October. The year is left out unless it is not this year. */
function day(at: number, now: number): string {
  const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear();
  return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
}

/**
 * What to have in front of you before ringing about this thing, taken from the thing itself:
 * its references, amounts, their number, when it was sent and the last call. Worked out on the
 * device, with no helper, so it is there for everyone.
 */
export function haveReady(item: Item, now = Date.now()): string[] {
  const facts = readFacts(item.text, new Date(item.createdAt));
  const out: string[] = [];
  const refs = [item.reference, ...facts.references.map((r) => r.value)].map((r) => r.trim()).filter(Boolean);
  const unique = refs.filter((r, i) => refs.findIndex((x) => x.replace(/\s/g, '') === r.replace(/\s/g, '')) === i);
  if (unique[0]) out.push(`Their reference: ${unique[0]}`);
  for (const r of unique.slice(1, 3)) out.push(`Also in it: ${r}`);
  if (!unique.length) out.push('No reference found. Have the letter in front of you, so you can read out anything they ask for.');
  for (const a of facts.amounts.slice(0, 2)) out.push(`Amount in it: ${a.value}`);
  if (facts.phones[0]) out.push(`Their number: ${facts.phones[0].value}`);
  const sent = [...item.record].reverse().find((r) => r.kind === 'sent');
  if (sent) out.push(`When you sent it: ${day(sent.at, now)}${sent.ref ? `, reference ${sent.ref}` : ''}`);
  const call = [...item.record].reverse().find((r) => r.kind === 'call');
  if (call) out.push(`Last call: ${day(call.at, now)}. ${call.text}`.trim());
  out.push('Your full name and address, as they are on the letter');
  out.push('Something to write on: their name, a reference for the call, and what they agree to do');
  return out;
}
