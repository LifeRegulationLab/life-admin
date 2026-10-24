import { firebase, firebaseConfigured } from '../firebase/app';
import type { Item, Settings, Understanding } from '../model/types';
import { CANNOT_ANSWER, checkReply, gate } from './safety';

/**
 * The helper. It is off unless the build turns it on and the person switches it on in Me. It
 * sends the words of the one thing being worked on, and nothing else.
 */

const env = import.meta.env;

export function helperAvailable(): boolean {
  return env['VITE_HELPER_ON'] === 'true' && Boolean(env['VITE_HELPER_URL']) && firebaseConfigured();
}

export type HelperResult<T> = { ok: true; value: T } | { ok: false; text: string; support?: boolean };

interface Understood {
  plain: string;
  easy: string;
  needs: 'yes' | 'no' | 'unclear';
  ask: string;
  due: string;
  consequence: string;
  quotes: string[];
  from: string;
  reference: string;
  steps: { type: string; title: string }[];
}

async function call(body: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> } | undefined> {
  const user = firebase().auth.currentUser;
  if (!user) return { status: 401, json: { text: 'Sign in to use the helper.' } };
  const token = await user.getIdToken();
  try {
    const res = await fetch(String(env['VITE_HELPER_URL']), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...body, today: new Date().toISOString().slice(0, 10) }),
    });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  } catch {
    return undefined;
  }
}

const NO_SIGNAL = 'No signal. Every step works without the helper.';

export async function explain(item: Item): Promise<HelperResult<Understood>> {
  const r = await call({ job: 'understand', text: item.text, kind: item.kind });
  if (!r) return { ok: false, text: NO_SIGNAL };
  const u = r.json['understood'] as Understood | undefined;
  if (r.status !== 200 || !u) return { ok: false, text: typeof r.json['text'] === 'string' ? r.json['text'] : CANNOT_ANSWER };
  return { ok: true, value: u };
}

async function textJob(job: 'draft' | 'script' | 'ask', item: Item, note: string, settings: Settings): Promise<HelperResult<string>> {
  const g = gate(note);
  if (!g.send) return { ok: false, text: g.reply, support: g.support };
  const r = await call({ job, text: item.text || `${item.title}. From ${item.from}. Reference ${item.reference}.`, kind: item.kind, note, name: settings.name, address: settings.address });
  if (!r) return { ok: false, text: NO_SIGNAL };
  const text = typeof r.json['text'] === 'string' ? r.json['text'] : '';
  if (r.json['support']) return { ok: false, text, support: true };
  if (r.status !== 200) return { ok: false, text: text || CANNOT_ANSWER };
  const checked = checkReply(text);
  return checked.ok && text !== CANNOT_ANSWER ? { ok: true, value: checked.text } : { ok: false, text: CANNOT_ANSWER };
}

export const draftReply = (item: Item, note: string, settings: Settings) => textJob('draft', item, note, settings);
export const callScriptFor = (item: Item, note: string, settings: Settings) => textJob('script', item, note, settings);
export const askAbout = (item: Item, question: string, settings: Settings) => textJob('ask', item, question, settings);

/** The helper's explanation as kept on the item. */
export function toUnderstanding(u: Understood): Understanding {
  const due = u.due ? new Date(`${u.due}T12:00:00`).getTime() : undefined;
  return {
    plain: u.plain,
    easy: u.easy || u.plain,
    needs: u.needs,
    ask: u.ask,
    consequence: u.consequence,
    quotes: u.quotes,
    by: 'helper',
    ...(due !== undefined && !Number.isNaN(due) ? { dueAt: due } : {}),
  };
}
