import type { Locale } from './config';

/** Fixed keys, not an array, so every locale is required to answer all of them. */
export const FAQ_KEYS = ['languages', 'volume', 'genres', 'legal', 'where', 'commission'] as const;

export type FaqKey = (typeof FAQ_KEYS)[number];

/**
 * One dictionary shape for every locale. Keeping it as a typed literal means a
 * missing or misspelled key is a build error rather than an empty string in
 * production.
 */
export interface Dictionary {
  site: { name: string; role: string; tagline: string };
  nav: { home: string; works: string; about: string; contact: string; menu: string };
  a11y: {
    skipToContent: string;
    languageSwitcher: string;
    currentLanguage: string;
    mainNav: string;
  };
  home: {
    heroLead: string;
    shelfHint: string;
    ctaWorks: string;
    ctaAbout: string;
    selectedHeading: string;
    metaDescription: string;
  };
  shelf: {
    region: string;
    previous: string;
    next: string;
    open: string;
    selected: string;
    loading: string;
    webglUnsupported: string;
    listFallback: string;
  };
  works: {
    title: string;
    lead: string;
    count: string;
    countOne: string;
    filterLanguage: string;
    filterCategory: string;
    filterAll: string;
    empty: string;
    metaDescription: string;
  };
  book: {
    originalTitle: string;
    coverAlt: string;
    author: string;
    publisher: string;
    year: string;
    isbn: string;
    pages: string;
    from: string;
    into: string;
    category: string;
    coTranslators: string;
    synopsis: string;
    details: string;
    sources: string;
    back: string;
    previous: string;
    next: string;
    metaDescription: string;
  };
  categories: Record<
    'fiction' | 'nonfiction' | 'memoir' | 'ya' | 'cookbook' | 'other',
    string
  >;
  languages: Record<'ca' | 'es' | 'en' | 'de' | 'fr' | 'it', string>;
  about: {
    title: string;
    lead: string;
    /** Heading over the academic-publication list. */
    research: string;
    /** Alt text for the portrait, if one is supplied. */
    portraitAlt: string;
    metaDescription: string;
  };
  contact: {
    title: string;
    lead: string;
    email: string;
    elsewhere: string;
    /** Heading over the list of areas she works in. */
    fields: string;
    /** Heading over the working-language pair. */
    languages: string;
    metaDescription: string;
  };
  /** Answers carry `{token}`s filled from the bibliography. */
  faq: { title: string; entries: Record<FaqKey, { question: string; answer: string }> };
  footer: { rights: string; coverNotice: string; colophon: string };
}

