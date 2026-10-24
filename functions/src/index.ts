import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { isTester, planChange, stripeForm, verifyStripeSignature, type Plan } from './billing';
import { handleHelper } from './helper';
import { handleSpeech, VOICE_DIRECTION } from './speech';

/**
 * The helper and read aloud, in London, both part of Dealt With Plus. Each is off until its switch
 * is "true" and its key secret is set. Plus is paid through Stripe (checkout, portal, stripeWebhook).
 * Needs the Blaze plan. Deploy: firebase deploy --only functions
 */

initializeApp();
const MODEL_KEY = defineSecret('MODEL_API_KEY');
const SPEECH_KEY = defineSecret('SPEECH_API_KEY');
const STRIPE_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_HOOK = defineSecret('STRIPE_WEBHOOK_SECRET');
const HELPER_ON = defineString('HELPER_ON', { default: 'false' });
const SPEECH_ON = defineString('SPEECH_ON', { default: 'false' });
const ORIGINS = defineString('APP_ORIGINS', { default: 'https://dealt-with-lrl.web.app,https://dealt-with-lrl.firebaseapp.com,capacitor://localhost' });
/** Alex Bennett, calm British narration: the voice chosen for the app. */
const VOICE = defineString('SPEECH_VOICE', { default: 'tw43HEeA0n5kOjSqCFT9' });
const SPEECH_MODEL = defineString('SPEECH_MODEL', { default: 'eleven_v3' });
/** Testers always have Plus. Comma separated emails. */
const TESTERS = defineString('PLUS_TESTERS', { default: '' });
/** The Plus monthly price from Stripe (price_...). Empty means Plus is not on sale yet. */
const PRICE = defineString('STRIPE_PRICE_ID', { default: '' });
const APP_URL = 'https://dealt-with-lrl.web.app';
const MODEL = 'claude-sonnet-5-5';
const OPTS = { region: 'europe-west2', maxInstances: 5, invoker: 'public' } as const;

async function verifyUser(token: string): Promise<string | undefined> {
  try {
    return (await getAuth().verifyIdToken(token)).uid;
  } catch {
    return undefined;
  }
}

async function whoFrom(header: string | undefined): Promise<{ uid: string; email?: string } | undefined> {
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return undefined;
  try {
    const t = await getAuth().verifyIdToken(token);
    return { uid: t.uid, ...(t.email ? { email: t.email } : {}) };
  } catch {
    return undefined;
  }
}

/** Plans live in plans/{uid}, which only this server writes. */
async function hasPlus(uid: string): Promise<boolean> {
  const plan = (await getFirestore().doc(`plans/${uid}`).get()).data() as (Plan & { tester?: boolean }) | undefined;
  if (plan?.active && !plan.tester) return true;
  return isTester((await getAuth().getUser(uid)).email, TESTERS.value());
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

function allow(origin: string | undefined, res: { setHeader: (k: string, v: string) => void }): boolean {
  if (!origin || !ORIGINS.value().split(',').includes(origin)) return false;
  res.setHeader('access-control-allow-origin', origin);
  res.setHeader('access-control-allow-headers', 'authorization, content-type');
  res.setHeader('access-control-allow-methods', 'POST, OPTIONS');
  res.setHeader('vary', 'origin');
  return true;
}

async function stripe(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${STRIPE_KEY.value()}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: stripeForm(params),
  });
  if (!r.ok) throw new Error(`stripe ${r.status}`);
  return (await r.json()) as Record<string, unknown>;
}

