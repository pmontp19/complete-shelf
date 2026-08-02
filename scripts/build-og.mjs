#!/usr/bin/env node
/**
 * Renders `public/og-default.png`, the social preview card: the five most
 * recent covers laid out like a shelf, over the site's paper background.
 * Run after `npm run covers`, since it composites the real cover files.
 */
import sharp from 'sharp';
import { readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const W = 1200;
const H = 630;

const escapeXml = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const books = JSON.parse(await readFile(resolve(root, 'src/data/books.json'), 'utf8'));
const featured = [...books].sort((a, b) => b.year - a.year).slice(0, 5);

const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#faf7f1" />
      <stop offset="100%" stop-color="#efe7db" />
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#paper)" />
  <rect x="0" y="${H - 8}" width="${W}" height="8" fill="#7a3b2e" />
  <text x="72" y="118" font-family="Georgia, 'Times New Roman', serif" font-size="60" font-weight="600" fill="#1e1a16">${escapeXml(
    'Judith Raigal Aran',
  )}</text>
  <text x="74" y="164" font-family="Helvetica, Arial, sans-serif" font-size="21" letter-spacing="4" fill="#8a7f72">${escapeXml(
    'TRADUCTORA LITERÀRIA',
  )}</text>
  <text x="74" y="206" font-family="Georgia, serif" font-size="24" fill="#4f463c">${escapeXml(
    "De l'anglès, l'alemany i el francès al català",
  )}</text>
</svg>`);

// Shelf geometry: five covers, slightly overlapping, sitting on a wooden rule.
const coverHeight = 300;
const gap = 24;
const composites = [];
let x = 74;

for (const book of featured) {
  const file = resolve(root, `public/covers/${book.id}.webp`);
  try {
    await access(file);
  } catch {
    console.warn(`skipping ${book.id}: no cover file yet`);
    continue;
  }
  const buffer = await sharp(file).resize({ height: coverHeight }).png().toBuffer();
  const { width } = await sharp(buffer).metadata();
  composites.push({ input: buffer, top: 262, left: x });
  x += (width ?? 200) + gap;
  if (x > W - 120) break;
}

const shelfRule = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="14"><rect width="${W}" height="14" rx="2" fill="#3f342a" opacity="0.9"/></svg>`,
);
composites.push({ input: shelfRule, top: 262 + coverHeight, left: 0 });

await sharp(background)
  .composite(composites)
  .png({ compressionLevel: 9 })
  .toFile(resolve(root, 'public/og-default.png'));

console.log(`Wrote public/og-default.png (${composites.length - 1} covers).`);