const ca: Dictionary = {
  site: {
    name: 'Judith Raigal Aran',
    role: 'Traductora literària',
    tagline: 'De l’anglès, l’alemany i el francès al català i al castellà',
  },
  nav: {
    home: 'Inici',
    works: 'Traduccions',
    about: 'Biografia',
    contact: 'Contacte',
    menu: 'Menú',
  },
  a11y: {
    skipToContent: 'Vés al contingut principal',
    languageSwitcher: 'Canvia d’idioma',
    currentLanguage: 'Idioma actual',
    mainNav: 'Navegació principal',
  },
  home: {
    heroLead:
      'Cada volum d’aquesta prestatgeria és un llibre que he portat a una altra llengua. Tria’n un per veure’n la fitxa completa.',
    shelfHint: 'Arrossega la prestatgeria o fes servir les fletxes. Clica un volum per obrir-lo.',
    ctaWorks: 'Veure totes les traduccions',
    ctaAbout: 'Sobre mi',
    selectedHeading: 'Volum seleccionat',
    metaDescription:
      'Prestatgeria interactiva amb les traduccions literàries de Judith Raigal Aran, de l’anglès, l’alemany i el francès al català i al castellà.',
  },
  shelf: {
    region: 'Prestatgeria interactiva de traduccions',
    previous: 'Volum anterior',
    next: 'Volum següent',
    open: 'Obre la fitxa del llibre',
    selected: '{title}, de {author}. Volum {position} de {total}.',
    loading: 'Carregant la prestatgeria…',
    webglUnsupported:
      'El teu navegador no pot mostrar la prestatgeria en 3D. Tot seguit tens el catàleg complet.',
    listFallback: 'Catàleg de traduccions',
  },
  works: {
    title: 'Traduccions',
    lead: 'Catàleg complet de llibres traduïts, amb l’edició, l’any i l’ISBN de cada volum.',
    count: '{count} traduccions',
    countOne: '1 traducció',
    filterLanguage: 'Llengua original',
    filterCategory: 'Gènere',
    filterAll: 'Totes',
    empty: 'No hi ha cap títol que coincideixi amb aquests filtres.',
    metaDescription:
      'Catàleg complet de les traduccions literàries de Judith Raigal Aran, amb editorial, any i ISBN.',
  },
  book: {
    originalTitle: 'Títol original',
    coverAlt: 'Coberta de {title}, de {author}',
    author: 'Autoria',
    publisher: 'Editorial',
    year: 'Any',
    isbn: 'ISBN',
    pages: 'Pàgines',
    from: 'Llengua original',
    into: 'Llengua d’arribada',
    category: 'Gènere',
    coTranslators: 'Amb',
    synopsis: 'Sinopsi',
    details: 'Fitxa tècnica',
    sources: 'Fonts',
    back: 'Torna a les traduccions',
    previous: 'Anterior',
    next: 'Següent',
    metaDescription: '{title}, de {author}. Traducció de Judith Raigal Aran per a {publisher}.',
  },
  categories: {
    fiction: 'Narrativa',
    nonfiction: 'No-ficció',
    memoir: 'Memòries',
    ya: 'Juvenil',
    cookbook: 'Cuina',
    other: 'Altres',
  },
  languages: {
    ca: 'català',
    es: 'castellà',
    en: 'anglès',
    de: 'alemany',
    fr: 'francès',
    it: 'italià',
  },
  about: {
    title: 'Biografia',
    lead: 'Traductora literària i docent universitària.',
    research: 'Recerca i publicacions',
    portraitAlt: 'Retrat de Judith Raigal Aran',
    metaDescription:
      'Biografia professional de Judith Raigal Aran, traductora literària i docent a la URV i la UPF.',
  },
  contact: {
    title: 'Contacte',
    lead: 'Per a encàrrecs editorials, docència o consultes sobre qualsevol de les traduccions.',
    email: 'Correu electrònic',
    fields: 'Àmbits de treball',
    languages: 'Llengües de treball',
    elsewhere: 'També em trobaràs a',
    metaDescription: 'Contacte professional de la traductora literària Judith Raigal Aran.',
  },
  faq: {
    title: 'Preguntes freqüents',
    entries: {
      languages: {
        question: 'En quines llengües treballes?',
        answer:
          'Les meves llengües de treball són: {workingLanguages}. Dels {count} volums publicats, tots han sortit en {targetLanguages}; les llengües de partida són {sourceLanguages}.',
      },
      volume: {
        question: 'Quantes traduccions has publicat?',
        answer:
          '{count} llibres, publicats entre el {firstYear} i el {lastYear} per a {publishers}. El catàleg complet, amb l’editorial, l’any i l’ISBN de cada volum, és a la pàgina de traduccions.',
      },
      genres: {
        question: 'Quins gèneres tradueixes?',
        answer:
          'Al catàleg hi ha {genres}. Cada fitxa indica el gènere del volum, la llengua original i qui n’és l’autoria.',
      },
      legal: {
        question: 'Fas traducció jurídica?',
        answer:
          'Sí. Compagino la traducció literària amb la traducció jurídica i econòmica, i imparteixo traducció jurídica i interpretació judicial a la Universitat Rovira i Virgili, la Universitat Pompeu Fabra i la Universitat Autònoma de Barcelona.',
      },
      where: {
        question: 'On treballes?',
        answer:
          'Entre {location}. Tradueixo per a editorials del Grup 62 i faig classe a la URV, la UPF i la UAB.',
      },
      commission: {
        question: 'Com et puc encarregar una traducció?',
        answer:
          'Escriu-me a {email}. Els encàrrecs editorials, les propostes de docència i les consultes sobre qualsevol dels títols del catàleg van al mateix correu.',
      },
    },
  },
  footer: {
    rights: 'Tots els drets reservats.',
    coverNotice:
      'Les cobertes reproduïdes pertanyen a les editorials corresponents i es mostren únicament a efectes d’identificació bibliogràfica.',
    colophon: 'Fet amb Astro i three.js.',
  },
};