export const helper = onRequest({ ...OPTS, secrets: [MODEL_KEY], timeoutSeconds: 90 }, async (req, res) => {
  const response = await handleHelper(toRequest(req), {
    on: HELPER_ON.value(),
    origins: ORIGINS.value().split(','),
    verifyUser,
    hasPlus,
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

export const speak = onRequest({ ...OPTS, secrets: [SPEECH_KEY], timeoutSeconds: 60 }, async (req, res) => {
  const response = await handleSpeech(toRequest(req), {
    on: SPEECH_ON.value(),
    origins: ORIGINS.value().split(','),
    verifyUser,
    hasPlus,
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

/**
 * Called by the app after sign-in. Testers get a plan marked tester, so the app shows Plus without
 * a payment; a tester taken off the list loses it the next time this runs.
 */
export const plan = onRequest({ ...OPTS, timeoutSeconds: 30 }, async (req, res) => {
  const ok = allow(req.headers.origin, res);
  if (req.method === 'OPTIONS') return void res.status(ok ? 204 : 403).send('');
  if (req.method !== 'POST') return void res.status(405).send('');
  const who = await whoFrom(req.headers.authorization);
  if (!who) return void res.status(401).json({ text: 'Sign in first.' });
  const ref = getFirestore().doc(`plans/${who.uid}`);
  const current = (await ref.get()).data() as (Plan & { tester?: boolean }) | undefined;
  const tester = isTester(who.email, TESTERS.value());
  if (tester && !current?.active) await ref.set({ active: true, tester: true, updatedAt: Date.now() }, { merge: true });
  if (!tester && current?.tester) await ref.set({ active: false, tester: false, updatedAt: Date.now() }, { merge: true });
  res.json({ plus: tester || Boolean(current?.active && !current.tester) });
});

/** Starts a Stripe checkout for Plus and returns its page. The uid rides along so the webhook knows whose plan it is. */
export const checkout = onRequest({ ...OPTS, secrets: [STRIPE_KEY], timeoutSeconds: 30 }, async (req, res) => {
  const ok = allow(req.headers.origin, res);
  if (req.method === 'OPTIONS') return void res.status(ok ? 204 : 403).send('');
  if (req.method !== 'POST') return void res.status(405).send('');
  const who = await whoFrom(req.headers.authorization);
  if (!who) return void res.status(401).json({ text: 'Sign in first.' });
  if (!PRICE.value()) return void res.status(503).json({ text: 'Plus is not on sale yet.' });
  try {
    const plan = (await getFirestore().doc(`plans/${who.uid}`).get()).data() as Plan | undefined;
    const session = await stripe('checkout/sessions', {
      mode: 'subscription',
      'line_items[0][price]': PRICE.value(),
      'line_items[0][quantity]': '1',
      client_reference_id: who.uid,
      success_url: `${APP_URL}/me?plus=thanks`,
      cancel_url: `${APP_URL}/me`,
      ...(plan?.customer ? { customer: plan.customer } : who.email ? { customer_email: who.email } : {}),
    });
    res.json({ url: session['url'] });
  } catch {
    res.status(502).json({ text: 'The payment page did not open. Try again later.' });
  }
});

/** Opens Stripe's page where a person can change their card or cancel Plus. */
export const portal = onRequest({ ...OPTS, secrets: [STRIPE_KEY], timeoutSeconds: 30 }, async (req, res) => {
  const ok = allow(req.headers.origin, res);
  if (req.method === 'OPTIONS') return void res.status(ok ? 204 : 403).send('');
  if (req.method !== 'POST') return void res.status(405).send('');
  const who = await whoFrom(req.headers.authorization);
  if (!who) return void res.status(401).json({ text: 'Sign in first.' });
  const plan = (await getFirestore().doc(`plans/${who.uid}`).get()).data() as Plan | undefined;
  if (!plan?.customer) return void res.status(404).json({ text: 'There is no payment to manage.' });
  try {
    const session = await stripe('billing_portal/sessions', { customer: plan.customer, return_url: `${APP_URL}/me` });
    res.json({ url: session['url'] });
  } catch {
    res.status(502).json({ text: 'That page did not open. Try again later.' });
  }
});

/** Stripe tells us when Plus starts, changes or ends. Only signed events are used. */
export const stripeWebhook = onRequest({ ...OPTS, secrets: [STRIPE_HOOK], timeoutSeconds: 30 }, async (req, res) => {
  const raw = req.rawBody.toString('utf8');
  if (!verifyStripeSignature(raw, req.get('stripe-signature'), STRIPE_HOOK.value(), Math.floor(Date.now() / 1000))) return void res.status(400).send('');
  const change = planChange(JSON.parse(raw), Date.now());
  const db = getFirestore();
  if (change.kind === 'by-uid') await db.doc(`plans/${change.uid}`).set(change.plan, { merge: true });
  if (change.kind === 'by-subscription') {
    const found = await db.collection('plans').where('subscription', '==', change.subscription).get();
    await Promise.all(found.docs.map((d) => d.ref.set({ active: change.active, updatedAt: Date.now() }, { merge: true })));
  }
  res.status(200).send('');
});
