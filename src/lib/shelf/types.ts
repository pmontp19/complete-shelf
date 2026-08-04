/**
 * Public contract between the Astro pages and the WebGL shelf.
 *
 * The shelf module must depend on nothing else in the project: it receives
 * plain data and returns a handle. This keeps the 3D layer swappable and
 * testable in isolation. All visible chrome — buttons, counter, caption —
 * belongs to the page; the module owns only the canvas and the focusable
 * region that wraps it.
 */

import type * as THREE from 'three';

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
  /** Printed trim height in millimetres. Drives the volume's height. */
  trimHeightMm?: number;
  /** Cover aspect ratio (height / width). Defaults to 1.5. From the real scan. */
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
  /** Accessible name of the control that enters inspect mode. */
  inspect: string;
  /** Accessible name of the control that leaves inspect mode. */
  exitInspect: string;
  orbitHint: string;
  zoomHint: string;
  resetView: string;
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
  /** Fired whenever the interaction mode changes. */
  onMode?: (mode: ShelfMode, index: number) => void;
}

export interface ShelfHandle {
  select(index: number): void;
  next(): void;
  previous(): void;
  /** Enters inspect mode on `index`, or on the centred volume. */
  inspect(index?: number): void;
  /** Leaves inspect mode. No-op in browse. */
  returnToShelf(): void;
  mode(): ShelfMode;
  /** Removes listeners, disposes GPU resources and empties the container. */
  destroy(): void;
}

export type MountShelf = (
  container: HTMLElement,
  options: ShelfOptions,
) => Promise<ShelfHandle>;

export type ShelfMode = 'browse' | 'focusing' | 'inspect' | 'returning';

/** Anything with a `.dispose()` — collected as resources are created so `destroy()` can free them all. */
export interface Disposable {
  dispose(): void;
}

export interface ThemePalette {
  /** Atmospheric haze the far end of the run dissolves into — always the page's own paper. */
  fog: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  key: THREE.Color;
  rim: THREE.Color;
}

/** The extra pose an inspected volume gets, on top of its browse pose. */
export interface InspectPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  /** 0..1 — how far the rest of the run has faded out for isolation. */
  isolation: number;
}

export interface BookDimensions {
  /** World-space width — the front cover's width (spine-to-fore-edge). */
  width: number;
  /** World-space height — the front cover's height. */
  height: number;
  /** World-space depth — the spine thickness, driven by page count. */
  depth: number;
}

export interface BookRig {
  book: ShelfBook;
  index: number;
  dims: BookDimensions;
  /** Slot pose: position, rotation.y (turn), rotation.z (lean), scale. */
  root: THREE.Group;
  /** Ambient pose: position.y (idle), rotation.x / rotation.y (parallax). */
  motion: THREE.Group;
  /** Invisible simple box; the only raycast target. userData.bookIndex = index. */
  pickMesh: THREE.Mesh;
  shadowMesh: THREE.Mesh;
  shadowMaterial: THREE.MeshBasicMaterial;
  /** Every material whose `.opacity` the layout writes. All `transparent: true`. */
  materials: THREE.Material[];
  /** Deterministic idle lean, radians. */
  lean: number;
  /** Smoothed 0..1 hover weight. */
  hover: number;
  /** Shows/hides every visible mesh of the volume at once. */
  setVisible(visible: boolean): void;
}

export interface ShelfContext {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Books and their contact shadows. */
  shelfGroup: THREE.Group;
  /** The ledge. Hidden while a volume is isolated for inspection. */
  furniture: THREE.Group;
  rigs: BookRig[];
  disposables: Disposable[];

  total: number;
  /** True when the run is long enough to loop without both ends on screen. */
  wraps: boolean;
  /** Slot pitch along X, in world units. */
  spacing: number;
  maxWidth: number;
  maxDepth: number;
  maxHeight: number;
  /** Worst-case extra room a turned-out cover needs beyond one slot of pitch. */
  spread: number;
  shelfTopY: number;

  /** Recomputed by the stage on every resize; read by the layout. */
  fade: { start: number; end: number };
  /** Recomputed by the stage on every resize; read by inspect. */
  frame: { distance: number; visibleHalfWidth: number; aspect: number };

  mode: ShelfMode;
  /** -1 when nothing is selected for inspection. */
  selectedIndex: number;
  /** 0..1 raw focus progress. */
  focusProgress: number;

  reducedMotion: boolean;
  darkScheme: boolean;
  paperColor: THREE.Color;
  pointerSmooth: { x: number; y: number };
  hoverIndex: number;

  diagnostics: { collisionRejects: number; motionPhase: string };

  /**
   * Set once by `destroy()`. Not part of the original binding contract's
   * field list, but async callbacks (texture loads) run in modules other
   * than `shelf.ts` and need a way to tell that teardown already happened so
   * a texture that resolves after `destroy()` is disposed on arrival instead
   * of leaking. Mirrors the `destroyed` local `shelf.ts` already keeps for
   * its own checks.
   */
  destroyed: boolean;
}
