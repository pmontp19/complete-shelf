import type { Locale } from '~/i18n/config';
import { DEFAULT_LOCALE } from '~/i18n/config';
import { assetPath, bookPath } from '~/i18n/paths';
import rawBooks from './books.json';
import rawCoverMeta from './cover-meta.json';

export type Category = 'fiction' | 'nonfiction' | 'memoir' | 'ya' | 'cookbook' | 'other';
export type SourceLanguage = 'en' | 'de' | 'fr' | 'es';
export type TargetLanguage = 'ca' | 'es';

/** A row of the verified bibliography, exactly as stored in `books.json`. */
export interface BookRecord {
  id: string;
  title: string;
  originalTitle: string;
  author: string;
  originalLanguage: SourceLanguage;
  targetLanguage: TargetLanguage;
  publisher: string;
  year: number;
  isbn: string;
  pageCount?: number;
  /**
   * Real printed trim height in millimetres, filled in only where the
   * edition's own retailer listing (linked in `sources`) states it: checking
   * those pages shows Grup 62 binds almost its entire backlist at one
   * identical 230 x 150mm trim regardless of genre or extent, so 230 here is
   * a verified fact for most of these 22, not a rounded-off guess. Left unset
   * for an edition nobody has looked up yet; `computeBookDimensions` in
   * `geometry.ts` then falls back to a flat default height instead of
   * deriving one from a trim ratio, same as it always did.
   */
  trimHeightMm?: number;
  category: Category;
  coTranslators?: string[];
  /**
   * Title as it should be set on the 3D shelf's spine, for the volumes where
   * `spineTitleFor`'s rule would leave something unreadable or unhelpful.
   */
  spineTitle?: string;
  /** Same escape hatch for the author line: overrides `spineAuthorFor`'s rule. */
  spineAuthor?: string;
  /** Per-locale synopsis; missing locales fall back through `SYNOPSIS_FALLBACK`. */
  synopsis: Partial<Record<Locale, string>>;
  /** URLs that verify the translator credit. Rendered on the detail page. */
  sources: string[];
}

interface CoverMeta {
  id: string;
  spineColor: string;
  textColor: string;
  width: number;
  height: number;
  source: 'openlibrary' | 'googlebooks' | 'url' | 'local' | 'generated';
}

/** Neutral tones used when the cover pipeline has not run yet. */
const FALLBACK_COVER_META: Omit<CoverMeta, 'id'> = {
  spineColor: '#4a4038',
  textColor: '#f6f1e8',
  width: 800,
  height: 1200,
  source: 'generated',
};

const SYNOPSIS_FALLBACK: Locale[] = ['ca', 'es', 'en', 'fr', 'de'];

const books = rawBooks as BookRecord[];
const coverMeta = new Map<string, CoverMeta>(
  (rawCoverMeta as CoverMeta[]).map((entry) => [entry.id, entry]),
);

/** Newest first — the shelf and the catalogue both read in this order. */
export const ALL_BOOKS: BookRecord[] = [...books].sort(
  (a, b) => b.year - a.year || a.title.localeCompare(b.title, 'ca'),
);

export function getBook(id: string): BookRecord | undefined {
  return ALL_BOOKS.find((book) => book.id === id);
}

export function coverFor(id: string): string {
  return assetPath(`covers/${id}.webp`);
}

export function thumbFor(id: string): string {
  return assetPath(`covers/${id}-thumb.webp`);
}

export function paletteFor(id: string): { spineColor: string; textColor: string } {
  const meta = coverMeta.get(id) ?? FALLBACK_COVER_META;
  return { spineColor: meta.spineColor, textColor: meta.textColor };
}

/**
 * Real pixel dimensions of the stored cover. Covers are not all 2:3 — assuming
 * they were shifted the whole book page down once the image decoded.
 */
export function dimensionsFor(id: string): { width: number; height: number } {
  const meta = coverMeta.get(id) ?? FALLBACK_COVER_META;
  return { width: meta.width, height: meta.height };
}

/** A typical B-format novel jacket, used when a cover has no measured size at all. */
const DEFAULT_COVER_ASPECT = 1.5;
/**
 * A cover ratio outside this band did not come from a real trim: it came from
 * a scan that got cropped badly before it ever reached `cover-meta.json`. The
 * clamp keeps one bad crop from rendering as a volume shaped like a bookmark
 * or a tabloid, without touching the (many, legitimate) real ratios in between.
 */
const MIN_COVER_ASPECT = 1.2;
const MAX_COVER_ASPECT = 1.9;

/** The real cover's height / width, from the pixel dimensions of the actual scan. */
function coverAspectFor(id: string): number {
  const { width, height } = dimensionsFor(id);
  if (!width || !height) return DEFAULT_COVER_ASPECT;
  const aspect = height / width;
  return Math.min(MAX_COVER_ASPECT, Math.max(MIN_COVER_ASPECT, aspect));
}

/**
 * No two physical copies of the same edition stand exactly as tall as one
 * another: binding tolerance and cover warp put real, small copy-to-copy
 * variation into any print run. That is a property of a given copy, not a
 * fact about the edition, so it has no business in `books.json` (it would
 * misrepresent a verified `trimHeightMm` as more precise than it is, or worse,
 * invent one). It is generated here, at render-data time, seeded off the book
 * id so the same volume gets the same jitter on every reload rather than
 * flickering between builds. Bounded to +/-1.5mm: a real binding tolerance,
 * not a lever for chasing more shelf variety than the verified data supports.
 */
