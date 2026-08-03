import type { APIRoute } from 'astro';
import { LOCALES, HREFLANGS, SECTIONS, DEFAULT_LOCALE, type Locale } from '~/i18n/config';
import { homePath, sectionPath, bookPath } from '~/i18n/paths';
import { ALL_BOOKS, coverFor } from '~/data/books';
import { useTranslations, interpolate } from '~/i18n/ui';
import type { PageRef } from '~/i18n/page-ref';

/**
 * Hand-rolled instead of @astrojs/sitemap so every URL carries its full set of
 * `xhtml:link` alternates — the part search engines actually use to group a
 * multilingual site — and so a record page can declare the cover it shows.
 *
 * No `lastmod`: nothing here records when a record changed, and one build
 * timestamp on every URL is a date about the deploy.
 */
const PAGES: PageRef[] = [
  { kind: 'home' },
  ...SECTIONS.map((section) => ({ kind: 'section', section }) as const),
  ...ALL_BOOKS.map((book) => ({ kind: 'book', slug: book.id }) as const),
];

function pathFor(locale: Locale, page: PageRef): string {
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
          `    <xhtml:link rel="alternate" hreflang="${HREFLANGS[alt]}" href="${escape(
            new URL(pathFor(alt, page), origin).href,
          )}" />`,
      ).join('\n');
      const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${escape(
        new URL(pathFor(DEFAULT_LOCALE, page), origin).href,
      )}" />`;
      const priority = page.kind === 'home' ? '1.0' : page.kind === 'section' ? '0.8' : '0.6';

      let image = '';
      if (page.kind === 'book') {
        const book = ALL_BOOKS.find((entry) => entry.id === page.slug);
        if (book) {
          const caption = interpolate(useTranslations(locale).book.coverAlt, {
            title: book.title,
            author: book.author,
          });
          const license = new URL(`${homePath(locale)}#cover-rights`, origin).href;
          image =
            '\n    <image:image>' +
            `\n      <image:loc>${escape(new URL(coverFor(book.id), origin).href)}</image:loc>` +
            `\n      <image:title>${escape(book.title)}</image:title>` +
            `\n      <image:caption>${escape(caption)}</image:caption>` +
            // The covers are publisher art, reproduced only for bibliographic
            // identification — not a work of this site's own. `image:license`
            // points at the footer note that says so, on every page.
            `\n      <image:license>${escape(license)}</image:license>` +
            '\n    </image:image>';
        }
      }

      return `  <url>\n    <loc>${escape(loc)}</loc>\n${alternates}\n${xDefault}${image}\n    <priority>${priority}</priority>\n  </url>`;
    }),
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.join('\n')}
</urlset>
`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
