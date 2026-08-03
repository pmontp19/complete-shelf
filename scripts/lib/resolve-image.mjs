// Resolves a source image buffer for a book entry, trying, in order:
// explicit sourceUrl -> Open Library -> Google Books. Returns
// { buffer, source } or null if nothing usable was found. Never throws for
// "no cover available" — only logs and moves on.

import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchBuffer, fetchText } from "./http.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const MIN_BYTES = 3000; // Open Library returns a tiny placeholder (often ~1x1px, ~40-100 bytes) when it has no cover.
const MIN_WIDTH = 200;

/** Sanity-check that a buffer really is a usable, reasonably sized image. */
async function isUsableImage(buffer) {
  if (!buffer || buffer.length < MIN_BYTES) return false;
  try {
    const meta = await sharp(buffer).metadata();
    if (!meta.width || meta.width < MIN_WIDTH) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * A `sourceUrl` that isn't an http(s) URL is read from disk, resolved against
 * the repository root. That is the escape hatch for the cases where the
 * publisher's own CDN serves something unusable — an angled 3D mock-up, say —
 * and the flat artwork has to be committed alongside the code instead.
 */
async function tryLocalFile(sourceUrl, log) {
  const relative = sourceUrl.replace(/^file:\/\//, "");
  const absolute = path.resolve(ROOT, relative);
  // Keep the override confined to the repo: a value from data should not be
  // able to reach into the wider filesystem.
  if (absolute !== ROOT && !absolute.startsWith(ROOT + path.sep)) {
    log(`  local sourceUrl "${sourceUrl}" resolves outside the repository — ignoring`);
    return null;
  }
  try {
    const buffer = await readFile(absolute);
    if (await isUsableImage(buffer)) {
      return { buffer, source: "local" };
    }
    log(`  local sourceUrl "${sourceUrl}" is not a usable image (${buffer.length} bytes)`);
  } catch (err) {
    log(`  local sourceUrl "${sourceUrl}" could not be read: ${err.message}`);
  }
  return null;
}

async function tryExplicitUrl(sourceUrl, log) {
  if (!sourceUrl) return null;
  if (!/^https?:\/\//i.test(sourceUrl)) return tryLocalFile(sourceUrl, log);
  try {
    const { status, buffer } = await fetchBuffer(sourceUrl);
    if (status >= 200 && status < 300 && (await isUsableImage(buffer))) {
      return { buffer, source: "url" };
    }
    log(`  sourceUrl fetch did not yield a usable image (status ${status}, ${buffer?.length ?? 0} bytes)`);
  } catch (err) {
    log(`  sourceUrl fetch failed: ${err.message}`);
  }
  return null;
}

async function tryOpenLibrary(isbn, log) {
  if (!isbn) return null;
  const url = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-L.jpg`;
  try {
    const { status, buffer } = await fetchBuffer(url);
    if (status >= 200 && status < 300 && (await isUsableImage(buffer))) {
      return { buffer, source: "openlibrary" };
    }
    log(`  Open Library had no usable cover for ISBN ${isbn} (status ${status}, ${buffer?.length ?? 0} bytes — likely their placeholder)`);
  } catch (err) {
    log(`  Open Library fetch failed: ${err.message}`);
  }
  return null;
}

function bestGoogleImageUrl(imageLinks) {
  if (!imageLinks) return null;
  const url = imageLinks.extraLarge || imageLinks.large || imageLinks.medium || imageLinks.thumbnail;
  if (!url) return null;
  // Google serves a curl-page overlay by default and caps raster size at zoom=1; ask for a bigger, clean image.
  return url.replace(/&edge=curl/g, "").replace(/zoom=1/g, "zoom=3");
}

async function tryGoogleBooks(isbn, log) {
  if (!isbn) return null;
  const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`;
  try {
    const { status, text } = await fetchText(apiUrl);
    if (status < 200 || status >= 300) {
      log(`  Google Books API returned status ${status}`);
      return null;
    }
    const data = JSON.parse(text);
    const imageLinks = data?.items?.[0]?.volumeInfo?.imageLinks;
    const imageUrl = bestGoogleImageUrl(imageLinks);
    if (!imageUrl) {
      log(`  Google Books had no imageLinks for ISBN ${isbn}`);
      return null;
    }
    const { status: imgStatus, buffer } = await fetchBuffer(imageUrl);
    if (imgStatus >= 200 && imgStatus < 300 && (await isUsableImage(buffer))) {
      return { buffer, source: "googlebooks" };
    }
    log(`  Google Books image fetch did not yield a usable image (status ${imgStatus}, ${buffer?.length ?? 0} bytes)`);
  } catch (err) {
    log(`  Google Books lookup failed: ${err.message}`);
  }
  return null;
}

/**
 * @param {{ sourceUrl?: string, isbn?: string }} entry
 * @param {(msg: string) => void} log
 * @returns {Promise<{ buffer: Buffer, source: 'url'|'local'|'openlibrary'|'googlebooks' } | null>}
 */
export async function resolveImage(entry, log = () => {}) {
  const fromUrl = await tryExplicitUrl(entry.sourceUrl, log);
  if (fromUrl) return fromUrl;

  const fromOpenLibrary = await tryOpenLibrary(entry.isbn, log);
  if (fromOpenLibrary) return fromOpenLibrary;

  const fromGoogleBooks = await tryGoogleBooks(entry.isbn, log);
  if (fromGoogleBooks) return fromGoogleBooks;

  return null;
}