const BINDING_TOLERANCE_MM = 1.5;

/**
 * A guard on hand-maintained data, not a design lever: a stray typo in
 * `books.json` (2300 instead of 230, or a dropped minus sign) would otherwise
 * flow straight through as a world-space height. Real printed trims, from a
 * pocket paperback to an oversized art book, sit comfortably inside this
 * band, so nothing legitimate should ever hit the clamp.
 */
const MIN_TRIM_HEIGHT_MM = 100;
const MAX_TRIM_HEIGHT_MM = 400;

function bindingJitterMm(id: string): number {
  // FNV-1a: a small, dependency-free hash that is stable for a given id and
  // spreads similar ids (e.g. "furia" vs "furiosa") to unrelated outputs.
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Unsigned 32-bit -> [0, 1) -> [-1, 1) -> the tolerance band.
  const unit = (hash >>> 0) / 4294967296;
  return (unit * 2 - 1) * BINDING_TOLERANCE_MM;
}

/**
 * Picks the best available synopsis for a locale. Returning the original-market
 * text is far better than returning an empty paragraph.
 */
export function synopsisFor(book: BookRecord, locale: Locale): string {
  const exact = book.synopsis[locale];
  if (exact) return exact;
  for (const candidate of SYNOPSIS_FALLBACK) {
    const text = book.synopsis[candidate];
    if (text) return text;
  }
  return '';
}

/** True when the synopsis shown is not in the reader's language. */
export function synopsisIsFallback(book: BookRecord, locale: Locale): boolean {
  return !book.synopsis[locale] && synopsisFor(book, locale) !== '';
}

/**
 * The title cut down to what a spine can actually carry. A printed spine holds
 * one line of type a few dozen pixels tall, so it gets the volume's own name and
 * not the subtitle, the series line or the second novel bound in with the first:
 * everything after the first sentence break goes, as long as what is left still
 * names the book. `spineTitle` in the record overrides the rule where it can't
 * (a title that *is* one word, or one where the distinguishing half comes
 * second).
 */
export function spineTitleFor(book: BookRecord): string {
  if (book.spineTitle) return book.spineTitle;
  const head = book.title.split(/\.\s+|:\s+/)[0]?.trim() ?? '';
  return head.length >= 5 ? head : book.title;
}

/**
 * The author credit a spine has room for: surnames only, which is what a library
 * spine label carries and what tells three Tracy Wolff volumes from three
 * Carissa Broadbent ones at a glance. Names are split on the "i" that joins two
 * authors and on commas, and the last word of each is kept, so hyphenated
 * surnames come through whole ("Brooks-Dalton"). A Catalan double surname joined
 * by "i" would be read as two people; none of the 22 has one, and if one arrives
 * the record can carry a `spineAuthor` the way it can carry a `spineTitle`.
 */
export function spineAuthorFor(book: BookRecord): string {
  if (book.spineAuthor) return book.spineAuthor;
  return book.author
    .split(/\s+i\s+|\s*,\s*|\s*&\s*/)
    .map((name) => name.trim().split(/\s+/).at(-1) ?? '')
    .filter(Boolean)
    .join(' · ');
}

/** The shape the WebGL shelf consumes, already localised and base-prefixed. */
export function toShelfBooks(locale: Locale, labels: { languages: Record<string, string> }) {
  return ALL_BOOKS.map((book) => {
    const palette = paletteFor(book.id);
    return {
      id: book.id,
      title: book.title,
      spineTitle: spineTitleFor(book),
      spineAuthor: spineAuthorFor(book),
      originalTitle: book.originalTitle,
      author: book.author,
      publisher: book.publisher,
      year: book.year,
      isbn: book.isbn,
      sourceLanguage: labels.languages[book.originalLanguage] ?? book.originalLanguage,
      targetLanguage: labels.languages[book.targetLanguage] ?? book.targetLanguage,
      coverUrl: coverFor(book.id),
      spineUrl: null,
      spineColor: palette.spineColor,
      textColor: palette.textColor,
      pageCount: book.pageCount ?? 280,
      trimHeightMm:
        book.trimHeightMm === undefined
          ? undefined
          : Math.min(
              MAX_TRIM_HEIGHT_MM,
              Math.max(MIN_TRIM_HEIGHT_MM, book.trimHeightMm + bindingJitterMm(book.id)),
            ),
      aspect: coverAspectFor(book.id),
      href: bookPath(locale, book.id),
    };
  });
}

export function neighbours(id: string): { previous?: BookRecord; next?: BookRecord } {
  const index = ALL_BOOKS.findIndex((book) => book.id === id);
  if (index === -1) return {};
  return {
    previous: index > 0 ? ALL_BOOKS[index - 1] : undefined,
    next: index < ALL_BOOKS.length - 1 ? ALL_BOOKS[index + 1] : undefined,
  };
}

export const SOURCE_LANGUAGES: SourceLanguage[] = [
  ...new Set(ALL_BOOKS.map((book) => book.originalLanguage)),
].sort();

export const CATEGORIES: Category[] = [
  ...new Set(ALL_BOOKS.map((book) => book.category)),
].sort();

export { DEFAULT_LOCALE };
