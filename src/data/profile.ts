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

/**
 * A journal article, book chapter, research report or thesis. Titles stay in the
 * language they were published in — translating an academic citation would make
 * it uncitable.
 */
export interface Publication {
  year: number;
  title: string;
  /** Journal, publisher or awarding institution. */
  venue: string;
  /** Invisible on the page; it is what the structured data turns into a type. */
  kind: 'article' | 'chapter' | 'report' | 'thesis';
  /** Co-authors in citation order, excluding her. */
  with?: string[];
  href?: string;
  /**
   * Registered DOI, where the work has one. The point of storing it separately
   * from `href` is that it resolves somewhere we do not control: a reader who
   * distrusts this site can check the citation against Crossref instead.
   */
  doi?: string;
}

export interface ProfileLink {
  label: string;
  href: string;
  /** Shown next to the label; keep it short. */
  handle?: string;
}

/**
 * A record about her, or about her work, that somebody else maintains.
 *
 * This replaced a bare list of URLs. The annotation is the part that matters:
 * "here are five links" tells a reader nothing about which one settles a
 * question, and the three flags below are what let the biography page, the
 * `sameAs` set and `llms.txt` each take the right subset without three separate
 * hand-kept lists going out of step.
 */
export interface Authority {
  /** The holding institution or service, in English. */
  label: string;
  href: string;
  /** What can be checked there. One line, English, no marketing. */
  covers: string;
  /**
   * True when the record is *about her* rather than about her work, so it may go
   * into schema.org `sameAs` — which asserts "this is the same person", not
   * "this is related". Grup 62 publishes her and is not her.
   */
  identifies: boolean;
  /**
   * True when somebody other than her or her employers maintains it, so it
   * corroborates rather than repeats. A staff page and an ORCID record are both
   * authoritative and neither is independent.
   */
  independent: boolean;
}

export interface Profile {
  name: string;
  /**
   * Every form of her name a citation is known to use, canonical first.
   * Publishers disagree about the hyphen: Crossref carries her as "Judith
   * Raigal-Aran" on the John Benjamins chapter and the Taylor & Francis article,
   * and as "Judith Raigal Aran" on the two Sage ones, so a bibliography search
   * on either form alone comes back short.
   *
   * The bare "Judith Raigal" is deliberately absent. It belongs to more than one
   * person, and claiming it as an alternate name invites precisely the merge this
   * list exists to prevent — which is the opposite of what naming variants is
   * for.
   */
  nameVariants: string[];
  /** ORCID iD, bare. The one identifier that is hers by construction. */
  orcid: string;
  /** Web of Science ResearcherID, asserted from her own ORCID record. */
  researcherId: string;
  /** Records other people keep. See `Authority`. */
  authorities: Authority[];
  /**
   * The day the `authorities` were last opened and checked to still say what
   * this file claims. Not a content date: it says how stale the corroboration
   * is, which is the thing a reader cannot otherwise judge.
   */
  verifiedOn: string;
  /**
   * Portrait shown on the biography page. Left null until she supplies one —
   * the layout simply drops the column rather than showing a placeholder.
   */
  portrait: { src: string; width: number; height: number } | null;
  /** Public, professional contact address only. */
  email: string | null;
  location: LocalisedText;
  bio: LocalisedParagraphs;
  /** Areas she actually works in. Sourced, not a marketing pitch. */
  fields: LocalisedParagraphs;
  /** One line naming the language pair, phrased naturally per locale. */
  workingLanguages: LocalisedText;
  timeline: TimelineEntry[];
  publications: Publication[];
  links: ProfileLink[];
}

