import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { BookDimensions, ShelfBook } from './types';
import type { BookMaterials } from './materials';

// `BookDimensions` itself now lives in `types.ts` (it is part of the public
// contract: `BookRig.dims` exposes it), which is also why `types.ts` can no
// longer import it back from here. Re-exported so the modules that already
// pull it in from this file (`book.ts`, `materials.ts`) do not need to change
// their import.
export type { BookDimensions };

const BOOK_HEIGHT = 1;
const MIN_DEPTH = 0.055;
const MAX_DEPTH = 0.16;
const REFERENCE_PAGE_COUNT = 280;
const REFERENCE_DEPTH = 0.09;

/** A 23 cm trim maps to height 1.0 in world units. */
export const REFERENCE_TRIM_MM = 230;
export const MIN_BOOK_HEIGHT = 0.82;
export const MAX_BOOK_HEIGHT = 1.12;

/** Derives real-world-ish book proportions from the loosely-typed catalogue data. */
export function computeBookDimensions(book: ShelfBook): BookDimensions {
  const aspect = book.aspect ?? 1.5;
  // 230mm is the reference because it is the trim the publisher binds most
  // of this catalogue at, so a typical volume lands at height 1.0 and the
  // unusual ones (a taller cookbook, a shorter pocket edition) move relative
  // to it. Books without a recorded trim keep the old flat BOOK_HEIGHT.
  const height =
    book.trimHeightMm != null
      ? THREE.MathUtils.clamp(
          book.trimHeightMm / REFERENCE_TRIM_MM,
          MIN_BOOK_HEIGHT,
          MAX_BOOK_HEIGHT,
        )
      : BOOK_HEIGHT;
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
 * Every proportion below is a fraction of a volume's own height (H), not an
 * absolute world size, so a run of variably-tall trims stays proportioned
 * correctly volume by volume. The fractions themselves are a Stripe-Press
 * reference implementation's absolute offsets (book height there ~2.1 world
 * units) divided through by that height, e.g. its 0.034 board thickness at
 * H=2.1 is the 0.016 below.
 */
const BOARD_THICKNESS_RATIO = 0.016;
/** Text-block inset from the boards on the fore-edge, head and tail. */
const SQUAB_RATIO = 0.012;
const SPINE_BAND_WIDTH_RATIO = 0.026;
/** How far the spine band stands proud of the boards' outer faces, in Z. */
const SPINE_PROUD_RATIO = 0.003;
// A headband's job is to fill the shoulder gap the squab leaves between the
// text block's head/tail face and the boards' edge, nothing more, so its
// radius is derived from the squab (half of it) rather than picked
// independently: that is what makes the cylinder exactly span, and be
// tangent to, both faces it sits between.
const HEADBAND_RADIUS_RATIO = SQUAB_RATIO / 2;
/** How far an art plane stands proud of the board/spine face it dresses. */
const ART_PROUD_RATIO = 0.001;
/** Art-plane inset from its board's edge, framing it with a board hairline. */
const ART_INSET_RATIO = 0.015;

// `RoundedBoxGeometry`'s `segments` argument subdivides every face of the
// box uniformly (not just the rounded corners), so its cost is quadratic:
// segments=1 here is already `super(1,1,1,3,3,3)` internally (108 triangles),
// and the reference's own segments=3-4 balloons to 588-972 triangles PER
// BOX. This shelf now builds four such boxes a book (text block, two
// boards, spine) across 22 volumes, so the lowest segment count that still
// reads as rounded (1) is the one to spend that multiplier on.
const BOARD_SEGMENTS = 1;
const SPINE_SEGMENTS = 1;
const TEXT_BLOCK_SEGMENTS = 1;
const HEADBAND_RADIAL_SEGMENTS = 8;

/**
 * The rounding on the spine band's edges, and therefore the width of the bare
 * cloth lip that a flat plane laid on its face can never cover.
 *
 * Kept small on purpose. The band used to round at 0.4 of its own width, which
 * on a 0.026H band is a 0.0104H lip on every edge, and the art plane was inset
 * by a further share of H on top of that. The two together left a smooth band of
 * plain cloth all round the artwork, worst along the depth axis where it reached
 * about a quarter of the whole spine's width on the thinnest volumes. That reads
 * exactly as what it is: a smooth edge, and then the texture starting.
 */
const SPINE_BAND_ROUND_RATIO = 0.15;

/** The band's corner radius, the one number the geometry and the art plane share. */
function spineBandRadius(H: number): number {
  return SPINE_BAND_WIDTH_RATIO * H * SPINE_BAND_ROUND_RATIO;
}

