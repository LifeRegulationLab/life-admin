/**
 * Read aloud. Turns a screen's words into the recorded voice the app uses everywhere, so the
 * phone's own voice is never needed. Signed-in people with Plus only, so the cost stays known. Nothing is stored.
 */

export interface SpeechDeps {
  on: string | undefined;
  origins: readonly string[];
  verifyUser: (token: string) => Promise<string | undefined>;
  /** Whether this person has Dealt With Plus (or is a tester). */
  hasPlus: (uid: string) => Promise<boolean>;
  speak: (text: string) => Promise<ArrayBuffer>;
}

export const MAX_SPEECH = 2500;

export const PLUS_VOICE_TEXT = 'The recorded voice is part of Dealt With Plus.';

/** The direction that keeps the voice calm and low. It is not spoken. */
export const VOICE_DIRECTION = '[calm, low, relaxed voice] ';

function cors(request: Request, origins: readonly string[]): Record<string, string> {
  const origin = request.headers.get('origin');
  if (origin === null || !origins.includes(origin)) return {};
  return { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' };
}

export async function handleSpeech(request: Request, deps: SpeechDeps): Promise<Response> {
  const headers = { 'cache-control': 'no-store', ...cors(request, deps.origins) };
  const fail = (status: number, text: string) => new Response(JSON.stringify({ text }), { status, headers: { ...headers, 'content-type': 'application/json' } });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (deps.on !== 'true') return fail(503, 'Read aloud is not switched on.');
  if (request.method !== 'POST') return fail(405, 'Not allowed.');
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const uid = token ? await deps.verifyUser(token) : undefined;
  if (!uid) return fail(401, 'Sign in to use read aloud.');
  if (!(await deps.hasPlus(uid))) return fail(402, PLUS_VOICE_TEXT);
  let text = '';
  try {
    const body = (await request.json()) as { text?: unknown };
    text = typeof body.text === 'string' ? body.text.trim() : '';
  } catch {
    text = '';
  }
  if (!text || text.length > MAX_SPEECH) return fail(400, 'Nothing to read, or too much at once.');
  try {
    const audio = await deps.speak(text);
    return new Response(audio, { status: 200, headers: { ...headers, 'content-type': 'audio/mpeg' } });
  } catch {
    return fail(502, 'Read aloud is not available just now.');
  }
}
