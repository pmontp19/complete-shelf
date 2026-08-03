#!/usr/bin/env node
/**
 * End-to-end smoke test. Builds nothing: point it at a served copy of `dist`.
 *
 *   npm run build
 *   npx astro preview --port 4173 --host 127.0.0.1 &
 *   node tests/smoke.mjs
 *
 * Exits non-zero on the first category of failure so CI can gate on it.
 * Screenshots land in `tests/__screenshots__/` for eyeballing.
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';

const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:4173';
const SHOTS = new URL('./__screenshots__/', import.meta.url).pathname;
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const books = JSON.parse(new TextDecoder().decode(await readFile(new URL('../src/data/books.json', import.meta.url))));
const EXPECTED = books.length;

const failures = [];
const fail = (msg) => failures.push(msg);
const ok = (msg) => console.log(`  ok  ${msg}`);

await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

/** The volume the caption is currently describing, by title. */
const selection = (page) =>
  page.evaluate(() => document.querySelector('[data-caption-title]')?.textContent?.trim() ?? null);

// ---------------------------------------------------------------- shelf ----
console.log('\n# shelf (ca)');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleIssues = [];
  page.on('console', (m) => {
    // SwiftShader emits GPU performance notes that say nothing about the code.
    if (['error', 'warning'].includes(m.type()) && !/GL Driver Message/.test(m.text())) {
      consoleIssues.push(`${m.type()}: ${m.text()}`);
    }
  });
  page.on('pageerror', (e) => fail(`pageerror on /ca/: ${e.message}`));
  page.on('requestfailed', (r) => fail(`request failed: ${r.url()} (${r.failure()?.errorText})`));

  await page.goto(`${BASE}/ca/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('[data-shelf-root]')?.dataset.mounted === 'true', {
    timeout: 20_000,
  }).catch(() => fail('shelf never reported data-mounted="true"'));
  await page.waitForTimeout(1200);
  ok('mounted');

  const box = await page.locator('[data-shelf-canvas] canvas').boundingBox();
  if (!box || box.width < 400 || box.height < 250) fail(`canvas too small: ${JSON.stringify(box)}`);
  else ok(`canvas ${Math.round(box.width)}x${Math.round(box.height)}`);

  await page.screenshot({ path: `${SHOTS}shelf-desktop.png` });

  // Each input method must move the selection.
  const start = await selection(page);
  if (!start) fail('no caption rendered on load');

  await page.getByRole('button', { name: /següent/i }).click();
  await page.waitForTimeout(1200);
  const afterButton = await selection(page);
  if (afterButton === start) fail(`next button did not change selection (stuck on ${start})`);
  else ok(`next button: ${start} -> ${afterButton}`);

  await page.keyboard.press('Tab');
  await page.locator('[data-shelf-canvas]').click({ position: { x: 80, y: 120 } });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1200);
  const afterKey = await selection(page);
  if (afterKey === afterButton) fail(`ArrowRight did not change selection (stuck on ${afterButton})`);
  else ok(`ArrowRight: ${afterButton} -> ${afterKey}`);

  // Sideways trackpad swipes scrub the shelf; plain vertical scrolling must
  // stay with the page, so this is deltaX, not deltaY.
  const stageBox = await page.locator('.shelf__stage').boundingBox();
  await page.mouse.move(stageBox.x + stageBox.width / 2, stageBox.y + stageBox.height * 0.55);
  await page.mouse.wheel(400, 0);
  await page.waitForTimeout(1200);
  const afterWheel = await selection(page);
  if (afterWheel === afterKey) fail(`lateral wheel did not change selection (stuck on ${afterKey})`);
  else ok(`lateral wheel: ${afterKey} -> ${afterWheel}`);

  // ...and the page must still scroll when the pointer is over the shelf.
  const beforeScroll = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 320);
  await page.waitForTimeout(400);
  const afterScroll = await page.evaluate(() => window.scrollY);
  if (afterScroll <= beforeScroll) fail('vertical wheel over the shelf did not scroll the page');
  else ok(`vertical wheel scrolls the page (${beforeScroll} -> ${afterScroll})`);

  const captions = await page.locator('[data-shelf-caption]').count();
  if (captions !== 1) fail(`expected exactly 1 caption, saw ${captions}`);

  // The rail must agree with the caption about where the carriage is.
  const counter = await page.locator('[data-shelf-position]').textContent();
  if (!/^\d{2}$/.test(counter?.trim() ?? '')) fail(`counter did not render a position: "${counter}"`);
  else ok(`counter reads ${counter.trim()}`);

  if (consoleIssues.length) fail(`console noise on /ca/:\n    ${consoleIssues.join('\n    ')}`);
  else ok('console clean');

  await page.close();
}

// ------------------------------------------------------------ catalogue ----
console.log('\n# catalogue');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => fail(`pageerror on catalogue: ${e.message}`));
  await page.goto(`${BASE}/ca/traduccions/`, { waitUntil: 'networkidle' });

  const cards = await page.locator('.card').count();
  if (cards !== EXPECTED) fail(`expected ${EXPECTED} cards, got ${cards}`);
  else ok(`${cards} cards`);

  // Force every lazy image to load, then check none 404'd.
  await page.evaluate(async () => {
    for (const img of document.querySelectorAll('img')) img.loading = 'eager';
    await Promise.all(
      [...document.querySelectorAll('img')].map((img) =>
        img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }),
      ),
    );
  });
  const broken = await page.evaluate(() =>
    [...document.querySelectorAll('img')].filter((i) => i.naturalWidth === 0).map((i) => i.src),
  );
  if (broken.length) fail(`broken cover images: ${broken.join(', ')}`);
  else ok('all covers load');

  await page.getByRole('button', { name: 'alemany' }).click();
  await page.waitForTimeout(250);
  const german = await page.locator('.card:not([hidden])').count();
  if (german !== 1) fail(`German filter should leave 1 card, left ${german}`);
  else ok('language filter');

  await page.getByRole('button', { name: 'Totes' }).first().click();
  await page.waitForTimeout(250);
  if ((await page.locator('.card:not([hidden])').count()) !== EXPECTED) fail('reset filter did not restore all cards');
  else ok('filter reset');

  // The pointer is still resting on the chip it just clicked. `.chip:hover`
  // outspecifies `.chip--on`, so this is where the active label can go
  // invisible — same ink on ink.
  const hovered = await page.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    return { text: el.textContent?.trim(), color: cs.color, bg: cs.backgroundColor };
  });
  if (hovered.color === hovered.bg) {
    fail(`hovered active chip "${hovered.text}" is invisible: ${hovered.color} on ${hovered.bg}`);
  } else ok('active chip readable while hovered');

  await page.screenshot({ path: `${SHOTS}catalogue.png`, fullPage: false });
  await page.close();
}

// ----------------------------------------------------------- book pages ----
console.log('\n# book detail + i18n');
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => fail(`pageerror on detail: ${e.message}`));
  await page.goto(`${BASE}/ca/traduccions/la-casa-alemanya/`, { waitUntil: 'networkidle' });

  const details = await page.locator('.book__details').textContent();
  for (const needle of ['9788466424912', 'Annette Hess', 'Columna', '2019']) {
    if (!details.includes(needle)) fail(`detail page missing "${needle}"`);
  }
  ok('edition metadata present');

  if ((await page.locator('h1').count()) !== 1) fail('detail page does not have exactly one h1');
  else ok('single h1');

  // The language switcher must keep the reader on the same book.
  await page.locator('.langs a[hreflang="de-DE"]').click();
  await page.waitForLoadState('networkidle');
  if (!page.url().includes('/de/uebersetzungen/la-casa-alemanya/')) {
    fail(`language switch lost the page: ${page.url()}`);
  } else ok('switch ca -> de keeps the book');

  const htmlLang = await page.getAttribute('html', 'lang');
  if (htmlLang !== 'de-DE') fail(`expected lang="de-DE", got "${htmlLang}"`);
  else ok('html lang');

  await page.screenshot({ path: `${SHOTS}detail-de.png` });
  await page.close();
}

// ------------------------------------------------------- every locale ------
console.log('\n# locales');
for (const loc of ['ca', 'es', 'en', 'de', 'fr']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => fail(`pageerror on /${loc}/: ${e.message}`));
  await page.goto(`${BASE}/${loc}/`, { waitUntil: 'networkidle' });
  const mounted = await page
    .waitForFunction(() => document.querySelector('[data-shelf-root]')?.dataset.mounted === 'true', { timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  if (!mounted) fail(`/${loc}/ shelf did not mount`);
  else ok(`/${loc}/`);
  await page.close();
}

// ----------------------------------------------------------- responsive ----
console.log('\n# responsive');
for (const [name, viewport] of [
  ['320', { width: 320, height: 568 }],
  ['mobile', { width: 390, height: 844 }],
  ['tablet', { width: 768, height: 1024 }],
]) {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (e) => fail(`pageerror at ${name}: ${e.message}`));
  for (const path of ['ca/', 'ca/traduccions/', 'ca/traduccions/lapicultor-dalep/', 'ca/biografia/']) {
    await page.goto(`${BASE}/${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 1) fail(`horizontal overflow ${overflow}px at ${name} on /${path}`);
  }
  await page.goto(`${BASE}/ca/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}shelf-${name}.png` });
  ok(`${name} (${viewport.width}px) no overflow`);
  await page.close();
}

