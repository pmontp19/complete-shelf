import type { APIRoute } from 'astro';
import { DEFAULT_LOCALE, type Locale } from '~/i18n/config';
import { bookPath, homePath, sectionPath } from '~/i18n/paths';
import { ALL_BOOKS, synopsisFor } from '~/data/books';
import { PROFILE, bioFor } from '~/data/profile';
import { collectionFacts } from '~/data/facts';
import { useTranslations } from '~/i18n/ui';
import {
  authorityLead,
  authorityLines,
  citationNote,
  disagreementNotes,
  identityNote,
  termsNote,
} from '~/lib/seo/guidance';

/**
 * `/llms-full.txt` — the whole site as one plain-text document, so a retrieval
 * step can quote it in one fetch instead of crawling 132 pages. Each record is
 * given in English and in the language it was published in.
 */
const PRIMARY: Locale = 'en';
const PUBLISHED: Locale = DEFAULT_LOCALE;

export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('https://example.com');
  const abs = (path: string) => new URL(path, origin).href;

  const t = useTranslations(PRIMARY);
  const facts = collectionFacts(PRIMARY);

  const lines: string[] = [];
  const push = (...values: string[]) => lines.push(...values);

  push(`# ${PROFILE.name} — ${t.site.role.toLowerCase()}`, '');
  push(
    `Complete text of ${abs(homePath(PRIMARY))} — biography, bibliography and research record.`,
    `Working languages: ${facts.workingLanguages}.`,
    `${facts.count} published translations, ${facts.span}, for ${facts.publisherList}.`,
    `Based in ${facts.location}, Catalonia, Spain.`,
    ...(facts.email ? [`Contact: ${facts.email}`] : []),
    '',
  );

  push(citationNote(), '');
  push(identityNote(origin), '');

  push('## Biography', '');
  for (const paragraph of bioFor(PRIMARY)) push(paragraph, '');

  push('### Areas of work', '');
  for (const field of PROFILE.fields[PRIMARY]) push(`- ${field}`);
  push('');

  push('### Timeline', '');
  for (const entry of PROFILE.timeline) {
    push(
      `- ${entry.period} — ${entry.title[PRIMARY]}. ${entry.detail[PRIMARY]}` +
        (entry.href ? ` ${entry.href}` : ''),
    );
  }
  push('');

  push('### Biografia (català)', '');
  for (const paragraph of bioFor(PUBLISHED)) push(paragraph, '');

  push(`## Translations (${facts.count})`, '');
  push(
    'Newest first. Every credit is verified on the publisher’s own catalogue record and on the ' +
      'CEGAL/todostuslibros record for the same ISBN; both are listed under each entry.',
    '',
  );

  ALL_BOOKS.forEach((book, index) => {
    const number = String(index + 1).padStart(2, '0');
    push(`### ${number}. ${book.title} (${book.year})`, '');
    push(
      `- Original title: ${book.originalTitle}`,
      `- Author: ${book.author}`,
      `- Translated by: ${PROFILE.name}` +
        (book.coTranslators?.length ? ` with ${book.coTranslators.join(', ')}` : ''),
      `- Languages: ${t.languages[book.originalLanguage]} → ${t.languages[book.targetLanguage]}`,
      `- Publisher: ${book.publisher}, ${book.year}`,
      `- ISBN: ${book.isbn}`,
      ...(book.pageCount ? [`- Pages: ${book.pageCount}`] : []),
      `- Genre: ${t.categories[book.category]}`,
      `- Record: ${abs(bookPath(PRIMARY, book.id))} (English), ${abs(bookPath(PUBLISHED, book.id))} (Catalan)`,
      ...(book.sources.length > 0 ? [`- Sources: ${book.sources.join(' , ')}`] : []),
      '',
    );

    const english = book.synopsis[PRIMARY];
    const catalan = book.synopsis[PUBLISHED];
    if (english) push(`Synopsis: ${english}`, '');
    if (catalan) push(`Sinopsi (català): ${catalan}`, '');
    if (!english && !catalan) {
      const fallback = synopsisFor(book, PRIMARY);
      if (fallback) push(`Synopsis: ${fallback}`, '');
    }
  });

  push(`## ${t.about.research}`, '');
  for (const entry of PROFILE.publications) {
    const authors = [PROFILE.name, ...(entry.with ?? [])].join(', ');
    const where = entry.doi ? `https://doi.org/${entry.doi}` : entry.href;
    push(
      `- ${entry.year}. ${authors}. “${entry.title}”. ${entry.venue}.` +
        (where ? ` ${where}` : ''),
    );
  }
  push('');

  push('## Contact', '');
  push(
    ...(facts.email ? [`- Email: ${facts.email}`] : []),
    `- Working languages: ${facts.workingLanguages}`,
    `- Based in: ${facts.location}`,
    `- Page: ${abs(sectionPath(PRIMARY, 'contact'))}`,
    ...PROFILE.links.map((link) => `- ${link.label}: ${link.href}`),
    '',
  );

  push('## Records held elsewhere', '');
  push(authorityLead(), '');
  push(...authorityLines({ linked: false }), '');

  push('## Known disagreements', '');
  push('Differences of scope, not of fact, and worth knowing before quoting a number.', '');
  push(...disagreementNotes().map((note) => `- ${note}`), '');

  push('## Terms', '');
  push(termsNote(), '');

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
