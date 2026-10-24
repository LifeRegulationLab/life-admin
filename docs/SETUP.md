# Setting up Dealt With's own Firebase project

Dealt With has its own project, so its accounts are separate from every other Life Regulation Lab app.

1. In the Firebase console, add a project called "Dealt With" (suggested id `dealt-with-lrl`). No Analytics.
2. Firestore: create the (default) database in `europe-west2` (London), production mode. Deploy the rules: `firebase deploy --only firestore`.
3. Authentication: turn on Email/Password with "Email link (passwordless sign-in)". Add the web app's domain to Authorised domains.
4. Add a web app called "Dealt With Web". Copy its settings into `.env.production` (they are public identifiers, not secrets).
5. Hosting: `npm run build` then `firebase deploy --only hosting`. Put the hosting address in `VITE_PUBLIC_URL`.

## The helper and read aloud (optional, needs the Blaze plan)

1. Switch the project to Blaze. Set a budget alert.
2. Set the secrets yourself (never paste keys in chat):
   - `firebase functions:secrets:set MODEL_API_KEY`
   - `firebase functions:secrets:set SPEECH_API_KEY`
3. In `functions/.env.<project id>` set `HELPER_ON=true`, `SPEECH_ON=true` and `APP_ORIGINS` to the hosting address plus `capacitor://localhost`.
4. `firebase deploy --only functions`. Put the two function addresses in `VITE_HELPER_URL` and `VITE_SPEECH_URL`, and set `VITE_HELPER_ON=true`.

Read aloud uses the Alex Bennett voice (`SPEECH_VOICE`, default `tw43HEeA0n5kOjSqCFT9`) with a calm, low direction. Each piece of text is recorded once per phone and kept there.

## Before the helper goes to anyone else

- Try it on the three test letters and ten real ones. Every quote must be in the letter; every date must match.
- Check the support line appears for the phrases in `src/lib/helper/safety.ts`.
- Check the free advice numbers on the Help page (see `docs/CHECKS.md`).