const es: Dictionary = {
  site: {
    name: 'Judith Raigal Aran',
    role: 'Traductora literaria',
    tagline: 'Del inglés, el alemán y el francés al catalán y al castellano',
  },
  nav: {
    home: 'Inicio',
    works: 'Traducciones',
    about: 'Biografía',
    contact: 'Contacto',
    menu: 'Menú',
  },
  a11y: {
    skipToContent: 'Ir al contenido principal',
    languageSwitcher: 'Cambiar de idioma',
    currentLanguage: 'Idioma actual',
    mainNav: 'Navegación principal',
  },
  home: {
    heroLead:
      'Cada volumen de esta estantería es un libro que he llevado a otra lengua. Elige uno para ver su ficha completa.',
    shelfHint: 'Arrastra la estantería o usa las flechas. Haz clic en un volumen para abrirlo.',
    ctaWorks: 'Ver todas las traducciones',
    ctaAbout: 'Sobre mí',
    selectedHeading: 'Volumen seleccionado',
    metaDescription:
      'Estantería interactiva con las traducciones literarias de Judith Raigal Aran, del inglés, el alemán y el francés al catalán y al castellano.',
  },
  shelf: {
    region: 'Estantería interactiva de traducciones',
    previous: 'Volumen anterior',
    next: 'Volumen siguiente',
    open: 'Abrir la ficha del libro',
    selected: '{title}, de {author}. Volumen {position} de {total}.',
    loading: 'Cargando la estantería…',
    webglUnsupported:
      'Tu navegador no puede mostrar la estantería en 3D. A continuación tienes el catálogo completo.',
    listFallback: 'Catálogo de traducciones',
  },
  works: {
    title: 'Traducciones',
    lead: 'Catálogo completo de libros traducidos, con la edición, el año y el ISBN de cada volumen.',
    count: '{count} traducciones',
    countOne: '1 traducción',
    filterLanguage: 'Lengua original',
    filterCategory: 'Género',
    filterAll: 'Todas',
    empty: 'No hay ningún título que coincida con estos filtros.',
    metaDescription:
      'Catálogo completo de las traducciones literarias de Judith Raigal Aran, con editorial, año e ISBN.',
  },
  book: {
    originalTitle: 'Título original',
    coverAlt: 'Cubierta de {title}, de {author}',
    author: 'Autoría',
    publisher: 'Editorial',
    year: 'Año',
    isbn: 'ISBN',
    pages: 'Páginas',
    from: 'Lengua original',
    into: 'Lengua de llegada',
    category: 'Género',
    coTranslators: 'Con',
    synopsis: 'Sinopsis',
    details: 'Ficha técnica',
    sources: 'Fuentes',
    back: 'Volver a las traducciones',
    previous: 'Anterior',
    next: 'Siguiente',
    metaDescription: '{title}, de {author}. Traducción de Judith Raigal Aran para {publisher}.',
  },
  categories: {
    fiction: 'Narrativa',
    nonfiction: 'No ficción',
    memoir: 'Memorias',
    ya: 'Juvenil',
    cookbook: 'Cocina',
    other: 'Otros',
  },
  languages: {
    ca: 'catalán',
    es: 'castellano',
    en: 'inglés',
    de: 'alemán',
    fr: 'francés',
    it: 'italiano',
  },
  about: {
    title: 'Biografía',
    lead: 'Traductora literaria y docente universitaria.',
    research: 'Investigación y publicaciones',
    portraitAlt: 'Retrato de Judith Raigal Aran',
    metaDescription:
      'Biografía profesional de Judith Raigal Aran, traductora literaria y docente en la URV y la UPF.',
  },
  contact: {
    title: 'Contacto',
    lead: 'Para encargos editoriales, docencia o consultas sobre cualquiera de las traducciones.',
    email: 'Correo electrónico',
    fields: 'Ámbitos de trabajo',
    languages: 'Lenguas de trabajo',
    elsewhere: 'También me encontrarás en',
    metaDescription: 'Contacto profesional de la traductora literaria Judith Raigal Aran.',
  },
  faq: {
    title: 'Preguntas frecuentes',
    entries: {
      languages: {
        question: '¿En qué lenguas trabajas?',
        answer:
          'Mis lenguas de trabajo son: {workingLanguages}. De los {count} volúmenes publicados, todos han salido en {targetLanguages}; las lenguas de partida son {sourceLanguages}.',
      },
      volume: {
        question: '¿Cuántas traducciones has publicado?',
        answer:
          '{count} libros, publicados entre {firstYear} y {lastYear} para {publishers}. El catálogo completo, con la editorial, el año y el ISBN de cada volumen, está en la página de traducciones.',
      },
      genres: {
        question: '¿Qué géneros traduces?',
        answer:
          'En el catálogo hay {genres}. Cada ficha indica el género del volumen, la lengua original y su autoría.',
      },
      legal: {
        question: '¿Haces traducción jurídica?',
        answer:
          'Sí. Compagino la traducción literaria con la traducción jurídica y económica, e imparto traducción jurídica e interpretación judicial en la Universitat Rovira i Virgili, la Universitat Pompeu Fabra y la Universitat Autònoma de Barcelona.',
      },
      where: {
        question: '¿Dónde trabajas?',
        answer:
          'Entre {location}. Traduzco para editoriales del Grup 62 y doy clase en la URV, la UPF y la UAB.',
      },
      commission: {
        question: '¿Cómo puedo encargarte una traducción?',
        answer:
          'Escríbeme a {email}. Los encargos editoriales, las propuestas de docencia y las consultas sobre cualquiera de los títulos del catálogo van al mismo correo.',
      },
    },
  },
  footer: {
    rights: 'Todos los derechos reservados.',
    coverNotice:
      'Las cubiertas reproducidas pertenecen a sus respectivas editoriales y se muestran únicamente a efectos de identificación bibliográfica.',
    colophon: 'Hecho con Astro y three.js.',
  },
};

