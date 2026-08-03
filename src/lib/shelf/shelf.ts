import * as THREE from 'three';
import type { MountShelf, ShelfBook, ShelfHandle, ShelfLabels } from './types';
import {
  computeBookDimensions,
  createBookGeometry,
  createContactShadowGeometry,
  type BookDimensions,
} from './geometry';
import {
  createContactShadowTexture,
  createPageEdgeTexture,
  createSpineTexture,
  createWoodGrainTexture,
  hashSeed,
  loadTextureSafe,
  seededRandom,
} from './textures';
import { Tween, clamp01, easeInOutCubic, easeOutQuint, lerp } from './easing';

/** Anything with a `.dispose()` — collected as resources are created so `destroy()` can free them all. */
interface Disposable {
  dispose(): void;
}

// A step taken with a key or a button: short enough to feel immediate, long
// enough to read as a volume being drawn out and turned.
const STEP_DURATION_MS = 520;
// A throw settles over a distance-scaled window, so a two-slot nudge lands
// crisply while a long flick decelerates like a real carriage.
const SETTLE_MIN_MS = 360;
const SETTLE_MAX_MS = 980;
const TINT_DURATION_MS = 760;
const PIXEL_RATIO_CAP = 2;
// Racked books stand spine-out, so a slot is one spine thick — not one cover
// wide. Spacing off the cover width left ~5x the spine's own width of dead air
// between volumes, which read as a nearly empty shelf.
const SPACING_GAP = 0.012;
// Air left between two volumes that are pressed against each other. The
// layout solver treats this as the closest they may ever come, so it is what
// stops a turning cover from grazing (or entering) the volume beside it.
const CONTACT_GAP = 0.02;
// How far the centred volume travels towards the reader. Bounded by the depth
// of the ledge below: any further and it stands on air.
const SELECTED_LIFT_Z = 0.24;
const LEDGE_DEPTH = 0.68;
const SELECTED_SCALE = 1.05;
const REST_ROTATION_Y = Math.PI / 2; // spine facing the camera
const SELECTED_ROTATION_Y = 0; // front cover facing the camera
// A volume is drawn out before it is turned, the way a hand does it: the turn
// only starts once the book is this far into the centre. Turning on the way
// out is what used to make two half-open covers meet in mid-air and shove the
// whole run sideways at the midpoint of every step.
const TURN_DELAY = 0.3;
// Books lean the way books lean. Deterministic per volume, straightened as a
// book comes to the centre.
const MAX_LEAN = 0.035;
const DRAG_PIXELS_PER_SLOT = 132;
const DRAG_MOVE_THRESHOLD = 4;
// A trackpad flick reports far more pixels than a mouse notch; scrubbing off a
// pixel budget rather than counting notches makes both feel like the same shelf.
const WHEEL_PIXELS_PER_SLOT = 118;
// How long the carriage keeps travelling after the fingers leave it.
const FLICK_PROJECTION_S = 0.28;
const FLICK_MAX_SLOTS = 7;
// Idle time after the last wheel event before the shelf settles onto a volume.
const WHEEL_SETTLE_DELAY_MS = 150;

// Camera framing — recomputed on every resize so the composition (roughly
// this many book-slots visible across the frame, selected book fully
// inside the frame with margin) holds at any container aspect ratio, from
// a wide desktop canvas down to a narrow, squat mobile one.
const CAMERA_VERTICAL_FOV = 34;
const TARGET_VISIBLE_SLOTS = 11;
// Reference canvas shape the slot target is authored against; narrower
// canvases show proportionally fewer books rather than shrinking them.
const REFERENCE_ASPECT = 1.6;
const MIN_VISIBLE_SLOTS = 6;
// Air above the selected volume and below the ledge, in world units. Enough
// that the turned-out cover is never clipped by the top of the stage, not so
// much that the shelf floats in a dead band.
const VERTICAL_MARGIN = 0.26;
const CAMERA_MIN_DISTANCE = 1.8;
const CAMERA_MAX_DISTANCE = 13;
// Below this many volumes the run is too short to hide the seam, so the shelf
// keeps hard ends instead of looping.
const MIN_BOOKS_TO_WRAP = 8;

function smootherstep(x: number): number {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function isWebglAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || typeof WebGLRenderingContext === 'undefined') return false;
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function visuallyHide(el: HTMLElement): void {
  el.style.position = 'absolute';
  el.style.width = '1px';
  el.style.height = '1px';
  el.style.overflow = 'hidden';
  el.style.clipPath = 'inset(50%)';
  el.style.whiteSpace = 'nowrap';
  el.style.border = '0';
  el.style.padding = '0';
  el.style.margin = '-1px';
}

function formatSelected(
  template: string,
  book: ShelfBook,
  position: number,
  total: number,
): string {
  return template
    .replace('{title}', book.title)
    .replace('{author}', book.author)
    .replace('{position}', String(position))
    .replace('{total}', String(total));
}

/**
 * Reads a colour off a CSS custom property. The scene has no background of its
 * own — it is drawn onto the page — so the atmosphere has to be mixed from the
 * same paper the CSS is painting, in whichever theme is live.
 */
function readCssColor(el: HTMLElement, name: string, fallback: string): THREE.Color {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  if (!raw) return new THREE.Color(fallback);
  try {
    return new THREE.Color(raw);
  } catch {
    return new THREE.Color(fallback);
  }
}

interface ThemePalette {
  /** Atmospheric haze the far end of the run dissolves into — always the page's own paper. */
  fog: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  key: THREE.Color;
  rim: THREE.Color;
}

/**
 * Mixes the lighting rig from the page's paper colour and the selected cover.
 * Anchoring on paper (rather than on an absolute white) is what lets the canvas
 * sit on the page with no visible seam, in light and dark alike.
 */
