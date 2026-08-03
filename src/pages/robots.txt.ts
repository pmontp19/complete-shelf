import type { APIRoute } from 'astro';
import { assetPath } from '~/i18n/paths';

/**
 * Everything is open, to everyone. This is a public bibliography whose whole
 * point is to be found — by a search engine, and just as much by an answer
 * engine asked who translated a given novel into Catalan.
 *
 * The named agents are therefore not restrictions but the opposite: two of them
 * (`Google-Extended`, `Applebot-Extended`) exist *only* as an opt-out, and any
 * crawler with no group of its own falls back to `*` regardless. Spelling them
 * out states the intent, so a later decision to shut one out is a visible edit to
 * this file rather than a silent inheritance nobody reviewed.
 */
const AI_AGENTS = [
  // OpenAI: training, live retrieval from a chat, and its search index.
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  // Anthropic.
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  // Google and Apple. Separate agents from Googlebot and Applebot, read only to
  // decide whether a page may be used in generative answers.
  'Google-Extended',
  'Applebot-Extended',
  // Perplexity, Meta, DuckDuckGo's assistant, Common Crawl — the corpus a great
  // many models are built from — and the rest of the field.
  'PerplexityBot',
  'Perplexity-User',
  'meta-externalagent',
  'DuckAssistBot',
  'CCBot',
  'Amazonbot',
  'MistralAI-User',
  'cohere-ai',
];

export const GET: APIRoute = ({ site }) => {
  // `site` is the bare origin; these files live under `base`, so build the paths
  // with the same helper the rest of the site uses.
  const url = (file: string) => new URL(assetPath(file), site ?? 'https://example.com/').href;

  const body = [
    'User-agent: *\nAllow: /\n',
    ...AI_AGENTS.map((agent) => `User-agent: ${agent}\nAllow: /\n`),
    `Sitemap: ${url('sitemap.xml')}\n`,
    // Not a robots.txt directive, so it goes in as a comment. The convention is
    // a well-known path, and this is where a crawler that looks for one looks.
    `# llms.txt: ${url('llms.txt')}\n# Full text: ${url('llms-full.txt')}\n`,
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
