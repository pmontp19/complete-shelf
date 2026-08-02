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
const SITE_URL = process.env.SITE_URL ?? 'https://pmontp19.github.io';
const SITE_BASE = process.env.SITE_BASE ?? '/complete-shelf';

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
      redirectToDefaultLocale: true,
    },
  },
  vite: {
    build: {
      // three.js is large; keep it in its own chunk so the rest of the site stays light.
      chunkSizeWarningLimit: 900,
    },
  },
});
