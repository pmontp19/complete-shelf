import type { APIRoute } from 'astro';
import { assetPath } from '~/i18n/paths';

/**
 * Everything is open, to everyone: this is a public bibliography whose point is
 * to be found. The named agents are not restrictions but the opposite — two of
 * them exist only as an opt-out, and any crawler without a group falls back to
 * `*` anyway, so a later decision to shut one out is a visible edit here.
 */
const AI_AGENTS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'Google-Extended',
  'Applebot-Extended',
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
  // `site` is the bare origin; these files live under `base`.
  const url = (file: string) => new URL(assetPath(file), site ?? 'https://example.com/').href;

  const body = [
    'User-agent: *\nAllow: /\n',
    ...AI_AGENTS.map((agent) => `User-agent: ${agent}\nAllow: /\n`),
    `Sitemap: ${url('sitemap.xml')}\n`,
    // Not a directive, so it goes in as a comment — but this is where a crawler
    // looking for llms.txt looks.
    `# llms.txt: ${url('llms.txt')}\n# Full text: ${url('llms-full.txt')}\n`,
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
