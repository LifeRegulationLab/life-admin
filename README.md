# Dealt With

Dealt With by Life Regulation Lab. Letters, emails, forms, bills, renewals, appointments and phone calls, dealt with one step at a time.

Author: Stuart Houlihan

## What it does

- **Today**: what needs doing, nearest date first. Things waiting for someone else's reply are kept apart, so they never look like more to do. They come back when it is time to chase.
- **Add**: choose what it is, then take a photo of each page, paste an email, or type. The words are read on the phone (no upload). Dates, amounts, references and phone numbers are found and shown with the words they came from. Signs of a scam are flagged.
- **One step per screen**: each kind of thing has its usual steps with help for each (plain and easy-read). Reply steps give a simple letter to start from; call steps give a script and the number. Send, pay and proof steps keep the date, the reference and a photo of the proof. Appointments go into the calendar.
- **Stop and come back**: "Stop here" asks where you got to and shows it when you return, on the same step.
- **Waiting for them**: after sending, it moves to Waiting with a chase date. "Their reply came" or "chase them now".
- **The record**: everything about one thing kept together, saved as a PDF with the pages and proof.
- **Pile of post**: photos of the front of each one first, no questions, then sort them one at a time.
- **Renewals**: MOT, car tax, insurance, TV Licence, passport and more. Each turns into something to deal with a set number of days before, then moves to the next date.
- **Someone to help**: hand one step to someone else by link (with an account) or by message. They see that step only, and the words only if you tick it. The link ends when the step is done.
- **Reminders**: three days before, on the day, and on the chase date, set by the phone itself. Calendar files for appointments and renewals.
- **Read aloud**: a calm recorded voice on every screen, or reading every screen as it opens.
- **Easy-read**, pictures, and larger text, in Me.
- **The helper** (off until switched on): explains a letter with quotes from it, suggests the steps, drafts replies and call scripts, answers a question about it.
- **Account**: optional, by emailed link. It belongs to this app only. Deleting it deletes only this app's records.

## Run it

```
npm install
npm --prefix functions install
npm run dev
npm run check   # types, lint, build, tests
```

With no `.env`, everything works on the device with no account. See `.env.example` for the switches and `docs/SETUP.md` for the Firebase project, the helper and read aloud.

## Where things are

- `src/lib/model/types.ts`: the records.
- `src/lib/content/`: kinds of thing and the steps with their help.
- `src/lib/logic/`: facts found in letters, what happens as a thing is dealt with, renewals, calendar files.
- `src/lib/papers/`: the record PDF.
- `src/lib/helper/`, `src/lib/speech.ts`: the helper and read aloud on the device; `functions/src/`: their server side.
- `src/pages/`, `src/components/`: the screens.
