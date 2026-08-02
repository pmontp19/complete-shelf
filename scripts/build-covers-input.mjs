#!/usr/bin/env node
/**
 * Derives `src/data/covers.json` (the input fetch-covers.mjs expects) from the
 * bibliography plus the map of publisher cover URLs. Keeping the two apart means
 * books.json stays a clean bibliographic record with no asset plumbing in it.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = async (relative) => JSON.parse(await readFile(resolve(root, relative), 'utf8'));

const books = await read('src/data/books.json');
const sources = await read('src/data/cover-sources.json');

const covers = books.map((book) => {
  const sourceUrl = sources[book.id];
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    publisher: book.publisher,
    isbn: book.isbn,
    ...(sourceUrl ? { sourceUrl } : {}),
  };
});

const missing = covers.filter((cover) => !cover.sourceUrl).map((cover) => cover.id);

await writeFile(
  resolve(root, 'src/data/covers.json'),
  `${JSON.stringify(covers, null, 2)}\n`,
  'utf8',
);

console.log(`Wrote src/data/covers.json with ${covers.length} entries.`);
if (missing.length > 0) {
  console.log(
    `${missing.length} without a publisher URL (will fall back to ISBN lookup): ${missing.join(', ')}`,
  );
}
