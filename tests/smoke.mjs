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

  // The language switcher must keep the reader on the same book. The selector is
  // also the regression test for `hreflang` turning back into `de-DE`.
  await page.locator('.langs a[hreflang="de"]').click();
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

// ----------------------------------------------------------------- seo ----
console.log('\n# seo');
{
  const text = async (path) => {
    const res = await fetch(`${BASE}/${path}`);
    if (!res.ok) fail(`${path} not served (${res.status})`);
    return res.ok ? res.text() : '';
  };

  const robots = await text('robots.txt');
  if (!/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m.test(robots)) fail('robots.txt has no absolute sitemap');
  else ok('robots.txt points at the sitemap');
  for (const agent of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
    if (!new RegExp(`^User-agent: ${agent}$`, 'm').test(robots)) fail(`robots.txt does not name ${agent}`);
  }
  if (/^Disallow: \/\s*$/m.test(robots)) fail('robots.txt disallows the whole site');
  else ok('robots.txt admits the answer engines');
  if (!robots.includes('llms.txt')) fail('robots.txt does not mention llms.txt');

  const llms = await text('llms.txt');
  if (!llms.startsWith('# Judith Raigal Aran')) fail('llms.txt does not open with an H1');
  const missingIsbn = books.filter((book) => !llms.includes(book.isbn));
  if (missingIsbn.length) fail(`llms.txt is missing ${missingIsbn.length} ISBN(s)`);
  else ok(`llms.txt lists all ${EXPECTED} records with their ISBNs`);
  if (!llms.includes('llms-full.txt')) fail('llms.txt does not link its full version');

  const full = await text('llms-full.txt');
  const missingTitle = books.filter((book) => !full.includes(book.title));
  if (missingTitle.length) fail(`llms-full.txt is missing ${missingTitle.length} title(s)`);
  else ok(`llms-full.txt carries all ${EXPECTED} records`);
  if (!/## Biography/.test(full) || !/## Contact/.test(full)) fail('llms-full.txt is missing a section');

  const sitemap = await text('sitemap.xml');
  const locs = [...sitemap.matchAll(/<loc>/g)].length;
  if (locs !== (EXPECTED + 4) * 5) fail(`sitemap has ${locs} URLs, expected ${(EXPECTED + 4) * 5}`);
  else ok(`sitemap lists ${locs} URLs`);
  const images = [...sitemap.matchAll(/<image:loc>/g)].length;
  if (images !== EXPECTED * 5) fail(`sitemap has ${images} cover images, expected ${EXPECTED * 5}`);
  else ok(`sitemap declares ${images} cover images`);
  if (/hreflang="[a-z]{2}-[A-Z]{2}"/.test(sitemap)) fail('sitemap uses region-locked hreflang tags');
  if (!/hreflang="x-default"/.test(sitemap)) fail('sitemap has no x-default');

  // --- the identifiers, in llms.txt and in the graph ---
  // These are the whole reason the file is worth fetching: without them a reader
  // has only a name to match on, and the name is ambiguous.
  for (const needle of ['0000-0002-0387-0867', 'R-7416-2018', 'dialnet', 'todostuslibros', 'openlibrary']) {
    if (!llms.toLowerCase().includes(needle.toLowerCase())) {
      fail(`llms.txt never mentions ${needle}`);
    }
  }
  // The variant Crossref uses on two of her publications; a bibliography search
  // that knows only the unhyphenated form comes back short.
  if (!llms.includes('Judith Raigal-Aran')) fail('llms.txt omits the hyphenated name variant');
  else ok('llms.txt carries the identifiers and both name forms');

  for (const section of ['## Records held elsewhere', '## Known disagreements']) {
    if (!llms.includes(section)) fail(`llms.txt has no "${section}" section`);
    if (!full.includes(section)) fail(`llms-full.txt has no "${section}" section`);
  }
  // `## Optional` is the one reserved heading in the llms.txt format — a client
  // on a budget skips it, which only works if nothing load-bearing follows.
  const headings = [...llms.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  if (headings.at(-1) !== 'Optional') {
    fail(`llms.txt: "## Optional" must come last, found "${headings.at(-1)}"`);
  } else ok(`llms.txt sections: ${headings.join(', ')}`);

  // --- the Markdown mirrors ---
  // The origin the artifact was *built* for is not the one it is served from, so
  // absolute links have to be rebased before they can be fetched. Filtering on
  // BASE instead would quietly match nothing and pass.
  const builtOrigin = new URL(robots.match(/^Sitemap:\s*(\S+)$/m)[1]).origin;
  const rebase = (url) => `${BASE}${new URL(url).pathname}`;

  const MIRRORS = [
    'ca/index.md',
    'ca/traduccions.md',
    'ca/biografia.md',
    'ca/contacte.md',
    'en/translations/la-casa-alemanya.md',
    'de/uebersetzungen/la-casa-alemanya.md',
  ];
  for (const path of MIRRORS) {
    const res = await fetch(`${BASE}/${path}`).catch(() => null);
    if (!res?.ok) {
      fail(`${path} not served (${res?.status ?? 'no response'})`);
      continue;
    }
    const body = await res.text();
    const type = res.headers.get('content-type') ?? '';
    // `.md` and a trailing slash are one typo apart in the route config, and the
    // wrong one silently serves the HTML page under a Markdown name.
    if (!/text\/markdown/.test(type)) fail(`${path} served as "${type}", expected text/markdown`);
    else if (/<html|<!doctype/i.test(body)) fail(`${path} returned HTML`);
    else if (!body.startsWith('---\n')) fail(`${path} has no front matter`);
    else ok(path);
  }

  {
    const home = await text('ca/index.md');
    const missing = books.filter((book) => !home.includes(book.isbn));
    if (missing.length) fail(`the home mirror omits ${missing.length} record(s)`);
    else ok(`home mirror carries all ${EXPECTED} records the shelf shows`);

    const record = await text('de/uebersetzungen/la-casa-alemanya.md');
    for (const needle of ['9788466424912', 'Deutsches Haus', 'Annette Hess', 'grup62.cat']) {
      if (!record.includes(needle)) fail(`book mirror missing "${needle}"`);
    }
    if (!record.includes(`translator_orcid: "0000-0002-0387-0867"`)) {
      fail('book mirror front matter has no translator ORCID');
    } else ok('book mirror carries the edition, its sources and the ORCID');

    const bio = await text('ca/biografia.md');
    if (!bio.includes('10.1075/btl.160.06pym')) fail('biography mirror resolves no DOIs');
    else ok('biography mirror cites DOIs');
  }

  // Every internal link in llms.txt must resolve: an index pointing at pages that
  // no longer exist is worse than no index.
  {
    const urls = [...new Set([...llms.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1]))];
    const internal = urls.filter((url) => url.startsWith(builtOrigin));
    if (internal.length < EXPECTED) {
      fail(`llms.txt yielded only ${internal.length} internal links, expected ${EXPECTED}+`);
    }
    const dead = [];
    for (const url of internal) {
      const res = await fetch(rebase(url)).catch(() => null);
      if (!res?.ok) dead.push(`${url} (${res?.status ?? 'no response'})`);
    }
    if (dead.length) fail(`llms.txt links to ${dead.length} dead URL(s): ${dead.join(', ')}`);
    else ok(`${internal.length} internal llms.txt links resolve`);
  }

  const PAGES = [
    ['ca/', 'home'],
    ['ca/traduccions/', 'works'],
    ['ca/biografia/', 'about'],
    ['ca/contacte/', 'contact'],
    ['ca/traduccions/la-casa-alemanya/', 'book'],
    ['de/uebersetzungen/la-casa-alemanya/', 'book (de)'],
  ];

  for (const [path, label] of PAGES) {
    const html = await text(path);
    const one = (re, what) => {
      const matches = [...html.matchAll(re)];
      if (matches.length !== 1) fail(`${label}: expected one ${what}, found ${matches.length}`);
      return matches[0]?.[1];
    };

    const canonical = one(/<link rel="canonical" href="([^"]+)"/g, 'canonical');
    if (canonical && !canonical.startsWith('http')) fail(`${label}: canonical is not absolute`);
    if (canonical && !canonical.endsWith(`/${path}`)) {
      fail(`${label}: canonical ${canonical} does not end in /${path}`);
    }

    const hreflangs = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)"/g)].map((m) => m[1]);
    const expected = ['ca', 'es', 'en', 'de', 'fr', 'x-default'];
    if (hreflangs.join(',') !== expected.join(',')) {
      fail(`${label}: hreflang set is ${hreflangs.join(',')}, expected ${expected.join(',')}`);
    }

    const robotsMeta = one(/<meta name="robots" content="([^"]+)"/g, 'robots meta');
    if (robotsMeta && !robotsMeta.includes('max-image-preview:large')) {
      fail(`${label}: robots meta does not allow a large image preview`);
    }

    const ogImage = one(/<meta property="og:image" content="([^"]+)"/g, 'og:image');
    if (ogImage && !ogImage.startsWith('http')) fail(`${label}: og:image is not absolute`);
    if (!/<meta property="og:image:width"/.test(html)) fail(`${label}: og:image has no dimensions`);
    if (!/<meta property="og:image:alt"/.test(html)) fail(`${label}: og:image has no alt text`);

    const description = one(/<meta name="description" content="([^"]*)"/g, 'description');
    if (!description) fail(`${label}: empty meta description`);

    const mirror = one(
      /<link rel="alternate" type="text\/markdown" href="([^"]+)"/g,
      'markdown alternate',
    );
    if (mirror && !mirror.endsWith('.md')) fail(`${label}: markdown alternate is not a .md URL`);
    if (mirror) {
      const res = await fetch(`${BASE}${new URL(mirror).pathname}`).catch(() => null);
      if (!res?.ok) fail(`${label}: the advertised markdown mirror 404s (${mirror})`);
    }
    if (!/<link rel="alternate" type="text\/plain"[^>]+llms\.txt"/.test(html)) {
      fail(`${label}: head does not point at llms.txt`);
    }

    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    if (blocks.length !== 1) {
      fail(`${label}: expected one JSON-LD block, found ${blocks.length}`);
      continue;
    }
    let graph;
    try {
      graph = JSON.parse(blocks[0][1])['@graph'];
    } catch (error) {
      fail(`${label}: JSON-LD does not parse (${error.message})`);
      continue;
    }
    if (!Array.isArray(graph)) {
      fail(`${label}: JSON-LD is not a @graph`);
      continue;
    }

    const byType = (type) =>
      graph.filter((node) => [].concat(node['@type'] ?? []).includes(type));
    const person = byType('Person')[0];
    if (!person?.['@id']?.endsWith('#person')) fail(`${label}: no Person with a stable @id`);
    if (!person?.sameAs?.some((href) => href.includes('orcid.org'))) {
      fail(`${label}: the Person node carries no ORCID`);
    }
    // Independent registries, so a consumer can check the identity against
    // something this site does not control.
    for (const host of ['dialnet.unirioja.es', 'todostuslibros.com', 'openlibrary.org']) {
      if (!person?.sameAs?.some((href) => href.includes(host))) {
        fail(`${label}: the Person node does not link ${host}`);
      }
    }
    const ids = [].concat(person?.identifier ?? []).map((entry) => entry.propertyID);
    if (!ids.includes('ORCID') || !ids.includes('ResearcherID')) {
      fail(`${label}: Person identifiers are ${ids.join(',') || 'absent'}`);
    }
    // The bare "Judith Raigal" belongs to more than one person; claiming it as
    // an alternate name invites the merge the variants exist to prevent.
    const names = [].concat(person?.alternateName ?? []);
    if (names.includes('Judith Raigal')) {
      fail(`${label}: Person claims the ambiguous bare name as an alternateName`);
    }
    if (!names.includes('Judith Raigal-Aran')) {
      fail(`${label}: Person omits the hyphenated form two publishers cite her under`);
    }
    if (byType('WebSite').length !== 1) fail(`${label}: expected exactly one WebSite node`);

    const pageNode = graph.find((node) => String(node['@id']).endsWith('#webpage'));
    if (!pageNode) fail(`${label}: no page node in the graph`);
    if (pageNode && pageNode.url !== canonical) {
      fail(`${label}: page node url ${pageNode.url} disagrees with the canonical`);
    }

    if (label.startsWith('book')) {
      const book = pageNode?.mainEntity;
      if (book?.['@type'] !== 'Book') fail(`${label}: the page is not about a Book`);
      if (book?.isbn !== '9788466424912') fail(`${label}: wrong or missing ISBN (${book?.isbn})`);
      if (!book?.translationOfWork?.name) fail(`${label}: Book does not name the work it translates`);
      const translators = [].concat(book?.translator ?? []);
      if (!translators.some((entry) => String(entry['@id']).endsWith('#person'))) {
        fail(`${label}: the translation is not linked to her`);
      }
      const crumbs = byType('BreadcrumbList')[0]?.itemListElement ?? [];
      if (crumbs.length !== 3) fail(`${label}: breadcrumb has ${crumbs.length} steps, expected 3`);
      if (!/<meta name="twitter:card" content="summary"/.test(html)) {
        fail(`${label}: a portrait cover should use the small card`);
      }
      ok(`${label}: Book, breadcrumb and cover card`);
    }

    if (label === 'works') {
      const list = pageNode?.mainEntity;
      if (list?.['@type'] !== 'ItemList') fail('works: the catalogue is not an ItemList');
      if (list?.itemListElement?.length !== EXPECTED) {
        fail(`works: ItemList holds ${list?.itemListElement?.length}, expected ${EXPECTED}`);
      } else ok(`works: ItemList of ${EXPECTED} editions`);
    }

    if (label === 'about') {
      if (!byType('ProfilePage').length) fail('about: not marked up as a ProfilePage');
      const works = graph.filter((node) => String(node['@id']).includes('#publication-'));
      if (works.length < 10) fail(`about: only ${works.length} publications in the graph`);
      else ok(`about: ${works.length} publications, authored by the site's Person`);

      const dois = works.filter((node) => node.sameAs?.includes?.('doi.org'));
      if (dois.length === 0) fail('about: no publication resolves through a DOI');
      else ok(`about: ${dois.length} publications carry a DOI`);

      // The external records belong on the page, not only in the markup: it is
      // the same answer to a reader asking "says who?" and to an answer engine
      // asking what to cite instead of this site.
      for (const host of ['dialnet.unirioja.es', 'todostuslibros.com', 'openlibrary.org', 'webofscience.com']) {
        if (!html.includes(host)) fail(`about: the page does not link ${host}`);
      }
      if (!/class="[^"]*\belsewhere\b[^"]*"/.test(html)) fail('about: no records-held-elsewhere section');
      else ok('about: the external records are visible to a reader');
    }

    if (label === 'contact') {
      const types = [].concat(pageNode?.['@type'] ?? []);
      if (!types.includes('FAQPage')) fail('contact: not marked up as an FAQPage');
      const questions = [].concat(pageNode?.mainEntity ?? []);
      if (questions.length < 5) fail(`contact: only ${questions.length} questions`);
      // The point of the markup is that it repeats the page.
      for (const question of questions) {
        const answer = question.acceptedAnswer?.text ?? '';
        if (!html.includes(answer.replace(/&/g, '&#38;'))) {
          fail(`contact: an answer in the markup is not on the page ("${answer.slice(0, 40)}…")`);
        }
      }
      ok(`contact: FAQPage with ${questions.length} questions, all of them visible`);
    }
  }
  ok('heads carry canonical, hreflang, robots and social metadata');
}

// ------------------------------------------------------------- routing ----
console.log('\n# routing');
for (const path of [
  'sitemap.xml',
  'robots.txt',
  'llms.txt',
  'llms-full.txt',
  '404.html',
  'og-default.png',
  'favicon.svg',
]) {
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
