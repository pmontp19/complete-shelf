// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

/**
 * Where the site will live. Vercel injects its own domain, so nothing needs
 * setting there; override it to build for anywhere else:
 *
 *   SITE_URL=https://judithraigal.com npm run build
 *
 * Every internal link, the sitemap, the canonicals and the hreflang alternates
 * are derived from this, so nothing else needs changing.
 *
 * VERCEL_PROJECT_PRODUCTION_URL is the production domain and is injected into
 * preview builds too, which is what we want: a preview should not publish
 * canonicals pointing at itself. VERCEL_URL is the per-deployment host, used
 * only if the project has no production domain yet.
 */
const SITE_URL =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : // Local builds. Obvious in the output if it ever escapes into a deploy,
        // which is the point: a wrong-but-plausible domain would not be.
        'http://localhost:4321');

export default defineConfig({
  site: SITE_URL,
  // No `base`: the site is served from the root of its domain. It used to carry
  // the /complete-shelf/ sub-path for GitHub Pages, which is gone.
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
      // happened. Vercel answers `/` itself (see vercel.json); that file is the
      // fallback for anything serving the artifact without those rules, local
      // `astro preview` included.
      redirectToDefaultLocale: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // three.js is large; keep it in its own chunk so the rest of the site stays light.
      chunkSizeWarningLimit: 900,
    },
  },
});
