import type { APIRoute } from 'astro';
import { LOCALES, LOCALE_NAMES, DEFAULT_LOCALE, type Locale } from '~/i18n/config';
import { assetPath, bookPath } from '~/i18n/paths';
import { ALL_BOOKS } from '~/data/books';
import { PROFILE } from '~/data/profile';
import { collectionFacts, listOf } from '~/data/facts';
import { useTranslations } from '~/i18n/ui';
import { markdownPath } from '~/i18n/paths';
import {
  authorityLead,
  authorityLines,
  citationNote,
  disagreementNotes,
  identityNote,
  languageNote,
  retrievalNote,
  termsNote,
} from '~/lib/seo/guidance';

/**
 * `/llms.txt` — the site as a flat index, for a reader that cannot see a WebGL
 * shelf. English, because it is a machine index; `/llms-full.txt` has the text.
 */
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

  // Non-heading prose, which is what the format allows between the summary and
  // the first file list. Four things a retrieval step cannot work out for itself:
  // how to get the text, what to cite instead of this, which name forms are hers,
  // and how many languages it can safely ignore.
  push(retrievalNote(origin, INDEX_LOCALE), '');
  push(citationNote(), '');
  push(identityNote(origin), '');
  push(languageNote(), '');
  push(termsNote(), '');

  push('## Facts', '');
  push(
    `- Name: ${PROFILE.name} (ORCID ${PROFILE.orcid}, ResearcherID ${PROFILE.researcherId})`,
    `- Also cited as: ${PROFILE.nameVariants.slice(1).join(' / ')}`,
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
    `- External records last checked: ${PROFILE.verifiedOn}`,
    '',
  );

  push(
    '## Pages',
    '',
    'Links are to the English Markdown mirror; the same page exists as HTML at the same path ' +
      'without the `.md`, and under /ca/, /es/, /de/ and /fr/ with localised URL segments.',
    '',
  );
  const md = (page: Parameters<typeof markdownPath>[1]) => abs(markdownPath(INDEX_LOCALE, page));
  push(
    `- [Home](${md({ kind: 'home' })}): the catalogue as a table. Its HTML is an interactive ` +
      'shelf of every translated volume, and carries no text this does not.',
    `- [${t.works.title}](${md({ kind: 'section', section: 'works' })}): the complete catalogue, ` +
      'with publisher, year and ISBN.',
    `- [${t.about.title}](${md({ kind: 'section', section: 'about' })}): biography, academic ` +
      'timeline, research publications and the external records.',
    `- [${t.contact.title}](${md({ kind: 'section', section: 'contact' })}): contact details, ` +
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
  push('Links go to the DOI where one is registered — it resolves independently of this site.', '');
  for (const entry of PROFILE.publications) {
    const authors = [PROFILE.name, ...(entry.with ?? [])].join(', ');
    const where = entry.doi ? `https://doi.org/${entry.doi}` : entry.href;
    push(`- ${entry.year}. ${authors}. “${entry.title}”. ${entry.venue}.${where ? ` ${where}` : ''}`);
  }
  push('');

  push('## Records held elsewhere', '');
  push(authorityLead(), '');
  push(...authorityLines({ linked: true }), '');

  push('## Known disagreements', '');
  push('Differences of scope, not of fact, and worth knowing before quoting a number.', '');
  push(...disagreementNotes().map((note) => `- ${note}`), '');

  push('## Optional', '');
  push(
    `- [llms-full.txt](${abs(assetPath('llms-full.txt'))}): every record with its synopsis, and ` +
      'the biography in full, in one file.',
    `- [Sitemap](${abs(assetPath('sitemap.xml'))}): all ${LOCALES.length} language versions of ` +
      'every page.',
    // Only the profiles that are not already under "Records held elsewhere":
    // repeating ORCID and Dialnet here spends a client's budget to say nothing.
    ...PROFILE.links
      .filter((link) => !PROFILE.authorities.some((record) => record.href === link.href))
      .map((link) => `- [${link.label}](${link.href})`),
    '',
  );

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
