import { ROUTES, type Locale, type Section } from './config';
import type { PageRef } from './page-ref';

/**
 * Every internal href in the project goes through these helpers, so the locale
 * segments and the trailing slashes are decided in one place. `BASE_URL` is `/`
 * now that the GitHub Pages sub-path is gone, but it is still read rather than
 * assumed: Astro applies `base` to `Astro.url` and never to hand-written
 * strings, so hard-coding it here is how that breaks quietly.
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

/** Site root, `/`. Used by the language redirect page. */
export function rootPath(): string {
  return join();
}

/** Home page of a locale, e.g. `/ca/`. */
export function homePath(locale: Locale): string {
  return join(locale);
}

/** A localised section index, e.g. `/es/traducciones/`. */
export function sectionPath(locale: Locale, section: Section): string {
  return join(locale, ROUTES[locale][section]);
}

/** A book detail page, e.g. `/ca/traduccions/l-apicultor-d-alep/`. */
export function bookPath(locale: Locale, slug: string): string {
  return join(locale, ROUTES[locale].works, slug);
}

/** Path to a file in `public/`, e.g. `/covers/foo.webp`. */
export function assetPath(relative: string): string {
  return `${BASE}/${relative.replace(/^\/+/, '')}`.replace(/([^:])\/{2,}/g, '$1/');
}

/**
 * The plain-Markdown mirror of a page, e.g. `/ca/traduccions/anhel.md`.
 *
 * Built by hand rather than through `join()`, which appends a trailing slash.
 * These are files: a trailing slash would make Astro emit `anhel.md/index.html`,
 * an HTML page under a name that promises Markdown, which is worse than not
 * offering one at all.
 */
export function markdownPath(locale: Locale, page: PageRef): string {
  switch (page.kind) {
    case 'home':
      return `${BASE}/${locale}/index.md`;
    case 'section':
      return `${BASE}/${locale}/${ROUTES[locale][page.section]}.md`;
    case 'book':
      return `${BASE}/${locale}/${ROUTES[locale].works}/${page.slug}.md`;
  }
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
