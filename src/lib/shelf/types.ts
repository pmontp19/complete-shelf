/**
 * Public contract between the Astro pages and the WebGL shelf.
 *
 * The shelf module must depend on nothing else in the project: it receives
 * plain data and returns a handle. This keeps the 3D layer swappable and
 * testable in isolation. All visible chrome — buttons, counter, caption —
 * belongs to the page; the module owns only the canvas and the focusable
 * region that wraps it.
 */

export interface ShelfBook {
  /** Stable slug, also used as the DOM id of the accessible fallback item. */
  id: string;
  /** Title of the translation (already localised by the caller). */
  title: string;
  /**
   * Short form of the title for the spine, where the full one would have to be
   * set too small to read. Falls back to `title`.
   */
  spineTitle?: string;
  /** Short author credit for the spine — surnames only. Falls back to `author`. */
  spineAuthor?: string;
  /** Title in the original language. */
  originalTitle: string;
  /** Original author. */
  author: string;
  /** Publishing house of this translation. */
  publisher: string;
  /** Publication year of this translation. */
  year: number;
  /** ISBN-13 of the printed edition. */
  isbn: string;
  /** Localised label for the source language, e.g. "alemán". */
  sourceLanguage: string;
  /** Localised label for the target language, e.g. "castellano". */
  targetLanguage: string;
  /** Absolute (base-prefixed) URL of the cover image, portrait, ~2:3. */
  coverUrl: string;
  /** Absolute (base-prefixed) URL of the spine image, or null to generate one. */
  spineUrl?: string | null;
  /** Dominant cover colour as `#rrggbb`; drives spine, scene tint and UI accents. */
  spineColor: string;
  /** Readable foreground over `spineColor` as `#rrggbb`. */
  textColor: string;
  /** Printed page count; drives book thickness. Defaults to 280 when unknown. */
  pageCount?: number;
  /** Cover aspect ratio (height / width). Defaults to 1.5. */
  aspect?: number;
  /** Link to the detail page for this translation. */
  href: string;
}

export interface ShelfLabels {
  previous: string;
  next: string;
  open: string;
  region: string;
  /** Announced on selection change; `{title}` and `{author}` are substituted. */
  selected: string;
  loading: string;
  webglUnsupported: string;
}

export interface ShelfOptions {
  books: ShelfBook[];
  labels: ShelfLabels;
  /** Index selected on first paint. */
  initialIndex?: number;
  /** Honour `prefers-reduced-motion`; the caller may force it on. */
  reducedMotion?: boolean;
  /** Fired whenever the centred volume changes. */
  onSelect?: (book: ShelfBook, index: number) => void;
  /**
   * Fired on every frame the shelf moves, with the continuous carriage
   * position in slot units. Drives the counter and the scrub rail.
   */
  onProgress?: (position: number, total: number) => void;
  /** Fired once every cover texture has settled (loaded or failed). */
  onReady?: () => void;
  /** Fired when the user activates the centred volume (click / Enter). */
  onActivate?: (book: ShelfBook, index: number) => void;
}

export interface ShelfHandle {
  select(index: number): void;
  next(): void;
  previous(): void;
  /** Removes listeners, disposes GPU resources and empties the container. */
  destroy(): void;
}

export type MountShelf = (
  container: HTMLElement,
  options: ShelfOptions,
) => Promise<ShelfHandle>;
