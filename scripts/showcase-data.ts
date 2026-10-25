// The invented record behind the pictures of Dealt With (scripts/screenshots.mjs). Printed as the
// device's local storage, built with the app's own rules so the items look as the app makes them.
// Everyone and everything here is made up; phone numbers are in the range set aside for fiction.
// Run: npx vite-node scripts/showcase-data.ts
import { addRecord, completeStep, itemFromRenewal, markDone, newItem, startWaiting } from '../src/lib/logic/items';
import { newRenewal, PRESETS } from '../src/lib/logic/renewals';
import { DEFAULT_SETTINGS, type Item, type Renewal } from '../src/lib/model/types';
import { DEVICE_PREFIX } from '../src/lib/store/StoreProvider';

/** Tuesday 27 October 2026, 10:20 in London: the clock the pictures are taken at. */
export const NOW = new Date(2026, 9, 27, 10, 20).getTime();
const DAY = 86_400_000;
const at = (days: number, h = 9, m = 0) => {
  const d = new Date(NOW + days * DAY);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};
const preset = (code: string) => {
  const found = PRESETS.find((p) => p.code === code);
  if (!found) throw new Error(`No renewal preset ${code}`);
  return found;
};
/** The first step's id, for marking it done. */
const firstStep = (item: Item) => item.steps[0]?.id ?? '';

const items: Item[] = [];
const renewals: Renewal[] = [];

// The council tax letter: understood, the first step done, the reply next.
let council = newItem(
  'letter',
  {
    title: 'Single person discount review',
    from: 'Brackenford Borough Council',
    reference: '6001 4482 7',
    status: 'working',
    dueAt: at(25),
    text: 'You currently receive a 25% single person discount on your Council Tax. Please confirm that you still live alone, and send us a copy of one document from the last three months that shows your name and address. Please reply by 21 November 2026.',
    understanding: {
      plain: 'The council checks every two years that you still live alone, so you can keep 25% off your Council Tax.',
      easy: 'The council wants to check you still live alone. If you do, you keep paying less Council Tax.',
      needs: 'yes',
      ask: 'Say you still live alone, and send a copy of a bank statement or a bill from the last three months.',
      dueAt: at(25),
      consequence: 'If they do not hear from you by 21 November, they may stop the discount and your bill would go up.',
      quotes: ['Please confirm that you still live alone', 'Please reply by 21 November 2026.'],
      by: 'me',
    },
  },
  at(-2, 18),
);
council = completeStep(council, firstStep(council), at(-1, 19));
council = { ...council, at: 1 };
items.push(council);

// A water bill to check and pay this week.
items.push(
  newItem('bill', { title: 'Water bill', from: 'Fernvale Water', reference: 'WB 220 418 7', dueAt: at(3), status: 'new' }, at(-4, 8)),
);

// The car insurance renewal, made from a renewal date.
const car = { ...newRenewal(preset('car-insurance'), at(9)), with: 'Northway Insurance' };
const carItem = itemFromRenewal(car, at(-19, 7));
items.push({ ...carItem, title: 'Car insurance', from: 'Northway Insurance', dueAt: at(9) });
renewals.push({ ...car, itemId: carItem.id });

// The dentist, booked for Thursday.
let dentist = newItem('appointment', { title: 'Check-up', from: 'Orchard Row Dental', dueAt: at(2, 14, 30), status: 'working' }, at(-12, 11));
dentist = completeStep(dentist, firstStep(dentist), at(-12, 11, 15));
dentist = { ...dentist, steps: dentist.steps.map((s) => (s.type === 'attend' ? { ...s, at: at(2, 14, 30) } : s)), at: 1 };
items.push(dentist);

// A phone call to make.
items.push(newItem('call', { title: 'Ask about a new bank card', from: 'Harbour Building Society', dueAt: at(6), status: 'new' }, at(-1, 16)));

// Waiting for a reply on a form that has gone off.
let form = newItem('form', { title: 'Parking permit renewal', from: 'Brackenford Borough Council', reference: 'PP-30418' }, at(-16, 10));
for (const s of form.steps.slice(0, 5)) form = completeStep(form, s.id, at(-12, 12));
form = addRecord(form, 'sent', 'Posted the form and a copy of the V5C', { ref: 'Proof of postage 7731 0042' }, at(-12, 12, 30));
form = startWaiting(form, 'The new permit', at(4), at(-12, 12, 40));
items.push(form);

// Dealt with this week and last.
let broadband = newItem('bill', { title: 'Broadband bill', from: 'Clearline', dueAt: at(-1) }, at(-6, 9));
broadband = markDone(broadband, 'Paid by card. Receipt kept.', at(-1, 9, 30));
items.push(broadband);
let tv = newItem('renewal', { title: 'TV Licence', from: 'TV Licensing' }, at(-9, 9));
tv = markDone(tv, 'Renewed online.', at(-5, 20));
items.push(tv);

// Dates coming round again.
renewals.push({ ...newRenewal(preset('mot'), at(41)), with: 'Hillside Garage' });
renewals.push({ ...newRenewal(preset('home-insurance'), at(52)), with: 'Northway Insurance' });
renewals.push({ ...newRenewal(preset('boiler'), at(70)) });
renewals.push({ ...newRenewal(preset('passport'), at(310)) });

const settings = { ...DEFAULT_SETTINGS, name: 'Jo Taylor', address: '14 Orchard Row, Brackenford BF4 7LP' };

const store: Record<string, unknown> = {
  [`${DEVICE_PREFIX}:items`]: items,
  [`${DEVICE_PREFIX}:renewals`]: renewals,
  [`${DEVICE_PREFIX}:doc:settings`]: settings,
};
console.log(JSON.stringify({ now: NOW, store, ids: { letter: council.id, form: form.id } }));
