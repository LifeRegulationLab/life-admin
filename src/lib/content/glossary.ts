/**
 * Words that often turn up in official letters, each explained in plain words. Explanations only,
 * never advice: where the real answer depends on the person, they point to free advice.
 */

export const GLOSSARY: Record<string, string> = {
  arrears: 'Money that should already have been paid and has not been. Arrears on rent or council tax are usually the first thing to sort, so speak to the sender or free debt advice.',
  'council tax': 'A yearly charge from the council for local services, usually paid in ten monthly parts.',
  'single person discount': 'A 25% cut in council tax when only one adult lives in the home.',
  liable: 'Responsible for paying it, in the eyes of the organisation that wrote.',
  liability: 'Who is responsible for paying, and how much.',
  'liability order': 'A court decision that lets the council collect unpaid council tax in other ways, such as from wages or benefits. Free debt advice can help.',
  reminder: 'A letter saying a payment or reply is late. It usually gives a new date.',
  'final notice': 'A last letter before the organisation takes a further step. Read what it says that step is.',
  summons: 'A letter telling you to go to court, or that the organisation is asking a court for something. Get free advice straight away.',
  'county court judgment': 'A court record that money is owed. Acting within the dates on the letter matters. Free debt advice can help.',
  ccj: 'Short for county court judgment: a court record that money is owed.',
  enforcement: 'Steps taken to collect money owed, such as using enforcement agents (bailiffs).',
  'enforcement agent': 'Another name for a bailiff: someone allowed to collect certain debts.',
  bailiff: 'Someone allowed to collect certain debts. Their powers depend on the debt. Free debt advice can explain them.',
  'direct debit': 'A payment that comes out of your bank account automatically, set up with your agreement.',
  'standing order': 'A regular payment you set up with your bank, for the same amount each time.',
  'payment plan': 'An agreement to pay what is owed in smaller parts over time.',
  instalment: 'One of the smaller parts a larger payment is split into.',
  instalments: 'The smaller parts a larger payment is split into.',
  'tenancy agreement': 'The written agreement between you and your landlord about renting your home.',
  'section 21': 'A notice from a landlord asking for the home back without giving a reason. Whether it is valid depends on the rules where you live; get free housing advice.',
  'section 8': 'A notice from a landlord giving a legal reason for wanting the home back. Get free housing advice.',
  'housing benefit': 'Help with rent from the council, for people on a low income.',
  'universal credit': 'A monthly payment to help with living costs, managed through an online journal.',
  'mandatory reconsideration': 'Asking the Department for Work and Pensions to look again at a decision. It usually has to be asked for within one month.',
  pip: 'Personal Independence Payment: money towards extra costs of a long-term health condition or disability.',
  'national insurance number': 'Your personal number for tax and benefits, two letters, six numbers and a letter, such as QQ 12 34 56 C.',
  hmrc: 'His Majesty’s Revenue and Customs, which collects tax.',
  dwp: 'The Department for Work and Pensions, which runs many benefits.',
  'self assessment': 'The way some people tell HMRC about their income each year, usually online.',
  'tax code': 'Letters and numbers that tell your employer or pension how much tax to take.',
  'penalty charge notice': 'A fine, usually for parking or driving in a bus lane. Paying early often costs less; challenging it is also allowed.',
  pcn: 'Short for penalty charge notice: a fine, usually for parking.',
  mot: 'The yearly check that a car over three years old is safe to drive.',
  'tv licence': 'What you need to watch live TV or use BBC iPlayer.',
  premium: 'The price of an insurance policy.',
  excess: 'The part of an insurance claim you pay yourself.',
  'renewal notice': 'A letter telling you a policy or contract is about to start again, often at a new price.',
  'no claims discount': 'A lower insurance price for years without a claim.',
  'without prejudice': 'Words that mean an offer cannot later be used against the person who made it. Get advice if a letter uses them.',
  'proof of address': 'A recent official letter or bill with your name and address on it.',
  'proof of identity': 'A document that shows who you are, such as a passport or driving licence.',
  'certificate of posting': 'A free receipt from the Post Office that shows you posted something on that day.',
  'recorded delivery': 'A postal service where someone signs for it when it arrives.',
  overpayment: 'Money paid to you that the organisation says you should not have had. You can ask them to explain how they worked it out.',
  'statement of account': 'A list of what has been charged and paid.',
  balance: 'What is owed now, or what is in an account.',
  'credit balance': 'Money the organisation owes you, for example from paying too much.',
  gp: 'Your family doctor at the local surgery.',
  'data protection': 'The rules about how organisations use your personal information.',
  'subject access request': 'Asking an organisation for a copy of the personal information it holds about you. It is free.',
};

export const TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);

/** Splits text into plain parts and known words, longest match first, ignoring case. */
export function markTerms(text: string): { text: string; term?: string }[] {
  if (!text) return [];
  const re = new RegExp(`\\b(${TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
  const out: { text: string; term?: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], term: m[0].toLowerCase() });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
