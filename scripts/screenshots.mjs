/* global process, console, URL, localStorage */
// The pictures of Dealt With for liferegulationlab.com, from an invented record on the device and
// no account. With no account the app keeps everything on the device; VITE_SHOWCASE leaves out the
// line asking for an account. Build, then:
//   VITE_SHOWCASE=true npx vite build --outDir /tmp/dealt-with-showcase --emptyOutDir
//   node scripts/screenshots.mjs /tmp/dealt-with-showcase <output folder>
// Needs Playwright installed globally (npm i -g playwright); it is not a project dependency.
// The record comes from scripts/showcase-data.ts; the clock is held at 10:20 on Tuesday
// 27 October 2026, London time. Each page is taken in dark and in light.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import http from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const require = createRequire(join(execSync('npm root -g').toString().trim(), 'x.js'));
const { chromium } = require('playwright');

const [base, out] = process.argv.slice(2);
if (!base || !out) {
  console.error('node scripts/screenshots.mjs <built folder> <output folder>');
  process.exit(1);
}
await mkdir(out, { recursive: true });
const { now, store, ids } = JSON.parse(execSync('npx vite-node scripts/showcase-data.ts').toString());

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  const file = extname(path) === '' ? 'index.html' : path.slice(1);
  try {
    const body = await readFile(join(base, file));
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(4320, resolve));

const SHOTS = [
  ['today', '/'],
  ['letter', `/item/${ids.letter}`],
  ['waiting', `/item/${ids.form}`],
  ['renewals', '/renewals'],
  ['all', '/all'],
  ['add', '/add'],
  ['me', '/me'],
];
const only = process.env.SHOTS?.split(' ');
const browser = await chromium.launch({ args: ['--lang=en-GB'] });
for (const scheme of ['dark', 'light']) {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    colorScheme: scheme,
    serviceWorkers: 'block',
  });
  await context.clock.setFixedTime(new Date(now));
  await context.addInitScript((entries) => {
    if (localStorage.getItem('showcase-ready')) return;
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem('showcase-ready', '1');
  }, store);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('page error', e.message));
  for (const [name, path] of SHOTS) {
    if (only && !only.includes(name)) continue;
    await page.goto(`http://localhost:4320${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(out, `${scheme}-${name}.png`), fullPage: process.env.FULL === '1' });
    console.log(scheme, name);
  }
  await context.close();
}
await browser.close();
server.close();
