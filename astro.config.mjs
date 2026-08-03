// @ts-check
import { defineConfig } from 'astro/config';

/**
 * Where the site will live. Defaults to the GitHub Pages project URL; override
 * both to publish on her own domain without touching any source file:
 *
 *   SITE_URL=https://judithraigal.com SITE_BASE=/ npm run build
 *
 * Every internal link, the sitemap, the canonicals and the hreflang alternates
 * are derived from these two, so nothing else needs changing.
 */

// Vercel serves the build at the domain root, so the GitHub Pages project
// sub-path would 404 every asset and link there. Detect it and drop the base.
// VERCEL, VERCEL_URL and VERCEL_PROJECT_PRODUCTION_URL are injected by Vercel.
const onVercel = process.env.VERCEL === '1';

const vercelUrl =
  process.env.VERCEL_PROJECT_PRODUCTION_URL ?? (onVercel ? process.env.VERCEL_URL : undefined);

const SITE_URL =
  process.env.SITE_URL ?? (vercelUrl ? `https://${vercelUrl}` : 'https://pmontp19.github.io');
const SITE_BASE = process.env.SITE_BASE ?? (onVercel ? '/' : '/complete-shelf');

export default defineConfig({
  site: SITE_URL,
  base: SITE_BASE,
  trailingSlash: 'always',
  output: 'static',
  build: {
    format: 'directory',
  },
  i18n: {
    defaultLocale: 'ca',
    locales: ['ca', 'es', 'en', 'de', 'fr'],
    routing: {
      prefixDefaultLocale: true,
      // Off, because Astro's own root redirect shadowed src/pages/index.astro
      // with a bare `<meta http-equiv="refresh" content="2;url=/ca/">` page —
      // two seconds of unstyled "Redirecting from / to /ca/" before anything
      // happened, and no language negotiation. Ours redirects immediately, and
      // on hosts that cannot redirect at the server (GitHub Pages) it is the
      // only chance to send a German visitor to /de/ rather than to /ca/.
      redirectToDefaultLocale: false,
    },
  },
  vite: {
    build: {
      // three.js is large; keep it in its own chunk so the rest of the site stays light.
      chunkSizeWarningLimit: 900,
    },
  },
});
