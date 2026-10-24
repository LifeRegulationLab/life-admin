import { KINDS, type Kind } from '../model/types';

/**
 * A link from another Life Regulation Lab app can start a new thing here with words filled in.
 * Nothing is saved until the person presses save, and nothing is read from the other app's account.
 *
 *   /add#kind=letter&title=Write%20to%20the%20clinic&text=...&from=regulate
 *
 * The words go after # so they stay in the browser: that part of a link is never sent to the
 * website's server or its logs. A ? link is read too, for a sender that cannot do that.
 * kind is optional: without it the person chooses, and the words come with them.
 */
export interface Incoming {
  kind?: Kind;
  title: string;
  text: string;
  /** Which app sent it, only to say so on the screen. */
  source?: 'regulate';
}

export const INCOMING_TITLE_MAX = 120;
export const INCOMING_TEXT_MAX = 4000;

const SOURCES = { regulate: 'Regulate' } as const;

const clean = (value: string | null, max: number) => (value ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);

/** Reads the part after # when there is one, otherwise the part after ?. */
export function readIncoming(search: string | URLSearchParams, hash = ''): Incoming {
  const fromHash = hash.replace(/^#/, '');
  const params = fromHash ? new URLSearchParams(fromHash) : typeof search === 'string' ? new URLSearchParams(search) : search;
  const kind = params.get('kind');
  const source = params.get('from');
  return {
    ...(kind && (KINDS as readonly string[]).includes(kind) ? { kind: kind as Kind } : {}),
    title: clean(params.get('title'), INCOMING_TITLE_MAX).replace(/\s+/g, ' '),
    text: clean(params.get('text'), INCOMING_TEXT_MAX),
    ...(source === 'regulate' ? { source } : {}),
  };
}

export const hasIncoming = (incoming: Incoming) => Boolean(incoming.title || incoming.text);

/** The part after # that carries the words on to the next screen, without the kind. */
export function incomingHash(incoming: Incoming): string {
  if (!hasIncoming(incoming)) return '';
  const params = new URLSearchParams();
  if (incoming.title) params.set('title', incoming.title);
  if (incoming.text) params.set('text', incoming.text);
  if (incoming.source) params.set('from', incoming.source);
  return `#${params.toString()}`;
}

export const sourceName = (incoming: Incoming) => (incoming.source ? SOURCES[incoming.source] : '');
