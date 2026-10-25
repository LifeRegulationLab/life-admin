# Dealt With

Read `README.md` first. Stack: Vite 6, React 19, TypeScript strict, React Router 7, Tailwind 4, Firebase (own project, London), Capacitor 8, pdf-lib, tesseract.js. `npm run check` must pass before saying anything is done.

- Life admin for one person: letters, emails, forms, bills, renewals, appointments and phone calls, dealt with one step per screen.
- Copy is British English, plain and short, no exclamation marks, no cheer or therapy tone, never "journey" or "steady". Easy-read text for every step.
- It explains and organises. It is never legal or financial advice, and it points to free advice (Citizens Advice, StepChange, National Debtline).
- This app has its own account in its own Firebase project. Deleting it must never touch any other Life Regulation Lab app.
- Photos stay on the device. The words read from them are what syncs.
- Every file the app produces names "Dealt With by Life Regulation Lab" and the person, nothing else. No tool or AI names in files, metadata or anything people see.
- The helper and read aloud are server functions in `functions/`. Keys stay there; a test checks the built app never carries them. The helper checks what the person types with `src/lib/helper/safety.ts` before any model is called (copy kept in `functions/src/safety.ts`; `npm --prefix functions run copy-safety`).
- Read aloud uses the recorded Alex Bennett voice with a calm, low direction. The phone's own voice is only used if the person switches it on.
- Never decompile other apps. Rival research uses public material only.
- Brand: the Life Regulation Lab teal shared with Pace, Regulate and Mull (pace `docs/DESIGN.md`), as tokens in `src/index.css`; Inter. The app name lives in `src/lib/brand.ts`.
