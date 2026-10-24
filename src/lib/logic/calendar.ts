import { APP_NAME } from '../brand';

/**
 * A calendar file (.ics) that any calendar app can open: Apple, Google, Outlook. Nothing is sent
 * to a calendar service; the person adds it themselves.
 */

export interface CalendarEvent {
  id: string;
  title: string;
  /** Start time. */
  at: number;
  /** Minutes. Zero means an all-day event on that date. */
  minutes: number;
  notes: string;
  /** Minutes before to remind. */
  alarm?: number;
}

function stamp(at: number): string {
  return new Date(at).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function day(at: number): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/** Text values in .ics need commas, semicolons, backslashes and new lines escaped. */
export function icsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Lines longer than 75 octets are folded, as the format asks. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

export function toIcs(events: readonly CalendarEvent[], now = Date.now()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//Life Regulation Lab//${APP_NAME}//EN`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.id}@dealtwith.liferegulationlab.com`, `DTSTAMP:${stamp(now)}`);
    if (e.minutes === 0) {
      const next = new Date(e.at);
      next.setDate(next.getDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${day(e.at)}`, `DTEND;VALUE=DATE:${day(next.getTime())}`);
    } else {
      lines.push(`DTSTART:${stamp(e.at)}`, `DTEND:${stamp(e.at + e.minutes * 60_000)}`);
    }
    lines.push(`SUMMARY:${icsText(e.title)}`);
    if (e.notes) lines.push(`DESCRIPTION:${icsText(e.notes)}`);
    if (e.alarm !== undefined) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(e.title)}`, `TRIGGER:-PT${Math.max(0, Math.round(e.alarm))}M`, 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
