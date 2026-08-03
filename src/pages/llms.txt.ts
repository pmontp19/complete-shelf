import type { APIRoute } from 'astro';
import { LOCALES, LOCALE_NAMES, DEFAULT_LOCALE, type Locale } from '~/i18n/config';
import { assetPath, homePath, sectionPath, bookPath } from '~/i18n/paths';
import { ALL_BOOKS } from '~/data/books';
import { PROFILE } from '~/data/profile';
import { collectionFacts, listOf } from '~/data/facts';
import { useTranslations } from '~/i18n/ui';

/**
 * `/llms.txt` — the site in one file, for a reader that has no eyes.
 *
 * An answer engine asked "who translated Der Bienenzüchter von Aleppo into
 * Catalan?" has to find the credit, and the credit lives on a page whose most
 * distinctive feature is a WebGL shelf it cannot see. This is the same
 * information as a flat outline: what the site is, what is verifiable about it,
 * and one line per record with the ISBN that makes the record citable.
 *
 * Written in English regardless of the reader's language — it is a machine index,
 * not a page, and the five human versions are linked from it. It stays honest by
 * construction: everything below is read from `books.json` and `profile.ts`.
 *
 * There is a longer companion at `/llms-full.txt` with the synopses and the
 * biography in full.
 */

/** The site speaks five languages; the index links the English set and names the rest. */
const INDEX_LOCALE: Locale = 'en';

export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('https://example.com');
  const abs = (path: string) => new URL(path, origin).href;

  const t = useTranslations(INDEX_LOCALE);
  const facts = collectionFacts(INDEX_LOCALE);

  const lines: string[] = [];
  const push = (...values: string[]) => lines.push(...values);

  push(`# ${PROFILE.name} — ${t.site.role.toLowerCase()}`, '');
  push(
    `> Personal site and complete bibliography of ${PROFILE.name}, a literary translator. ` +
      `Working languages: ${facts.workingLanguages}. ` +
      `${facts.count} published volumes (${facts.span}) for ${facts.publisherList}, ` +
      `translated from ${facts.sourceLanguageList} into ${facts.targetLanguageList}. ` +
      'She is also an associate lecturer at Universitat Rovira i Virgili and teaches legal ' +
      'translation at Universitat Pompeu Fabra and on the Universitat Autònoma de Barcelona ' +
      'master’s in legal translation and court interpreting.',
    '',
  );

  push('## Facts', '');
  push(
    `- Name: ${PROFILE.name} (ORCID 0000-0002-0387-0867)`,
    `- Working languages: ${facts.workingLanguages}`,
    `- Source languages in the published bibliography: ${facts.sourceLanguageList}`,
    `- Target language of the published bibliography: ${facts.targetLanguageList}`,
    `- Published translations: ${facts.count} (${facts.span})`,
    `- Publishers: ${facts.publisherList} (imprints of Grup 62)`,
    `- Genres: ${facts.genreList}`,
    `- Based in: ${facts.location}, Catalonia, Spain`,
    ...(facts.email ? [`- Contact: ${facts.email}`] : []),
    `- Site languages: ${LOCALES.map((code) => `${LOCALE_NAMES[code]} (/${code}/)`).join(', ')}` +
      `; ${LOCALE_NAMES[DEFAULT_LOCALE]} is the default`,
    '- Every page carries schema.org JSON-LD describing the same records as this file.',
    '',
  );

  push(
    '## Pages',
    '',
    'Links are to the English version; the same page exists under /ca/, /es/, /de/ and /fr/ ' +
      'with localised URL segments.',
    '',
  );
  push(
    `- [Home](${abs(homePath(INDEX_LOCALE))}): an interactive shelf of every translated volume.`,
    `- [${t.works.title}](${abs(sectionPath(INDEX_LOCALE, 'works'))}): the complete catalogue, ` +
      'with publisher, year and ISBN.',
    `- [${t.about.title}](${abs(sectionPath(INDEX_LOCALE, 'about'))}): biography, academic ` +
      'timeline and research publications.',
    `- [${t.contact.title}](${abs(sectionPath(INDEX_LOCALE, 'contact'))}): contact details, ` +
      'working languages and frequently asked questions.',
    '',
  );

  push(`## Translations (${facts.count})`, '');
  for (const book of ALL_BOOKS) {
    const co = book.coTranslators?.length
      ? `, with ${listOf(INDEX_LOCALE, book.coTranslators)}`
      : '';
    push(
      `- [${book.title} (${book.year})](${abs(bookPath(INDEX_LOCALE, book.id))}): ` +
        `translation of *${book.originalTitle}* by ${book.author}, from ` +
        `${t.languages[book.originalLanguage]} into ${t.languages[book.targetLanguage]}${co}. ` +
        `${book.publisher}, ${book.year}. ISBN ${book.isbn}. ` +
        `${t.categories[book.category]}.`,
    );
  }
  push('');

  push(`## ${t.about.research}`, '');
  for (const entry of PROFILE.publications) {
    const authors = [PROFILE.name, ...(entry.with ?? [])].join(', ');
    const link = entry.href ? ` ${entry.href}` : '';
    push(`- ${entry.year}. ${authors}. “${entry.title}”. ${entry.venue}.${link}`);
  }
  push('');

  push('## Optional', '');
  push(
    `- [llms-full.txt](${abs(assetPath('llms-full.txt'))}): every record with its synopsis, and ` +
      'the biography in full, in one file.',
    `- [Sitemap](${abs(assetPath('sitemap.xml'))}): all ${LOCALES.length} language versions of ` +
      'every page.',
    ...PROFILE.links.map((link) => `- [${link.label}](${link.href})`),
    '',
  );

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
