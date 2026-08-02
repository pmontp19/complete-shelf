import type { APIRoute } from 'astro';
import { assetPath } from '~/i18n/paths';

export const GET: APIRoute = ({ site }) => {
  // `site` is the bare origin; the sitemap lives under `base`, so build the
  // path with the same helper the rest of the site uses.
  const sitemap = new URL(assetPath('sitemap.xml'), site ?? 'https://example.com/').href;
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
