import * as THREE from 'three';
import type { ShelfBook } from './types';
import { spineArtPlaneSize, type BookDimensions } from './geometry';
import { createSpineTexture } from './textures';

/**
 * The cream `createPageEdgeTexture` paints its page block on. Kept here as the
 * ground the headband thread is woven from, so the trim belongs to the same
 * paper as the block it is glued to rather than to an unrelated swatch.
 */
const PAGE_STOCK = '#e7ddc7';

/**
 * The colour of the sweep across a jacket. A varnish highlight is light
 * reflecting off the coating, so it takes the lamp's colour rather than the
 * book's: a warm white matching the key light's own, not the cover palette.
 * Tinting it per volume would read as a coloured glow instead of a reflection.
 */
const SHEEN_HIGHLIGHT = 0xfff1d8;

/**
 * The highlight a varnished jacket throws back. The jacket already carries
 * `clearcoat`, which is the varnish as a material property; this is where that
 * varnish catches the light.
 *
 * `uOffset` places the band, and the layout derives it from things the reader is
 * doing: where the pointer is across the stage, and how far the volume has turned
 * out of the run. So the highlight behaves like a reflection, holding still while
 * nothing moves and sweeping when the volume or the viewpoint does. It is
 * deliberately NOT a function of the clock. An earlier version drove it from
 * elapsed time, which made it an animation that simply happened on its own, with
 * no relationship to anything the reader was doing.
 *
 * Additive and `depthWrite: false`, because it is light added to whatever is drawn
 * there rather than a surface of its own: it must never occlude the artwork
 * beneath it or take part in depth sorting.
 */
export function createJacketSheenMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOffset: { value: 0 },
      uStrength: { value: 0 },
      uColor: { value: new THREE.Color(SHEEN_HIGHLIGHT) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    // One broad diagonal band with eased edges, so it has no hard boundary,
    // multiplied by a horizontal falloff so it dies out before the jacket's edge
    // instead of being cut off square by the end of the plane. Broader than a
    // travelling sweep would want: this one can come to rest, and a narrow band
    // sitting still reads as a drawn stripe rather than as a reflection.
    fragmentShader: `
      varying vec2 vUv;
      uniform float uOffset;
      uniform float uStrength;
      uniform vec3 uColor;

      void main() {
        float travel = fract(vUv.x * 0.72 + vUv.y * 0.31 + uOffset);
        float band = smoothstep(0.34, 0.5, travel) * (1.0 - smoothstep(0.5, 0.66, travel));
        float falloff = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        gl_FragColor = vec4(uColor, band * falloff * uStrength * 0.42);
      }
    `,
  });
}

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
  /**
   * The animated varnish highlight. Deliberately NOT in `all`: that array is
   * the set whose `.opacity` the layout writes for the distance fade, and this
   * one is additive with its own `uStrength` uniform instead, so an opacity
   * written onto it would mean nothing. It is disposed alongside the rest by
   * `book.ts`.
   */
  jacketSheen: THREE.ShaderMaterial;
  /** Every material whose `.opacity` the layout writes, for `BookRig.materials`. */
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
  // A headband is woven cotton thread, so it is matte and not metallic, and it
  // is decorative rather than typographic: it picks the binding cloth up
  // without matching it. `book.textColor` used to be the ground here, but that
  // is the ink the cover palette chose for legibility over the cloth, so on
  // most volumes it resolved to near-black and the trim read as a drawn line
  // rather than as thread. Starting from the page stock and pulling partway
  // toward the cloth keeps it light on every volume in the run.
  const headband = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(PAGE_STOCK).lerp(new THREE.Color(book.spineColor), 0.45),
    roughness: 0.78,
    metalness: 0,
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

  const jacketSheen = createJacketSheenMaterial();

  const all: THREE.Material[] = [board, boardBack, pageEdge, headband, frontArt, spineArt];

  return { board, boardBack, pageEdge, headband, frontArt, spineArt, jacketSheen, all };
}
