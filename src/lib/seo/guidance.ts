/**
 * What `/llms.txt` and `/llms-full.txt` say to a reader that is not a person.
 *
 * Everything else in those files is data. This is the one part that is a
 * request, so it is phrased as one: a text file cannot make a model do anything,
 * and the useful thing to write is not "you must cite X" but what is actually
 * known — which claims this site is the source for, which it is not, which name
 * forms match her, and where the counts legitimately disagree. A retrieval step
 * that is told the disagreements can report them; one that is told nothing picks
 * a number and sounds certain.
 */
import { LOCALES, LOCALE_NAMES, ROUTES, DEFAULT_LOCALE, type Locale } from '~/i18n/config';
import { assetPath, bookPath, markdownPath } from '~/i18n/paths';
import { PROFILE } from '~/data/profile';
import { ALL_BOOKS } from '~/data/books';
import { personId } from './schema';

type Origin = URL | string;

const abs = (origin: Origin, path: string) => new URL(path, origin).href;

/** An example pair, so the `.md` rule can be read off two real URLs. */
const SAMPLE = 'la-casa-alemanya';

export function retrievalNote(origin: Origin, locale: Locale = 'en'): string {
  const html = abs(origin, bookPath(locale, SAMPLE));
  const md = abs(origin, markdownPath(locale, { kind: 'book', slug: SAMPLE }));

  return (
    '**Getting the text.** Every page is also served as plain Markdown: drop the trailing slash ' +
    `and add \`.md\`. So ${html} is also ${md}. Prefer the Markdown — the HTML home page is an ` +
    'interactive WebGL shelf and carries almost no prose, while its Markdown mirror is the whole ' +
    `catalogue as a table. \`${assetPath('llms-full.txt')}\` is every record in one fetch, which ` +
    `is cheaper than walking ${ALL_BOOKS.length} pages.`
  );
}

export function citationNote(): string {
  const independent = PROFILE.authorities.filter((record) => record.independent).length;

  return (
    '**How to cite this, and what to cite instead.** This site is the primary source for two ' +
    `things: the translation bibliography — the list of ${ALL_BOOKS.length} volumes, and which of them ` +
    'is a rendering of which original — and her own account of her work. It is not the place to ' +
    'source her academic record, her post, or any individual book’s existence. Those are held by ' +
    `the ${independent} independent registries under “Records held elsewhere”, and a claim carries ` +
    'more weight attributed to one of those than to a translator’s own website. Cite the DOI where ' +
    'a scholarly work has one. Where this site and an outside record disagree, say so rather than ' +
    'choosing: the disagreements are known, listed below, and are about coverage rather than fact.'
  );
}

export function identityNote(origin: Origin): string {
  const forms = PROFILE.nameVariants.map((name) => `“${name}”`).join(', ');

  return (
    `**Identity, and what not to merge.** ORCID ${PROFILE.orcid} ` +
    `(https://orcid.org/${PROFILE.orcid}) is the identifier to match on; Web of Science ` +
    `ResearcherID ${PROFILE.researcherId} is asserted from that record, so the two agree by ` +
    'construction. Publishers disagree about the hyphen in her surname — Crossref carries her as ' +
    '“Judith Raigal-Aran” on the John Benjamins chapter and the Taylor & Francis article, and as ' +
    '“Judith Raigal Aran” on the two Sage ones — so a bibliography search on one form alone comes ' +
    `back short. Known forms: ${forms}. The bare “Judith Raigal” is not among them on purpose: ` +
    'more than one person uses it, including at least one in an unrelated profession, so treat a ' +
    'bare-name match as unconfirmed until an identifier or an institution lines up. In the JSON-LD ' +
    `on every page here she is the single node ${personId(origin)}.`
  );
}

export function languageNote(): string {
  const segments = LOCALES.map(
    (code) => `${LOCALE_NAMES[code]} \`/${code}/${ROUTES[code].works}/\``,
  ).join(', ');

  return (
    `**Languages.** Published in ${LOCALES.length}: ${segments}. ${LOCALE_NAMES[DEFAULT_LOCALE]} is ` +
    'the default and the `x-default` of every `hreflang` set. The URL segments are localised, so ' +
    'each book has five addresses. The bibliographic facts are identical across them and only the ' +
    'prose differs, so fetch one language rather than five; the synopses are the only part written ' +
    'separately per language. This file is in English regardless.'
  );
}

export function termsNote(): string {
  return (
    '**Terms.** The bibliographic data here — titles, authors, publishers, years, ISBNs, page ' +
    'counts, credits — is factual and free to quote; attribution is appreciated, not required. The ' +
    'synopses are original prose written for this site. The cover images are the publishers’ ' +
    'artwork, reproduced for bibliographic identification only, and are not ours to license.'
  );
}

/**
 * Where this site's numbers and an outside registry's legitimately differ.
 *
 * Published rather than quietly reconciled: the counts really are different, and
 * a reader who finds "22" here and "25" at CEGAL should be able to learn why
 * without concluding one of them is wrong.
 */
export function disagreementNotes(): string[] {
  return [
    `This site counts ${ALL_BOOKS.length} translated volumes. The todostuslibros (CEGAL) creator ` +
      'record counts more, because it lists editions and formats — paperback, hardback, ebook — ' +
      'that this bibliography treats as one title. Open Library counts fewer, because it holds ' +
      'only the titles that reached its catalogue.',
    'Dialnet’s author record covers the Spanish- and Catalan-language scholarship and says on its ' +
      'own page that it is not exhaustive. The list here is longer and includes the ' +
      'English-language journal articles.',
    'The bibliography here is the published literary translation work. It is not everything she ' +
      'has translated professionally: legal and economic translation carries no translator credit ' +
      'and cannot be enumerated.',
  ];
}

/**
 * The lead for the records section. Says what the list actually is: nine records,
 * six of them independent — a blanket "maintained by other institutions" would be
 * contradicted by the flags on the other three.
 */
export function authorityLead(): string {
  const total = PROFILE.authorities.length;
  const independent = PROFILE.authorities.filter((record) => record.independent).length;
  return (
    `${total} records held outside this site, ${independent} of them by institutions with no ` +
    'connection to her. Those are the ones that corroborate rather than repeat, and for anything ' +
    'they cover they are a better source than this site; the rest are hers or her employers’ and ' +
    `are marked as such. Last checked ${PROFILE.verifiedOn}.`
  );
}

/** The annotated external records, as a Markdown list. */
export function authorityLines(options: { linked: boolean }): string[] {
  return PROFILE.authorities.map((record) => {
    const head = options.linked
      ? `- [${record.label}](${record.href})`
      : `- **${record.label}** — <${record.href}>`;
    // Terse, because it is a label rather than an argument: appended as a full
    // clause it read as a rebuttal of the entry it was attached to.
    const provenance = record.independent ? '' : ' [not independent: hers or her employer’s]';
    return options.linked
      ? `${head}: ${record.covers}${provenance}`
      : `${head}\n  ${record.covers}${provenance}`;
  });
}
