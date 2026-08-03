import { HREFLANGS, LOCALE_TAGS, LOCALES, type Locale } from '~/i18n/config';
import { assetPath, bookPath, homePath, sectionPath } from '~/i18n/paths';
import type { PageRef } from '~/i18n/page-ref';
import { useTranslations } from '~/i18n/ui';
import { PROFILE, bioFor } from '~/data/profile';
import { ALL_BOOKS, coverFor, synopsisFor, type BookRecord } from '~/data/books';

/** The JSON-LD graph every page carries, built from `books.json` and `profile.ts`. */
export type Node = Record<string, unknown>;

const abs = (origin: URL | string, path: string) => new URL(path, origin).href;
const root = (origin: URL | string) => abs(origin, assetPath(''));

// Identical on every page of every locale, or the graph splits into one Person
// per URL.
export const personId = (origin: URL | string) => `${root(origin)}#person`;
export const websiteId = (origin: URL | string) => `${root(origin)}#website`;

const ORCID = '0000-0002-0387-0867';

const URV: Node = {
  '@type': 'CollegeOrUniversity',
  name: 'Universitat Rovira i Virgili',
  alternateName: 'URV',
  url: 'https://www.urv.cat/',
};

const UPF: Node = {
  '@type': 'CollegeOrUniversity',
  name: 'Universitat Pompeu Fabra',
  alternateName: 'UPF',
  url: 'https://www.upf.edu/',
};

const UAB: Node = {
  '@type': 'CollegeOrUniversity',
  name: 'Universitat Autònoma de Barcelona',
  alternateName: 'UAB',
  url: 'https://www.uab.cat/',
};

const IMPRINT_PARENTS: Record<string, Node> = {
  Columna: { '@type': 'Organization', name: 'Grup 62', url: 'https://www.grup62.cat/' },
  'Edicions 62': { '@type': 'Organization', name: 'Grup 62', url: 'https://www.grup62.cat/' },
};

function publisherNode(name: string): Node {
  const parent = IMPRINT_PARENTS[name];
  return { '@type': 'Organization', name, ...(parent ? { parentOrganization: parent } : {}) };
}

export function personNode(locale: Locale, origin: URL | string): Node {
  const t = useTranslations(locale);
  const [opening] = bioFor(locale);

  return {
    '@type': 'Person',
    '@id': personId(origin),
    name: PROFILE.name,
    givenName: 'Judith',
    familyName: 'Raigal Aran',
    alternateName: 'Judith Raigal',
    jobTitle: t.site.role,
    description: opening ?? t.about.metaDescription,
    url: abs(origin, homePath(locale)),
    mainEntityOfPage: { '@id': `${abs(origin, sectionPath(locale, 'about'))}#webpage` },
    ...(PROFILE.email ? { email: `mailto:${PROFILE.email}` } : {}),
    sameAs: PROFILE.links.map((link) => link.href),
    identifier: {
      '@type': 'PropertyValue',
      propertyID: 'ORCID',
      value: ORCID,
      url: `https://orcid.org/${ORCID}`,
    },
    knowsLanguage: LOCALES.map((code) => ({
      '@type': 'Language',
      name: t.languages[code],
      alternateName: HREFLANGS[code],
    })),
    knowsAbout: PROFILE.fields[locale],
    hasOccupation: {
      '@type': 'Occupation',
      name: t.site.role,
      // ISCO-08 2643: translators, interpreters and other linguists.
      occupationalCategory: '2643',
      skills: PROFILE.fields[locale].join('; '),
      occupationLocation: [
        { '@type': 'City', name: 'Tarragona' },
        { '@type': 'City', name: 'Barcelona' },
      ],
    },
    worksFor: [URV, UPF, UAB],
    alumniOf: [UPF, URV],
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Tarragona',
      addressRegion: 'Catalunya',
      addressCountry: 'ES',
    },
    workLocation: ['Tarragona', 'Barcelona'].map((city) => ({
      '@type': 'Place',
      name: city,
      address: {
        '@type': 'PostalAddress',
        addressLocality: city,
        addressRegion: 'Catalunya',
        addressCountry: 'ES',
      },
    })),
  };
}

export function websiteNode(locale: Locale, origin: URL | string): Node {
  const t = useTranslations(locale);
  return {
    '@type': 'WebSite',
    '@id': websiteId(origin),
    url: root(origin),
    name: `${t.site.name} — ${t.site.role}`,
    alternateName: t.site.name,
    description: t.home.metaDescription,
    inLanguage: LOCALES.map((code) => LOCALE_TAGS[code]),
    author: { '@id': personId(origin) },
    publisher: { '@id': personId(origin) },
    copyrightHolder: { '@id': personId(origin) },
  };
}

