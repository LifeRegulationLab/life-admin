import type { Item, Step } from '../model/types';
import type { PaceProgress } from './link';

/**
 * A step put into Pace, and its way back. Sent, added, finished in Pace and dealt with here are
 * four different things. Pace finishing a task never marks the step done here.
 */

/** What the person reads for each place a step can have got to in Pace. */
export const PACE_LINES: Record<PaceProgress, string> = {
  sent: 'Sent. Pace adds it to your to-do list the next time Pace is open. It is not in Pace yet.',
  added: 'Added to Pace. It is not finished there yet.',
  finished: 'Finished in Pace. It is not marked done here yet: press Done when it is.',
  declined: 'Pace did not add it.',
  gone: 'This was sent to Pace before, but it is no longer there. You can send it again.',
};

/** Shown when the server could not be asked. Nothing is claimed about Pace. */
export const PACE_NOT_CHECKED = 'This was sent to Pace. Where it has got to could not be checked just now.';

/** Shown when the step has an id kept but the send did not get through. */
export const PACE_NOT_SENT = 'This has not reached Pace yet. Send it again: it can only ever be added once.';

/** Before sending: the id is kept with the step and marked as not sent yet. */
export function keepForPace(item: Item, stepId: string, id: string, now = Date.now()): Item {
  return { ...item, steps: item.steps.map((s) => (s.id === stepId ? { ...s, paceHandover: id, paceUnsent: true } : s)), updatedAt: now };
}

/** After the server has taken it. */
export function sentToPace(item: Item, stepId: string, now = Date.now()): Item {
  return { ...item, steps: item.steps.map((s) => (s.id === stepId ? withoutUnsent(s) : s)), updatedAt: now };
}

/** Lets a step that Pace no longer has, or did not add, be sent again as a new task. */
export function clearPace(item: Item, stepId: string, now = Date.now()): Item {
  return {
    ...item,
    steps: item.steps.map((s) => {
      if (s.id !== stepId) return s;
      const rest = withoutUnsent(s);
      delete rest.paceHandover;
      return rest;
    }),
    updatedAt: now,
  };
}

function withoutUnsent(step: Step): Step {
  const rest = { ...step };
  delete rest.paceUnsent;
  return rest;
}

/** The address Pace opens to come back to a letter: dealtwith://item/<id>. Returns the page to show. */
export function pageFromLink(url: string): string | undefined {
  const m = /^dealtwith:\/\/item\/([A-Za-z0-9_-]{1,80})\/?$/.exec(url.trim());
  return m ? `/item/${m[1]}` : undefined;
}
