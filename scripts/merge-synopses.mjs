#!/usr/bin/env node
/**
 * Merges localised synopses into books.json. Takes one or more JSON files
 * shaped { "<book id>": { ca, es, en, de, fr } } and folds them in, leaving
 * every other field untouched. Rerunnable: later files win.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, 'src/data/books.json');
const inputs = process.argv.slice(2);
if (inputs.length === 0) {
  console.error('usage: node scripts/merge-synopses.mjs <synopses.json> [more.json ...]');
  process.exit(1);
}

const books = JSON.parse(await readFile(target, 'utf8'));
const merged = {};
for (const file of inputs) Object.assign(merged, JSON.parse(await readFile(file, 'utf8')));

const LOCALES = ['ca', 'es', 'en', 'de', 'fr'];
const ids = new Set(books.map((b) => b.id));
const unknown = Object.keys(merged).filter((id) => !ids.has(id));

let applied = 0;
for (const book of books) {
  const entry = merged[book.id];
  if (!entry) continue;
  book.synopsis = Object.fromEntries(
    LOCALES.filter((l) => typeof entry[l] === 'string' && entry[l].trim()).map((l) => [l, entry[l].trim()]),
  );
  applied += 1;
}

await writeFile(target, `${JSON.stringify(books, null, 2)}\n`, 'utf8');

const missing = books.filter((b) => Object.keys(b.synopsis).length === 0).map((b) => b.id);
const partial = books.filter((b) => {
  const n = Object.keys(b.synopsis).length;
  return n > 0 && n < LOCALES.length;
}).map((b) => b.id);

console.log(`Applied synopses to ${applied}/${books.length} books.`);
if (unknown.length) console.log(`Ignored ids not in books.json: ${unknown.join(', ')}`);
if (partial.length) console.log(`Incomplete (missing some locales): ${partial.join(', ')}`);
if (missing.length) console.log(`Still without any synopsis: ${missing.join(', ')}`);
