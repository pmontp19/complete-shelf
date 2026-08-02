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
  loadTextureSafe,
} from './textures';
import { Tween, clamp01, easeInOutCubic, lerp } from './easing';

/** Anything with a `.dispose()` — collected as resources are created so `destroy()` can free them all. */
interface Disposable {
  dispose(): void;
}

const NAV_DURATION_MS = 560;
const TINT_DURATION_MS = 700;
const PIXEL_RATIO_CAP = 2;
// Racked books stand spine-out, so a slot is one spine thick — not one cover
// wide. Spacing off the cover width left ~5x the spine's own width of dead air
// between volumes, which read as a nearly empty shelf.
const SPACING_GAP = 0.012;
// The centred book turns to face the camera and then needs its full cover
// width. Neighbours slide outward to open that gap, the way a shelf gives when
// you pull a volume halfway out.
const SELECTED_CLEARANCE = 0.05;
const SPREAD_FALLOFF = 1.6;
const REST_ROTATION_Y = Math.PI / 2; // spine facing the camera
const SELECTED_ROTATION_Y = 0; // front cover facing the camera
// Neighbours fully fade out just past the edge of the framed run so the
// shelf reads as continuing off-frame rather than stopping abruptly.
const FADE_START_DISTANCE = 5.5;
const FADE_END_DISTANCE = 7.5;
const DRAG_PIXELS_PER_SLOT = 140;
const DRAG_MOVE_THRESHOLD = 4;
const WHEEL_STEP = 90;

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
const VERTICAL_MARGIN = 0.26;
const CAMERA_MIN_DISTANCE = 1.8;
const CAMERA_MAX_DISTANCE = 13;

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

function formatSelected(template: string, book: ShelfBook): string {
  return template.replace('{title}', book.title).replace('{author}', book.author);
}

interface ThemePalette {
  background: THREE.Color;
  fog: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  key: THREE.Color;
  rim: THREE.Color;
}

