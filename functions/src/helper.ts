import { CANNOT_ANSWER, checkReply, distressCheck, gate, SUPPORT_TEXT } from './safety';

/**
 * The helper's server. It is a plain function of a web Request so it can be tested without
 * Firebase. In order: the switch, the sign-in, the request's shape, the safety gate on what the
 * person wrote (the model is not called if it catches something), the model, the reply check.
 * Nothing is stored. Four jobs: explain a letter, draft a reply, write a call script, answer a question.
 */

const RULES = [
  'You help one person in the UK, Channel Islands or Isle of Man deal with their own life admin: letters, emails, forms, bills, renewals, appointments and phone calls.',
  'Write in plain British English, short sentences, adult to adult. No exclamation marks, no cheerleading, no therapy language, no "journey".',
  'Stick to what the document says. Never invent a date, an amount or a reference. If something is not clear, say it is not clear.',
  'You are not a solicitor or a financial adviser. When the real answer is free advice, name the organisation: Citizens Advice, StepChange, National Debtline, the council, the organisation that wrote.',
  'Never ask for or repeat a PIN, password, card number or one-time code. If a document asks for one, say it may be a scam.',
].join('\n');

export const SYSTEMS = {
  understand: [
    RULES,
    'Read the document and reply with JSON only, no other text, in this shape:',
    '{"plain": "two or three sentences: who it is from, what it is about, what they want", "easy": "the same in easy-read: very short sentences, one idea each, everyday words", "needs": "yes" | "no" | "unclear", "ask": "what they want the person to do, starting with a verb, or empty", "due": "YYYY-MM-DD or empty", "consequence": "what the document says happens if nothing is done, or empty", "quotes": ["exact words copied from the document that show the ask, the date and the consequence"], "from": "who sent it", "reference": "their reference number, or empty", "steps": [{"type": "find" | "reply" | "send" | "proof" | "call" | "pay" | "book" | "attend" | "wait" | "check" | "custom", "title": "a short step starting with a verb"}]}',
    'needs is "no" only when the document plainly asks for nothing. Steps are the smallest useful steps in order, at most seven.',
  ].join('\n'),
  draft: [
    RULES,
    'Write a short reply to the document for the person to send. Put their reference near the top. Answer only what was asked, using what the person has told you; where something is missing, leave a gap in square brackets such as [date]. Sign with the person\'s name. Reply with the letter only.',
  ].join('\n'),
  script: [
    RULES,
    'Write a short script for a phone call about the document: what to say first, the reference to give, the questions to ask, and a reminder to write down the name of the person spoken to and what they agree. Short lines. Reply with the script only.',
  ].join('\n'),
  ask: [RULES, 'Answer the person\'s question about the document in under 150 words.'].join('\n'),
} as const;

export type Job = keyof typeof SYSTEMS;

export interface HelperDeps {
  on: string | undefined;
  origins: readonly string[];
  verifyUser: (token: string) => Promise<string | undefined>;
  model: (system: string, messages: { role: 'user' | 'assistant'; content: string }[], maxTokens: number) => Promise<{ text: string; refused: boolean }>;
}

export interface HelperRequest {
  job: Job;
  /** The words of the document. */
  text: string;
  kind: string;
  /** For drafts: the person's own notes, name and address. For questions: the question. */
  note: string;
  name: string;
  address: string;
  today: string;
}

const MAX_TEXT = 12_000;

export function readRequest(body: unknown): HelperRequest | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const b = body as Record<string, unknown>;
  const job = b['job'];
  if (typeof job !== 'string' || !(job in SYSTEMS)) return undefined;
  const str = (k: string, max: number) => (typeof b[k] === 'string' ? (b[k] as string).slice(0, max) : '');
  const text = str('text', MAX_TEXT);
  if (!text.trim() && job !== 'ask') return undefined;
  const note = str('note', 3000);
  if (job === 'ask' && !note.trim()) return undefined;
  return { job: job as Job, text, kind: str('kind', 30), note, name: str('name', 120), address: str('address', 400), today: str('today', 20) };
}