// -------------------------------------------------- graceful degradation ---
console.log('\n# degradation');
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/ca/`, { waitUntil: 'load' });
  const links = await page.locator('.fallback-grid a').count();
  if (!(await page.locator('[data-shelf-fallback]').isVisible()) || links !== EXPECTED) {
    fail(`no-JS fallback incomplete: visible=${await page.locator('[data-shelf-fallback]').isVisible()} links=${links}`);
  } else ok(`no-JS fallback lists all ${links} books`);
  await page.screenshot({ path: `${SHOTS}no-js.png` });
  await ctx.close();
}
{
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => fail(`pageerror under reduced motion: ${e.message}`));
  await page.goto(`${BASE}/ca/`, { waitUntil: 'networkidle' });
  const mounted = await page
    .waitForFunction(() => document.querySelector('[data-shelf-root]')?.dataset.mounted === 'true', { timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  if (!mounted) fail('shelf did not mount under prefers-reduced-motion');
  else ok('reduced motion');
  await page.screenshot({ path: `${SHOTS}reduced-motion.png` });
  await ctx.close();
}
{
  const ctx = await browser.newContext({ colorScheme: 'dark' });
  const page = await ctx.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${BASE}/ca/traduccions/`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${SHOTS}dark-catalogue.png` });
  ok('dark mode captured');
  await ctx.close();
}

// ------------------------------------------------------------- routing ----
console.log('\n# routing');
for (const path of ['sitemap.xml', 'robots.txt', '404.html', 'og-default.png', 'favicon.svg']) {
  const res = await fetch(`${BASE}/${path}`).catch(() => null);
  if (!res?.ok) fail(`${path} not served (${res?.status ?? 'no response'})`);
  else ok(path);
}

// The bare root. Astro will happily overwrite src/pages/index.astro with a bare
// two-second refresh of its own if `redirectToDefaultLocale` is ever switched
// back on, and nothing else here would notice: the page it replaces it with is
// still technically a redirect. In production Vercel answers `/` from
// vercel.json and this file is never reached, so `astro preview` — what this
// suite runs against — is the only place it can be checked.
{
  const res = await fetch(`${BASE}/`, { redirect: 'manual' }).catch(() => null);
  const html = (await res?.text().catch(() => '')) ?? '';
  const refresh = html.match(/http-equiv="refresh" content="(\d+)/i)?.[1];
  if (!res?.ok) fail(`/ not served (${res?.status ?? 'no response'})`);
  else if (refresh === undefined) fail('/ carries no meta refresh to a locale');
  else if (Number(refresh) > 0) fail(`/ waits ${refresh}s before redirecting`);
  else if (!/rel="canonical" href="https?:\/\//.test(html)) {
    fail('/ has no absolute canonical');
  } else if (
    !['ca', 'es', 'en', 'de', 'fr'].every((loc) =>
      html.includes(`href="${new URL(BASE).pathname.replace(/\/$/, '')}/${loc}/"`),
    )
  ) {
    fail('/ does not list every locale as a fallback link');
  } else ok('/ redirects immediately and lists all five locales');
}

await browser.close();

console.log(`\n${'='.repeat(60)}`);
if (failures.length) {
  console.log(`FAILED — ${failures.length} problem(s):\n`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
console.log('PASSED — all checks green.');
