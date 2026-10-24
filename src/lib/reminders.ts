import { LocalNotifications } from '@capacitor/local-notifications';
import { dueOf, DAY } from './logic/items';
import type { Item, Renewal } from './model/types';
import { inShell } from './shell';

/**
 * Reminders on the phone, set by the phone itself: nothing is sent from a server. Each open
 * thing with a date gets a reminder three days before and one on the day, at 9 in the morning.
 * Waiting things get one on their chase date. The web app shows the same dates on Today instead.
 */

export interface Reminder {
  id: number;
  at: number;
  title: string;
  body: string;
  itemId?: string;
}

function nine(at: number): number {
  const d = new Date(at);
  d.setHours(9, 0, 0, 0);
  return d.getTime();
}

/** A stable whole number for each reminder, as the phone asks for. */
export function reminderId(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

export function remindersFor(items: readonly Item[], renewals: readonly Renewal[], now = Date.now()): Reminder[] {
  const out: Reminder[] = [];
  const add = (key: string, at: number, title: string, body: string, itemId?: string) => {
    if (at > now) out.push({ id: reminderId(key), at, title, body, ...(itemId ? { itemId } : {}) });
  };
  for (const item of items) {
    if (item.status === 'done') continue;
    const name = item.title || 'Something to deal with';
    const due = dueOf(item);
    if (item.status === 'waiting' && item.waiting) {
      add(`${item.id}:chase`, nine(item.waiting.chaseAt), `Time to chase: ${name}`, `Has ${item.waiting.forWhat} come yet? If not, it may be time to chase.`, item.id);
      continue;
    }
    if (due !== undefined) {
      add(`${item.id}:soon`, nine(due - 3 * DAY), `Due in 3 days: ${name}`, 'Open it to see the next step.', item.id);
      add(`${item.id}:day`, nine(due), `Due today: ${name}`, 'Open it to see the next step.', item.id);
    }
  }
  for (const r of renewals) {
    if (r.itemId) continue;
    add(`${r.id}:renew`, nine(r.dueAt - r.daysBefore * DAY), `Coming up: ${r.title}`, `Due ${new Date(r.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.`);
  }
  return out.sort((a, b) => a.at - b.at).slice(0, 60);
}

let asked = false;

export async function scheduleReminders(items: readonly Item[], renewals: readonly Renewal[], on: boolean): Promise<void> {
  if (!inShell()) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    if (!on) return;
    const list = remindersFor(items, renewals);
    if (!list.length) return;
    if (!asked) {
      asked = true;
      const p = await LocalNotifications.checkPermissions();
      if (p.display !== 'granted') {
        const r = await LocalNotifications.requestPermissions();
        if (r.display !== 'granted') return;
      }
    }
    await LocalNotifications.schedule({
      notifications: list.map((r) => ({ id: r.id, title: r.title, body: r.body, schedule: { at: new Date(r.at) }, extra: r.itemId ? { itemId: r.itemId } : {} })),
    });
  } catch {
    // Reminders are a help, not a promise: Today still shows every date.
  }
}
