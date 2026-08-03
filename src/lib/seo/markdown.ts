/**
 * A plain-Markdown mirror of every page.
 *
 * The structured data in `schema.ts` tells a machine what the records *are*. It
 * does not give it the prose, and on this site the prose is the part that is
 * hardest to reach: the home page is a WebGL shelf, so a client that cannot run
 * it gets a cover grid and a paragraph. Serving the same records as Markdown
 * costs 130 small files in a static build and means an answer engine never has
 * to reconstruct a bibliography out of a canvas.
 *
 * Rendered from `books.json` and `profile.ts`, like everything else here, so the
 * mirror cannot say something the page does not.
 */
import { LOCALE_NAMES, LOCALE_TAGS, LOCALES, type Locale, type Section } from '~/i18n/config';
import { assetPath, bookPath, homePath, markdownPath, sectionPath } from '~/i18n/paths';
import { useTranslations } from '~/i18n/ui';
import { PROFILE, bioFor, type Publication } from '~/data/profile';
import { ALL_BOOKS, coverFor, synopsisFor, synopsisIsFallback, type BookRecord } from '~/data/books';
import { collectionFacts, listOf } from '~/data/facts';
import { personId } from './schema';
import { authorityLines } from './guidance';

type Origin = URL | string;

const abs = (origin: Origin, path: string) => new URL(path, origin).href;

/**
 * YAML front matter. Strings are quoted and escaped, numbers left bare so a
 * parser reads `year: 2019` as the number it is. The keys are ours, so they need
 * no quoting.
 */
function frontMatter(fields: Record<string, string | number | string[] | undefined>): string {
  const quote = (value: string | number) =>
    typeof value === 'number' ? String(value) : `"${value.replace(/"/g, '\\"')}"`;
  const lines = Object.entries(fields).flatMap(([key, value]) => {
    if (value === undefined || (Array.isArray(value) && value.length === 0)) return [];
    if (Array.isArray(value)) return [`${key}: [${value.map(quote).join(', ')}]`];
    return [`${key}: ${quote(value)}`];
  });
  return ['---', ...lines, '---'].join('\n');
}

/** One reference, in a shape that survives being copied into prose. */
export function citationLine(entry: Publication): string {
  const authors = ['Raigal Aran, J.', ...(entry.with ?? [])].join('; ');
  const where = entry.doi ? `https://doi.org/${entry.doi}` : (entry.href ?? '');
  return `${authors} (${entry.year}). “${entry.title}”. ${entry.venue}.${where ? ` ${where}` : ''}`;
}

