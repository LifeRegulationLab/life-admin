import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KIND_INFO } from '../lib/content/kinds';
import { CHASE_STEP, EXTRA_STEPS, TEMPLATES } from '../lib/content/steps';
import { KINDS } from '../lib/model/types';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const SRC = join(__dirname, '..');

describe('the words in the app', () => {
  it('gives every step help in plain and easy-read words', () => {
    for (const k of KINDS) {
      expect(KIND_INFO[k].name).toBeTruthy();
      for (const t of TEMPLATES[k]) {
        expect(t.help.length).toBeGreaterThan(20);
        expect(t.easyHelp.length).toBeGreaterThan(5);
        expect(t.easyHelp.length).toBeLessThan(t.help.length);
      }
    }
    expect(EXTRA_STEPS.length).toBeGreaterThan(5);
    expect(CHASE_STEP.help).toBeTruthy();
  });

  it('has no exclamation marks, cheer or journeys, and uses British spelling', () => {
    const app = files(SRC).filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(`${join('src', 'test')}`));
    for (const f of app) {
      const text = readFileSync(f, 'utf8');
      // Strings only: quoted text and JSX text between tags.
      const words = [...text.matchAll(/'([^'\n]{12,})'|>([^<>{}\n]{12,})</g)].map((m) => m[1] ?? m[2] ?? '').join('\n');
      expect(words, f).not.toMatch(/[a-z]!(\s|$)/i);
      expect(words, f).not.toMatch(/\bjourney|\bsteady\b|\byou'?ve got this\b|\bawesome\b|\bcolor\b|\borganiz|\brecogniz|\bcenter\b/i);
    }
  });

  it('never names a tool or model in what people see', () => {
    for (const f of files(join(SRC, 'pages')).concat(files(join(SRC, 'components')))) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/claude|anthropic|openai|elevenlabs|tesseract|\bGPT\b/i);
    }
  });
});