export const PROFILE: Profile = {
  name: 'Judith Raigal Aran',
  nameVariants: [
    'Judith Raigal Aran',
    'Judith Raigal-Aran',
    'Raigal Aran, Judith',
    'Raigal-Aran, J.',
  ],
  orcid: '0000-0002-0387-0867',
  researcherId: 'R-7416-2018',
  verifiedOn: '2026-08-03',
  authorities: [
    {
      label: 'ORCID',
      href: 'https://orcid.org/0000-0002-0387-0867',
      covers:
        'The identity record she controls. Start here: it is the only identifier that is hers by construction rather than by name match.',
      identifies: true,
      independent: false,
    },
    {
      label: 'Universitat Rovira i Virgili — Department of English and German Studies',
      href: 'https://www.deaa.urv.cat/ca/departament/staff/raigal/',
      covers: 'Her current post, the subjects she teaches, and her institutional email.',
      identifies: true,
      independent: false,
    },
    {
      label: 'Dialnet (Universidad de La Rioja)',
      href: 'https://dialnet.unirioja.es/servlet/autor?codigo=5746504',
      covers:
        'Author record for the Spanish- and Catalan-language scholarship. Narrower than the list on this site, and its own page says it is not exhaustive.',
      identifies: true,
      independent: true,
    },
    {
      label: 'Web of Science (ResearcherID R-7416-2018)',
      href: 'https://www.webofscience.com/wos/author/record/R-7416-2018',
      covers: 'Indexed journal articles. Asserted from her own ORCID record, so the link is hers.',
      identifies: true,
      independent: true,
    },
    {
      label: 'todostuslibros.com (CEGAL)',
      href: 'https://www.todostuslibros.com/creador/raigal-aran-judith_2438224',
      covers:
        'Creator record held by the Spanish booksellers’ association, built from ISBN registrations rather than from publisher copy. Its count runs higher than the 22 here because it lists editions and formats this bibliography treats as one title.',
      identifies: true,
      independent: true,
    },
    {
      label: 'Open Library',
      href: 'https://openlibrary.org/authors/OL12539003A',
      covers:
        'Library author record for the translated editions. Partial: it holds the titles that reached its catalogue, not the whole bibliography.',
      identifies: true,
      independent: true,
    },
    {
      label: 'TDX — Tesis Doctorals en Xarxa',
      href: 'https://www.tdx.cat/handle/10803/675003',
      covers: 'Full text of the 2022 doctoral thesis, deposited by the awarding university.',
      identifies: false,
      independent: true,
    },
    {
      label: 'Universitat Autònoma de Barcelona — MA in Legal Translation and Court Interpreting',
      href: 'https://www.uab.cat/doc/mtj-professorat-en.pdf',
      covers: 'Faculty list naming her on the UAB master’s programme (PDF).',
      identifies: false,
      independent: false,
    },
    {
      label: 'Grup 62',
      href: 'https://www.grup62.cat/',
      covers:
        'Publisher of every book here, through its Columna and Edicions 62 imprints. Each record links the individual catalogue page that names her in its Traductora field.',
      identifies: false,
      independent: true,
    },
  ],
  portrait: null,
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
  fields: {
    ca: [
      'Traducció literària de l’anglès, l’alemany i el francès al català',
      'Traducció jurídica i econòmica',
      'Docència universitària en traducció jurídica i interpretació judicial',
    ],
    es: [
      'Traducción literaria del inglés, el alemán y el francés al catalán',
      'Traducción jurídica y económica',
      'Docencia universitaria en traducción jurídica e interpretación judicial',
    ],
    en: [
      'Literary translation from English, German and French into Catalan',
      'Legal and economic translation',
      'University teaching in legal translation and court interpreting',
    ],
    de: [
      'Literaturübersetzung aus dem Englischen, Deutschen und Französischen ins Katalanische',
      'Juristisches und Wirtschaftsübersetzen',
      'Universitätslehre in juristischem Übersetzen und Gerichtsdolmetschen',
    ],
    fr: [
      'Traduction littéraire de l’anglais, de l’allemand et du français vers le catalan',
      'Traduction juridique et économique',
      'Enseignement universitaire en traduction juridique et interprétation judiciaire',
    ],
  },
  workingLanguages: {
    ca: 'Alemany, francès i anglès → català i castellà',
    es: 'Alemán, francés e inglés → catalán y castellano',
    en: 'German, French and English → Catalan and Spanish',
    de: 'Deutsch, Französisch und Englisch → Katalanisch und Spanisch',
    fr: 'Allemand, français et anglais → catalan et espagnol',
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
  publications: [
    {
      year: 2026,
      kind: 'article',
      title:
        '¿Cómo enseñar desde la incertidumbre? Resultados de aprendizaje de traducción en la era de la automatización',
      venue: 'redit — Revista Electrónica de Didáctica de la Traducción y la Interpretación, 20',
      with: ['Anthony Pym'],
      href: 'https://revistas.uma.es/index.php/redit/article/view/24035',
    },
    {
      year: 2026,
      kind: 'report',
      title: 'Generative AI in the Translation Revision Class. Technical Report on the Spanish Activity',
      venue: 'Universitat Rovira i Virgili',
      with: ['Nune Ayvazyan', 'Yu Hao', 'Anthony Pym'],
      href: 'https://doi.org/10.13140/RG.2.2.33219.26406',
      doi: '10.13140/RG.2.2.33219.26406',
    },
    {
      year: 2024,
      kind: 'article',
      title:
        'Recommendations on the translation of academic texts in the social sciences and the humanities',
      venue: 'Social Science Information',
      with: ['Esperança Bielsa', 'Mattea Cussel', 'Oriol Barranco', 'Carmen Bestué'],
      href: 'https://journals.sagepub.com/doi/10.1177/05390184241261509',
      doi: '10.1177/05390184241261509',
    },
    {
      year: 2023,
      kind: 'article',
      title:
        'Academics in the semi-periphery: Translation and linguistic strategies on the rocky road to publishing in English',
      venue: 'Social Science Information',
      with: ['Mattea Cussel', 'Oriol Barranco'],
      href: 'https://journals.sagepub.com/doi/abs/10.1177/05390184231221460',
      doi: '10.1177/05390184231221460',
    },
    {
      year: 2023,
      kind: 'article',
      title:
        'Applying a sociological perspective to the analysis of court interpreting interactions: Exploring trust and distrust',
      venue: "The Interpreters' Newsletter, 28 — EUT Edizioni Università di Trieste",
      with: ['Carmen Bestué'],
      href: 'https://www.openstarts.units.it/handle/10077/35554',
    },
    {
      year: 2023,
      kind: 'chapter',
      title: 'Non-standard court interpreting as risk management',
      venue: 'Introducing New Hypertexts on Interpreting (Studies), John Benjamins',
      with: ['Anthony Pym', 'Carmen Bestué'],
      href: 'https://benjamins.com/catalog/btl.160.06pym',
      doi: '10.1075/btl.160.06pym',
    },
    {
      year: 2022,
      kind: 'thesis',
      title: 'Quan els jutges (no) confien en els intèrprets: anàlisi d’un corpus de procediments penals',
      venue: 'Tesi doctoral, Universitat Rovira i Virgili',
      href: 'https://www.tdx.cat/handle/10803/675003',
    },
    {
      year: 2022,
      kind: 'chapter',
      title: 'Careers in languages',
      venue:
        'Inclusion, Diversity and Communication Across Cultures. A Teacher’s Book with Classroom Activities for Secondary Education, Universitat Autònoma de Barcelona',
      with: ['Marta Arumí Ribas', 'Carmen Bestué'],
      href: 'https://ddd.uab.cat/record/259878',
    },
    {
      year: 2021,
      kind: 'article',
      title:
        'La recepció crítica de l’estrena de «La visita de la vella dama» [Der Besuch der alten Dame], de Friedrich Dürrenmatt a Barcelona (1962)',
      venue: 'Anuari TRILCAT, 10 (2020–2021)',
      href: 'https://dialnet.unirioja.es/servlet/articulo?codigo=8595736',
    },
    {
      year: 2021,
      kind: 'article',
      title:
        'Child language brokering and multilingualism in Catalonia: language use and attitudes in a bilingual region',
      venue: 'Language and Intercultural Communication, 22(4)',
      with: ['Gema Rubio-Carbonero', 'Mireia Vargas-Urpí'],
      href: 'https://doi.org/10.1080/14708477.2021.2005617',
      doi: '10.1080/14708477.2021.2005617',
    },
    {
      year: 2021,
      kind: 'article',
      title:
        'Disseny d’una simulació judicial multilingüe per futurs traductors, intèrprets i operadors jurídics: col·laboració interdepartamental',
      venue: 'Revista del CIDUI, 5',
      with: [
        'Esther Torres-Simón',
        'Diana Marín Consarnau',
        'Maria Font i Mas',
        'Sergio Prats Jané',
        'Anthony Pym',
      ],
      href: 'https://raco.cat/index.php/RevistaCIDUI/article/view/378900',
    },
    {
      year: 2019,
      kind: 'report',
      title: 'Normas recomendadas para trabajar con intérpretes judiciales',
      venue: 'Grup de Recerca Intercultural, URV',
      with: ['Anthony Pym'],
      href: 'https://www.intercultural.urv.cat/media/upload/domain_317/arxius/Normas%20recomendadas_ES_Agosto2019_AP.pdf',
    },
    {
      year: 2018,
      kind: 'chapter',
      title:
        'Les expectatives del client: el contracte de serveis d’interpretació i traducció dels òrgans judicials de Catalunya',
      venue: 'Recerca en Humanitats 2018',
      href: 'https://dialnet.unirioja.es/servlet/articulo?codigo=6641047',
    },
  ],
  links: [
    {
      label: 'Universitat Rovira i Virgili',
      href: 'https://www.deaa.urv.cat/ca/departament/staff/raigal/',
    },
    { label: 'ORCID', href: 'https://orcid.org/0000-0002-0387-0867', handle: '0000-0002-0387-0867' },
    // The author profile, not the thesis record it used to point at: it lists the
    // articles and chapters too, which is what somebody following a "find me
    // elsewhere" link wants.
    { label: 'Dialnet', href: 'https://dialnet.unirioja.es/servlet/autor?codigo=5746504' },
    { label: 'X', href: 'https://x.com/judith8ra', handle: '@judith8ra' },
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
