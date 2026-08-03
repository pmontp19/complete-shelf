import type { APIRoute } from 'astro';
import { LOCALES, type Locale } from '~/i18n/config';
import { homeMarkdown } from '~/lib/seo/markdown';

/**
 * `/{lang}/index.md`. Named `index.md.ts` rather than `index.ts` so Astro takes
 * `index.md` as the page name and writes a file, instead of folding it into the
 * directory the way it folds `index.astro` into `/{lang}/`.
 */
export function getStaticPaths() {
  return LOCALES.map((lang) => ({ params: { lang } }));
}

export const GET: APIRoute = ({ params, site }) =>
  new Response(homeMarkdown(params.lang as Locale, site ?? 'https://example.com/'), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
