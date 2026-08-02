import type { Locale } from '~/i18n/config';

/** Localised prose. Every locale is required so the biography is never blank. */
export type LocalisedText = Record<Locale, string>;
export type LocalisedParagraphs = Record<Locale, string[]>;

export interface TimelineEntry {
  /** Free-form period label, e.g. "2019 – " or "2016". */
  period: string;
  title: LocalisedText;
  detail: LocalisedText;
  href?: string;
}

export interface ProfileLink {
  label: string;
  href: string;
  /** Shown next to the label; keep it short. */
  handle?: string;
}

export interface Profile {
  name: string;
  /** Public, professional contact address only. */
  email: string | null;
  location: LocalisedText;
  bio: LocalisedParagraphs;
  timeline: TimelineEntry[];
  links: ProfileLink[];
  /** Source URLs backing the biography, rendered as a small credits line. */
  sources: string[];
}

export const PROFILE: Profile = {
  name: 'Judith Raigal Aran',
  // Published on her URV departmental staff page; the only contact channel used here.
  email: 'judith.raigal@urv.cat',
  location: {
    ca: 'Tarragona i Barcelona',
    es: 'Tarragona y Barcelona',
    en: 'Tarragona and Barcelona',
    de: 'Tarragona und Barcelona',
    fr: 'Tarragone et Barcelone',
  },
  bio: {
    ca: [
      'Sóc traductora literària i professora universitària. Tradueixo de l’alemany, el francès i l’anglès al català i al castellà, i des del 2019 he portat més de vint llibres a la llengua catalana per a Columna i Edicions 62: novel·la contemporània, memòries, narrativa de gènere i, també, algun receptari.',
      'Em vaig graduar en Traducció i Interpretació a la Universitat Pompeu Fabra el 2013 i hi vaig cursar el Màster en Estudis de Traducció l’any següent, amb un treball sobre la recepció de La visita de la vella dama, de Friedrich Dürrenmatt, a Barcelona. El 2022 vaig defensar la tesi doctoral a la Universitat Rovira i Virgili, dirigida per Anthony Pym i Carmen Bestué, sobre la confiança dels jutges en els intèrprets en els procediments penals.',
      'Actualment sóc professora associada al Departament d’Estudis Anglesos i Alemanys de la URV i imparteixo traducció jurídica a la Universitat Pompeu Fabra i al Màster en Traducció Jurídica i Interpretació Judicial de la UAB. Compagino la docència i la recerca —traducció jurídica, interpretació als serveis públics, sociologia de la traducció— amb la traducció professional.',
    ],
    es: [
      'Soy traductora literaria y profesora universitaria. Traduzco del alemán, el francés y el inglés al catalán y al castellano, y desde 2019 he llevado más de veinte libros a la lengua catalana para Columna y Edicions 62: novela contemporánea, memorias, narrativa de género y también algún recetario.',
      'Me gradué en Traducción e Interpretación en la Universitat Pompeu Fabra en 2013 y cursé allí el Máster en Estudios de Traducción al año siguiente, con un trabajo sobre la recepción de La visita de la vieja dama, de Friedrich Dürrenmatt, en Barcelona. En 2022 defendí la tesis doctoral en la Universitat Rovira i Virgili, dirigida por Anthony Pym y Carmen Bestué, sobre la confianza de los jueces en los intérpretes en los procedimientos penales.',
      'Actualmente soy profesora asociada en el Departamento de Estudios Ingleses y Alemanes de la URV e imparto traducción jurídica en la Universitat Pompeu Fabra y en el Máster en Traducción Jurídica e Interpretación Judicial de la UAB. Compagino la docencia y la investigación —traducción jurídica, interpretación en los servicios públicos, sociología de la traducción— con la traducción profesional.',
    ],
    en: [
      'I am a literary translator and university lecturer. I translate from German, French and English into Catalan and Spanish, and since 2019 I have brought more than twenty books into Catalan for Columna and Edicions 62: contemporary fiction, memoir, genre writing and the occasional cookbook.',
      'I graduated in Translation and Interpreting from Universitat Pompeu Fabra in 2013 and took the MA in Translation Studies there the following year, with a dissertation on the Barcelona reception of Friedrich Dürrenmatt’s The Visit. In 2022 I defended my doctoral thesis at Universitat Rovira i Virgili, supervised by Anthony Pym and Carmen Bestué, on how judges do — and do not — trust interpreters in criminal proceedings.',
      'I currently teach as an associate lecturer in the Department of English and German Studies at URV, and I teach legal translation at Universitat Pompeu Fabra and on the UAB Master’s in Legal Translation and Court Interpreting. Teaching and research — legal translation, public service interpreting, the sociology of translation — run alongside my professional translation work.',
    ],
    de: [
      'Ich bin Literaturübersetzerin und Universitätsdozentin. Ich übersetze aus dem Deutschen, Französischen und Englischen ins Katalanische und Spanische und habe seit 2019 mehr als zwanzig Bücher für Columna und Edicions 62 ins Katalanische übertragen: Gegenwartsliteratur, Memoiren, Genreliteratur und gelegentlich ein Kochbuch.',
      'Ich habe 2013 mein Studium der Übersetzung und des Dolmetschens an der Universitat Pompeu Fabra abgeschlossen und dort im Jahr darauf den Master in Übersetzungswissenschaft absolviert, mit einer Arbeit über die Rezeption von Friedrich Dürrenmatts Der Besuch der alten Dame in Barcelona. 2022 habe ich an der Universitat Rovira i Virgili meine Doktorarbeit verteidigt, betreut von Anthony Pym und Carmen Bestué, über das Vertrauen von Richterinnen und Richtern in Dolmetscher in Strafverfahren.',
      'Derzeit bin ich Lehrbeauftragte am Fachbereich für Anglistik und Germanistik der URV und unterrichte juristisches Übersetzen an der Universitat Pompeu Fabra sowie im Masterstudiengang für juristisches Übersetzen und Gerichtsdolmetschen der UAB. Lehre und Forschung — juristisches Übersetzen, Community Interpreting, Translationssoziologie — begleiten meine Arbeit als Übersetzerin.',
    ],
    fr: [
      'Je suis traductrice littéraire et enseignante à l’université. Je traduis de l’allemand, du français et de l’anglais vers le catalan et l’espagnol, et depuis 2019 j’ai porté plus de vingt livres en catalan pour Columna et Edicions 62 : romans contemporains, récits autobiographiques, littérature de genre et, à l’occasion, un livre de cuisine.',
      'Diplômée en traduction et interprétation de l’Universitat Pompeu Fabra en 2013, j’y ai suivi l’année suivante le master en études de traduction, avec un mémoire sur la réception à Barcelone de La Visite de la vieille dame de Friedrich Dürrenmatt. En 2022, j’ai soutenu ma thèse de doctorat à l’Universitat Rovira i Virgili, sous la direction d’Anthony Pym et de Carmen Bestué, sur la confiance que les juges accordent — ou non — aux interprètes dans les procédures pénales.',
      'Je suis actuellement enseignante associée au département d’études anglaises et allemandes de l’URV et j’enseigne la traduction juridique à l’Universitat Pompeu Fabra ainsi que dans le master en traduction juridique et interprétation judiciaire de l’UAB. L’enseignement et la recherche — traduction juridique, interprétation en milieu social, sociologie de la traduction — accompagnent mon travail de traductrice.',
    ],
  },
  timeline: [
    {
      period: '2022 –',
      title: {
        ca: 'Professora associada, URV',
        es: 'Profesora asociada, URV',
        en: 'Associate lecturer, URV',
        de: 'Lehrbeauftragte, URV',
        fr: 'Enseignante associée, URV',
      },
      detail: {
        ca: 'Departament d’Estudis Anglesos i Alemanys. Traducció jurídica i econòmica.',
        es: 'Departamento de Estudios Ingleses y Alemanes. Traducción jurídica y económica.',
        en: 'Department of English and German Studies. Legal and economic translation.',
        de: 'Fachbereich für Anglistik und Germanistik. Juristisches und Wirtschaftsübersetzen.',
        fr: 'Département d’études anglaises et allemandes. Traduction juridique et économique.',
      },
      href: 'https://www.deaa.urv.cat/ca/departament/staff/raigal/',
    },
    {
      period: '2022',
      title: {
        ca: 'Doctorat en Estudis Humanístics, URV',
        es: 'Doctorado en Estudios Humanísticos, URV',
        en: 'PhD in Humanities, URV',
        de: 'Promotion in Geisteswissenschaften, URV',
        fr: 'Doctorat en études humanistes, URV',
      },
      detail: {
        ca: '«Quan els jutges (no) confien en els intèrprets». Direcció: Anthony Pym i Carmen Bestué.',
        es: '«Quan els jutges (no) confien en els intèrprets». Dirección: Anthony Pym y Carmen Bestué.',
        en: '“Quan els jutges (no) confien en els intèrprets”. Supervisors: Anthony Pym and Carmen Bestué.',
        de: '„Quan els jutges (no) confien en els intèrprets“. Betreuung: Anthony Pym und Carmen Bestué.',
        fr: '« Quan els jutges (no) confien en els intèrprets ». Direction : Anthony Pym et Carmen Bestué.',
      },
      href: 'https://www.tdx.cat/handle/10803/675003',
    },
    {
      period: '2019 –',
      title: {
        ca: 'Traducció literària per a Grup 62',
        es: 'Traducción literaria para Grup 62',
        en: 'Literary translation for Grup 62',
        de: 'Literaturübersetzung für Grup 62',
        fr: 'Traduction littéraire pour Grup 62',
      },
      detail: {
        ca: 'Columna i Edicions 62. Narrativa, memòries i no-ficció en català.',
        es: 'Columna y Edicions 62. Narrativa, memorias y no ficción en catalán.',
        en: 'Columna and Edicions 62. Fiction, memoir and non-fiction in Catalan.',
        de: 'Columna und Edicions 62. Belletristik, Memoiren und Sachbuch auf Katalanisch.',
        fr: 'Columna et Edicions 62. Fiction, mémoires et essais en catalan.',
      },
    },
    {
      period: '2014',
      title: {
        ca: 'Màster en Estudis de Traducció, UPF',
        es: 'Máster en Estudios de Traducción, UPF',
        en: 'MA in Translation Studies, UPF',
        de: 'Master in Übersetzungswissenschaft, UPF',
        fr: 'Master en études de traduction, UPF',
      },
      detail: {
        ca: 'Treball sobre la recepció de «La visita de la vella dama», de Dürrenmatt, a Barcelona.',
        es: 'Trabajo sobre la recepción de «La visita de la vieja dama», de Dürrenmatt, en Barcelona.',
        en: 'Dissertation on the Barcelona reception of Dürrenmatt’s “The Visit”.',
        de: 'Arbeit über die Rezeption von Dürrenmatts „Der Besuch der alten Dame“ in Barcelona.',
        fr: 'Mémoire sur la réception à Barcelone de « La Visite de la vieille dame » de Dürrenmatt.',
      },
    },
    {
      period: '2013',
      title: {
        ca: 'Grau en Traducció i Interpretació, UPF',
        es: 'Grado en Traducción e Interpretación, UPF',
        en: 'BA in Translation and Interpreting, UPF',
        de: 'Bachelor in Übersetzen und Dolmetschen, UPF',
        fr: 'Licence en traduction et interprétation, UPF',
      },
      detail: {
        ca: 'Treball final sobre la presència del dialecte estirià a internet.',
        es: 'Trabajo final sobre la presencia del dialecto estirio en internet.',
        en: 'Final project on the presence of the Styrian dialect online.',
        de: 'Abschlussarbeit über die Präsenz des steirischen Dialekts im Internet.',
        fr: 'Mémoire de fin d’études sur la présence du dialecte styrien sur internet.',
      },
      href: 'https://repositori.upf.edu/handle/10230/22080',
    },
  ],
  links: [
    {
      label: 'Universitat Rovira i Virgili',
      href: 'https://www.deaa.urv.cat/ca/departament/staff/raigal/',
    },
    { label: 'Dialnet', href: 'https://dialnet.unirioja.es/servlet/tesis?codigo=318640' },
    { label: 'X', href: 'https://x.com/judith8ra', handle: '@judith8ra' },
  ],
  sources: [
    'https://www.deaa.urv.cat/ca/departament/staff/raigal/',
    'https://www.uab.cat/doc/mtj-professorat-en.pdf',
    'https://dialnet.unirioja.es/servlet/tesis?codigo=318640',
    'https://www.tdx.cat/handle/10803/675003',
  ],
};

export function bioFor(locale: Locale): string[] {
  const paragraphs = PROFILE.bio[locale];
  if (paragraphs.length > 0) return paragraphs;
  for (const fallback of ['ca', 'es', 'en'] as const) {
    if (PROFILE.bio[fallback].length > 0) return PROFILE.bio[fallback];
  }
  return [];
}
