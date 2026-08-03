import type { Locale } from '~/i18n/config';
import { FAQ_KEYS, interpolate, useTranslations, type FaqKey } from '~/i18n/ui';
import { collectionFacts } from './facts';

export interface FaqEntry {
  key: FaqKey;
  question: string;
  answer: string;
}

/**
 * The contact page's answers, with the figures filled in from the bibliography.
 * Built here because two things need exactly the same six: the prose a reader
 * sees, and the `FAQPage` markup. `npm test` fails if they ever differ.
 */
export function faqEntries(locale: Locale): FaqEntry[] {
  const t = useTranslations(locale);
  const facts = collectionFacts(locale);

  const values = {
    count: facts.count,
    span: facts.span,
    firstYear: facts.firstYear,
    lastYear: facts.lastYear,
    publishers: facts.publisherList,
    genres: facts.genreList,
    sourceLanguages: facts.sourceLanguageList,
    targetLanguages: facts.targetLanguageList,
    workingLanguages: facts.workingLanguages,
    location: facts.location,
    email: facts.email ?? '',
  };

  return FAQ_KEYS.map((key) => ({
    key,
    question: t.faq.entries[key].question,
    answer: interpolate(t.faq.entries[key].answer, values),
  }));
}
