import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { ShelfBook } from './types';

export interface BookDimensions {
  /** World-space width — the front cover's width (spine-to-fore-edge). */
  width: number;
  /** World-space height — the front cover's height. */
  height: number;
  /** World-space depth — the spine thickness, driven by page count. */
  depth: number;
}

const BOOK_HEIGHT = 1;
const MIN_DEPTH = 0.055;
const MAX_DEPTH = 0.16;
const REFERENCE_PAGE_COUNT = 280;
const REFERENCE_DEPTH = 0.09;

/** Derives real-world-ish book proportions from the loosely-typed catalogue data. */
export function computeBookDimensions(book: ShelfBook): BookDimensions {
  const aspect = book.aspect ?? 1.5;
  const height = BOOK_HEIGHT;
  const width = height / aspect;
  const pageCount = book.pageCount ?? REFERENCE_PAGE_COUNT;
  const depth = THREE.MathUtils.clamp(
    (pageCount / REFERENCE_PAGE_COUNT) * REFERENCE_DEPTH,
    MIN_DEPTH,
    MAX_DEPTH,
  );
  return { width, height, depth };
}

/**
 * Book case geometry: axes are chosen so the six faces line up with a real
 * hardcover — X = width (spine <-> fore-edge), Y = height (head <-> tail),
 * Z = thickness (front cover <-> back cover). BoxGeometry's default face
 * group order is [+X, -X, +Y, -Y, +Z, -Z], which callers rely on when
 * building the per-face material array:
 *   0 +X fore-edge   1 -X spine   2 +Y head   3 -Y tail   4 +Z front cover   5 -Z back cover
 */
export function createBookGeometry(dimensions: BookDimensions): THREE.BufferGeometry {
  const radius = Math.min(dimensions.width, dimensions.height, dimensions.depth) * 0.05;
  return new RoundedBoxGeometry(dimensions.width, dimensions.height, dimensions.depth, 1, radius);
}

/** A thin quad used for the soft contact-shadow blob under each book. */
export function createContactShadowGeometry(): THREE.PlaneGeometry {
  return new THREE.PlaneGeometry(1, 1);
}