const en: Dictionary = {
  site: {
    name: 'Judith Raigal Aran',
    role: 'Literary translator',
    tagline: 'From English, German and French into Catalan and Spanish',
  },
  nav: {
    home: 'Home',
    works: 'Translations',
    about: 'Biography',
    contact: 'Contact',
    menu: 'Menu',
  },
  a11y: {
    skipToContent: 'Skip to main content',
    languageSwitcher: 'Change language',
    currentLanguage: 'Current language',
    mainNav: 'Main navigation',
  },
  home: {
    heroLead:
      'Every volume on this shelf is a book I carried into another language. Pick one to read its full record.',
    shelfHint: 'Drag the shelf or use the arrow keys. Click a volume to open it.',
    ctaWorks: 'See all translations',
    ctaAbout: 'About me',
    selectedHeading: 'Selected volume',
    metaDescription:
      'An interactive shelf of the literary translations of Judith Raigal Aran, from English, German and French into Catalan and Spanish.',
  },
  shelf: {
    region: 'Interactive shelf of translations',
    previous: 'Previous volume',
    next: 'Next volume',
    open: 'Open the book record',
    selected: '{title}, by {author}. Volume {position} of {total}.',
    loading: 'Loading the shelf…',
    webglUnsupported:
      'Your browser cannot display the 3D shelf. The full catalogue is listed below.',
    listFallback: 'Catalogue of translations',
  },
  works: {
    title: 'Translations',
    lead: 'The complete catalogue of translated books, with the edition, year and ISBN of every volume.',
    count: '{count} translations',
    countOne: '1 translation',
    filterLanguage: 'Source language',
    filterCategory: 'Genre',
    filterAll: 'All',
    empty: 'No title matches these filters.',
    metaDescription:
      'The complete catalogue of literary translations by Judith Raigal Aran, with publisher, year and ISBN.',
  },
  book: {
    originalTitle: 'Original title',
    coverAlt: 'Cover of {title} by {author}',
    author: 'Author',
    publisher: 'Publisher',
    year: 'Year',
    isbn: 'ISBN',
    pages: 'Pages',
    from: 'Source language',
    into: 'Target language',
    category: 'Genre',
    coTranslators: 'With',
    synopsis: 'Synopsis',
    details: 'Edition details',
    sources: 'Sources',
    back: 'Back to translations',
    previous: 'Previous',
    next: 'Next',
    metaDescription: '{title}, by {author}. Translated by Judith Raigal Aran for {publisher}.',
  },
  categories: {
    fiction: 'Fiction',
    nonfiction: 'Non-fiction',
    memoir: 'Memoir',
    ya: 'Young adult',
    cookbook: 'Cookery',
    other: 'Other',
  },
  languages: {
    ca: 'Catalan',
    es: 'Spanish',
    en: 'English',
    de: 'German',
    fr: 'French',
    it: 'Italian',
  },
  about: {
    title: 'Biography',
    lead: 'Literary translator and university lecturer.',
    research: 'Research and publications',
    portraitAlt: 'Portrait of Judith Raigal Aran',
    metaDescription:
      'Professional biography of Judith Raigal Aran, literary translator and lecturer at URV and UPF.',
  },
  contact: {
    title: 'Contact',
    lead: 'For publishing commissions, teaching, or questions about any of the translations.',
    email: 'Email',
    fields: 'Areas of work',
    languages: 'Working languages',
    elsewhere: 'You can also find me on',
    metaDescription: 'Professional contact details for literary translator Judith Raigal Aran.',
  },
  faq: {
    title: 'Frequently asked questions',
    entries: {
      languages: {
        question: 'Which languages do you work in?',
        answer:
          'My working languages are: {workingLanguages}. All {count} published volumes have appeared in {targetLanguages}; the source languages are {sourceLanguages}.',
      },
      volume: {
        question: 'How many translations have you published?',
        answer:
          '{count} books, published between {firstYear} and {lastYear} for {publishers}. The full catalogue, with the publisher, year and ISBN of every volume, is on the translations page.',
      },
      genres: {
        question: 'Which genres do you translate?',
        answer:
          'The catalogue holds {genres}. Every record names the genre, the source language and the author of the volume.',
      },
      legal: {
        question: 'Do you take legal translation work?',
        answer:
          'Yes. Literary translation runs alongside legal and economic translation, and I teach legal translation and court interpreting at Universitat Rovira i Virgili, Universitat Pompeu Fabra and Universitat Autònoma de Barcelona.',
      },
      where: {
        question: 'Where do you work?',
        answer:
          'Between {location}. I translate for the Grup 62 imprints and teach at URV, UPF and UAB.',
      },
      commission: {
        question: 'How can I commission a translation?',
        answer:
          'Write to {email}. Publishing commissions, teaching enquiries and questions about any title in the catalogue all reach the same address.',
      },
    },
  },
  footer: {
    rights: 'All rights reserved.',
    coverNotice:
      'The cover images reproduced here belong to their respective publishers and are shown for bibliographic identification only.',
    colophon: 'Built with Astro and three.js.',
  },
};

