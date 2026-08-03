export const LOCALES = ['ca', 'es', 'en', 'de', 'fr'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ca';

export function isLocale(value: string | undefined): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Native names, used in the language switcher. Never translate these. */
export const LOCALE_NAMES: Record<Locale, string> = {
  ca: 'Català',
  es: 'Castellano',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
};

/** BCP-47 tags for `lang` attributes and `Intl` formatting. */
export const LOCALE_TAGS: Record<Locale, string> = {
  ca: 'ca-ES',
  es: 'es-ES',
  en: 'en-GB',
  de: 'de-DE',
  fr: 'fr-FR',
};

/**
 * Language-only tags, used for `hreflang` and nothing else.
 *
 * Deliberately not `LOCALE_TAGS`: `hreflang="en-GB"` claims the page is *for
 * the United Kingdom*, so a reader in Ireland or the United States matches
 * nothing and falls through to `x-default` — which here is Catalan. There is one
 * English version of this site and it is for every English speaker, so the
 * alternates say `en`. `LOCALE_TAGS` stays regional because `lang="en-GB"` is a
 * true statement about the prose (and drives hyphenation and quote marks), and
 * because `Intl` wants a region.
 */
export const HREFLANGS: Record<Locale, string> = {
  ca: 'ca',
  es: 'es',
  en: 'en',
  de: 'de',
  fr: 'fr',
};

/** Localised URL segments. Kept ASCII-safe so the paths never need escaping. */
export const ROUTES = {
  ca: { works: 'traduccions', about: 'biografia', contact: 'contacte' },
  es: { works: 'traducciones', about: 'biografia', contact: 'contacto' },
  en: { works: 'translations', about: 'biography', contact: 'contact' },
  de: { works: 'uebersetzungen', about: 'biografie', contact: 'kontakt' },
  fr: { works: 'traductions', about: 'biographie', contact: 'contact' },
} as const satisfies Record<Locale, Record<Section, string>>;

export type Section = 'works' | 'about' | 'contact';

export const SECTIONS: Section[] = ['works', 'about', 'contact'];

/** Reverse lookup: which section does this localised segment belong to? */
export function sectionFromSegment(locale: Locale, segment: string): Section | null {
  const table = ROUTES[locale];
  for (const section of SECTIONS) {
    if (table[section] === segment) return section;
  }
  return null;
}
