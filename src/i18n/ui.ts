import type { Locale } from './config';

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
  about: { title: string; lead: string; metaDescription: string };
  contact: {
    title: string;
    lead: string;
    email: string;
    elsewhere: string;
    metaDescription: string;
  };
  footer: { rights: string; coverNotice: string; colophon: string };
}

const ca: Dictionary = {
  site: {
    name: 'Judith Raigal Aran',
    role: 'Traductora literària',
    tagline: "De l'anglès, l'alemany i el francès al català i al castellà",
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
    shelfHint: 'Desplaça’t o fes servir les fletxes per recórrer la prestatgeria.',
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
    selected: '{title}, de {author}',
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
    author: 'Autoria',
    publisher: 'Editorial',
    year: 'Any',
    isbn: 'ISBN',
    pages: 'Pàgines',
    from: 'Traduït de',
    into: 'Traduït al',
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
    metaDescription:
      'Biografia professional de Judith Raigal Aran, traductora literària i docent a la URV i la UPF.',
  },
  contact: {
    title: 'Contacte',
    lead: 'Per a encàrrecs editorials, docència o consultes sobre qualsevol de les traduccions.',
    email: 'Correu electrònic',
    elsewhere: 'També em trobaràs a',
    metaDescription: 'Contacte professional de la traductora literària Judith Raigal Aran.',
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
    shelfHint: 'Desplázate o usa las flechas para recorrer la estantería.',
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
    selected: '{title}, de {author}',
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
    author: 'Autoría',
    publisher: 'Editorial',
    year: 'Año',
    isbn: 'ISBN',
    pages: 'Páginas',
    from: 'Traducido del',
    into: 'Traducido al',
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
    metaDescription:
      'Biografía profesional de Judith Raigal Aran, traductora literaria y docente en la URV y la UPF.',
  },
  contact: {
    title: 'Contacto',
    lead: 'Para encargos editoriales, docencia o consultas sobre cualquiera de las traducciones.',
    email: 'Correo electrónico',
    elsewhere: 'También me encontrarás en',
    metaDescription: 'Contacto profesional de la traductora literaria Judith Raigal Aran.',
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
    shelfHint: 'Scroll or use the arrow keys to browse the shelf.',
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
    selected: '{title}, by {author}',
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
    author: 'Author',
    publisher: 'Publisher',
    year: 'Year',
    isbn: 'ISBN',
    pages: 'Pages',
    from: 'Translated from',
    into: 'Translated into',
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
    metaDescription:
      'Professional biography of Judith Raigal Aran, literary translator and lecturer at URV and UPF.',
  },
  contact: {
    title: 'Contact',
    lead: 'For publishing commissions, teaching, or questions about any of the translations.',
    email: 'Email',
    elsewhere: 'You can also find me on',
    metaDescription: 'Professional contact details for literary translator Judith Raigal Aran.',
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
      'Jeder Band in diesem Regal ist ein Buch, das ich in eine andere Sprache gebracht habe. Wählen Sie einen aus, um den vollständigen Eintrag zu sehen.',
    shelfHint: 'Scrollen Sie oder nutzen Sie die Pfeiltasten, um das Regal zu durchstöbern.',
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
    selected: '{title} von {author}',
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
    author: 'Autorin oder Autor',
    publisher: 'Verlag',
    year: 'Jahr',
    isbn: 'ISBN',
    pages: 'Seiten',
    from: 'Übersetzt aus dem',
    into: 'Übersetzt ins',
    category: 'Genre',
    coTranslators: 'Gemeinsam mit',
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
    ca: 'Katalanischen',
    es: 'Spanischen',
    en: 'Englischen',
    de: 'Deutschen',
    fr: 'Französischen',
    it: 'Italienischen',
  },
  about: {
    title: 'Biografie',
    lead: 'Literaturübersetzerin und Universitätsdozentin.',
    metaDescription:
      'Berufliche Biografie von Judith Raigal Aran, Literaturübersetzerin und Dozentin an der URV und der UPF.',
  },
  contact: {
    title: 'Kontakt',
    lead: 'Für Verlagsaufträge, Lehre oder Fragen zu einer der Übersetzungen.',
    email: 'E-Mail',
    elsewhere: 'Sie finden mich auch auf',
    metaDescription: 'Beruflicher Kontakt der Literaturübersetzerin Judith Raigal Aran.',
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
    tagline: "De l'anglais, l'allemand et le français vers le catalan et l'espagnol",
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
      'Chaque volume de cette étagère est un livre que j’ai fait passer dans une autre langue. Choisissez-en un pour consulter sa fiche complète.',
    shelfHint: 'Faites défiler ou utilisez les flèches pour parcourir l’étagère.',
    ctaWorks: 'Voir toutes les traductions',
    ctaAbout: 'À propos',
    selectedHeading: 'Volume sélectionné',
    metaDescription:
      'Étagère interactive présentant les traductions littéraires de Judith Raigal Aran, de l’anglais, l’allemand et le français vers le catalan et l’espagnol.',
  },
  shelf: {
    region: 'Étagère interactive de traductions',
    previous: 'Volume précédent',
    next: 'Volume suivant',
    open: 'Ouvrir la fiche du livre',
    selected: '{title}, de {author}',
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
    author: 'Auteur ou autrice',
    publisher: 'Éditeur',
    year: 'Année',
    isbn: 'ISBN',
    pages: 'Pages',
    from: 'Traduit de',
    into: 'Traduit vers le',
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
    metaDescription:
      'Biographie professionnelle de Judith Raigal Aran, traductrice littéraire et enseignante à l’URV et à l’UPF.',
  },
  contact: {
    title: 'Contact',
    lead: 'Pour des commandes éditoriales, de l’enseignement ou toute question sur les traductions.',
    email: 'Courriel',
    elsewhere: 'Vous pouvez aussi me retrouver sur',
    metaDescription: 'Contact professionnel de la traductrice littéraire Judith Raigal Aran.',
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