const de: Dictionary = {
  site: {
    name: 'Judith Raigal Aran',
    role: 'Literaturübersetzerin',
    tagline: 'Aus dem Englischen, Deutschen und Französischen ins Katalanische und Spanische',
  },
  nav: {
    home: 'Start',
    works: 'Übersetzungen',
    about: 'Biografie',
    contact: 'Kontakt',
    menu: 'Menü',
  },
  a11y: {
    skipToContent: 'Zum Hauptinhalt springen',
    languageSwitcher: 'Sprache wechseln',
    currentLanguage: 'Aktuelle Sprache',
    mainNav: 'Hauptnavigation',
  },
  home: {
    heroLead:
      'Jeder Band in diesem Regal ist ein Buch, das ich in eine andere Sprache übertragen habe. Wählen Sie einen aus, um den vollständigen Eintrag zu sehen.',
    shelfHint: 'Ziehen Sie am Regal oder nutzen Sie die Pfeiltasten. Klicken Sie einen Band an, um ihn zu öffnen.',
    ctaWorks: 'Alle Übersetzungen ansehen',
    ctaAbout: 'Über mich',
    selectedHeading: 'Ausgewählter Band',
    metaDescription:
      'Interaktives Bücherregal mit den literarischen Übersetzungen von Judith Raigal Aran aus dem Englischen, Deutschen und Französischen ins Katalanische und Spanische.',
  },
  shelf: {
    region: 'Interaktives Regal mit Übersetzungen',
    previous: 'Vorheriger Band',
    next: 'Nächster Band',
    open: 'Buchdetails öffnen',
    selected: '{title} von {author}. Band {position} von {total}.',
    loading: 'Regal wird geladen…',
    webglUnsupported:
      'Ihr Browser kann das 3D-Regal nicht darstellen. Der vollständige Katalog folgt unten.',
    listFallback: 'Katalog der Übersetzungen',
  },
  works: {
    title: 'Übersetzungen',
    lead: 'Vollständiger Katalog der übersetzten Bücher, mit Ausgabe, Jahr und ISBN jedes Bandes.',
    count: '{count} Übersetzungen',
    countOne: '1 Übersetzung',
    filterLanguage: 'Ausgangssprache',
    filterCategory: 'Genre',
    filterAll: 'Alle',
    empty: 'Kein Titel entspricht diesen Filtern.',
    metaDescription:
      'Vollständiger Katalog der literarischen Übersetzungen von Judith Raigal Aran, mit Verlag, Jahr und ISBN.',
  },
  book: {
    originalTitle: 'Originaltitel',
    coverAlt: 'Buchumschlag von {title} von {author}',
    author: 'Autorin oder Autor',
    publisher: 'Verlag',
    year: 'Jahr',
    isbn: 'ISBN',
    pages: 'Seiten',
    from: 'Ausgangssprache',
    into: 'Zielsprache',
    category: 'Genre',
    coTranslators: 'Mit',
    synopsis: 'Inhalt',
    details: 'Ausgabe',
    sources: 'Quellen',
    back: 'Zurück zu den Übersetzungen',
    previous: 'Zurück',
    next: 'Weiter',
    metaDescription:
      '{title} von {author}. Übersetzt von Judith Raigal Aran für {publisher}.',
  },
  categories: {
    fiction: 'Belletristik',
    nonfiction: 'Sachbuch',
    memoir: 'Memoiren',
    ya: 'Jugendbuch',
    cookbook: 'Kochbuch',
    other: 'Sonstiges',
  },
  languages: {
    ca: 'Katalanisch',
    es: 'Spanisch',
    en: 'Englisch',
    de: 'Deutsch',
    fr: 'Französisch',
    it: 'Italienisch',
  },
  about: {
    title: 'Biografie',
    lead: 'Literaturübersetzerin und Universitätsdozentin.',
    research: 'Forschung und Publikationen',
    portraitAlt: 'Porträt von Judith Raigal Aran',
    metaDescription:
      'Berufliche Biografie von Judith Raigal Aran, Literaturübersetzerin und Dozentin an der URV und der UPF.',
  },
  contact: {
    title: 'Kontakt',
    lead: 'Für Verlagsaufträge, Lehre oder Fragen zu einer der Übersetzungen.',
    email: 'E-Mail',
    fields: 'Arbeitsbereiche',
    languages: 'Arbeitssprachen',
    elsewhere: 'Sie finden mich auch auf',
    metaDescription: 'Beruflicher Kontakt der Literaturübersetzerin Judith Raigal Aran.',
  },
  faq: {
    title: 'Häufige Fragen',
    entries: {
      languages: {
        question: 'Mit welchen Sprachen arbeiten Sie?',
        answer:
          'Meine Arbeitssprachen sind: {workingLanguages}. Alle {count} veröffentlichten Bände sind auf {targetLanguages} erschienen; die Ausgangssprachen sind {sourceLanguages}.',
      },
      volume: {
        question: 'Wie viele Übersetzungen haben Sie veröffentlicht?',
        answer:
          '{count} Bücher, erschienen zwischen {firstYear} und {lastYear} bei {publishers}. Der vollständige Katalog mit Verlag, Jahr und ISBN jedes Bandes steht auf der Seite mit den Übersetzungen.',
      },
      genres: {
        question: 'Welche Genres übersetzen Sie?',
        answer:
          'Der Katalog umfasst {genres}. Jeder Eintrag nennt Genre, Ausgangssprache und Autorschaft des Bandes.',
      },
      legal: {
        question: 'Übernehmen Sie juristische Übersetzungen?',
        answer:
          'Ja. Neben der Literaturübersetzung arbeite ich als juristische und Wirtschaftsübersetzerin und unterrichte juristisches Übersetzen und Gerichtsdolmetschen an der Universitat Rovira i Virgili, der Universitat Pompeu Fabra und der Universitat Autònoma de Barcelona.',
      },
      where: {
        question: 'Wo arbeiten Sie?',
        answer:
          'Zwischen {location}. Ich übersetze für die Verlage der Grup 62 und lehre an der URV, der UPF und der UAB.',
      },
      commission: {
        question: 'Wie kann ich eine Übersetzung in Auftrag geben?',
        answer:
          'Schreiben Sie an {email}. Verlagsaufträge, Anfragen zur Lehre und Fragen zu einem Titel des Katalogs erreichen mich alle unter derselben Adresse.',
      },
    },
  },
  footer: {
    rights: 'Alle Rechte vorbehalten.',
    coverNotice:
      'Die abgebildeten Buchumschläge gehören den jeweiligen Verlagen und werden ausschließlich zur bibliografischen Kennzeichnung gezeigt.',
    colophon: 'Erstellt mit Astro und three.js.',
  },
};

