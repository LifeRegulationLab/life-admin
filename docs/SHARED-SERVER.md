# Moving Dealt With to the shared server

Stuart asked on 11 November 2026 for Dealt With to live where the other Life Regulation Lab apps
do, so that one sign-in serves them all and a letter can be handed to Pace and come back. Today
the app has its own Firebase project (`dealt-with-lrl`, London). The shared server is the Supabase
project `xgeacgbeiivcbrgdfpbf` (Zurich), which Mull, Pace, Head Untangled, Picture Talk and, since
11 November 2026, Regulate use.

Nothing about the live app changes until stage 4.

| Stage | What | State |
| --- | --- | --- |
| 1 | The `dealt_with` schema on the shared server (`supabase/0001_dealt_with.sql`); the synced store (`src/lib/store/synced.ts`) and its calls to the server (`src/lib/shared/remote.ts`) | Built and tested. Not used by the app yet. |
| 2 | Sign-in with the shared account: Apple, Google and an email code. The Dealt With pages that use `src/lib/firebase/account.ts` move to it | Not started |
| 3 | The helper, read aloud and Plus (checkout, portal, webhook) check the shared sign-in. Supporter links (`shares`) move | Not started |
| 4 | The switch: the build points at the shared server, records already in an account are carried across, a new phone build | Not started |
| 5 | A letter handed to Pace keeps its source, and comes back to be marked dealt with | Not started |

## What stage 1 is

- **Two tables**, `dealt_with.records` and `dealt_with.docs`, hold what the app syncs in the shape
  the screens already use: the four collections (`items`, `renewals`, `benefits`, `money`) and the
  one document (`settings`). Only the signed-in person can read or write their own rows. Photos
  never go there.
- **`SyncedBackend`** is the same `Backend` the screens already talk to. It keeps a copy on the
  device and a queue of changes, so the app works with no signal as it does on Firebase. A change
  not yet sent always wins over an older copy from the server.
- **`RestRemote`** makes the few web calls, in the `dealt_with` schema, signed as the person.
- `public.lrl_still_used` on the shared server counts Dealt With rows, so leaving another app
  never removes the sign-in of someone who uses Dealt With.

## What changes for the rules in `CLAUDE.md` at stage 4

"This app has its own account in its own Firebase project. Deleting it must never touch any other
Life Regulation Lab app." The second sentence stays true and is how the shared server already
works for the other apps: deleting in Dealt With removes Dealt With's rows, and the sign-in itself
goes only if no other app uses it. The first sentence changes: the account becomes the shared one.

## Still to decide before stage 4

- Whether records in existing Firebase accounts are carried across automatically at first sign-in,
  or only by "Move them into my account" from the device copy.
- Where the helper, read aloud and billing functions run (they can stay on Firebase Functions and
  check the shared sign-in, or move to the shared server's functions).