export function pageTypeFor(page: PageRef): string {
  switch (page.kind) {
    case 'home':
      return 'WebPage';
    case 'book':
      return 'ItemPage';
    case 'section':
      return page.section === 'works'
        ? 'CollectionPage'
        : page.section === 'about'
          ? 'ProfilePage'
          : 'ContactPage';
  }
}

export interface BreadcrumbStep {
  name: string;
  url: string;
}

/** Home gets no trail: a breadcrumb of one item is dropped anyway. */
export function breadcrumbSteps(
  locale: Locale,
  page: PageRef,
  title: string,
  origin: URL | string,
): BreadcrumbStep[] {
  const t = useTranslations(locale);
  const home = { name: t.nav.home, url: abs(origin, homePath(locale)) };

  switch (page.kind) {
    case 'home':
      return [];
    case 'section':
      return [
        home,
        { name: t.nav[page.section], url: abs(origin, sectionPath(locale, page.section)) },
      ];
    case 'book':
      return [
        home,
        { name: t.nav.works, url: abs(origin, sectionPath(locale, 'works')) },
        { name: title, url: abs(origin, bookPath(locale, page.slug)) },
      ];
  }
}

export function breadcrumbNode(canonical: string, steps: BreadcrumbStep[]): Node {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${canonical}#breadcrumb`,
    itemListElement: steps.map((step, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: step.name,
      item: step.url,
    })),
  };
}

/** A translated edition. `brief` is the form a catalogue entry takes. */
export function bookNode(
  book: BookRecord,
  locale: Locale,
  origin: URL | string,
  options: { brief?: boolean } = {},
): Node {
  const t = useTranslations(locale);
  const url = abs(origin, bookPath(locale, book.id));
  const synopsis = synopsisFor(book, locale);

  const translators: Node[] = [
    { '@id': personId(origin) },
    ...(book.coTranslators ?? []).map((name) => ({ '@type': 'Person', name })),
  ];

  const identity: Node = {
    '@type': 'Book',
    '@id': `${url}#book`,
    url,
    name: book.title,
    alternateName: book.originalTitle,
    inLanguage: HREFLANGS[book.targetLanguage],
    author: { '@type': 'Person', name: book.author },
    translator: translators,
    datePublished: String(book.year),
    isbn: book.isbn,
    genre: t.categories[book.category],
    image: abs(origin, coverFor(book.id)),
  };

  if (options.brief) {
    return { ...identity, publisher: { '@type': 'Organization', name: book.publisher } };
  }

  return {
    ...identity,
    publisher: publisherNode(book.publisher),
    identifier: { '@type': 'PropertyValue', propertyID: 'ISBN', value: book.isbn },
    ...(book.pageCount ? { numberOfPages: book.pageCount } : {}),
    ...(synopsis ? { abstract: synopsis, description: synopsis } : {}),
    ...(book.sources.length > 0 ? { sameAs: book.sources } : {}),
    translationOfWork: {
      '@type': 'Book',
      name: book.originalTitle,
      inLanguage: HREFLANGS[book.originalLanguage],
      author: { '@type': 'Person', name: book.author },
    },
  };
}

export function catalogueNode(locale: Locale, origin: URL | string, canonical: string): Node {
  const t = useTranslations(locale);
  return {
    '@type': 'ItemList',
    '@id': `${canonical}#catalogue`,
    name: t.works.title,
    description: t.works.metaDescription,
    numberOfItems: ALL_BOOKS.length,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    itemListElement: ALL_BOOKS.map((book, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: bookNode(book, locale, origin, { brief: true }),
    })),
  };
}

export function publicationNodes(locale: Locale, origin: URL | string): Node[] {
  const KINDS: Record<string, string> = {
    article: 'ScholarlyArticle',
    chapter: 'Chapter',
    report: 'Report',
    thesis: 'Thesis',
  };

  return PROFILE.publications.map((entry, index) => ({
    '@type': KINDS[entry.kind] ?? 'CreativeWork',
    '@id': `${abs(origin, sectionPath(locale, 'about'))}#publication-${index + 1}`,
    name: entry.title,
    datePublished: String(entry.year),
    author: [
      { '@id': personId(origin) },
      ...(entry.with ?? []).map((name) => ({ '@type': 'Person', name })),
    ],
    isPartOf: { '@type': 'CreativeWork', name: entry.venue },
    ...(entry.href ? { url: entry.href, sameAs: entry.href } : {}),
    ...(entry.kind === 'thesis' ? { inSupportOf: 'PhD', sourceOrganization: URV } : {}),
  }));
}

export function questionNodes(
  entries: Array<{ question: string; answer: string }>,
  canonical: string,
): Node[] {
  return entries.map((entry, index) => ({
    '@type': 'Question',
    '@id': `${canonical}#question-${index + 1}`,
    name: entry.question,
    acceptedAnswer: { '@type': 'Answer', text: entry.answer },
  }));
}
