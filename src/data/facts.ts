import { LOCALE_TAGS, type Locale } from '~/i18n/config';
import { useTranslations } from '~/i18n/ui';
import { ALL_BOOKS, type Category, type SourceLanguage, type TargetLanguage } from './books';
import { PROFILE } from './profile';

/**
 * Everything the site says about the collection *as a whole*, derived from the
 * bibliography rather than written down anywhere. The colophon on the home page,
 * the answers in the FAQ, `llms.txt` and the structured data all read from here,
 * so none of them can claim twenty-two volumes after the twenty-third is added.
 */
export interface CollectionFacts {
  count: number;
  firstYear: number;
  lastYear: number;
  /** `2019–2026`, or a single year while the bibliography has only one. */
  span: string;
  publishers: string[];
  sourceLanguages: SourceLanguage[];
  targetLanguages: TargetLanguage[];
  categories: Category[];
  /** Prose-ready lists in the reader's language: "anglès, alemany i francès". */
  sourceLanguageList: string;
  targetLanguageList: string;
  publisherList: string;
  genreList: string;
  location: string;
  email: string | null;
  workingLanguages: string;
}

/**
 * A conjunction list in the reader's own language, so an answer reads as a
 * sentence rather than as a row of separators. `Intl` knows that Catalan puts
 * "i" (and "e" before an i-sound) where English puts "and"; hard-coding a
 * separator per locale would not.
 */
export function listOf(locale: Locale, items: readonly string[]): string {
  return new Intl.ListFormat(LOCALE_TAGS[locale], {
    style: 'long',
    type: 'conjunction',
  }).format(items);
}

export function collectionFacts(locale: Locale): CollectionFacts {
  const t = useTranslations(locale);

  const years = ALL_BOOKS.map((book) => book.year);
  const firstYear = years.length > 0 ? Math.min(...years) : new Date().getUTCFullYear();
  const lastYear = years.length > 0 ? Math.max(...years) : firstYear;

  // Sorted by first appearance in the bibliography, which is newest first, so
  // the most recent work leads every list.
  const unique = <T>(values: T[]): T[] => [...new Set(values)];
  const sourceLanguages = unique(ALL_BOOKS.map((book) => book.originalLanguage));
  const targetLanguages = unique(ALL_BOOKS.map((book) => book.targetLanguage));
  const publishers = unique(ALL_BOOKS.map((book) => book.publisher));
  const categories = unique(ALL_BOOKS.map((book) => book.category));

  return {
    count: ALL_BOOKS.length,
    firstYear,
    lastYear,
    span: firstYear === lastYear ? String(firstYear) : `${firstYear}–${lastYear}`,
    publishers,
    sourceLanguages,
    targetLanguages,
    categories,
    sourceLanguageList: listOf(
      locale,
      sourceLanguages.map((code) => t.languages[code]),
    ),
    targetLanguageList: listOf(
      locale,
      targetLanguages.map((code) => t.languages[code]),
    ),
    publisherList: listOf(locale, publishers),
    // The genre labels are written for a table heading, so they are capitalised;
    // inside a sentence they should not be. Except in German, where the nouns
    // keep their capitals wherever they stand.
    genreList: listOf(
      locale,
      categories.map((code) =>
        locale === 'de' ? t.categories[code] : t.categories[code].toLocaleLowerCase(LOCALE_TAGS[locale]),
      ),
    ),
    location: PROFILE.location[locale],
    email: PROFILE.email,
    workingLanguages: PROFILE.workingLanguages[locale],
  };
}
