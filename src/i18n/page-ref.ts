import type { Section } from './config';

/**
 * Identifies the page being rendered, independently of locale, so the layout
 * can emit `hreflang` alternates and the switcher can keep the reader in place.
 *
 * Lives in its own module rather than in `BaseLayout.astro`: the Astro compiler
 * hoists frontmatter exports, and a multi-line exported union type there breaks
 * the esbuild pass.
 */
export type PageRef =
  | { kind: 'home' }
  | { kind: 'section'; section: Section }
  | { kind: 'book'; slug: string };
