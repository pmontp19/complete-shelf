import type { APIRoute } from 'astro';
import { LOCALES, ROUTES, type Locale } from '~/i18n/config';
import { ALL_BOOKS, type BookRecord } from '~/data/books';
import { bookMarkdown } from '~/lib/seo/markdown';

/**
 * `/{lang}/{works}/{slug}.md`. The same params as the `.astro` route beside it,
 * so the two stay in step: one record, two representations, and the HTML points
 * here with `rel="alternate"`.
 */
export function getStaticPaths() {
  return LOCALES.flatMap((lang) =>
    ALL_BOOKS.map((book) => ({
      params: { lang, section: ROUTES[lang].works, book: book.id },
      props: { book },
    })),
  );
}

export const GET: APIRoute = ({ params, props, site }) =>
  new Response(
    bookMarkdown(
      (props as { book: BookRecord }).book,
      params.lang as Locale,
      site ?? 'https://example.com/',
    ),
    { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } },
  );
