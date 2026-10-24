import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIST = join(__dirname, '../../dist/assets');

describe('the built app', () => {
  it.skipIf(!existsSync(DIST))('never carries a model or voice key or the services that need one', () => {
    for (const f of readdirSync(DIST).filter((x) => x.endsWith('.js'))) {
      const text = readFileSync(join(DIST, f), 'utf8');
      expect(text, f).not.toMatch(/api\.anthropic\.com|x-api-key|xi-api-key|api\.elevenlabs\.io|sk-ant-/);
    }
  });
});