/**
 * The spine art plane's own width (its depth axis, before the plane is
 * rotated to face -X) and height (Y, head-to-tail). Exported so
 * `materials.ts` can generate the procedural spine texture at the exact
 * aspect ratio the plane is actually built at, otherwise the type painted
 * on it would read stretched or squashed against the geometry it sits on.
 *
 * The inset is the band's own corner radius and nothing more, so the plane
 * covers exactly the flat part of the face it is laid on. A real jacket wraps
 * the spine continuously: there is no board edge to frame here (that framing is
 * the front cover's job, where the boards genuinely do overhang), so any inset
 * beyond the rounding itself is just bare cloth where artwork should be. Racked
 * volumes are seen spine-on, so this is the most-viewed surface on the shelf and
 * the one that can least afford to give width away.
 */
export function spineArtPlaneSize(dims: BookDimensions): { width: number; height: number } {
  const H = dims.height;
  const spineProud = SPINE_PROUD_RATIO * H;
  const spineFaceDepth = dims.depth + spineProud * 2;
  const lip = spineBandRadius(H);
  return {
    width: Math.max(0.01, spineFaceDepth - lip * 2),
    height: Math.max(0.01, H - lip * 2),
  };
}

/** A thin quad used for the soft contact-shadow blob under each book. */
export function createContactShadowGeometry(): THREE.PlaneGeometry {
  return new THREE.PlaneGeometry(1, 1);
}

export interface BookCase {
  /** Origin at the volume's centre. */
  group: THREE.Group;
  /** Every mesh whose visibility follows the volume's fade (shown/hidden
   *  together); shadow-casting varies per mesh, see `createBookCase`. */
  meshes: THREE.Mesh[];
  /**
   * The subset of `meshes` the browse camera never actually sees while a
   * volume is fully opaque: the text block, the back board and both
   * headbands sit entirely behind the front board, spine band and the two
   * art planes from that nearly head-on angle. A volume fading through
   * partial opacity has nothing occluding them any more (every material is
   * `transparent: true`), so leaving them visible is what turns a fading
   * volume into a stack of mutually see-through layers instead of a single
   * dissolving silhouette. Hidden independently of `meshes` above, so a
   * volume can drop this subset the instant it is no longer fully opaque.
   */
  interiorMeshes: THREE.Mesh[];
  /**
   * The jacket's varnish-highlight plane. Outside `meshes` because its
   * visibility is driven by its own strength rather than by the volume's fade:
   * it is only shown while there is a highlight to draw, which for most of the
   * run is never.
   */
  sheenMesh: THREE.Mesh;
  /** Invisible simple box for raycasting. */
  pickMesh: THREE.Mesh;
  /** For disposal. */
  geometries: THREE.BufferGeometry[];
}

/**
 * Assembles one volume's case as a composite hardcover, axes chosen so they
 * line up with a real book: X = width (spine <-> fore-edge), Y = height
 * (head <-> tail), Z = thickness (front cover <-> back cover):
 *
 * 1. Text block, flush with the spine and inset ("squab") everywhere else.
 * 2. Front and back boards, full width/height so they overhang the block.
 * 3. A spine band at the -X edge, proud of the boards in Z.
 * 4. A headband cylinder at the head and tail, in the boards' overhang.
 * 5. The jacket art plane, proud of the front board and inset from its edge.
 * 6. The spine art plane, proud of the spine band the same way.
 * 7. An invisible pick box spanning the whole volume, for raycasting.
 */
