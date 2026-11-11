/* global process */
// Copies the helper, read aloud and safety code into the shared server's functions
// (supabase/functions/). They run on Deno there, which needs the file ending on each import, so
// "./safety" becomes "./safety.ts". Nothing else changes. Run with "npm run copy-functions";
// src/test/functionsCopy.test.ts checks the copies match.
import { readFileSync, writeFileSync } from 'node:fs';

export const COPIES = [
  ['functions/src/helper.ts', 'supabase/functions/dealt-with-helper/helper.ts'],
  ['functions/src/safety.ts', 'supabase/functions/dealt-with-helper/safety.ts'],
  ['functions/src/speech.ts', 'supabase/functions/dealt-with-voice/speech.ts'],
];

export function forDeno(name, source) {
  return `// Copied from ${name} by "npm run copy-functions". Do not edit here; a test checks the two match.\n${source.replace(/from '(\.\/[^']+)';/g, "from '$1.ts';")}`;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  for (const [from, to] of COPIES) writeFileSync(to, forDeno(from, readFileSync(from, 'utf8')));
}
