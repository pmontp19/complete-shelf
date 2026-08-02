import type { APIRoute } from 'astro';
import { LOCALES, LOCALE_TAGS, SECTIONS, DEFAULT_LOCALE } from '~/i18n/config';
import { homePath, sectionPath, bookPath } from '~/i18n/paths';
import { ALL_BOOKS } from '~/data/books';
import type { PageRef } from '~/i18n/page-ref';

/**
 * Hand-rolled instead of @astrojs/sitemap so every URL carries its full set of
 * `xhtml:link` alternates — the part search engines actually use to group a
 * multilingual site.
 */
const PAGES: PageRef[] = [
  { kind: 'home' },
  ...SECTIONS.map((section) => ({ kind: 'section', section }) as const),
  ...ALL_BOOKS.map((book) => ({ kind: 'book', slug: book.id }) as const),
];

function pathFor(locale: (typeof LOCALES)[number], page: PageRef): string {
  switch (page.kind) {
    case 'home':
      return homePath(locale);
    case 'section':
      return sectionPath(locale, page.section);
    case 'book':
      return bookPath(locale, page.slug);
  }
}

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('https://example.com');

  const entries = PAGES.flatMap((page) =>
    LOCALES.map((locale) => {
      const loc = new URL(pathFor(locale, page), origin).href;
      const alternates = LOCALES.map(
        (alt) =>
          `    <xhtml:link rel="alternate" hreflang="${LOCALE_TAGS[alt]}" href="${escape(
            new URL(pathFor(alt, page), origin).href,
          )}" />`,
      ).join('\n');
      const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${escape(
        new URL(pathFor(DEFAULT_LOCALE, page), origin).href,
      )}" />`;
      const priority = page.kind === 'home' ? '1.0' : page.kind === 'section' ? '0.8' : '0.6';

      return `  <url>\n    <loc>${escape(loc)}</loc>\n${alternates}\n${xDefault}\n    <priority>${priority}</priority>\n  </url>`;
    }),
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
