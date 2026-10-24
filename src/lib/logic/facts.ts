/**
 * Finds the facts in a letter's words on the device, with no helper: dates, amounts, reference
 * numbers, phone numbers and who it is from. Each fact keeps the words it came from, so the person
 * can see where it was found. A guess is always shown as a guess and can be changed.
 */

export interface Found<T> {
  value: T;
  /** The words in the letter. */
  quote: string;
}

export interface Facts {
  dates: Found<number>[];
  /** The date most likely to be the deadline: one beside "by", "before" or "reply". */
  deadline?: Found<number>;
  amounts: Found<string>[];
  references: Found<string>[];
  phones: Found<string>[];
  from?: string;
  scam: string[];
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

function monthIndex(word: string): number {
  const w = word.toLowerCase().slice(0, 3);
  return MONTHS.findIndex((m) => m.startsWith(w));
}

function lineAround(text: string, index: number, length: number): string {
  const start = text.lastIndexOf('\n', index) + 1;
  const endNl = text.indexOf('\n', index + length);
  const line = text.slice(start, endNl === -1 ? undefined : endNl).trim();
  return line.length > 160 ? text.slice(Math.max(0, index - 60), index + length + 60).trim() : line;
}

/** Midday local time, so a date never slips a day across time zones. */
function at(y: number, m: number, d: number): number | undefined {
  if (m < 0 || m > 11 || d < 1 || d > 31) return undefined;
  const date = new Date(y, m, d, 12, 0, 0, 0);
  return date.getMonth() === m ? date.getTime() : undefined;
}

export function findDates(text: string, today = new Date()): Found<number>[] {
  const out: Found<number>[] = [];
  const seen = new Set<number>();
  const push = (value: number | undefined, index: number, length: number) => {
    if (value === undefined || seen.has(value)) return;
    seen.add(value);
    out.push({ value, quote: lineAround(text, index, length) });
  };
  // 21 November 2026, 21st Nov 2026, 21 November
  const long = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\.?,?(?:\\s+(\\d{4}))?\\b`, 'gi');
  for (const m of text.matchAll(long)) {
    const day = Number(m[1]);
    const month = monthIndex(m[2] ?? '');
    let year = m[3] ? Number(m[3]) : today.getFullYear();
    if (!m[3] && at(year, month, day) !== undefined && (at(year, month, day) ?? 0) < today.getTime() - 60 * 864e5) year += 1;
    push(at(year, month, day), m.index, m[0].length);
  }
  // November 21, 2026
  const us = new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, 'gi');
  for (const m of text.matchAll(us)) push(at(Number(m[3]), monthIndex(m[1] ?? ''), Number(m[2])), m.index, m[0].length);
  // 21/11/2026, 21.11.26, 21-11-2026 (day first, as in the UK)
  for (const m of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/g)) {
    const y = Number(m[3]);
    push(at(y < 100 ? 2000 + y : y, Number(m[2]) - 1, Number(m[1])), m.index, m[0].length);
  }
  return out.sort((a, b) => a.value - b.value);
}

const DEADLINE_WORDS = /\b(by|before|no later than|deadline|reply|respond|return|due|must|within|until|expires?|pay)\b/i;

export function findDeadline(text: string, today = new Date()): Found<number> | undefined {
  const dates = findDates(text, today).filter((d) => d.value >= today.getTime() - 864e5);
  return dates.find((d) => DEADLINE_WORDS.test(d.quote)) ?? undefined;
}

export function findAmounts(text: string): Found<string>[] {
  const out: Found<string>[] = [];
  for (const m of text.matchAll(/£\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\b\d+(?:\.\d{2})?\s?(?:pounds|GBP)\b/gi)) {
    const value = m[0].replace(/\s/g, '');
    if (!out.some((o) => o.value === value)) out.push({ value, quote: lineAround(text, m.index, m[0].length) });
  }
  return out;
}

const REF_LABEL = /\b(reference|ref|account(?: number| no\.?)?|customer number|claim number|case number|policy number|our ref|your ref|national insurance number|NI number|tenancy reference|invoice number)\b[\s.:#-]*(?:is\s+)?/gi;

export function findReferences(text: string): Found<string>[] {
  const out: Found<string>[] = [];
  for (const m of text.matchAll(REF_LABEL)) {
    const rest = text.slice(m.index + m[0].length, m.index + m[0].length + 40);
    // Each part of a reference has a number in it, such as 6001 4482 7 or WH/20931; a National Insurance number ends in a letter.
    const value = /^((?:[A-Z]{1,3}[ ]?)?[A-Z0-9/-]*\d[A-Z0-9/-]*(?: [A-Z0-9/-]*\d[A-Z0-9/-]*)*(?: [A-D]\b)?)/i.exec(rest)?.[1]?.trim();
    if (!value || value.length < 3) continue;
    const clean = value.replace(/\s{2,}/g, ' ');
    if (!out.some((o) => o.value === clean)) out.push({ value: clean, quote: lineAround(text, m.index, m[0].length + clean.length) });
  }
  return out;
}

export function findPhones(text: string): Found<string>[] {
  const out: Found<string>[] = [];
  for (const m of text.matchAll(/(?:\+44\s?|\b0)(?:\d[\s-]?){9,10}\b/g)) {
    const value = m[0].trim().replace(/-/g, ' ').replace(/\s{2,}/g, ' ');
    const digits = value.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 12) continue;
    if (!out.some((o) => o.value.replace(/\D/g, '') === digits)) out.push({ value, quote: lineAround(text, m.index, m[0].length) });
  }
  return out;
}

/** The first line that looks like an organisation's name: the usual top line of a letter. */
export function findFrom(text: string): string | undefined {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6);
  return lines.find((l) => /[a-z]/i.test(l) && l.length <= 60 && !/^(dear|date|ref|to:|from:|subject)/i.test(l) && !/\d{3,}/.test(l));
}

/** Signs that a letter or message might be a scam. Shown as a warning, never as a verdict. */
const SCAM = [
  { re: /\b(gift ?cards?|itunes|google play cards?|steam cards?)\b/i, why: 'It asks for payment by gift card. Real organisations never do this.' },
  { re: /\b(bitcoin|crypto(currency)?|usdt)\b/i, why: 'It asks for payment in cryptocurrency.' },
  { re: /\b(arrest(ed)?|warrant|police will)\b.*\b(today|immediately|within 24 hours)\b/i, why: 'It threatens arrest straight away. Government bodies do not do this by letter or text.' },
  { re: /\b(tell|give|send|confirm|reply with|read out|share)\b[^.\n]{0,20}\b(pin|password|passcode|security code|one[- ]time code)\b/i, why: 'It asks for a PIN, password or code. Never give these to anyone.' },
  { re: /\b(transfer|move) (your |the )?(money|funds|savings) to a (safe|secure|new) account\b/i, why: 'It asks you to move money to a "safe account". This is always a scam.' },
  { re: /\b(you have won|claim your prize|lottery winner|unclaimed (prize|winnings))\b/i, why: 'It says you have won something you did not enter.' },
];

export function scamSigns(text: string): string[] {
  return SCAM.filter((s) => s.re.test(text)).map((s) => s.why);
}

export function readFacts(text: string, today = new Date()): Facts {
  const deadline = findDeadline(text, today);
  const from = findFrom(text);
  return {
    dates: findDates(text, today),
    ...(deadline ? { deadline } : {}),
    amounts: findAmounts(text),
    references: findReferences(text),
    phones: findPhones(text),
    ...(from ? { from } : {}),
    scam: scamSigns(text),
  };
}
