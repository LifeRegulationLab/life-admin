import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CodeSignIn, OWN_NOTE, SHARED_NOTE } from '../pages/SignIn';
import { OWN_ACCOUNT_NOTE, SHARED_ACCOUNT_NOTE, SHARED_DELETE_NOTE } from '../pages/Me';

// docs/SHARED-SERVER.md, stage 2: the shared Life Regulation Lab account.

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('sign-in with the shared account', () => {
  const html = renderToStaticMarkup(
    <CodeSignIn busy={false} onSocial={() => undefined} onSend={() => Promise.resolve(true)} onVerify={() => undefined} />,
  );

  it('offers Apple, Google and a code by email, and no password', () => {
    const buttons = [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);
    expect(buttons).toEqual(['Continue with Apple', 'Continue with Google', 'Send me a code']);
    expect(html).not.toMatch(/type="password"/);
    expect(html).not.toContain('Password');
    expect(html).not.toContain('!');
  });

  it('cannot ask for a code without an email address', () => {
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Send me a code<\/button>/);
  });

  it('says what the account is: one sign-in, and Dealt With keeps its own records', () => {
    expect(SHARED_NOTE).toContain('The same sign-in works in Regulate, Pace, Mull and Head Untangled.');
    expect(SHARED_NOTE).toContain('stays in Dealt With');
    expect(SHARED_ACCOUNT_NOTE).toContain('the other apps cannot read it');
    expect(SHARED_DELETE_NOTE).toContain('Your other Life Regulation Lab apps are not touched');
    expect(SHARED_DELETE_NOTE).toContain('your sign-in stays');
    // The words for this app's own account are still there for a build that uses it.
    expect(OWN_NOTE).toContain('for Dealt With only');
    expect(OWN_ACCOUNT_NOTE).toContain('for Dealt With only');
  });
});

describe('pages never reach a server directly', () => {
  it('only the account layer imports the Firebase or shared-server code', () => {
    const offenders = sources('src')
      .filter((p) => !/src\/lib\/(firebase|shared|account)\//.test(p))
      .filter((p) => /from '[./]+(lib\/)?(firebase|shared)\//.test(readFileSync(p, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
