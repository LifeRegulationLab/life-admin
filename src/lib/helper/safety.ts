/**
 * The helper's safety rules. The same checks run on the device, before anything is sent, and in
 * the server function, before the model sees a message and before a reply is shown.
 */

export const SUPPORT_TEXT =
  'It sounds like things are very hard right now. You do not have to deal with this on your own. ' +
  'If anyone is in danger, call 999. ' +
  'Samaritans are on 116 123, any time of the day or night, anywhere in the UK and Ireland. ' +
  'If money is the worry, National Debtline (0808 808 4000) and StepChange (0800 138 1111) give free, confidential help.';

export const CANNOT_ANSWER = 'The helper could not do that. Try again in a different way, or use the steps without it.';

/**
 * Words and phrases that mean the model is not called and the support line is shown instead.
 * A word list will sometimes catch a message that was not about crisis; that is the safer mistake.
 */
const DISTRESS = [
  /\bsuicid/,
  /\bkill(ing)? my ?self\b/,
  /\bend(ing)? (my|it) (life|all)\b/,
  /\bend it all\b/,
  /\b(want|wanted|wanting) to die\b/,
  /\bbetter off dead\b/,
  /\bbetter off without me\b/,
  /\bno (reason|point) (in )?(living|being alive|going on)\b/,
  /\bdon'?t want to (be alive|be here|live|wake up)\b/,
  /\bself[- ]?harm/,
  /\bhurt(ing)? my ?self\b/,
  /\bcut(ting)? my ?self\b/,
  /\boverdos/,
  /\btake all (my|the) (pills|tablets)\b/,
  /\bin danger\b/,
  /\bnot safe (at home|here)\b/,
  /\b(he|she|they)('s| is| are| has| have)? (hit|hurt|attacked|strangled|choked|threatened) me\b/,
];

function normalise(text: string): string {
  return text.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
}

/** True when a message should be met with the support line, not the model. */
export function distressCheck(text: string): boolean {
  const t = normalise(text);
  return DISTRESS.some((pattern) => pattern.test(t));
}

/** Replies that are never shown: asking for secret numbers, or claiming to be a professional. */
const NEVER_SHOW = [
  /\b(your|the) (pin|password|passcode|card number|security code|cvv|one[- ]time code)\b.*\b(send|give|tell|enter|share|type)\b/,
  /\b(send|give|tell|enter|share|type)\b.*\b(your|the) (pin|password|passcode|card number|security code|cvv|one[- ]time code)\b/,
  /\b(i am|i'm) (a|your) (solicitor|lawyer|barrister|financial adviser|debt adviser|accountant)\b/,
  /\b(guaranteed?|definitely) (to )?(win|succeed|be accepted|get it back)\b/,
];

export type ReplyCheck = { ok: true; text: string } | { ok: false };

/** Checks a reply from the model. A reply that breaks a rule is not shown; exclamation marks are taken out. */
export function checkReply(text: string): ReplyCheck {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false };
  // A warning such as "Never give your PIN to anyone" is good advice, so sentences that say not to are skipped.
  const t = normalise(trimmed).replace(/[^.?\n]*\b(never|do not|don't|must not|should not|shouldn't)\b[^.?\n]*[.?\n]?/g, ' ');
  if (NEVER_SHOW.some((pattern) => pattern.test(t))) return { ok: false };
  return { ok: true, text: trimmed.replace(/!+/g, '.').replace(/\.{2,}/g, '.') };
}

/** What happens to a message before it is sent. */
export type Gate = { send: true } | { send: false; reply: string; support: boolean };

export function gate(text: string): Gate {
  if (distressCheck(text)) return { send: false, reply: SUPPORT_TEXT, support: true };
  return { send: true };
}