/** The catalogue as a table, shared by the home mirror and the works mirror. */
function catalogueTable(locale: Locale, origin: Origin): string {
  const t = useTranslations(locale);
  const columns = [
    t.book.year,
    t.book.title,
    t.book.author,
    t.book.originalTitle,
    t.book.from,
    t.book.publisher,
    t.book.isbn,
  ];

  const rows = ALL_BOOKS.map((book) => {
    const href = abs(origin, markdownPath(locale, { kind: 'book', slug: book.id }));
    return [
      String(book.year),
      `[${book.title}](${href})`,
      book.author,
      book.originalTitle,
      t.languages[book.originalLanguage],
      book.publisher,
      book.isbn,
    ];
  });

  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

/** The trailer every mirror carries: where the same thing is in other forms. */
function seeAlso(origin: Origin, canonical: string, extra: string[] = []): string {
  return [
    '## See also',
    '',
    ...extra,
    `- HTML version of this page: ${canonical}`,
    `- Every record in one file: ${abs(origin, assetPath('llms-full.txt'))}`,
    `- Index for automated clients: ${abs(origin, assetPath('llms.txt'))}`,
  ].join('\n');
}

/** `/{lang}/{works}/{slug}.md` — one record. */
export function bookMarkdown(book: BookRecord, locale: Locale, origin: Origin): string {
  const t = useTranslations(locale);
  const canonical = abs(origin, bookPath(locale, book.id));
  const synopsis = synopsisFor(book, locale);

  const rows: Array<[string, string]> = [
    [t.book.originalTitle, book.originalTitle],
    [t.book.author, book.author],
    [t.book.publisher, book.publisher],
    [t.book.year, String(book.year)],
    [t.book.from, t.languages[book.originalLanguage]],
    [t.book.into, t.languages[book.targetLanguage]],
    [t.book.category, t.categories[book.category]],
    ...(book.pageCount ? [[t.book.pages, String(book.pageCount)] as [string, string]] : []),
    [t.book.isbn, book.isbn],
    ...(book.coTranslators?.length
      ? [[t.book.coTranslators, listOf(locale, book.coTranslators)] as [string, string]]
      : []),
  ];

  const credit =
    `${book.author}. Translated into ${t.languages[book.targetLanguage]} by ` +
    `[${PROFILE.name}](${abs(origin, sectionPath(locale, 'about'))}) from the ` +
    `${t.languages[book.originalLanguage]} *${book.originalTitle}*` +
    `${book.coTranslators?.length ? `, with ${listOf(locale, book.coTranslators)}` : ''}. ` +
    `${book.publisher}, ${book.year}. ISBN ${book.isbn}.`;

  return [
    frontMatter({
      title: book.title,
      original_title: book.originalTitle,
      author: book.author,
      translator: PROFILE.name,
      translator_orcid: PROFILE.orcid,
      co_translators: book.coTranslators,
      publisher: book.publisher,
      year: book.year,
      isbn: book.isbn,
      source_language: book.originalLanguage,
      target_language: book.targetLanguage,
      lang: LOCALE_TAGS[locale],
      canonical,
      verified_by: book.sources,
    }),
    '',
    `# ${book.title}`,
    '',
    credit,
    '',
    ...(synopsis
      ? [
          `## ${t.book.synopsis}`,
          '',
          synopsis,
          ...(synopsisIsFallback(book, locale)
            ? ['', `(No synopsis was written in ${LOCALE_NAMES[locale]}; this one is a fallback.)`]
            : []),
          '',
        ]
      : []),
    `## ${t.book.details}`,
    '',
    '| | |',
    '| --- | --- |',
    ...rows.map(([label, value]) => `| ${label} | ${value} |`),
    '',
    `## ${t.book.sources}`,
    '',
    'The records that verify this credit: the publisher’s own catalogue page, which names her in ' +
      'its Traductora field, and the todostuslibros (CEGAL) record for the same ISBN. Cite these ' +
      'rather than this page when the credit itself is the point.',
    '',
    ...book.sources.map((href) => `- <${href}>`),
    '',
    seeAlso(origin, canonical, [
      `- Cover image: ${abs(origin, coverFor(book.id))}`,
      `- Full catalogue: ${abs(origin, markdownPath(locale, { kind: 'section', section: 'works' }))}`,
      `- Other languages: ${LOCALES.filter((code) => code !== locale)
        .map(
          (code) =>
            `${LOCALE_NAMES[code]} ${abs(origin, markdownPath(code, { kind: 'book', slug: book.id }))}`,
        )
        .join(', ')}`,
    ]),
    '',
  ].join('\n');
}

/** `/{lang}/{section}.md` — one of the three section indexes. */
export function sectionMarkdown(section: Section, locale: Locale, origin: Origin): string {
  const t = useTranslations(locale);
  const facts = collectionFacts(locale);
  const canonical = abs(origin, sectionPath(locale, section));

  const head = frontMatter({
    title: t[section].title,
    subject: PROFILE.name,
    subject_orcid: PROFILE.orcid,
    lang: LOCALE_TAGS[locale],
    canonical,
    external_records_checked: PROFILE.verifiedOn,
  });

  if (section === 'works') {
    return [
      head,
      '',
      `# ${t.works.title}`,
      '',
      `${t.works.lead} ${facts.count} volumes, ${facts.span}, newest first. Every credit is ` +
        'verified against the publisher’s catalogue record and the CEGAL record for the same ' +
        'ISBN; follow a title for those links and the synopsis.',
      '',
      catalogueTable(locale, origin),
      '',
      seeAlso(origin, canonical, [
        `- ${t.about.title}: ${abs(origin, markdownPath(locale, { kind: 'section', section: 'about' }))}`,
      ]),
      '',
    ].join('\n');
  }

  if (section === 'about') {
    return [
      head,
      '',
      `# ${t.about.title}`,
      '',
      ...bioFor(locale).flatMap((paragraph) => [paragraph, '']),
      `## ${t.about.research}`,
      '',
      ...PROFILE.publications.map((entry) => `- ${citationLine(entry)}`),
      '',
      `## ${t.about.elsewhere}`,
      '',
      t.about.elsewhereLead,
      '',
      ...authorityLines({ linked: false }),
      '',
      seeAlso(origin, canonical, [
        `- ${t.works.title} (${facts.count}): ${abs(origin, markdownPath(locale, { kind: 'section', section: 'works' }))}`,
      ]),
      '',
    ].join('\n');
  }

  return [
    head,
    '',
    `# ${t.contact.title}`,
    '',
    t.contact.lead,
    '',
    ...(PROFILE.email ? [`- ${t.contact.email}: ${PROFILE.email}`] : []),
    `- ${t.contact.languages}: ${PROFILE.workingLanguages[locale]}`,
    `- ${PROFILE.location[locale]}`,
    '',
    `## ${t.contact.fields}`,
    '',
    ...PROFILE.fields[locale].map((field) => `- ${field}`),
    '',
    `## ${t.contact.elsewhere}`,
    '',
    ...PROFILE.links.map(
      (link) => `- ${link.label}${link.handle ? ` (${link.handle})` : ''} — <${link.href}>`,
    ),
    '',
    seeAlso(origin, canonical),
    '',
  ].join('\n');
}

/**
 * `/{lang}/index.md` — the mirror of the shelf, and the one that earns the
 * feature. Its HTML is a 3D canvas; what the canvas *shows* is the catalogue,
 * so that is what this says.
 */
export function homeMarkdown(locale: Locale, origin: Origin): string {
  const t = useTranslations(locale);
  const facts = collectionFacts(locale);
  const canonical = abs(origin, homePath(locale));

  return [
    frontMatter({
      title: `${PROFILE.name} — ${t.site.role}`,
      subject: PROFILE.name,
      subject_orcid: PROFILE.orcid,
      lang: LOCALE_TAGS[locale],
      canonical,
      external_records_checked: PROFILE.verifiedOn,
    }),
    '',
    `# ${PROFILE.name}`,
    '',
    `${t.site.role}. ${t.site.tagline}.`,
    '',
    bioFor(locale)[0] ?? '',
    '',
    `The HTML at ${canonical} is an interactive 3D shelf holding all ${facts.count} volumes, which ` +
      'is why this mirror exists: what the shelf shows is the catalogue below.',
    '',
    `## ${t.works.title}`,
    '',
    catalogueTable(locale, origin),
    '',
    seeAlso(origin, canonical, [
      `- ${t.about.title}: ${abs(origin, markdownPath(locale, { kind: 'section', section: 'about' }))}`,
      `- ${t.contact.title}: ${abs(origin, markdownPath(locale, { kind: 'section', section: 'contact' }))}`,
      `- Her node in the structured data on every page: ${personId(origin)}`,
    ]),
    '',
  ].join('\n');
}
