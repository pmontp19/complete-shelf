#!/usr/bin/env node
// Book-cover asset pipeline.
//
// Reads src/data/covers.json, resolves a real cover image for each book
// (explicit URL -> Open Library -> Google Books) or generates a
// typographic fallback cover when none can be found, writes 800px-wide
// WebP covers (+320px thumbnails) into public/covers/, and records
// per-cover metadata (spine colour, readable text colour, dimensions,
// which source won) into src/data/cover-meta.json.
//
// Usage:
//   node scripts/fetch-covers.mjs             # process everything, skip cached
//   node scripts/fetch-covers.mjs --force      # re-download/regenerate everything
//   node scripts/fetch-covers.mjs --only=some-id
//
// See scripts/README.md for the covers.json schema and full pipeline docs.

import sharp from "sharp";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveImage } from "./lib/resolve-image.mjs";
import { buildFallbackSvg } from "./lib/fallback-cover.mjs";
import { tameForSpine, readableTextColor, toHex } from "./lib/color.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const COVERS_JSON = path.join(ROOT, "src", "data", "covers.json");
const EXAMPLE_JSON = path.join(ROOT, "scripts", "covers.example.json");
const COVERS_DIR = path.join(ROOT, "public", "covers");
const META_JSON = path.join(ROOT, "src", "data", "cover-meta.json");

const COVER_WIDTH = 800;
const THUMB_WIDTH = 320;
const WEBP_QUALITY = 82;

const EXAMPLE_COVERS = [
  {
    id: "el-jardin-de-al-lado",
    title: "El jardín de al lado",
    author: "Jane Example",
    publisher: "Editorial Ejemplo",
    isbn: "9780000000000",
    sourceUrl: "",
  },
];

function parseArgs(argv) {
  const args = { force: false, only: null };
  for (const arg of argv) {
    if (arg === "--force") args.force = true;
    else if (arg.startsWith("--only=")) args.only = arg.slice("--only=".length);
  }
  return args;
}

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function loadCovers() {
  if (!(await fileExists(COVERS_JSON))) {
    await mkdir(path.dirname(EXAMPLE_JSON), { recursive: true });
    await writeFile(EXAMPLE_JSON, `${JSON.stringify(EXAMPLE_COVERS, null, 2)}\n`, "utf8");
    console.log(
      `No src/data/covers.json found yet — that's expected if the data hasn't been authored. ` +
        `Wrote an example schema to scripts/covers.example.json. Nothing else to do; exiting cleanly.`,
    );
    return null;
  }

  const raw = await readFile(COVERS_JSON, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`src/data/covers.json is not valid JSON: ${err.message}`);
  }
  if (!Array.isArray(data)) {
    throw new Error("src/data/covers.json must be a JSON array of book entries.");
  }
  return data;
}

async function loadExistingMeta() {
  if (!(await fileExists(META_JSON))) return {};
  try {
    const raw = await readFile(META_JSON, "utf8");
    const arr = JSON.parse(raw);
    const map = {};
    for (const item of arr) map[item.id] = item;
    return map;
  } catch {
    return {};
  }
}

/** Extract dominant colour + readable text colour + dimensions from a rasterised cover buffer. */
async function analyzeCover(buffer) {
  const image = sharp(buffer);
  const [metadata, stats] = await Promise.all([image.metadata(), image.stats()]);
  const [rCh, gCh, bCh] = stats.channels;
  const rawRgb = { r: rCh.mean, g: gCh.mean, b: bCh.mean };
  const spineRgb = tameForSpine(rawRgb);
  const spineColor = toHex(spineRgb);
  const textColor = readableTextColor(spineRgb);
  return {
    spineColor,
    textColor,
    width: metadata.width,
    height: metadata.height,
  };
}

