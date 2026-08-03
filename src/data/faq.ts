import type { Locale } from '~/i18n/config';
import { FAQ_KEYS, interpolate, useTranslations, type FaqKey } from '~/i18n/ui';
import { collectionFacts } from './facts';

export interface FaqEntry {
  key: FaqKey;
  question: string;
  answer: string;
}

/**
 * The contact page's questions, with the numbers filled in from the
 * bibliography.
 *
 * They are built here rather than in the component because two things need
 * exactly the same six answers: the page a reader sees, and the `FAQPage` block
 * in the structured data. An answer engine that quotes the markup and a reader
 * who reads the page have to be told the same thing — that is the whole bargain —
 * and the only way to guarantee it is to render both from one list.
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
