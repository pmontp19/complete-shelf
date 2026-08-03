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
