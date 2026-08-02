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

/** BCP-47 tags for `lang` attributes, `hreflang` and `Intl` formatting. */
export const LOCALE_TAGS: Record<Locale, string> = {
  ca: 'ca-ES',
  es: 'es-ES',
  en: 'en-GB',
  de: 'de-DE',
  fr: 'fr-FR',
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