function themePalette(paper: THREE.Color, spineColorHex: string, dark: boolean): ThemePalette {
  const spine = new THREE.Color(spineColorHex);
  const hsl = { h: 0, s: 0, l: 0 };
  spine.getHSL(hsl);

  const sky = dark ? new THREE.Color(0x6d6153) : new THREE.Color(0xfff8ec);
  return {
    fog: paper.clone().lerp(spine, dark ? 0.16 : 0.09),
    hemiSky: sky.lerp(spine, 0.12),
    hemiGround: paper.clone().multiplyScalar(dark ? 0.42 : 0.3).lerp(spine, 0.28),
    key: new THREE.Color(dark ? 0xf3e4cd : 0xfff4e2).lerp(spine, 0.1),
    rim: new THREE.Color().setHSL(hsl.h, Math.min(0.6, hsl.s * 0.75 + 0.15), dark ? 0.48 : 0.62),
  };
}

/** Renders a plain accessible list in place of the WebGL canvas, and a matching no-op handle. */
function mountFallback(container: HTMLElement, labels: ShelfLabels, books: ShelfBook[]): ShelfHandle {
  container.innerHTML = '';
  const region = document.createElement('div');
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', labels.region);
  region.style.padding = '1rem';

  const message = document.createElement('p');
  message.textContent = labels.webglUnsupported;
  region.appendChild(message);

  if (books.length > 0) {
    const list = document.createElement('ul');
    list.style.listStyle = 'none';
    list.style.padding = '0';
    for (const book of books) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = book.href;
      link.textContent = `${book.title} — ${book.author}`;
      item.appendChild(link);
      list.appendChild(item);
    }
    region.appendChild(list);
  }

  container.appendChild(region);

  return {
    select() {},
    next() {},
    previous() {},
    destroy() {
      if (region.parentNode === container) container.removeChild(region);
    },
  };
}

interface BookRig {
  book: ShelfBook;
  index: number;
  dims: BookDimensions;
  root: THREE.Group;
  motion: THREE.Group;
  mesh: THREE.Mesh;
  shadowMesh: THREE.Mesh;
  shadowMaterial: THREE.MeshBasicMaterial;
  materials: THREE.MeshStandardMaterial[];
  /** Deterministic idle lean, in radians. */
  lean: number;
  /** Smoothed 0..1 hover weight. */
  hover: number;
}

