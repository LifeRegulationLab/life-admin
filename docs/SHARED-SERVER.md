# Moving Dealt With to the shared server

Stuart asked on 11 November 2026 for Dealt With to live where the other Life Regulation Lab apps
do, so that one sign-in serves them all and a letter can be handed to Pace and come back. Today
the app has its own Firebase project (`dealt-with-lrl`, London). The shared server is the Supabase
project `xgeacgbeiivcbrgdfpbf` (Zurich), which Mull, Pace, Head Untangled, Picture Talk and, since
11 November 2026, Regulate use.

Nothing about the live app changes until stage 4.

| Stage | What | State |
| --- | --- | --- |
| 1 | The `dealt_with` schema (`supabase/0001_dealt_with.sql`); the synced store (`src/lib/store/synced.ts`) and its calls (`src/lib/shared/remote.ts`) | Built, tested, applied |
| 2 | The shared account: Apple, Google and an email code (`src/lib/shared/account.ts`); every page goes through `src/lib/account/`; supporter links, Plus and deleting (`supabase/0002_account.sql`) | Built, tested, applied. Not yet used on a phone |
| 3 | The helper and read aloud on the shared server (`supabase/functions/`), checking the shared sign-in and `dealt_with.plans` | Built. Deployed from the Mac with `scripts/deploy-shared.sh` |
| 4 | The switch: `.env.production` names the shared server | In this change. Live once the website is deployed and a phone build is made |
| 5 | A letter handed to Pace keeps its source, and comes back to be marked dealt with | Not started |

There were no accounts or records in the Firebase project to carry across (Stuart, 11 November
2026), so the shared account starts empty.

## Not moved yet

- **Payments.** Checkout, the portal and Stripe's webhook are still the Firebase functions and
  still check a Firebase sign-in, so they do not work with the shared account. Plus is not on sale
  (`VITE_CHECKOUT_URL` is empty), so nothing is lost today. Testers are given Plus by the owner:
  `select dealt_with.grant_tester_plus('person@example.com');`
- **The phone's Apple and Google sheets** still come from the Firebase plug-in, which only hands
  over the result. Apple needs `com.liferegulationlab.dealtwith` among the shared project's Apple
  client ids; Google needs this app's iPhone client id (in `GoogleService-Info.plist`) among its
  Google client ids.

## To put it live, on the Mac

```
zsh scripts/deploy-shared.sh
```

then a phone build. The shared project also needs `https://dealt-with-lrl.web.app/**` among its
sign-in return addresses and `dealt_with` among its exposed schemas.

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