const fr: Dictionary = {
  site: {
    name: 'Judith Raigal Aran',
    role: 'Traductrice littéraire',
    tagline: 'De l’anglais, de l’allemand et du français vers le catalan et l’espagnol',
  },
  nav: {
    home: 'Accueil',
    works: 'Traductions',
    about: 'Biographie',
    contact: 'Contact',
    menu: 'Menu',
  },
  a11y: {
    skipToContent: 'Aller au contenu principal',
    languageSwitcher: 'Changer de langue',
    currentLanguage: 'Langue actuelle',
    mainNav: 'Navigation principale',
  },
  home: {
    heroLead:
      'Chaque volume de cette étagère est un livre que j’ai fait passer d’une langue à l’autre. Choisissez-en un pour consulter sa fiche complète.',
    shelfHint: 'Faites glisser l’étagère ou utilisez les flèches. Cliquez sur un volume pour l’ouvrir.',
    ctaWorks: 'Voir toutes les traductions',
    ctaAbout: 'À propos',
    selectedHeading: 'Volume sélectionné',
    metaDescription:
      'Étagère interactive présentant les traductions littéraires de Judith Raigal Aran, de l’anglais, de l’allemand et du français vers le catalan et l’espagnol.',
  },
  shelf: {
    region: 'Étagère interactive de traductions',
    previous: 'Volume précédent',
    next: 'Volume suivant',
    open: 'Ouvrir la fiche du livre',
    selected: '{title}, de {author}. Volume {position} sur {total}.',
    loading: 'Chargement de l’étagère…',
    webglUnsupported:
      'Votre navigateur ne peut pas afficher l’étagère en 3D. Le catalogue complet est présenté ci-dessous.',
    listFallback: 'Catalogue des traductions',
  },
  works: {
    title: 'Traductions',
    lead: 'Catalogue complet des livres traduits, avec l’édition, l’année et l’ISBN de chaque volume.',
    count: '{count} traductions',
    countOne: '1 traduction',
    filterLanguage: 'Langue source',
    filterCategory: 'Genre',
    filterAll: 'Toutes',
    empty: 'Aucun titre ne correspond à ces filtres.',
    metaDescription:
      'Catalogue complet des traductions littéraires de Judith Raigal Aran, avec éditeur, année et ISBN.',
  },
  book: {
    originalTitle: 'Titre original',
    coverAlt: 'Couverture de {title}, de {author}',
    author: 'Auteur ou autrice',
    publisher: 'Éditeur',
    year: 'Année',
    isbn: 'ISBN',
    pages: 'Pages',
    from: 'Langue source',
    into: 'Langue cible',
    category: 'Genre',
    coTranslators: 'Avec',
    synopsis: 'Résumé',
    details: 'Fiche technique',
    sources: 'Sources',
    back: 'Retour aux traductions',
    previous: 'Précédent',
    next: 'Suivant',
    metaDescription:
      '{title}, de {author}. Traduit par Judith Raigal Aran pour {publisher}.',
  },
  categories: {
    fiction: 'Fiction',
    nonfiction: 'Essai',
    memoir: 'Mémoires',
    ya: 'Jeunesse',
    cookbook: 'Cuisine',
    other: 'Autres',
  },
  languages: {
    ca: 'catalan',
    es: 'espagnol',
    en: 'anglais',
    de: 'allemand',
    fr: 'français',
    it: 'italien',
  },
  about: {
    title: 'Biographie',
    lead: 'Traductrice littéraire et enseignante universitaire.',
    research: 'Recherche et publications',
    portraitAlt: 'Portrait de Judith Raigal Aran',
    metaDescription:
      'Biographie professionnelle de Judith Raigal Aran, traductrice littéraire et enseignante à l’URV et à l’UPF.',
  },
  contact: {
    title: 'Contact',
    lead: 'Pour des projets éditoriaux, des activités d’enseignement ou toute question sur les traductions.',
    email: 'Courriel',
    fields: 'Domaines de travail',
    languages: 'Langues de travail',
    elsewhere: 'Vous pouvez aussi me retrouver sur',
    metaDescription: 'Contact professionnel de la traductrice littéraire Judith Raigal Aran.',
  },
  faq: {
    title: 'Questions fréquentes',
    entries: {
      languages: {
        question: 'Dans quelles langues travaillez-vous ?',
        answer:
          'Mes langues de travail sont : {workingLanguages}. Les {count} volumes publiés ont tous paru en {targetLanguages} ; les langues de départ sont {sourceLanguages}.',
      },
      volume: {
        question: 'Combien de traductions avez-vous publiées ?',
        answer:
          '{count} livres, publiés entre {firstYear} et {lastYear} chez {publishers}. Le catalogue complet, avec l’éditeur, l’année et l’ISBN de chaque volume, se trouve sur la page des traductions.',
      },
      genres: {
        question: 'Quels genres traduisez-vous ?',
        answer:
          'Le catalogue réunit {genres}. Chaque fiche indique le genre du volume, la langue source et son autrice ou son auteur.',
      },
      legal: {
        question: 'Acceptez-vous des traductions juridiques ?',
        answer:
          'Oui. La traduction littéraire va de pair avec la traduction juridique et économique, et j’enseigne la traduction juridique et l’interprétation judiciaire à l’Universitat Rovira i Virgili, à l’Universitat Pompeu Fabra et à l’Universitat Autònoma de Barcelona.',
      },
      where: {
        question: 'Où travaillez-vous ?',
        answer:
          'Entre {location}. Je traduis pour les maisons du Grup 62 et j’enseigne à l’URV, à l’UPF et à l’UAB.',
      },
      commission: {
        question: 'Comment vous confier une traduction ?',
        answer:
          'Écrivez-moi à {email}. Les commandes éditoriales, les propositions d’enseignement et les questions sur l’un des titres du catalogue arrivent à la même adresse.',
      },
    },
  },
  footer: {
    rights: 'Tous droits réservés.',
    coverNotice:
      'Les couvertures reproduites appartiennent à leurs éditeurs respectifs et ne sont montrées qu’à des fins d’identification bibliographique.',
    colophon: 'Réalisé avec Astro et three.js.',
  },
};

export const DICTIONARIES: Record<Locale, Dictionary> = { ca, es, en, de, fr };

export function useTranslations(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/** Replaces `{token}` placeholders. Unknown tokens are left untouched. */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
