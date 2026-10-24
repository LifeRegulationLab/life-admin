import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { handleHelper } from './helper';
import { handleSpeech, VOICE_DIRECTION } from './speech';

/**
 * The helper and read aloud, in London. Each is off until its switch is "true" and its key
 * secret is set. Needs the Blaze plan. Deploy: firebase deploy --only functions
 */

initializeApp();
const MODEL_KEY = defineSecret('MODEL_API_KEY');
const SPEECH_KEY = defineSecret('SPEECH_API_KEY');
const HELPER_ON = defineString('HELPER_ON', { default: 'false' });
const SPEECH_ON = defineString('SPEECH_ON', { default: 'false' });
const ORIGINS = defineString('APP_ORIGINS', { default: 'capacitor://localhost' });
/** Alex Bennett, calm British narration: the voice chosen for the app. */
const VOICE = defineString('SPEECH_VOICE', { default: 'tw43HEeA0n5kOjSqCFT9' });
const SPEECH_MODEL = defineString('SPEECH_MODEL', { default: 'eleven_v3' });
const MODEL = 'claude-sonnet-5-5';

async function verifyUser(token: string): Promise<string | undefined> {
  try {
    return (await getAuth().verifyIdToken(token)).uid;
  } catch {
    return undefined;
  }
}

type Req = { method: string; hostname: string; originalUrl: string; headers: unknown; body: unknown };
type Res = { status: (n: number) => void; setHeader: (k: string, v: string) => void; send: (b: string | Buffer) => void };

function toRequest(req: Req): Request {
  return new Request(`https://${req.hostname}${req.originalUrl}`, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    ...(req.method === 'POST' ? { body: JSON.stringify(req.body) } : {}),
  });
}

async function reply(res: Res, response: Response): Promise<void> {
  res.status(response.status);
  response.headers.forEach((v, k) => res.setHeader(k, v));
  res.send(Buffer.from(await response.arrayBuffer()));
}

export const helper = onRequest({ region: 'europe-west2', secrets: [MODEL_KEY], maxInstances: 5, timeoutSeconds: 90, invoker: 'public' }, async (req, res) => {
  const response = await handleHelper(toRequest(req), {
    on: HELPER_ON.value(),
    origins: ORIGINS.value().split(','),
    verifyUser,
    model: async (system, messages, maxTokens) => {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': MODEL_KEY.value(), 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
      });
      if (!r.ok) throw new Error(`model ${r.status}`);
      const body = (await r.json()) as { stop_reason?: string; content?: { type: string; text?: string }[] };
      return { refused: body.stop_reason === 'refusal', text: (body.content ?? []).map((c) => c.text ?? '').join('') };
    },
  });
  await reply(res, response);
});

export const speak = onRequest({ region: 'europe-west2', secrets: [SPEECH_KEY], maxInstances: 5, timeoutSeconds: 60, invoker: 'public' }, async (req, res) => {
  const response = await handleSpeech(toRequest(req), {
    on: SPEECH_ON.value(),
    origins: ORIGINS.value().split(','),
    verifyUser,
    speak: async (text) => {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE.value()}?output_format=mp3_44100_64`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'xi-api-key': SPEECH_KEY.value(), accept: 'audio/mpeg' },
        body: JSON.stringify({ text: VOICE_DIRECTION + text, model_id: SPEECH_MODEL.value(), language_code: 'en' }),
      });
      if (!r.ok) throw new Error(`speech ${r.status}`);
      return r.arrayBuffer();
    },
  });
  await reply(res, response);
});
