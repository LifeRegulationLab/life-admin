import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error a plain script with no types
import { COPIES, forDeno } from '../../scripts/copy-functions.mjs';

// The shared server's functions run the same helper, read aloud and safety code as the Firebase
// ones. They are copies, so a change to one must be copied: "npm run copy-functions".

describe('the functions on the shared server', () => {
  it('are exact copies of the tested code, apart from the file endings Deno needs', () => {
    for (const [from, to] of COPIES as [string, string][]) {
      expect(readFileSync(to, 'utf8'), to).toBe(forDeno(from, readFileSync(from, 'utf8')));
    }
  });

  it('take their keys from the server only, and check the person and their plan themselves', () => {
    for (const name of ['dealt-with-helper', 'dealt-with-voice']) {
      const index = readFileSync(`supabase/functions/${name}/index.ts`, 'utf8');
      expect(index).toContain('admin.auth.getUser(token)');
      expect(index).toContain(".from('plans').select('active').eq('user_id', uid)");
      expect(index).not.toMatch(/sk-ant-|sk_live|sk_test|xi-api-key': '[^']/);
    }
  });
});