function themePalette(spineColorHex: string): ThemePalette {
  const base = new THREE.Color(spineColorHex);
  const hsl = { h: 0, s: 0, l: 0 };
  base.getHSL(hsl);
  return {
    background: new THREE.Color().setHSL(hsl.h, Math.min(0.14, hsl.s * 0.3 + 0.04), 0.93),
    fog: new THREE.Color().setHSL(hsl.h, Math.min(0.16, hsl.s * 0.32 + 0.05), 0.86),
    hemiSky: new THREE.Color().setHSL(hsl.h, Math.min(0.22, hsl.s * 0.4 + 0.06), 0.88),
    hemiGround: new THREE.Color().setHSL(hsl.h, Math.min(0.3, hsl.s * 0.5 + 0.08), 0.26),
    key: new THREE.Color().setHSL(hsl.h, Math.min(0.28, hsl.s * 0.4 + 0.06), 0.9),
    rim: new THREE.Color().setHSL(hsl.h, Math.min(0.55, hsl.s * 0.7 + 0.15), 0.62),
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
  materials: THREE.MeshStandardMaterial[];
}

export const mountShelf: MountShelf = async (container, options) => {
  const { books, labels } = options;

  if (!isWebglAvailable()) {
    return mountFallback(container, labels, books);
  }

  // ---------------------------------------------------------------------
  // DOM scaffold
  // ---------------------------------------------------------------------
  container.innerHTML = '';
  container.style.position = container.style.position || 'relative';

  const region = document.createElement('div');
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', labels.region);
  region.tabIndex = 0;
  region.style.position = 'relative';
  region.style.width = '100%';
  region.style.height = '100%';
  region.style.overflow = 'hidden';
  // The ancestor `.shelf__canvas` wrapper clips with overflow:hidden too, so an
  // outward-drawn outline would be clipped at exactly the frame it should ring.
  // Drawing it inset keeps the focus ring visible.
  region.style.outlineOffset = '-3px';

  const canvasHost = document.createElement('div');
  canvasHost.style.position = 'absolute';
  canvasHost.style.inset = '0';
  region.appendChild(canvasHost);

  const loadingNote = document.createElement('div');
  loadingNote.textContent = labels.loading;
  loadingNote.style.position = 'absolute';
  loadingNote.style.left = '0.75rem';
  loadingNote.style.top = '0.75rem';
  loadingNote.style.font = '0.75rem system-ui, sans-serif';
  loadingNote.style.opacity = '0.65';
  loadingNote.style.pointerEvents = 'none';
  loadingNote.style.transition = 'opacity 0.4s ease';
  region.appendChild(loadingNote);
  let loadingNoteHidden = false;
  function hideLoadingNote(): void {
    if (loadingNoteHidden) return;
    loadingNoteHidden = true;
    loadingNote.style.opacity = '0';
  }

  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('aria-live', 'polite');
  visuallyHide(liveRegion);
  region.appendChild(liveRegion);

  const controls = document.createElement('div');
  controls.style.position = 'absolute';
  controls.style.bottom = '1rem';
  controls.style.left = '50%';
  controls.style.transform = 'translateX(-50%)';
  controls.style.display = 'flex';
  controls.style.gap = '0.6rem';
  controls.style.zIndex = '2';

  function makeButton(label: string, glyph: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.textContent = glyph;
    button.style.font = '1rem system-ui, sans-serif';
    button.style.width = '2.25rem';
    button.style.height = '2.25rem';
    button.style.borderRadius = '999px';
    button.style.border = '1px solid rgba(0,0,0,0.18)';
    button.style.background = 'rgba(255,255,255,0.82)';
    button.style.color = '#2a2118';
    button.style.cursor = 'pointer';
    button.style.lineHeight = '1';
    return button;
  }

  const previousButton = makeButton(labels.previous, '‹');
  const openButton = makeButton(labels.open, '●');
  const nextButton = makeButton(labels.next, '›');
  controls.append(previousButton, openButton, nextButton);
  region.appendChild(controls);

  container.appendChild(region);

  // ---------------------------------------------------------------------
  // Renderer
  // ---------------------------------------------------------------------
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch {
    container.innerHTML = '';
    return mountFallback(container, labels, books);
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_CAP));
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.cursor = 'grab';
  renderer.domElement.style.touchAction = 'none';
  canvasHost.appendChild(renderer.domElement);
  const canvas = renderer.domElement;

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  let destroyed = false;
  const disposables: Disposable[] = [];

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedMotionForced = options.reducedMotion !== undefined;
  let reducedMotion = options.reducedMotion ?? reducedMotionQuery.matches;

  const clampIndex = (index: number): number =>
    books.length === 0 ? -1 : THREE.MathUtils.clamp(Math.round(index), 0, books.length - 1);

  let currentIndex = clampIndex(options.initialIndex ?? 0);
  const navTween = new Tween(Math.max(0, currentIndex), NAV_DURATION_MS, easeInOutCubic);
  let livePosition: number | null = null;

  const tintTween = new Tween(0, TINT_DURATION_MS, easeInOutCubic);
  tintTween.snapTo(1);
  let tintFrom: ThemePalette = themePalette(books[currentIndex]?.spineColor ?? '#6b5a45');
  let tintTo: ThemePalette = tintFrom;

  // ---------------------------------------------------------------------
  // Scene
  // ---------------------------------------------------------------------
  const scene = new THREE.Scene();
  const sceneBackground = new THREE.Color();
  scene.background = sceneBackground;
  scene.fog = new THREE.Fog(0xffffff, 2.4, 15);

  // Book proportions and shelf-slot spacing — computed up front so the
  // lights, backdrop and camera can all be sized against the real run
  // length instead of a fixed guess.
  const dims = books.map(computeBookDimensions);
  const maxWidth = dims.reduce((max, d) => Math.max(max, d.width), 0.42);
  const maxDepth = dims.reduce((max, d) => Math.max(max, d.depth), 0.06);
  const spacing = maxDepth + SPACING_GAP;
  // Half the extra room the turned-out book needs beyond its own slot.
  const spread = Math.max(0, (maxWidth + SELECTED_CLEARANCE - spacing) / 2);
  const shelfTopY = 0;
  // Only books within the fade radius are ever drawn, so the board needs to
  // span that run plus a margin — not the full 22-volume collection.
  const shelfLength = Math.max(
    3,
    Math.min(books.length, FADE_END_DISTANCE * 2 + 2) * spacing + spread * 2 + maxWidth * 1.6,
  );
  const halfFrameWidth = (TARGET_VISIBLE_SLOTS * spacing) / 2 + spread;

  const camera = new THREE.PerspectiveCamera(CAMERA_VERTICAL_FOV, 1, 0.1, 40);
  const cameraTarget = new THREE.Vector3(0, 0.6, 0);
  camera.position.set(0.3, 0.9, 3);
  camera.lookAt(cameraTarget);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x33241a, 0.75);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff1d8, 1.3);
  keyLight.position.set(-2.4, 3.1, 3.3);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -(halfFrameWidth + 1);
  keyLight.shadow.camera.right = halfFrameWidth + 1;
  keyLight.shadow.camera.top = 2.1;
  keyLight.shadow.camera.bottom = -0.6;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 8;
  keyLight.shadow.bias = -0.0018;
  keyLight.shadow.normalBias = 0.01;
  keyLight.shadow.radius = 2.5;
  keyLight.shadow.camera.updateProjectionMatrix();
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xcfe0ea, 0.32);
  fillLight.position.set(2.6, 1.6, 2.4);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffe3b0, 0.55);
  rimLight.position.set(0.4, 2.4, -1.6);
  scene.add(rimLight);

  // Backdrop — tinted with the same palette as the background for a seamless
  // studio wall. Sized generously and re-scaled on resize (see
  // `updateCameraFraming`) so it always covers the frustum, however far the
  // camera has to sit back to frame the full run of books.
  const backdropGeometry = new THREE.PlaneGeometry(1, 1);
  const backdropMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true });
  const backdrop = new THREE.Mesh(backdropGeometry, backdropMaterial);
  backdrop.position.set(0, 2.2, -3.4);
  scene.add(backdrop);
  disposables.push(backdropGeometry, backdropMaterial);

  const woodTexture = createWoodGrainTexture();
  woodTexture.repeat.set(shelfLength * 1.6, 1);
  disposables.push(woodTexture);

  const shelfBoardGeometry = new THREE.BoxGeometry(shelfLength, 0.08, 0.5);
  const shelfBoardMaterial = new THREE.MeshStandardMaterial({
    map: woodTexture,
    roughness: 0.72,
    metalness: 0.02,
  });
  const shelfBoard = new THREE.Mesh(shelfBoardGeometry, shelfBoardMaterial);
  shelfBoard.position.set(0, shelfTopY - 0.04, -0.08);
  shelfBoard.receiveShadow = true;
  shelfBoard.castShadow = true;
  scene.add(shelfBoard);
  disposables.push(shelfBoardGeometry, shelfBoardMaterial);

  const shelfLipGeometry = new THREE.BoxGeometry(shelfLength, 0.02, 0.54);
  const shelfLipMaterial = new THREE.MeshStandardMaterial({
    map: woodTexture,
    roughness: 0.6,
    metalness: 0.02,
    color: 0x3c2c1c,
  });
  const shelfLip = new THREE.Mesh(shelfLipGeometry, shelfLipMaterial);
  shelfLip.position.set(0, shelfTopY - 0.005, 0.12);
  shelfLip.receiveShadow = true;
  scene.add(shelfLip);
  disposables.push(shelfLipGeometry, shelfLipMaterial);

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
    const spineMaterial = new THREE.MeshStandardMaterial({
      color: book.spineUrl ? 0xffffff : book.spineColor,
      roughness: 0.88,
      metalness: 0.02,
      transparent: true,
    });
    if (!book.spineUrl) {
      const generated = createSpineTexture(book);
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

    const shadowMesh = new THREE.Mesh(contactShadowGeometry, new THREE.MeshBasicMaterial({
      map: contactShadowTexture,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    }));
    disposables.push(shadowMesh.material as THREE.Material);
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
      hideLoadingNote();
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
          const generated = createSpineTexture(book);
          spineMaterial.map = generated;
          spineMaterial.color.set(0xffffff);
          disposables.push(generated);
        }
        spineMaterial.needsUpdate = true;
        requestRenderSoon();
      });
    }

    return { book, index, dims: dimensions, root, motion, mesh, shadowMesh, materials };
  }

  const rigs: BookRig[] = books.map((book, index) => buildBookRig(book, index, dims[index]));

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
    const hits = raycaster.intersectObjects(rigs.map((rig) => rig.mesh), false);
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
    if (book) liveRegion.textContent = formatSelected(labels.selected, book);
  }

  function goTo(targetIndex: number): void {
    if (books.length === 0) return;
    const clamped = clampIndex(targetIndex);
    const now = performance.now();
    if (clamped === currentIndex) {
      requestRenderSoon();
      return;
    }
    currentIndex = clamped;
    if (reducedMotion) {
      navTween.snapTo(currentIndex);
    } else {
      navTween.retarget(currentIndex, now, NAV_DURATION_MS);
    }

    const nextPalette = themePalette(books[currentIndex].spineColor);
    tintFrom = currentPaletteSnapshot(now);
    tintTo = nextPalette;
    if (reducedMotion) tintTween.snapTo(1);
    else tintTween.retarget(1, now, TINT_DURATION_MS);

    announceSelection();
    options.onSelect?.(books[currentIndex], currentIndex);
    requestRenderSoon();
  }

  function currentPaletteSnapshot(now: number): ThemePalette {
    const p = tintTween.progressAt(now);
    return {
      background: tintFrom.background.clone().lerp(tintTo.background, p),
      fog: tintFrom.fog.clone().lerp(tintTo.fog, p),
      hemiSky: tintFrom.hemiSky.clone().lerp(tintTo.hemiSky, p),
      hemiGround: tintFrom.hemiGround.clone().lerp(tintTo.hemiGround, p),
      key: tintFrom.key.clone().lerp(tintTo.key, p),
      rim: tintFrom.rim.clone().lerp(tintTo.rim, p),
    };
  }

  function getPosition(now: number): number {
    if (livePosition !== null) return livePosition;
    return navTween.valueAt(now);
  }

  // ---------------------------------------------------------------------
  // Frame update
  // ---------------------------------------------------------------------
  function updateTint(now: number): void {
    const p = tintTween.progressAt(now);
    sceneBackground.copy(tintFrom.background).lerp(tintTo.background, p);
    if (scene.fog && scene.fog instanceof THREE.Fog) scene.fog.color.copy(tintFrom.fog).lerp(tintTo.fog, p);
    hemiLight.color.copy(tintFrom.hemiSky).lerp(tintTo.hemiSky, p);
    hemiLight.groundColor.copy(tintFrom.hemiGround).lerp(tintTo.hemiGround, p);
    keyLight.color.copy(tintFrom.key).lerp(tintTo.key, p);
    rimLight.color.copy(tintFrom.rim).lerp(tintTo.rim, p);
    backdropMaterial.color.copy(sceneBackground);
  }

  function layoutBooks(now: number, elapsed: number): void {
    const position = getPosition(now);
    for (const rig of rigs) {
      const offset = rig.index - position;
      const distance = Math.abs(offset);
      const focus = smootherstep(1 - clamp01(distance));

      const rotationY = lerp(REST_ROTATION_Y, SELECTED_ROTATION_Y, focus);
      const scale = 1 + focus * 0.05;
      // tanh saturates, so books past the immediate neighbours keep uniform
      // spacing while the gap around the selection opens smoothly.
      const x = offset * spacing + Math.tanh(offset * SPREAD_FALLOFF) * spread;
      const y = shelfTopY + rig.dims.height / 2 + focus * 0.04;
      const z = focus * 0.34;

      rig.root.position.set(x, y, z);
      rig.root.rotation.y = rotationY;
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

      const fadeT = clamp01((distance - FADE_START_DISTANCE) / (FADE_END_DISTANCE - FADE_START_DISTANCE));
      const opacity = 1 - smootherstep(fadeT);
      for (const material of rig.materials) material.opacity = opacity;
      rig.mesh.visible = opacity > 0.02;

      rig.shadowMesh.position.set(x, shelfTopY - 0.001, z + rig.dims.depth * 0.5 + 0.06);
      (rig.shadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.32 * opacity;
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
    layoutBooks(now, elapsed);
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
   * independently and take the larger, safer distance.
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
    const selectedHalfHeight = 0.62;
    const distanceForHeight = (selectedHalfHeight + VERTICAL_MARGIN) / tanHalf;
    const distance = THREE.MathUtils.clamp(
      Math.max(distanceForSlots, distanceForHeight),
      CAMERA_MIN_DISTANCE,
      CAMERA_MAX_DISTANCE,
    );

    // A gentle, consistent 3/4 angle rather than a dead-on frontal shot,
    // scaled with distance so the deflection reads the same at any size.
    camera.position.set(distance * 0.11, cameraTarget.y + distance * 0.045, distance);
    camera.lookAt(cameraTarget);

    // Keep the backdrop comfortably oversized relative to the current frustum.
    const backdropScale = Math.max(16, distance * 2.6);
    backdrop.scale.set(backdropScale, backdropScale * 0.6, 1);
    backdrop.position.z = -Math.max(3.4, distance * 0.7);
  }

  function handleResize(): void {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    updateCameraFraming();
    camera.updateProjectionMatrix();
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

  // ---------------------------------------------------------------------
  // Input: wheel, drag-to-scrub, click, keyboard
  // ---------------------------------------------------------------------
  let wheelAccumulator = 0;
  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    wheelAccumulator += event.deltaY;
    while (Math.abs(wheelAccumulator) >= WHEEL_STEP) {
      if (wheelAccumulator > 0) {
        goTo(currentIndex + 1);
        wheelAccumulator -= WHEEL_STEP;
      } else {
        goTo(currentIndex - 1);
        wheelAccumulator += WHEEL_STEP;
      }
    }
  };
  canvas.addEventListener('wheel', onWheel, { passive: false });

  interface DragState {
    pointerId: number;
    startX: number;
    startPosition: number;
    moved: boolean;
  }
  let drag: DragState | null = null;

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    // The canvas itself is not focusable, and a click on a non-focusable
    // descendant does not reliably focus an ancestor in every engine —
    // focus the region explicitly so keyboard nav works right after a click.
    region.focus({ preventScroll: true });
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startPosition: getPosition(performance.now()),
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
      const dx = event.clientX - drag.startX;
      if (Math.abs(dx) > DRAG_MOVE_THRESHOLD) drag.moved = true;
      if (drag.moved) {
        const slots = -dx / DRAG_PIXELS_PER_SLOT;
        const next = THREE.MathUtils.clamp(drag.startPosition + slots, 0, Math.max(0, books.length - 1));
        livePosition = next;
        requestRenderSoon();
      }
      return;
    }

    if (!drag) {
      const nextHover = pickBookAt(ndcFromEvent(event));
      if (nextHover !== hoverIndex) {
        hoverIndex = nextHover;
        canvas.style.cursor = hoverIndex >= 0 ? 'pointer' : 'grab';
      }
    }
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (drag && drag.pointerId === event.pointerId) {
      const wasMoved = drag.moved;
      const settlePosition = livePosition;
      canvas.releasePointerCapture(event.pointerId);
      canvas.style.cursor = 'grab';
      drag = null;
      if (wasMoved && settlePosition !== null) {
        livePosition = null;
        goTo(Math.round(settlePosition));
      } else {
        livePosition = null;
        const clicked = pickBookAt(ndcFromEvent(event));
        if (clicked >= 0) {
          if (clicked === currentIndex) {
            const book = currentBook();
            if (book) options.onActivate?.(book, currentIndex);
          } else {
            goTo(clicked);
          }
        }
      }
      return;
    }
  };

  const onPointerLeave = (): void => {
    pointerTarget.x = 0;
    pointerTarget.y = 0;
    if (!drag) {
      hoverIndex = -1;
      canvas.style.cursor = 'grab';
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(currentIndex + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(currentIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      goTo(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      goTo(books.length - 1);
    } else if ((event.key === 'Enter' || event.key === ' ') && event.target === region) {
      event.preventDefault();
      const book = currentBook();
      if (book) options.onActivate?.(book, currentIndex);
    }
  };
  region.addEventListener('keydown', onKeyDown);

  const onPreviousClick = (): void => goTo(currentIndex - 1);
  const onNextClick = (): void => goTo(currentIndex + 1);
  const onOpenClick = (): void => {
    const book = currentBook();
    if (book) options.onActivate?.(book, currentIndex);
  };
  previousButton.addEventListener('click', onPreviousClick);
  nextButton.addEventListener('click', onNextClick);
  openButton.addEventListener('click', onOpenClick);

  // ---------------------------------------------------------------------
  // Initial paint
  // ---------------------------------------------------------------------
  handleResize();
  announceSelection();
  if (currentIndex >= 0) options.onSelect?.(books[currentIndex], currentIndex);
  layoutBooks(performance.now(), performance.now() / 1000);
  updateTint(performance.now());
  renderer.render(scene, camera);
  ensureLoopRunning();

  // ---------------------------------------------------------------------
  // Handle
  // ---------------------------------------------------------------------
  const handle: ShelfHandle = {
    select(index: number) {
      goTo(index);
    },
    next() {
      goTo(currentIndex + 1);
    },
    previous() {
      goTo(currentIndex - 1);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopLoop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reducedMotionQuery.removeEventListener('change', onReducedMotionChange);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      region.removeEventListener('keydown', onKeyDown);
      previousButton.removeEventListener('click', onPreviousClick);
      nextButton.removeEventListener('click', onNextClick);
      openButton.removeEventListener('click', onOpenClick);

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