async function writeCoverAndThumb(id, rasterBuffer) {
  const coverPath = path.join(COVERS_DIR, `${id}.webp`);
  const thumbPath = path.join(COVERS_DIR, `${id}-thumb.webp`);

  const coverBuffer = await sharp(rasterBuffer)
    .resize({ width: COVER_WIDTH, withoutEnlargement: false })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  const thumbBuffer = await sharp(rasterBuffer)
    .resize({ width: THUMB_WIDTH, withoutEnlargement: false })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  await mkdir(COVERS_DIR, { recursive: true });
  await writeFile(coverPath, coverBuffer);
  await writeFile(thumbPath, thumbBuffer);
  return coverBuffer;
}

async function processEntry(entry, { force, existingMetaById }, log) {
  const id = entry.id;
  const coverPath = path.join(COVERS_DIR, `${id}.webp`);
  const alreadyCached = !force && (await fileExists(coverPath));

  let source;
  let finalBuffer;

  if (alreadyCached) {
    log(`  cached (public/covers/${id}.webp already exists — pass --force to redo)`);
    finalBuffer = await readFile(coverPath);
    source = existingMetaById[id]?.source ?? "url";
  } else {
    const resolved = await resolveImage(entry, log);
    if (resolved) {
      finalBuffer = await writeCoverAndThumb(id, resolved.buffer);
      source = resolved.source;
      log(`  resolved cover via ${source}`);
    } else {
      const { svg } = buildFallbackSvg({
        id,
        title: entry.title,
        author: entry.author,
        publisher: entry.publisher,
      });
      const svgBuffer = Buffer.from(svg, "utf8");
      finalBuffer = await writeCoverAndThumb(id, svgBuffer);
      source = "generated";
      log(`  no real cover found — generated typographic fallback`);
    }
  }

  const analysis = await analyzeCover(finalBuffer);
  return { id, source, ...analysis };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const covers = await loadCovers();
  if (covers === null) {
    process.exitCode = 0;
    return;
  }

  const targets = args.only ? covers.filter((c) => c.id === args.only) : covers;
  if (args.only && targets.length === 0) {
    console.warn(`--only=${args.only} did not match any entry in covers.json.`);
  }

  const existingMetaById = await loadExistingMeta();
  const results = [];
  let hadInternalError = false;

  for (const entry of targets) {
    if (!entry?.id) {
      console.warn("Skipping an entry with no id:", JSON.stringify(entry));
      continue;
    }
    console.log(`\n${entry.id} — "${entry.title ?? "(untitled)"}"`);
    try {
      const result = await processEntry(entry, { force: args.force, existingMetaById }, (msg) => console.log(msg));
      results.push(result);
    } catch (err) {
      hadInternalError = true;
      console.error(`  INTERNAL ERROR processing ${entry.id}: ${err.stack || err.message}`);
    }
  }

  // Merge freshly-processed results into whatever metadata already existed
  // for entries we didn't touch this run (e.g. when using --only).
  const mergedById = { ...existingMetaById };
  for (const r of results) mergedById[r.id] = r;
  const knownIds = new Set(covers.map((c) => c.id));
  const merged = Object.values(mergedById).filter((m) => knownIds.has(m.id));
  merged.sort((a, b) => a.id.localeCompare(b.id));

  await mkdir(path.dirname(META_JSON), { recursive: true });
  await writeFile(META_JSON, `${JSON.stringify(merged, null, 2)}\n`, "utf8");

  console.log("\n=== Cover pipeline summary ===");
  const rows = merged.map((m) => ({
    id: m.id,
    source: m.source,
    spineColor: m.spineColor,
    size: `${m.width}x${m.height}`,
  }));
  const idWidth = Math.max(2, ...rows.map((r) => r.id.length));
  const sourceWidth = Math.max(6, ...rows.map((r) => r.source.length));
  for (const r of rows) {
    console.log(
      `  ${r.id.padEnd(idWidth)}  ${r.source.padEnd(sourceWidth)}  ${r.spineColor}  ${r.size}`,
    );
  }
  console.log(`\nWrote ${merged.length} cover metadata entries to src/data/cover-meta.json`);

  if (hadInternalError) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Fatal error running the cover pipeline:", err.stack || err.message);
  process.exitCode = 1;
});
