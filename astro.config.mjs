// @ts-check
import { defineConfig } from 'astro/config';

// Update `site` / `base` if the project moves to a custom domain.
export default defineConfig({
  site: 'https://pmontp19.github.io',
  base: '/complete-shelf',
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