function cors(request: Request, origins: readonly string[]): Record<string, string> {
  const origin = request.headers.get('origin');
  if (origin === null || !origins.includes(origin)) return {};
  return { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' };
}

function squash(s: string): string {
  return s.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
}

export interface Understood {
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

const STEP_TYPES = new Set(['find', 'reply', 'send', 'proof', 'call', 'pay', 'book', 'attend', 'wait', 'check', 'custom']);

/**
 * Reads the model's explanation. Only quotes that really are in the document are kept, and a
 * date is kept only if it is a real date, so nothing has to be taken on trust.
 */
export function readUnderstood(raw: string, source: string): Understood | undefined {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return undefined;
  let v: Record<string, unknown>;
  try {
    v = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
  const s = (k: string) => (typeof v[k] === 'string' ? (v[k] as string).trim() : '');
  const needs = v['needs'] === 'yes' || v['needs'] === 'no' ? v['needs'] : 'unclear';
  const due = /^\d{4}-\d{2}-\d{2}$/.test(s('due')) && !Number.isNaN(Date.parse(s('due'))) ? s('due') : '';
  const src = squash(source);
  const quotes = (Array.isArray(v['quotes']) ? v['quotes'] : [])
    .filter((q): q is string => typeof q === 'string' && q.trim().length > 3)
    .map((q) => q.trim())
    .filter((q) => src.includes(squash(q)))
    .slice(0, 6);
  const steps = (Array.isArray(v['steps']) ? v['steps'] : [])
    .filter((x): x is { type: string; title: string } => typeof x === 'object' && x !== null && typeof (x as { title?: unknown }).title === 'string')
    .map((x) => ({ type: STEP_TYPES.has(x.type) ? x.type : 'custom', title: x.title.trim().slice(0, 120) }))
    .filter((x) => x.title)
    .slice(0, 7);
  const out: Understood = { plain: s('plain'), easy: s('easy'), needs, ask: s('ask'), due, consequence: s('consequence'), quotes, from: s('from'), reference: s('reference'), steps };
  if (!out.plain) return undefined;
  return out;
}

function userMessage(r: HelperRequest): string {
  const parts = [`Today is ${r.today || 'not given'}.`, `Kind: ${r.kind || 'letter'}.`, `The document:\n"""\n${r.text}\n"""`];
  if (r.job === 'draft') parts.push(`My name: ${r.name || '[name]'}`, r.address ? `My address: ${r.address}` : '', `What I want to say: ${r.note || '(not given)'}`);
  if (r.job === 'script') parts.push(`My name: ${r.name || '[name]'}`, r.note ? `What I need from the call: ${r.note}` : '');
  if (r.job === 'ask') parts.push(`My question: ${r.note}`);
  return parts.filter(Boolean).join('\n\n');
}

export async function handleHelper(request: Request, deps: HelperDeps): Promise<Response> {
  const send = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors(request, deps.origins) } });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request, deps.origins) });
  if (deps.on !== 'true') return send(503, { text: 'The helper is not switched on.' });
  if (request.method !== 'POST') return send(405, { text: CANNOT_ANSWER });

  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const uid = token ? await deps.verifyUser(token) : undefined;
  if (!uid) return send(401, { text: 'Sign in to use the helper.' });

  let parsed: HelperRequest | undefined;
  try {
    parsed = readRequest(await request.json());
  } catch {
    parsed = undefined;
  }
  if (!parsed) return send(400, { text: CANNOT_ANSWER });

  // What the person wrote is checked. The document itself is not: a letter about arrears is not a crisis.
  if (distressCheck(parsed.note)) return send(200, { text: SUPPORT_TEXT, support: true });
  const g = gate(parsed.note);
  if (!g.send) return send(200, { text: g.reply, support: g.support });

  try {
    const r = await deps.model(SYSTEMS[parsed.job], [{ role: 'user', content: userMessage(parsed) }], parsed.job === 'understand' ? 1200 : 800);
    if (r.refused) return send(200, { text: CANNOT_ANSWER });
    if (parsed.job === 'understand') {
      const u = readUnderstood(r.text, parsed.text);
      if (!u) return send(200, { text: CANNOT_ANSWER });
      for (const field of [u.plain, u.easy, u.ask, u.consequence]) if (field && !checkReply(field).ok) return send(200, { text: CANNOT_ANSWER });
      const tidy = (t: string) => (t ? (checkReply(t) as { ok: true; text: string }).text : t);
      return send(200, { understood: { ...u, plain: tidy(u.plain), easy: tidy(u.easy), ask: tidy(u.ask), consequence: tidy(u.consequence) } });
    }
    const checked = checkReply(r.text);
    return send(200, { text: checked.ok ? checked.text : CANNOT_ANSWER });
  } catch {
    return send(502, { text: 'The helper is not available just now. The steps work without it.' });
  }
}
