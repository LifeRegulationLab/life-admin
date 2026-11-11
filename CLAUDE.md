# Dealt With

Read `README.md` first. Stack: Vite 6, React 19, TypeScript strict, React Router 7, Tailwind 4, the shared Life Regulation Lab server (Supabase, Zurich) for the account and records, Firebase Hosting for the website and the phone's Apple and Google sign-in sheets, Capacitor 8, pdf-lib, tesseract.js. `npm run check` must pass before saying anything is done.

- Life admin for one person: letters, emails, forms, bills, renewals, appointments and phone calls, dealt with one step per screen.
- Copy is British English, plain and short, no exclamation marks, no cheer or therapy tone, never "journey" or "steady". Easy-read text for every step.
- It explains and organises. It is never legal or financial advice, and it points to free advice (Citizens Advice, StepChange, National Debtline).
- Since 11 November 2026 the account is the shared Life Regulation Lab one (`docs/SHARED-SERVER.md`): the same sign-in as Regulate, Pace, Mull and Head Untangled, on the Supabase project `xgeacgbeiivcbrgdfpbf` (Zurich). Dealt With's records are in their own schema there, `dealt_with`, and no other app reads them. Deleting in Dealt With must never touch any other Life Regulation Lab app: it removes Dealt With's rows, and the sign-in itself goes only if no other app uses it. Pages reach the account only through `src/lib/account/`; a build without `VITE_SHARED_URL` still uses the app's own Firebase project.
- Photos stay on the device. The words read from them are what syncs.
- Every file the app produces names "Dealt With by Life Regulation Lab" and the person, nothing else. No tool or AI names in files, metadata or anything people see.
- The helper and read aloud are server functions: the tested code is in `functions/src/`, and the copies that run on the shared server are in `supabase/functions/` (`npm run copy-functions`; a test checks they match). Keys stay there; a test checks the built app never carries them. The helper checks what the person types with `src/lib/helper/safety.ts` before any model is called (copy kept in `functions/src/safety.ts`; `npm --prefix functions run copy-safety`).
- Read aloud uses the recorded Alex Bennett voice with a calm, low direction. The phone's own voice is only used if the person switches it on.
- Never decompile other apps. Rival research uses public material only.
- Brand: the Life Regulation Lab teal shared with Pace, Regulate and Mull (pace `docs/DESIGN.md`), as tokens in `src/index.css`; Inter. The app name lives in `src/lib/brand.ts`.