export const mountShelf: MountShelf = async (container, options) => {
  const { books, labels } = options;

  if (!isWebglAvailable()) {
    return mountFallback(container, labels, books);
  }

  const total = books.length;
  // A run this long can loop without the two ends ever being on screen at
  // once, so the shelf reads as continuing past the frame in both directions
  // instead of running out of books at the first and last volume.
  const wraps = total >= MIN_BOOKS_TO_WRAP;

  // ---------------------------------------------------------------------
  // DOM scaffold — the canvas and nothing else. Buttons, counter and caption
  // are the page's job, wired through the returned handle.
  // ---------------------------------------------------------------------
  container.innerHTML = '';
  // The region inside is absolutely positioned, so the host must be a
  // containing block — but check the *computed* value, not the inline one:
  // writing `relative` over a stage that the page laid out as `absolute`
  // collapses it to zero height.
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  const region = document.createElement('div');
  region.className = 'shelf3d-region';
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', labels.region);
  region.tabIndex = 0;
  region.style.position = 'relative';
  region.style.width = '100%';
  region.style.height = '100%';
  // The ancestor stage clips with overflow:hidden, so an outward-drawn outline
  // would be clipped at exactly the frame it should ring. Draw it inset.
  region.style.outlineOffset = '-3px';

  const canvasHost = document.createElement('div');
  canvasHost.style.position = 'absolute';
  canvasHost.style.inset = '0';
  region.appendChild(canvasHost);

  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('aria-live', 'polite');
  visuallyHide(liveRegion);
  region.appendChild(liveRegion);

  container.appendChild(region);

  // ---------------------------------------------------------------------
  // Renderer — transparent, so the page's paper (and its tint wash) shows
  // through and the 3D stage has no edge of its own.
  // ---------------------------------------------------------------------
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch {
    container.innerHTML = '';
    return mountFallback(container, labels, books);
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP));
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.cursor = 'grab';
  renderer.domElement.style.touchAction = 'pan-y';
  canvasHost.appendChild(renderer.domElement);
  const canvas = renderer.domElement;

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  let destroyed = false;
  const disposables: Disposable[] = [];

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const darkSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const reducedMotionForced = options.reducedMotion !== undefined;
  let reducedMotion = options.reducedMotion ?? reducedMotionQuery.matches;
  let darkScheme = darkSchemeQuery.matches;
  let paperColor = readCssColor(document.documentElement, '--color-paper', '#f7f3ec');

  /** Wraps a slot index into `[0, total)`. */
  const wrapIndex = (index: number): number =>
    total === 0 ? -1 : ((Math.round(index) % total) + total) % total;

  const clampIndex = (index: number): number =>
    total === 0 ? -1 : THREE.MathUtils.clamp(Math.round(index), 0, total - 1);

  const normaliseIndex = (index: number): number => (wraps ? wrapIndex(index) : clampIndex(index));

  /**
   * The shortest signed distance, in slots, from a continuous carriage
   * position to a book — the whole of the looping illusion lives here. Each
   * volume is drawn exactly once, at whichever side of the carriage it is
   * nearer to, so the run has no ends to fall off.
   */
  function slotOffset(index: number, position: number): number {
    const raw = index - position;
    if (!wraps) return raw;
    let d = ((raw % total) + total) % total;
    if (d > total / 2) d -= total;
    return d;
  }

  let currentIndex = normaliseIndex(options.initialIndex ?? 0);
  // Unbounded when wrapping: the carriage keeps counting up past the last
  // volume rather than bouncing off it.
  let targetPosition = Math.max(0, currentIndex);
  const navTween = new Tween(targetPosition, STEP_DURATION_MS, easeInOutCubic);
  /** Set while the reader is scrubbing by hand; overrides the tween. */
  let livePosition: number | null = null;

  const tintTween = new Tween(0, TINT_DURATION_MS, easeInOutCubic);
  tintTween.snapTo(1);
  let tintFrom: ThemePalette = themePalette(
    paperColor,
    books[currentIndex]?.spineColor ?? '#6b5a45',
    darkScheme,
  );
  let tintTo: ThemePalette = tintFrom;

  // ---------------------------------------------------------------------
  // Scene
  // ---------------------------------------------------------------------
  const scene = new THREE.Scene();
  // No background: the page shows through. Fog is what dissolves the far end
  // of the run, so it must be the paper colour exactly.
  scene.fog = new THREE.Fog(tintFrom.fog.getHex(), 2.4, 15);

  // Book proportions and shelf-slot spacing — computed up front so the
  // lights, ledge and camera can all be sized against the real run length
  // instead of a fixed guess.
  const dims = books.map(computeBookDimensions);
  const maxWidth = dims.reduce((max, d) => Math.max(max, d.width), 0.42);
  const maxDepth = dims.reduce((max, d) => Math.max(max, d.depth), 0.06);
  const spacing = maxDepth + SPACING_GAP;
  // The most room the run can be asked to give up on one side of the
  // selection: a fully turned-out cover pressed against a racked neighbour.
  // The per-frame solver below works this out exactly, per pair; this is the
  // worst case, kept as a scalar so the camera can frame for it.
  const spread = Math.max(
    0,
    (maxWidth * SELECTED_SCALE) / 2 + maxDepth / 2 + CONTACT_GAP - spacing,
  );
  const shelfTopY = 0;

  // Recomputed in `updateCameraFraming` from the frame the camera actually
  // ends up with, so the run always fades out just past the edge of the
  // canvas rather than at a distance guessed from a reference viewport.
  let fadeStartDistance = 5.5;
  let fadeEndDistance = 7.5;

  const camera = new THREE.PerspectiveCamera(CAMERA_VERTICAL_FOV, 1, 0.1, 40);
  const cameraTarget = new THREE.Vector3(0, 0.54, 0);
  camera.position.set(0.3, 0.9, 3);
  camera.lookAt(cameraTarget);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x33241a, 0.95);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff1d8, 1.05);
  keyLight.position.set(-2.4, 3.1, 3.3);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.top = 2.1;
  keyLight.shadow.camera.bottom = -0.6;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 8;
  keyLight.shadow.bias = -0.0018;
  keyLight.shadow.normalBias = 0.01;
  keyLight.shadow.radius = 4;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xcfe0ea, 0.42);
  fillLight.position.set(2.6, 1.6, 2.4);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffe3b0, 0.55);
  rimLight.position.set(0.4, 2.4, -1.6);
  scene.add(rimLight);

  // The ledge. A unit-length board scaled on every resize so it always runs
  // clear off both edges of the frame, whatever shape the canvas takes.
  const woodTexture = createWoodGrainTexture();
  disposables.push(woodTexture);

  // One plank, deep enough that even the volume drawn forward still stands on
  // it. An earlier version added a separate front lip, but that box overlapped
  // the books in Z and sliced a bright band across every spine.
  const shelfBoardGeometry = new THREE.BoxGeometry(1, 0.07, LEDGE_DEPTH);
  const shelfBoardMaterial = new THREE.MeshStandardMaterial({
    map: woodTexture,
    roughness: 0.68,
    metalness: 0.02,
  });
  const shelfBoard = new THREE.Mesh(shelfBoardGeometry, shelfBoardMaterial);
  shelfBoard.position.set(0, shelfTopY - 0.035, 0.02);
  shelfBoard.receiveShadow = true;
  scene.add(shelfBoard);
  disposables.push(shelfBoardGeometry, shelfBoardMaterial);

  /** Tints the ledge so it belongs to the current theme rather than to a wood swatch. */
  function applySurfaceTheme(): void {
    shelfBoardMaterial.color.setHex(darkScheme ? 0x6b5c4a : 0xc7b294);
  }
  applySurfaceTheme();

  const shelfGroup = new THREE.Group();
  scene.add(shelfGroup);

  // ---------------------------------------------------------------------
  // Book rigs
  // ---------------------------------------------------------------------
  const textureLoader = new THREE.TextureLoader();
  const pageEdgeTexture = createPageEdgeTexture();
  const contactShadowTexture = createContactShadowTexture();
  const contactShadowGeometry = createContactShadowGeometry();
  disposables.push(pageEdgeTexture, contactShadowTexture, contactShadowGeometry);

  const raycaster = new THREE.Raycaster();

  let pendingCovers = books.length;
  function noteCoverSettled(): void {
    pendingCovers -= 1;
    if (pendingCovers <= 0 && !destroyed) options.onReady?.();
  }

  function buildBookRig(book: ShelfBook, index: number, dimensions: BookDimensions): BookRig {
    const root = new THREE.Group();
    root.name = `book-${book.id}`;
    const motion = new THREE.Group();
    root.add(motion);

    const geometry = createBookGeometry(dimensions);
    disposables.push(geometry);

    const frontMaterial = new THREE.MeshStandardMaterial({
      color: book.spineColor,
      roughness: 0.85,
      metalness: 0.02,
      transparent: true,
    });
    const backMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(book.spineColor).multiplyScalar(0.78),
      roughness: 0.9,
      metalness: 0.02,
      transparent: true,
    });
    // White whenever a map is in play: a standard material multiplies its map
    // by `color`, so tinting a spine texture that already paints the spine
    // colour squares the ground and drags the title down with it — which is
    // how every generated spine ended up near-black with type you couldn't
    // make out. The flat colour is only the ground for the moment before a
    // `spineUrl` texture arrives.
    const spineMaterial = new THREE.MeshStandardMaterial({
      color: book.spineUrl ? book.spineColor : 0xffffff,
      roughness: 0.88,
      metalness: 0.02,
      transparent: true,
    });
    // The generated spine is drawn at the proportions this volume actually has,
    // so the type is not stretched along the reading direction.
    const spineRatio = dimensions.depth / dimensions.height;
    if (!book.spineUrl) {
      const generated = createSpineTexture(book, spineRatio);
      spineMaterial.map = generated;
      spineMaterial.needsUpdate = true;
      disposables.push(generated);
    }
    const foreEdgeMaterial = new THREE.MeshStandardMaterial({
      map: pageEdgeTexture,
      roughness: 0.92,
      metalness: 0,
      transparent: true,
    });
    const headMaterial = new THREE.MeshStandardMaterial({
      map: pageEdgeTexture,
      roughness: 0.92,
      metalness: 0,
      transparent: true,
    });
    disposables.push(frontMaterial, backMaterial, spineMaterial, foreEdgeMaterial, headMaterial);

    const materials = [foreEdgeMaterial, spineMaterial, headMaterial, headMaterial, frontMaterial, backMaterial];
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.bookIndex = index;
    motion.add(mesh);

    const shadowMaterial = new THREE.MeshBasicMaterial({
      map: contactShadowTexture,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(contactShadowGeometry, shadowMaterial);
    disposables.push(shadowMaterial);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.scale.set(dimensions.width * 1.7, dimensions.width * 1.1, 1);
    shadowMesh.renderOrder = -1;
    shelfGroup.add(shadowMesh);

    shelfGroup.add(root);

    // Cover art — falls back to the flat spineColor material above until (or unless) it loads.
    void loadTextureSafe(textureLoader, book.coverUrl).then((texture) => {
      if (destroyed) {
        texture?.dispose();
        return;
      }
      if (texture) {
        frontMaterial.map = texture;
        frontMaterial.color.set(0xffffff);
        frontMaterial.needsUpdate = true;
        disposables.push(texture);
      }
      noteCoverSettled();
      requestRenderSoon();
    });

    if (book.spineUrl) {
      void loadTextureSafe(textureLoader, book.spineUrl).then((texture) => {
        if (destroyed) {
          texture?.dispose();
          return;
        }
        if (texture) {
          spineMaterial.map = texture;
          spineMaterial.color.set(0xffffff);
          disposables.push(texture);
        } else {
          const generated = createSpineTexture(book, spineRatio);
          spineMaterial.map = generated;
          spineMaterial.color.set(0xffffff);
          disposables.push(generated);
        }
        spineMaterial.needsUpdate = true;
        requestRenderSoon();
      });
    }

    const lean = (seededRandom(hashSeed(`${book.id}-lean`))() * 2 - 1) * MAX_LEAN;

    return {
      book,
      index,
      dims: dimensions,
      root,
      motion,
      mesh,
      shadowMesh,
      shadowMaterial,
      materials,
      lean,
      hover: 0,
    };
  }

  const rigs: BookRig[] = books.map((book, index) => buildBookRig(book, index, dims[index]));
  if (books.length === 0) options.onReady?.();

  // ---------------------------------------------------------------------
  // Pointer parallax (ambient, disabled under reduced motion)
  // ---------------------------------------------------------------------
  const pointerTarget = { x: 0, y: 0 };
  const pointerSmooth = { x: 0, y: 0 };
  let hoverIndex = -1;

  function ndcFromEvent(event: PointerEvent): THREE.Vector2 {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    return new THREE.Vector2(x, y);
  }

  function pickBookAt(ndc: THREE.Vector2): number {
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(
      rigs.filter((rig) => rig.mesh.visible).map((rig) => rig.mesh),
      false,
    );
    if (hits.length === 0) return -1;
    const hit = hits[0];
    return typeof hit.object.userData.bookIndex === 'number' ? hit.object.userData.bookIndex : -1;
  }

  // ---------------------------------------------------------------------
  // Selection / navigation
  // ---------------------------------------------------------------------
  function currentBook(): ShelfBook | undefined {
    return currentIndex >= 0 ? books[currentIndex] : undefined;
  }

  function announceSelection(): void {
    const book = currentBook();
    if (!book) return;
    liveRegion.textContent = formatSelected(labels.selected, book, currentIndex + 1, total);
    // Without these a non-visual reader hears one book at a time with no sense
    // of how long the shelf is or where they are on it.
    region.setAttribute('aria-setsize', String(total));
    region.setAttribute('aria-posinset', String(currentIndex + 1));
  }

  function currentPaletteSnapshot(now: number): ThemePalette {
    const p = tintTween.progressAt(now);
    return {
      fog: tintFrom.fog.clone().lerp(tintTo.fog, p),
      hemiSky: tintFrom.hemiSky.clone().lerp(tintTo.hemiSky, p),
      hemiGround: tintFrom.hemiGround.clone().lerp(tintTo.hemiGround, p),
      key: tintFrom.key.clone().lerp(tintTo.key, p),
      rim: tintFrom.rim.clone().lerp(tintTo.rim, p),
    };
  }

  /**
   * Moves the selection to `index` and re-tints the scene. Called both by
   * discrete navigation and, live, while the reader scrubs — hence the
   * `announce` switch: a screen reader wants the destination, not every
   * volume the carriage swept past.
   */
  function applySelection(index: number, announce: boolean): void {
    if (index < 0 || index === currentIndex) return;
    currentIndex = index;
    const now = performance.now();
    tintFrom = currentPaletteSnapshot(now);
    tintTo = themePalette(paperColor, books[currentIndex].spineColor, darkScheme);
    if (reducedMotion) tintTween.snapTo(1);
    else tintTween.retarget(1, now, TINT_DURATION_MS);
    if (announce) announceSelection();
    options.onSelect?.(books[currentIndex], currentIndex);
  }

  /** Retints without moving, e.g. after the colour scheme flips. */
  function refreshTheme(): void {
    paperColor = readCssColor(document.documentElement, '--color-paper', '#f7f3ec');
    const palette = themePalette(
      paperColor,
      books[currentIndex]?.spineColor ?? '#6b5a45',
      darkScheme,
    );
    tintFrom = palette;
    tintTo = palette;
    tintTween.snapTo(1);
    applySurfaceTheme();
    requestRenderSoon();
  }

  /** Eases the carriage to an absolute (unwrapped) position. */
  function glideTo(position: number, durationMs: number): void {
    if (total === 0) return;
    const now = performance.now();
    if (livePosition !== null) {
      navTween.snapTo(livePosition);
      livePosition = null;
    }
    targetPosition = wraps ? position : THREE.MathUtils.clamp(position, 0, total - 1);
    if (reducedMotion) navTween.snapTo(targetPosition);
    else navTween.retarget(targetPosition, now, durationMs, easeInOutCubic);
    applySelection(normaliseIndex(targetPosition), true);
    requestRenderSoon();
  }

  /** Steps by whole slots from wherever the carriage is heading. */
  function stepBy(slots: number): void {
    const from = livePosition ?? navTween.target;
    glideTo(Math.round(from) + slots, STEP_DURATION_MS);
  }

  /** Travels to a specific volume by the shorter way round. */
  function goToIndex(index: number): void {
    if (total === 0) return;
    const from = livePosition ?? navTween.target;
    const wanted = normaliseIndex(index);
    const delta = slotOffset(wanted, from);
    glideTo(Math.round(from) + Math.round(delta), STEP_DURATION_MS);
  }

  function getPosition(now: number): number {
    if (livePosition !== null) return livePosition;
    return navTween.valueAt(now);
  }

  // ---------------------------------------------------------------------
  // Hand scrubbing — wheel and drag both write to `livePosition`, then hand
  // the carriage back to the tween when they let go.
  // ---------------------------------------------------------------------
  let settleTimer = 0;

  function cancelSettle(): void {
    if (settleTimer) {
      window.clearTimeout(settleTimer);
      settleTimer = 0;
    }
  }

  function beginScrub(): void {
    cancelSettle();
    if (livePosition === null) livePosition = navTween.valueAt(performance.now());
  }

  function scrubTo(position: number): void {
    livePosition = wraps ? position : THREE.MathUtils.clamp(position, 0, total - 1);
    // The caption tracks the carriage live; only the settle announces.
    applySelection(normaliseIndex(livePosition), false);
    requestRenderSoon();
  }

  /**
   * Lets go of the carriage. `velocity` is in slots per second: the shelf
   * projects where a throw of that speed would come to rest, clamps it to a
   * sane distance, and eases onto the nearest volume from there.
   */
  function settle(velocity = 0): void {
    cancelSettle();
    if (livePosition === null) return;
    const projected =
      livePosition + THREE.MathUtils.clamp(velocity * FLICK_PROJECTION_S, -FLICK_MAX_SLOTS, FLICK_MAX_SLOTS);
    const landing = Math.round(projected);
    const travel = Math.abs(landing - livePosition);
    const duration = THREE.MathUtils.clamp(SETTLE_MIN_MS + travel * 110, SETTLE_MIN_MS, SETTLE_MAX_MS);
    const now = performance.now();
    navTween.snapTo(livePosition);
    livePosition = null;
    targetPosition = wraps ? landing : THREE.MathUtils.clamp(landing, 0, total - 1);
    if (reducedMotion) navTween.snapTo(targetPosition);
    else navTween.retarget(targetPosition, now, duration, easeOutQuint);
    applySelection(normaliseIndex(targetPosition), true);
    requestRenderSoon();
  }

  // ---------------------------------------------------------------------
  // Frame update
  // ---------------------------------------------------------------------
  function updateTint(now: number): void {
    const p = tintTween.progressAt(now);
    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(tintFrom.fog).lerp(tintTo.fog, p);
    hemiLight.color.copy(tintFrom.hemiSky).lerp(tintTo.hemiSky, p);
    hemiLight.groundColor.copy(tintFrom.hemiGround).lerp(tintTo.hemiGround, p);
    keyLight.color.copy(tintFrom.key).lerp(tintTo.key, p);
    rimLight.color.copy(tintFrom.rim).lerp(tintTo.rim, p);
  }

  let lastReportedPosition = Number.NaN;
  function reportProgress(position: number): void {
    if (Math.abs(position - lastReportedPosition) < 0.002) return;
    lastReportedPosition = position;
    options.onProgress?.(position, total);
  }

  /**
   * One volume's pose for the current frame, before the run has been spaced
   * out. Reused between frames — the layout runs every frame and must not
   * allocate.
   */
  interface LayoutSlot {
    rig: BookRig;
    /** Signed distance from the carriage, in slots. */
    offset: number;
    focus: number;
    hover: number;
    rotationY: number;
    scale: number;
    /** Half the width this volume covers along X, in its current pose. */
    halfX: number;
    x: number;
  }

  const slots: LayoutSlot[] = rigs.map((rig) => ({
    rig,
    offset: 0,
    focus: 0,
    hover: 0,
    rotationY: REST_ROTATION_Y,
    scale: 1,
    halfX: 0,
    x: 0,
  }));
  /** Extra room pair `i`..`i+1` needs beyond one slot of pitch. */
  const gapExtras = new Float64Array(Math.max(0, slots.length - 1));
  const byOffset = (a: LayoutSlot, b: LayoutSlot): number => a.offset - b.offset;

  /**
   * Half the footprint, along the camera's X axis, of a book-sized box turned
   * `angle` radians about Y. Racked (angle = π/2) that is half its spine
   * thickness; turned out (angle = 0) it is half its full cover width, and in
   * between it is the width the two swept corners actually need.
   */
  function halfExtentX(dimensions: BookDimensions, angle: number, scale: number): number {
    return (
      (scale * (Math.abs(Math.cos(angle)) * dimensions.width + Math.abs(Math.sin(angle)) * dimensions.depth)) / 2
    );
  }

  /**
   * Spaces the run out so no two volumes ever occupy the same stretch of X.
   *
   * Pitch alone is not enough: a volume turning to face the camera grows from
   * one spine thickness to a full cover width, and a fixed spread profile
   * either leaves a hole at rest or lets the turning cover enter the volumes
   * beside it halfway through the step. Instead each neighbouring pair is
   * asked how much room it actually needs right now, and the surplus is
   * inserted between them — pushing the rest of the run outwards from the
   * carriage, exactly the way a real shelf gives when a volume is drawn out.
   *
   * Books are already sorted by offset, so keeping every adjacent pair clear
   * keeps the whole run clear.
   */
  function spaceOutRun(count: number): void {
    for (let i = 0; i < count - 1; i += 1) {
      gapExtras[i] = Math.max(0, slots[i].halfX + slots[i + 1].halfX + CONTACT_GAP - spacing);
    }

    // The last volume at or left of the carriage. The run opens outwards from
    // here, so the selection itself stays put and the shelf parts around it.
    let pivot = -1;
    for (let i = 0; i < count; i += 1) {
      if (slots[i].offset > 0) break;
      pivot = i;
    }

    // The pair straddling the carriage shares its surplus by how far the
    // carriage has crossed it: sitting on a volume, that volume holds still
    // and its neighbour takes the whole push; halfway between two, they part
    // symmetrically. This is what keeps the run from lurching sideways as the
    // carriage passes from one volume to the next.
    let rightShare = 0;
    let leftShare = 0;
    if (pivot >= 0 && pivot + 1 < count) {
      const crossed = clamp01(slots[pivot + 1].offset);
      rightShare = gapExtras[pivot] * crossed;
      leftShare = gapExtras[pivot] * (1 - crossed);
    }

    let acc = rightShare;
    for (let i = pivot + 1; i < count; i += 1) {
      slots[i].x = slots[i].offset * spacing + acc;
      if (i < count - 1) acc += gapExtras[i];
    }
    acc = leftShare;
    for (let i = pivot; i >= 0; i -= 1) {
      slots[i].x = slots[i].offset * spacing - acc;
      if (i > 0) acc += gapExtras[i - 1];
    }
  }

  function layoutBooks(now: number, elapsed: number, dt: number): void {
    const position = getPosition(now);
    reportProgress(position);
    const hoverRate = Math.min(1, dt * 9);
    const count = slots.length;

    // Pass one: every volume's own pose, and the room it needs for it.
    for (let i = 0; i < count; i += 1) {
      const slot = slots[i];
      const rig = slot.rig;
      const offset = slotOffset(rig.index, position);
      const proximity = clamp01(1 - Math.abs(offset));
      const focus = smootherstep(proximity);
      // The turn trails the draw-out, so a volume is already clear of the run
      // before its cover starts sweeping sideways.
      const turn = smootherstep(clamp01((proximity - TURN_DELAY) / (1 - TURN_DELAY)));

      const wantsHover = hoverIndex === rig.index && focus < 0.9 ? 1 : 0;
      rig.hover += (wantsHover - rig.hover) * hoverRate;
      const hover = reducedMotion ? wantsHover : rig.hover;

      const scale = 1 + focus * (SELECTED_SCALE - 1);
      // The ambient parallax yaw is part of the pose, so the spacing has to
      // account for it too — otherwise a cover tilted towards the pointer
      // reaches past the clearance that was solved for.
      const parallaxYaw = reducedMotion ? 0 : -pointerSmooth.x * 0.05 * focus;
      const rotationY = lerp(REST_ROTATION_Y, SELECTED_ROTATION_Y, turn);

      slot.offset = offset;
      slot.focus = focus;
      slot.hover = hover;
      slot.rotationY = rotationY;
      slot.scale = scale;
      slot.halfX = halfExtentX(rig.dims, rotationY + parallaxYaw, scale);
    }

    slots.sort(byOffset);
    spaceOutRun(count);

    // Pass two: commit the solved X and the rest of the pose.
    for (let i = 0; i < count; i += 1) {
      const { rig, offset, focus, hover, rotationY, scale, x } = slots[i];
      const distance = Math.abs(offset);

      // A hovered volume rides up out of the run, the way you tip one out with
      // a finger before deciding to take it.
      const y = shelfTopY + rig.dims.height / 2 + focus * 0.04 + hover * 0.05;
      const z = focus * SELECTED_LIFT_Z + hover * 0.05;

      rig.root.position.set(x, y, z);
      rig.root.rotation.y = rotationY;
      // Books lean while they are racked and stand up as they come forward.
      rig.root.rotation.z = rig.lean * (1 - focus) * (1 - hover * 0.6);
      rig.root.scale.setScalar(scale);

      const idle = reducedMotion ? 0 : Math.sin(elapsed * 0.9 + rig.index * 0.7) * 0.01 * focus;
      rig.motion.position.y = idle;
      if (!reducedMotion) {
        rig.motion.rotation.x = pointerSmooth.y * 0.05 * focus;
        rig.motion.rotation.y = -pointerSmooth.x * 0.05 * focus;
      } else {
        rig.motion.rotation.x = 0;
        rig.motion.rotation.y = 0;
      }

      const fadeT = clamp01((distance - fadeStartDistance) / Math.max(0.001, fadeEndDistance - fadeStartDistance));
      const opacity = 1 - smootherstep(fadeT);
      for (const material of rig.materials) material.opacity = opacity;
      rig.mesh.visible = opacity > 0.02;

      rig.shadowMesh.position.set(x, shelfTopY - 0.001, z + rig.dims.depth * 0.5 + 0.06);
      rig.shadowMaterial.opacity = 0.32 * opacity * (1 - hover * 0.45);
      rig.shadowMesh.visible = opacity > 0.02;
    }
  }

  function updatePointerSmoothing(dt: number): void {
    if (reducedMotion) {
      pointerSmooth.x = 0;
      pointerSmooth.y = 0;
      return;
    }
    const rate = Math.min(1, dt * 6);
    pointerSmooth.x += (pointerTarget.x - pointerSmooth.x) * rate;
    pointerSmooth.y += (pointerTarget.y - pointerSmooth.y) * rate;
  }

  let lastFrameTime = performance.now();
  function updateFrame(now: number): void {
    const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
    lastFrameTime = now;
    const elapsed = now / 1000;
    updatePointerSmoothing(dt);
    layoutBooks(now, elapsed, dt);
    updateTint(now);
    renderer.render(scene, camera);
  }

  // ---------------------------------------------------------------------
  // Render loop / visibility
  // ---------------------------------------------------------------------
  let rafId = 0;
  let isIntersecting = true;

  function stopLoop(): void {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function loop(now: number): void {
    rafId = 0;
    updateFrame(now);
    if (!destroyed && !reducedMotion && isIntersecting && !document.hidden) {
      rafId = requestAnimationFrame(loop);
    }
  }

  function renderOnce(): void {
    lastFrameTime = performance.now() - 16;
    updateFrame(performance.now());
  }

  function ensureLoopRunning(): void {
    if (destroyed) return;
    if (reducedMotion) {
      renderOnce();
      return;
    }
    if (!rafId && isIntersecting && !document.hidden) {
      lastFrameTime = performance.now();
      rafId = requestAnimationFrame(loop);
    }
  }

  function requestRenderSoon(): void {
    if (destroyed) return;
    if (reducedMotion) {
      renderOnce();
    } else {
      ensureLoopRunning();
    }
  }

  const resizeObserver = new ResizeObserver(() => {
    handleResize();
  });
  resizeObserver.observe(container);

  /**
   * Picks a camera distance so that, whatever the container's current
   * aspect ratio, roughly `TARGET_VISIBLE_SLOTS` book-slots are visible
   * across the frame *and* the (slightly popped-forward, slightly scaled
   * up) selected book stays fully inside the frame with vertical margin.
   * Both constraints are distance-only (FOV is fixed), so we solve each
   * independently and take the larger, safer distance. Everything that has
   * to match the resulting frame — the fade radius, the ledge, the shadow
   * camera, the fog — is then derived from it rather than guessed.
   */
  function updateCameraFraming(): void {
    const halfVerticalFov = THREE.MathUtils.degToRad(CAMERA_VERTICAL_FOV / 2);
    const tanHalf = Math.tan(halfVerticalFov);
    const aspect = camera.aspect;

    // A narrow canvas frames fewer volumes instead of rendering them tiny.
    const slots = THREE.MathUtils.clamp(
      TARGET_VISIBLE_SLOTS * (aspect / REFERENCE_ASPECT),
      MIN_VISIBLE_SLOTS,
      TARGET_VISIBLE_SLOTS,
    );
    const frameHalfWidth = (slots * spacing) / 2 + spread;
    const distanceForSlots = frameHalfWidth / Math.max(0.05, tanHalf * aspect);
    // Half the book's height, scaled for the selected state and for the fact
    // that popping forward in Z makes it read larger than its world size.
    const selectedHalfHeight = 0.58;
    const distanceForHeight = (selectedHalfHeight + VERTICAL_MARGIN) / tanHalf;
    const distance = THREE.MathUtils.clamp(
      Math.max(distanceForSlots, distanceForHeight),
      CAMERA_MIN_DISTANCE,
      CAMERA_MAX_DISTANCE,
    );

    // Dead-on and slightly above. Yawing the camera off-axis put the ledge on
    // a diagonal, which fights every horizontal rule on the page; the lift
    // alone is enough to keep the shot from reading as an elevation drawing.
    camera.position.set(0, cameraTarget.y + distance * 0.05, distance);
    camera.lookAt(cameraTarget);
    camera.updateProjectionMatrix();

    // How much of the run the frame can actually hold, in slots — the fade has
    // to finish inside that, or the shelf reads as a floating cluster on wide
    // canvases and as an abrupt cut on narrow ones.
    const visibleHalfWidth = tanHalf * aspect * distance;
    const visibleHalfSlots = visibleHalfWidth / spacing;
    const hardLimit = wraps ? total / 2 : Number.POSITIVE_INFINITY;
    fadeEndDistance = Math.max(2.5, Math.min(hardLimit, visibleHalfSlots + 1.5));
    fadeStartDistance = Math.max(1.5, fadeEndDistance - 2.6);

    // The ledge runs clear off both edges, and the shadow camera covers it.
    const ledgeLength = visibleHalfWidth * 2 + maxWidth * 2 + 1;
    shelfBoard.scale.x = ledgeLength;
    woodTexture.repeat.set(ledgeLength * 1.6, 1);
    keyLight.shadow.camera.left = -(visibleHalfWidth + 1);
    keyLight.shadow.camera.right = visibleHalfWidth + 1;
    keyLight.shadow.camera.updateProjectionMatrix();

    // Gentle haze: nothing in front of the selected volume is touched, and the
    // far end of the run dissolves into the page instead of stopping.
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = distance * 0.95;
      scene.fog.far = distance + Math.max(3, visibleHalfWidth * 2.4);
    }
  }

  function handleResize(): void {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    updateCameraFraming();
    requestRenderSoon();
  }

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      isIntersecting = entries[entries.length - 1]?.isIntersecting ?? true;
      if (isIntersecting) ensureLoopRunning();
    },
    { threshold: 0.01 },
  );
  intersectionObserver.observe(container);

  const onVisibilityChange = (): void => {
    if (!document.hidden) ensureLoopRunning();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  const onReducedMotionChange = (event: MediaQueryListEvent): void => {
    if (reducedMotionForced) return;
    reducedMotion = event.matches;
    if (reducedMotion) {
      navTween.snapTo(navTween.target);
      tintTween.snapTo(1);
      stopLoop();
      renderOnce();
    } else {
      ensureLoopRunning();
    }
  };
  reducedMotionQuery.addEventListener('change', onReducedMotionChange);

  const onSchemeChange = (event: MediaQueryListEvent): void => {
    darkScheme = event.matches;
    refreshTheme();
  };
  darkSchemeQuery.addEventListener('change', onSchemeChange);

  // ---------------------------------------------------------------------
  // Input: wheel, drag-to-scrub, click, keyboard
  // ---------------------------------------------------------------------

  /** Converts a wheel delta to pixels, whatever unit the device reports in. */
  function toPixels(delta: number, deltaMode: number): number {
    if (deltaMode === 1) return delta * 16; // lines
    if (deltaMode === 2) return delta * 400; // pages
    return delta;
  }

  /**
   * The lateral component of a wheel gesture, or 0 if there isn't one.
   *
   * Vertical scrolling stays the page's. A full-bleed stage that swallowed it
   * would strand the reader on a shelf that loops and therefore has no end to
   * escape past — so the shelf only claims sideways trackpad swipes, tilt
   * wheels and shift+wheel. Dragging, the arrow keys and the two steppers all
   * still browse it, and the cursor advertises the drag.
   */
  function lateralPixels(event: WheelEvent): number {
    if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) {
      return toPixels(event.deltaX, event.deltaMode);
    }
    return event.shiftKey ? toPixels(event.deltaY, event.deltaMode) : 0;
  }

  let reducedWheelAccumulator = 0;
  const onWheel = (event: WheelEvent): void => {
    const pixels = lateralPixels(event);
    if (pixels === 0) return;
    event.preventDefault();

    if (reducedMotion) {
      // No scrubbing under reduced motion: step, once, per notch.
      reducedWheelAccumulator += pixels;
      while (Math.abs(reducedWheelAccumulator) >= WHEEL_PIXELS_PER_SLOT) {
        const direction = reducedWheelAccumulator > 0 ? 1 : -1;
        stepBy(direction);
        reducedWheelAccumulator -= direction * WHEEL_PIXELS_PER_SLOT;
      }
      return;
    }

    beginScrub();
    scrubTo((livePosition ?? 0) + pixels / WHEEL_PIXELS_PER_SLOT);
    cancelSettle();
    settleTimer = window.setTimeout(() => {
      settleTimer = 0;
      settle();
    }, WHEEL_SETTLE_DELAY_MS);
  };
  canvas.addEventListener('wheel', onWheel, { passive: false });

  interface DragState {
    pointerId: number;
    startX: number;
    lastX: number;
    lastTime: number;
    /** Slots per second, exponentially smoothed. */
    velocity: number;
    moved: boolean;
  }
  let drag: DragState | null = null;

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    // The canvas itself is not focusable, and a click on a non-focusable
    // descendant does not reliably focus an ancestor in every engine —
    // focus the region explicitly so keyboard nav works right after a click.
    region.focus({ preventScroll: true });
    cancelSettle();
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
      moved: false,
    };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!reducedMotion) {
      const ndc = ndcFromEvent(event);
      pointerTarget.x = ndc.x;
      pointerTarget.y = ndc.y;
    }

    if (drag && drag.pointerId === event.pointerId) {
      if (!drag.moved && Math.abs(event.clientX - drag.startX) > DRAG_MOVE_THRESHOLD) {
        drag.moved = true;
        beginScrub();
      }
      if (drag.moved) {
        const dx = event.clientX - drag.lastX;
        const dt = Math.max(1, event.timeStamp - drag.lastTime) / 1000;
        const slots = -dx / DRAG_PIXELS_PER_SLOT;
        scrubTo((livePosition ?? 0) + slots);
        // Smoothed so one stuttering sample cannot throw the whole flick.
        drag.velocity = lerp(drag.velocity, slots / dt, 0.35);
        drag.lastX = event.clientX;
        drag.lastTime = event.timeStamp;
      }
      return;
    }

    if (!drag) {
      const nextHover = pickBookAt(ndcFromEvent(event));
      if (nextHover !== hoverIndex) {
        hoverIndex = nextHover;
        canvas.style.cursor = hoverIndex >= 0 ? 'pointer' : 'grab';
        requestRenderSoon();
      }
    }
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const { moved, velocity } = drag;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    canvas.style.cursor = hoverIndex >= 0 ? 'pointer' : 'grab';
    drag = null;

    if (moved) {
      settle(reducedMotion ? 0 : velocity);
      return;
    }

    // A tap: the centred volume opens, any other volume comes to the centre.
    const clicked = pickBookAt(ndcFromEvent(event));
    if (clicked < 0) return;
    if (clicked === currentIndex) {
      const book = currentBook();
      if (book) options.onActivate?.(book, currentIndex);
    } else {
      goToIndex(clicked);
    }
  };

  const onPointerLeave = (): void => {
    pointerTarget.x = 0;
    pointerTarget.y = 0;
    if (!drag) {
      hoverIndex = -1;
      canvas.style.cursor = 'grab';
      requestRenderSoon();
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      stepBy(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      stepBy(-1);
    } else if (event.key === 'PageDown') {
      event.preventDefault();
      stepBy(5);
    } else if (event.key === 'PageUp') {
      event.preventDefault();
      stepBy(-5);
    } else if (event.key === 'Home') {
      event.preventDefault();
      goToIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      goToIndex(total - 1);
    } else if ((event.key === 'Enter' || event.key === ' ') && event.target === region) {
      event.preventDefault();
      const book = currentBook();
      if (book) options.onActivate?.(book, currentIndex);
    }
  };
  region.addEventListener('keydown', onKeyDown);

  // ---------------------------------------------------------------------
  // Initial paint
  // ---------------------------------------------------------------------
  handleResize();
  announceSelection();
  if (currentIndex >= 0) options.onSelect?.(books[currentIndex], currentIndex);
  reportProgress(targetPosition);
  layoutBooks(performance.now(), performance.now() / 1000, 0.016);
  updateTint(performance.now());
  renderer.render(scene, camera);
  ensureLoopRunning();

  // ---------------------------------------------------------------------
  // Handle
  // ---------------------------------------------------------------------
  const handle: ShelfHandle = {
    select(index: number) {
      goToIndex(index);
    },
    next() {
      stepBy(1);
    },
    previous() {
      stepBy(-1);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      cancelSettle();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reducedMotionQuery.removeEventListener('change', onReducedMotionChange);
      darkSchemeQuery.removeEventListener('change', onSchemeChange);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      region.removeEventListener('keydown', onKeyDown);

      // Every geometry/material/texture created above (including each book's
      // own geometry and its contact-shadow material) was pushed into
      // `disposables` as it was made, so a single sweep here is enough —
      // disposing them again here would just double-fire `dispose()`.
      for (const disposable of disposables) {
        try {
          disposable.dispose();
        } catch {
          // Best-effort cleanup — a texture that failed to load may already be gone.
        }
      }
      renderer.dispose();
      const contextLoss = renderer as unknown as { forceContextLoss?: () => void };
      contextLoss.forceContextLoss?.();

      container.innerHTML = '';
    },
  };

  return handle;
};
