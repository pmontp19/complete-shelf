import * as THREE from 'three';
import type { ShelfBook } from './types';
import { spineArtPlaneSize, type BookDimensions } from './geometry';
import { createSpineTexture } from './textures';

/**
 * Every material one volume is dressed in. `board`, `boardBack`, `headband`,
 * `frontArt` and `spineArt` are `MeshPhysicalMaterial` so a later unit can add
 * `sheen`/`sheenColor`/`sheenRoughness` (cloth) or `clearcoat` (jacket art)
 * without changing the type here; `pageEdge` stays `MeshStandardMaterial`,
 * which is all a flat page-block face ever needs.
 */
export interface BookMaterials {
  /** Cloth over boards. MeshPhysicalMaterial with sheen. */
  board: THREE.MeshPhysicalMaterial;
  /** Back board, a shade darker. */
  boardBack: THREE.MeshPhysicalMaterial;
  /** The whole text block: the fanned page edges on the fore-edge, head and
   *  tail, and (reusing the same look, since nothing ever sees them) the
   *  spine, front and back faces hidden behind the spine band and boards. */
  pageEdge: THREE.MeshStandardMaterial;
  headband: THREE.MeshPhysicalMaterial;
  /** Jacket art. `.map` is assigned when the cover texture resolves. */
  frontArt: THREE.MeshPhysicalMaterial;
  spineArt: THREE.MeshPhysicalMaterial;
  /** Every material above, in one array, for `BookRig.materials`. */
  all: THREE.Material[];
}

/**
 * Builds the six materials a volume is dressed in. Every one is created
 * `transparent: true`, because the layout fades the far end of the run every
 * frame by writing `.opacity` across the whole set.
 *
 * `board` and `boardBack` carry `sheen`/`sheenColor`/`sheenRoughness`: that
 * combination, not roughness alone, is what reads as cloth-over-board rather
 * than plastic. `frontArt` carries a light `clearcoat`, the varnish on a
 * printed jacket.
 */
export function createBookMaterials(
  book: ShelfBook,
  dims: BookDimensions,
  shared: { pageEdgeTexture: THREE.Texture },
): BookMaterials {
  const board = new THREE.MeshPhysicalMaterial({
    color: book.spineColor,
    roughness: 0.85,
    metalness: 0.02,
    sheen: 0.35,
    sheenColor: new THREE.Color(book.textColor),
    sheenRoughness: 0.8,
    transparent: true,
  });
  const boardBack = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(book.spineColor).multiplyScalar(0.78),
    roughness: 0.9,
    metalness: 0.02,
    sheen: 0.35,
    sheenColor: new THREE.Color(book.textColor),
    sheenRoughness: 0.85,
    transparent: true,
  });
  const headband = new THREE.MeshPhysicalMaterial({
    color: book.textColor,
    roughness: 0.62,
    metalness: 0.2,
    transparent: true,
  });

  // White whenever a map is in play: a standard material multiplies its map
  // by `color`, so tinting a spine texture that already paints the spine
  // colour squares the ground and drags the title down with it — which is
  // how every generated spine ended up near-black with type you couldn't
  // make out. The flat colour is only the ground for the moment before a
  // `spineUrl` texture arrives.
  const spineArt = new THREE.MeshPhysicalMaterial({
    color: book.spineUrl ? book.spineColor : 0xffffff,
    roughness: 0.88,
    metalness: 0.02,
    transparent: true,
  });
  // The generated spine is drawn at the proportions the spine art plane is
  // actually built at (see `spineArtPlaneSize`), so the type is not
  // stretched along the reading direction.
  const spineArtSize = spineArtPlaneSize(dims);
  const spineRatio = spineArtSize.width / spineArtSize.height;
  if (!book.spineUrl) {
    spineArt.map = createSpineTexture(book, spineRatio);
    spineArt.needsUpdate = true;
  }

  // Clearcoat is the varnish printed over a jacket, and `color` is white for
  // the same reason as `spineArt` above: once `book.ts` assigns the cover
  // scan to `.map`, tinting it with `spineColor` would square the ground
  // dark. Until then this is the flat ground the map has not yet arrived to
  // replace.
  const frontArt = new THREE.MeshPhysicalMaterial({
    color: book.spineColor,
    roughness: 0.85,
    metalness: 0.02,
    clearcoat: 0.18,
    clearcoatRoughness: 0.55,
    transparent: true,
  });

  const pageEdge = new THREE.MeshStandardMaterial({
    map: shared.pageEdgeTexture,
    roughness: 0.92,
    metalness: 0,
    transparent: true,
  });

  const all: THREE.Material[] = [board, boardBack, pageEdge, headband, frontArt, spineArt];

  return { board, boardBack, pageEdge, headband, frontArt, spineArt, all };
}