export function createBookCase(dims: BookDimensions, materials: BookMaterials): BookCase {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const meshes: THREE.Mesh[] = [];
  // Populated alongside `meshes` below, for the fade-only subset documented
  // on `BookCase.interiorMeshes`.
  const interiorMeshes: THREE.Mesh[] = [];

  const { width: W, height: H, depth: D } = dims;
  const boardThickness = BOARD_THICKNESS_RATIO * H;
  const squab = SQUAB_RATIO * H;
  const spineBandWidth = SPINE_BAND_WIDTH_RATIO * H;
  const spineProud = SPINE_PROUD_RATIO * H;
  const headbandRadius = HEADBAND_RADIUS_RATIO * H;
  const artProud = ART_PROUD_RATIO * H;
  const artInset = ART_INSET_RATIO * H;

  // 1. Text block: flush with the spine (pages are sewn there, not trimmed
  // away from it) and inset from the boards on the fore-edge, head and tail.
  // Being flush on only one side means it is not centred in X: its own
  // centre sits `squab / 2` toward the spine relative to the case origin.
  const textWidth = Math.max(0.01, W - squab);
  const textHeight = Math.max(0.01, H - squab * 2);
  const textDepth = Math.max(0.01, D - boardThickness * 2);
  const textGeometry = new RoundedBoxGeometry(
    textWidth,
    textHeight,
    textDepth,
    TEXT_BLOCK_SEGMENTS,
    Math.min(textWidth, textHeight, textDepth) * 0.15,
  );
  // Face order per `RoundedBoxGeometry`'s inherited `BoxGeometry` grouping:
  // [+X fore-edge, -X spine, +Y head, -Y tail, +Z front, -Z back]. The three
  // faces a real block shows its fanned page edges on are the fore-edge,
  // head and tail; the spine, front and back faces are hidden behind the
  // spine band and boards. A single `pageEdge` material covers all six: the
  // hidden faces never need their own look, so one material renders the
  // whole block in one draw call instead of six.
  const textMesh = new THREE.Mesh(textGeometry, materials.pageEdge);
  textMesh.position.x = -squab / 2;
  textMesh.castShadow = true;
  textMesh.receiveShadow = true;
  geometries.push(textGeometry);
  meshes.push(textMesh);
  interiorMeshes.push(textMesh);
  group.add(textMesh);

  // 2. Front and back boards: full width and height, so they overhang the
  // text block. One geometry, two materials (front cloth / darker back).
  const boardGeometry = new RoundedBoxGeometry(
    W,
    H,
    boardThickness,
    BOARD_SEGMENTS,
    boardThickness * 0.4,
  );
  const frontBoard = new THREE.Mesh(boardGeometry, materials.board);
  frontBoard.position.z = D / 2 - boardThickness / 2;
  frontBoard.castShadow = true;
  frontBoard.receiveShadow = true;
  const backBoard = new THREE.Mesh(boardGeometry, materials.boardBack);
  backBoard.position.z = -(D / 2 - boardThickness / 2);
  backBoard.castShadow = true;
  backBoard.receiveShadow = true;
  geometries.push(boardGeometry);
  meshes.push(frontBoard, backBoard);
  // The front board is the outer shell (seen through the jacket art's own
  // frame hairline); the back board faces away from the browse camera
  // entirely and is never on-screen while the volume is opaque.
  interiorMeshes.push(backBoard);
  group.add(frontBoard, backBoard);

  // 3. Spine band: standing proud of both boards in Z (symmetrically, the
  // way a rounded spine curves past the flat boards on both sides) so it
  // reads as the binding rather than a stripe painted across a flat box.
  const spineGeometry = new RoundedBoxGeometry(
    spineBandWidth,
    H,
    D + spineProud * 2,
    SPINE_SEGMENTS,
    // Shared with `spineArtPlaneSize`, so the plane laid on this face and the
    // rounding of the face itself can never drift apart.
    spineBandRadius(H),
  );
  const spineMesh = new THREE.Mesh(spineGeometry, materials.board);
  spineMesh.position.x = -W / 2 + spineBandWidth / 2;
  // Built from `materials.board`, structurally a board, and the most
  // extruded feature in Z, so it casts and receives like the boards it
  // shares a material with (unlike the headbands and art planes, which do
  // neither).
  spineMesh.castShadow = true;
  spineMesh.receiveShadow = true;
  geometries.push(spineGeometry);
  meshes.push(spineMesh);
  group.add(spineMesh);

  // 4. Headbands: the woven cord glued across the head and the tail of the
  // SPINE, tucked into the shoulder the squab leaves. It spans the thickness
  // of the text block, not the width of the cover: a real headband is a few
  // millimetres of trim you glimpse at the spine end when you look down at a
  // shelved book. Running it the whole way out to the fore-edge (as this once
  // did) draws a continuous bar across the top of the page block, which is
  // obvious the moment a volume is turned and seen from above.
  const headbandLength = Math.max(0.01, textDepth);
  const headbandGeometry = new THREE.CylinderGeometry(
    headbandRadius,
    headbandRadius,
    headbandLength,
    HEADBAND_RADIAL_SEGMENTS,
  );
  // A cylinder is built along Y, so a quarter turn about X lays its axis along
  // Z, across the thickness, in the channel between the two boards.
  headbandGeometry.rotateX(Math.PI / 2);
  // Just clear of the spine band's inner face, resting on the text block the
  // way the cord rests on the gathered signatures it is glued to.
  const headbandX = -W / 2 + spineBandWidth + headbandRadius;
  const headTop = new THREE.Mesh(headbandGeometry, materials.headband);
  // Centred at H/2 - squab/2 rather than H/2 - squab (the text block's own
  // top face) so the cylinder's radius (squab/2) spans outward from there to
  // exactly H/2 (the board's top edge): tangent to both, filling the gap
  // instead of half-burying itself in the text block.
  headTop.position.set(headbandX, H / 2 - squab / 2, 0);
  headTop.castShadow = false;
  headTop.receiveShadow = false;
  const headTail = new THREE.Mesh(headbandGeometry, materials.headband);
  headTail.position.set(headbandX, -(H / 2 - squab / 2), 0);
  headTail.castShadow = false;
  headTail.receiveShadow = false;
  geometries.push(headbandGeometry);
  meshes.push(headTop, headTail);
  interiorMeshes.push(headTop, headTail);
  group.add(headTop, headTail);

  // 5. Jacket art: the real cover scan, proud of the front board and inset
  // from its edge on all four sides so a hairline of board colour frames it
  // like a jacket wrapped over boards, not art painted edge-to-edge.
  const frontArtGeometry = new THREE.PlaneGeometry(
    Math.max(0.01, W - artInset * 2),
    Math.max(0.01, H - artInset * 2),
  );
  const frontArtMesh = new THREE.Mesh(frontArtGeometry, materials.frontArt);
  frontArtMesh.position.z = D / 2 + artProud;
  frontArtMesh.castShadow = false;
  frontArtMesh.receiveShadow = false;
  // All book materials are transparent (the layout fades the far end of the
  // run by opacity), so depth-sorting by centroid is what would otherwise
  // decide draw order between this plane and the board it sits proud of. At
  // an `artProud` gap that is stable in practice but not guaranteed, so give
  // it an explicit order above the boards' (implicit 0) instead of leaving
  // it incidental.
  frontArtMesh.renderOrder = 1;
  geometries.push(frontArtGeometry);
  meshes.push(frontArtMesh);
  group.add(frontArtMesh);

  // The varnish highlight, on its own plane a hair in front of the artwork and
  // sharing its outline exactly, so the sweep is bounded by the jacket rather
  // than running out over the board's hairline frame. Deliberately NOT pushed
  // into `meshes`: its visibility follows its own strength (the layout only
  // shows it while it has something to draw), so a volume racked spine-out in
  // the middle of the run costs nothing for it. Order 2 puts it above the
  // artwork it adds light to.
  const sheenMesh = new THREE.Mesh(frontArtGeometry, materials.jacketSheen);
  sheenMesh.position.z = D / 2 + artProud * 2;
  sheenMesh.castShadow = false;
  sheenMesh.receiveShadow = false;
  sheenMesh.renderOrder = 2;
  sheenMesh.visible = false;
  group.add(sheenMesh);

  // 6. Spine art: the generated (or scanned) spine artwork, proud of the
  // spine band the same way. Racked volumes are seen spine-on, so this is
  // the single most-viewed surface on the shelf (see `spineArtPlaneSize`
  // for why its inset is not the naive four-sided one).
  const spineArtSize = spineArtPlaneSize(dims);
  const spineArtGeometry = new THREE.PlaneGeometry(spineArtSize.width, spineArtSize.height);
  const spineArtMesh = new THREE.Mesh(spineArtGeometry, materials.spineArt);
  spineArtMesh.rotation.y = -Math.PI / 2;
  spineArtMesh.position.x = -W / 2 - artProud;
  spineArtMesh.castShadow = false;
  spineArtMesh.receiveShadow = false;
  // Same deterministic-order reasoning as the jacket art plane above, against
  // the spine band it sits proud of.
  spineArtMesh.renderOrder = 1;
  geometries.push(spineArtGeometry);
  meshes.push(spineArtMesh);
  group.add(spineArtMesh);

  // 7. Pick mesh: one invisible simple box spanning the whole volume — the
  // only raycast target, independent of which faces the composite above
  // actually occupies. `visible: false` on the material (not the mesh) keeps
  // it out of every render pass while leaving `Object3D.visible` free for
  // the layout to gate raycasting the same way it gates the rendered mesh.
  const pickGeometry = new THREE.BoxGeometry(W, H, D);
  const pickMesh = new THREE.Mesh(pickGeometry, new THREE.MeshBasicMaterial({ visible: false }));
  geometries.push(pickGeometry);
  group.add(pickMesh);

  return { group, meshes, interiorMeshes, sheenMesh, pickMesh, geometries };
}
