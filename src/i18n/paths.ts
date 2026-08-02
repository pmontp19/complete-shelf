import { ROUTES, type Locale, type Section } from './config';

/**
 * Astro's `base` is applied by `Astro.url` but not by hand-written strings, so
 * every internal href in the project goes through these helpers.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

function join(...parts: string[]): string {
  const path = parts
    .filter((part) => part !== '')
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter((part) => part !== '')
    .join('/');
  return `${BASE}/${path}/`.replace(/\/{2,}/g, '/');
}

/** Site root, e.g. `/complete-shelf/`. Used by the language redirect page. */
export function rootPath(): string {
  return join();
}

/** Home page of a locale, e.g. `/complete-shelf/ca/`. */
export function homePath(locale: Locale): string {
  return join(locale);
}

/** A localised section index, e.g. `/complete-shelf/es/traducciones/`. */
export function sectionPath(locale: Locale, section: Section): string {
  return join(locale, ROUTES[locale][section]);
}

/** A book detail page, e.g. `/complete-shelf/ca/traduccions/l-apicultor-d-alep/`. */
export function bookPath(locale: Locale, slug: string): string {
  return join(locale, ROUTES[locale].works, slug);
}

/** Path to a file in `public/`, e.g. `/complete-shelf/covers/foo.webp`. */
export function assetPath(relative: string): string {
  return `${BASE}/${relative.replace(/^\/+/, '')}`.replace(/([^:])\/{2,}/g, '$1/');
}

/**
 * The equivalent of the current page in another locale, so the language
 * switcher never dumps the reader back on the home page.
 */
export function translatePath(
  target: Locale,
  page: { kind: 'home' } | { kind: 'section'; section: Section } | { kind: 'book'; slug: string },
): string {
  switch (page.kind) {
    case 'home':
      return homePath(target);
    case 'section':
      return sectionPath(target, page.section);
    case 'book':
      return bookPath(target, page.slug);
  }
}
