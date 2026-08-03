import type { APIRoute } from 'astro';
import { LOCALES, ROUTES, SECTIONS, type Locale, type Section } from '~/i18n/config';
import { sectionMarkdown } from '~/lib/seo/markdown';

/**
 * `/{lang}/{section}.md`. A sibling of the `[section]/` directory rather than a
 * file inside it: this emits `/ca/traduccions.md` while the directory route emits
 * `/ca/traduccions/index.html`, so the two never collide.
 */
export function getStaticPaths() {
  return LOCALES.flatMap((lang) =>
    SECTIONS.map((section) => ({
      params: { lang, section: ROUTES[lang][section] },
      props: { section },
    })),
  );
}

export const GET: APIRoute = ({ params, props, site }) =>
  new Response(
    sectionMarkdown(
      (props as { section: Section }).section,
      params.lang as Locale,
      site ?? 'https://example.com/',
    ),
    { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } },
  );
