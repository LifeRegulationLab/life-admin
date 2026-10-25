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
- **From another app**: a link such as `/add#kind=letter&title=...&text=...&from=regulate` opens Add (the words go after #, so they never reach the server) with the words filled in and says where they came from. Nothing is saved until the person saves it, and no app reads another's account.
- **Pile of post**: photos of the front of each one first, no questions, then sort them one at a time.
- **Renewals**: MOT, car tax, insurance, TV Licence, passport and more. Each turns into something to deal with a set number of days before, then moves to the next date.
- **Someone to help**: hand one step to someone else by link (with an account) or by message. They see that step only, and the words only if you tick it. The link ends when the step is done.
- **Reminders**: three days before, on the day, and on the chase date, set by the phone itself. Calendar files for appointments and renewals.
- **Read aloud**: a calm recorded voice on every screen (Plus), or reading every screen as it opens. The phone's own voice only if the person switches it on.
- **Easy-read**, pictures, and larger text, in Me.
- **The helper** (Plus): explains a letter with quotes from it, suggests the steps, drafts replies and call scripts, answers a question about it.
- **Moss**: the face of the helper, shared with the other Life Regulation Lab apps. It shows what the app is doing (ready, working on it). In Me, the person can rename it, stop it moving, and optionally connect it to their Mull or Pace account with an email code so the name and movement match. Nothing from letters or the helper is sent, no account is made, and this app's own account is untouched.
- **Dealt With Plus**: a monthly plan through Stripe for the helper and the recorded voice. Everything else is free. Testers have it without paying.
- **Account**: email and password, or an emailed link. People can look around first; a line at the top asks them to make an account to keep what they add. It belongs to this app only. Deleting it deletes only this app's records.

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
- `src/lib/moss/`, `src/components/Moss.tsx`, `src/components/MossCard.tsx`: Moss's face, its settings and the optional link (only `moss_profiles` name and motion).
- `src/lib/helper/`, `src/lib/speech.ts`: the helper and read aloud on the device; `functions/src/`: their server side.
- `src/pages/`, `src/components/`: the screens.
