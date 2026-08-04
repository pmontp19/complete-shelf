import * as THREE from 'three';
import type { Disposable, MountShelf, ShelfBook, ShelfContext, ShelfHandle, ShelfLabels, ThemePalette } from './types';
import { computeBookDimensions, createContactShadowGeometry, MIN_BOOK_HEIGHT } from './geometry';
import { createContactShadowTexture, createPageEdgeTexture } from './textures';
import { Tween, easeInOutCubic, easeOutQuint, lerp } from './easing';
import { buildBookRig } from './book';
import { CAMERA_VERTICAL_FOV, createStage, readCssColor, themePalette } from './scene';
import { CONTACT_GAP, SELECTED_SCALE, createLayout, slotOffset } from './layout';
import { createInspection } from './inspect';
import { createDiagnostics } from './diagnostics';

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
// Below this many volumes the run is too short to hide the seam, so the shelf
// keeps hard ends instead of looping.
const MIN_BOOKS_TO_WRAP = 8;

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
    inspect() {},
    returnToShelf() {},
    mode() {
      return 'browse';
    },
    destroy() {
      if (region.parentNode === container) container.removeChild(region);
    },
  };
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
  const initialReducedMotion = options.reducedMotion ?? reducedMotionQuery.matches;
  const initialDarkScheme = darkSchemeQuery.matches;
  const initialPaperColor = readCssColor(document.documentElement, '--color-paper', '#f7f3ec');

  /** Wraps a slot index into `[0, total)`. */
  const wrapIndex = (index: number): number =>
    total === 0 ? -1 : ((Math.round(index) % total) + total) % total;

  const clampIndex = (index: number): number =>
    total === 0 ? -1 : THREE.MathUtils.clamp(Math.round(index), 0, total - 1);

  const normaliseIndex = (index: number): number => (wraps ? wrapIndex(index) : clampIndex(index));

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
    initialPaperColor,
    books[currentIndex]?.spineColor ?? '#6b5a45',
    initialDarkScheme,
  );
  let tintTo: ThemePalette = tintFrom;

  // ---------------------------------------------------------------------
  // Scene
  // ---------------------------------------------------------------------
  // Book proportions and shelf-slot spacing — computed up front so the
  // lights, ledge and camera can all be sized against the real run length
  // instead of a fixed guess.
  const dims = books.map(computeBookDimensions);
  const maxWidth = dims.reduce((max, d) => Math.max(max, d.width), 0.42);
  const maxDepth = dims.reduce((max, d) => Math.max(max, d.depth), 0.06);
  const maxHeight = dims.reduce((max, d) => Math.max(max, d.height), MIN_BOOK_HEIGHT);
  const spacing = maxDepth + SPACING_GAP;
  // The most room the run can be asked to give up on one side of the
  // selection: a fully turned-out cover pressed against a racked neighbour.
  // The per-frame solver in layout.ts works this out exactly, per pair; this
  // is the worst case, kept as a scalar so the camera can frame for it.
  const spread = Math.max(
    0,
    (maxWidth * SELECTED_SCALE) / 2 + maxDepth / 2 + CONTACT_GAP - spacing,
  );
  const shelfTopY = 0;

  // Bare shells: `createStage` below fills these in with fog, lights, the
  // ledge and the camera's actual pose. Kept as real objects (rather than
  // assigned inside createStage) so `ctx` can be a fully valid ShelfContext
  // from the moment it is constructed.
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_VERTICAL_FOV, 1, 0.1, 40);
  const shelfGroup = new THREE.Group();
  const furniture = new THREE.Group();

  const ctx: ShelfContext = {
    canvas,
    renderer,
    scene,
    camera,
    shelfGroup,
    furniture,
    rigs: [],
    disposables,
    total,
    wraps,
    spacing,
    maxWidth,
    maxDepth,
    maxHeight,
    spread,
    shelfTopY,
    // Recomputed in `updateCameraFraming` from the frame the camera actually
    // ends up with, so the run always fades out just past the edge of the
    // canvas rather than at a distance guessed from a reference viewport.
    fade: { start: 5.5, end: 7.5 },
    frame: { distance: 0, visibleHalfWidth: 0, aspect: 1 },
    mode: 'browse',
    selectedIndex: -1,
    focusProgress: 0,
    reducedMotion: initialReducedMotion,
    darkScheme: initialDarkScheme,
    paperColor: initialPaperColor,
    pointerSmooth: { x: 0, y: 0 },
    hoverIndex: -1,
    diagnostics: { collisionRejects: 0, motionPhase: 'idle' },
    destroyed: false,
  };

  const stage = createStage(ctx);

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

  ctx.rigs = books.map((book, index) =>
    buildBookRig({
      ctx,
      book,
      index,
      dims: dims[index],
      textureLoader,
      shared: { pageEdgeTexture, contactShadowTexture, contactShadowGeometry },
      onCoverSettled: noteCoverSettled,
      onTextureReady: requestRenderSoon,
    }),
  );
  if (books.length === 0) options.onReady?.();

  // ---------------------------------------------------------------------
  // Inspect / layout / diagnostics
  // ---------------------------------------------------------------------
  const inspection = createInspection(ctx, {
    stage,
    onMode: (mode, index) => options.onMode?.(mode, index),
    requestRender: requestRenderSoon,
  });
  const layout = createLayout(ctx, { inspectPose: () => inspection.pose() });
  const diagnostics = createDiagnostics(ctx);

  // ---------------------------------------------------------------------
  // Pointer parallax (ambient, disabled under reduced motion)
  // ---------------------------------------------------------------------
  const pointerTarget = { x: 0, y: 0 };

  function ndcFromEvent(event: PointerEvent): THREE.Vector2 {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    return new THREE.Vector2(x, y);
  }

  function pickBookAt(ndc: THREE.Vector2): number {
    raycaster.setFromCamera(ndc, ctx.camera);
    const hits = raycaster.intersectObjects(
      ctx.rigs.filter((rig) => rig.pickMesh.visible).map((rig) => rig.pickMesh),
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

  /**
   * The book activation (a tap or Enter) should act on. `currentIndex` is
   * the browse carriage's centred slot; `ctx.selectedIndex` is whichever
   * volume inspection actually framed. Nothing keeps the two equal in
   * general (`window.__SHELF__.inspect(3)` while the carriage still sits on
   * book 0 is exactly such a case), so activation has to pick the one that
   * matches what the reader is actually looking at: the inspected volume
   * while inspecting, the centred one everywhere else.
   */
  function selectionToActivate(): { book: ShelfBook; index: number } | undefined {
    if (ctx.mode === 'inspect' && ctx.selectedIndex >= 0) {
      return { book: books[ctx.selectedIndex], index: ctx.selectedIndex };
    }
    const book = currentBook();
    return book ? { book, index: currentIndex } : undefined;
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
    tintTo = themePalette(ctx.paperColor, books[currentIndex].spineColor, ctx.darkScheme);
    if (ctx.reducedMotion) tintTween.snapTo(1);
    else tintTween.retarget(1, now, TINT_DURATION_MS);
    if (announce) announceSelection();
    options.onSelect?.(books[currentIndex], currentIndex);
  }

  /** Retints without moving, e.g. after the colour scheme flips. */
  function refreshTheme(): void {
    ctx.paperColor = readCssColor(document.documentElement, '--color-paper', '#f7f3ec');
    const palette = themePalette(
      ctx.paperColor,
      books[currentIndex]?.spineColor ?? '#6b5a45',
      ctx.darkScheme,
    );
    tintFrom = palette;
    tintTo = palette;
    tintTween.snapTo(1);
    stage.applySurfaceTheme();
    requestRenderSoon();
  }

  /** Eases the carriage to an absolute (unwrapped) position. */
  function glideTo(position: number, durationMs: number): void {
    if (total === 0) return;
    // A glide is a fresh navigation intent, not a settle, even if it happens
    // to interrupt one mid-flight.
    carriageSettling = false;
    const now = performance.now();
    if (livePosition !== null) {
      navTween.snapTo(livePosition);
      livePosition = null;
    }
    targetPosition = wraps ? position : THREE.MathUtils.clamp(position, 0, total - 1);
    if (ctx.reducedMotion) navTween.snapTo(targetPosition);
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
    const delta = slotOffset(ctx, wanted, from);
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
  // True from the moment `settle()` is called until the next glide or scrub
  // starts. Distinguishes a settle's `navTween` run from a glide's: both
  // drive the same tween, so the tween alone cannot tell them apart.
  let carriageSettling = false;

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
    carriageSettling = true;
    const projected =
      livePosition + THREE.MathUtils.clamp(velocity * FLICK_PROJECTION_S, -FLICK_MAX_SLOTS, FLICK_MAX_SLOTS);
    const landing = Math.round(projected);
    const travel = Math.abs(landing - livePosition);
    const duration = THREE.MathUtils.clamp(SETTLE_MIN_MS + travel * 110, SETTLE_MIN_MS, SETTLE_MAX_MS);
    const now = performance.now();
    navTween.snapTo(livePosition);
    livePosition = null;
    targetPosition = wraps ? landing : THREE.MathUtils.clamp(landing, 0, total - 1);
    if (ctx.reducedMotion) navTween.snapTo(targetPosition);
    else navTween.retarget(targetPosition, now, duration, easeOutQuint);
    applySelection(normaliseIndex(targetPosition), true);
    requestRenderSoon();
  }

  /**
   * Hands the carriage over to inspection. A lateral wheel tick arms
   * `settleTimer` for `WHEEL_SETTLE_DELAY_MS`; if inspection starts before
   * that timer fires, `settle()` would still retarget the tween out from
   * under the volume that just got isolated, visibly re-spacing the rest of
   * the run mid-focus. Cancelling the timer and, if a scrub is still live,
   * parking the tween exactly where the carriage was (rather than letting
   * it round to the nearest slot) removes the retarget entirely instead of
   * just racing it.
   */
  function requestInspect(index: number): void {
    cancelSettle();
    if (livePosition !== null) {
      navTween.snapTo(livePosition);
      livePosition = null;
    }
    inspection.request(index);
  }

  // ---------------------------------------------------------------------
  // Frame update
  // ---------------------------------------------------------------------
  function updateTint(now: number): void {
    stage.applyPalette(currentPaletteSnapshot(now));
  }

  let lastReportedPosition = Number.NaN;
  function reportProgress(position: number): void {
    if (Math.abs(position - lastReportedPosition) < 0.002) return;
    lastReportedPosition = position;
    options.onProgress?.(position, total);
  }

  function updatePointerSmoothing(dt: number): void {
    if (ctx.reducedMotion) {
      ctx.pointerSmooth.x = 0;
      ctx.pointerSmooth.y = 0;
      return;
    }
    const rate = Math.min(1, dt * 6);
    ctx.pointerSmooth.x += (pointerTarget.x - ctx.pointerSmooth.x) * rate;
    ctx.pointerSmooth.y += (pointerTarget.y - ctx.pointerSmooth.y) * rate;
  }

  let lastFrameTime = performance.now();
  function updateFrame(now: number): void {
    const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
    lastFrameTime = now;
    const elapsed = now / 1000;
    updatePointerSmoothing(dt);
    const position = getPosition(now);
    reportProgress(position);
    // Precedence: a live hand scrub always outranks a tween, since the tween
    // is exactly what the scrub is overriding. Between the two tweened
    // states, `carriageSettling` tells a settle (let go, easing onto the
    // nearest volume) apart from a plain glide (arrow key, click, initial
    // paint), even though both drive the same `navTween`.
    if (livePosition !== null) {
      ctx.diagnostics.motionPhase = 'scrubbing';
    } else if (settleTimer !== 0 || (carriageSettling && !navTween.isSettled(now))) {
      ctx.diagnostics.motionPhase = 'settling';
    } else if (!navTween.isSettled(now)) {
      ctx.diagnostics.motionPhase = 'gliding';
    } else {
      ctx.diagnostics.motionPhase = 'idle';
    }
    layout.update(position, now, elapsed, dt);
    updateTint(now);
    inspection.update(dt, now);
    ctx.renderer.render(ctx.scene, ctx.camera);
    // `renderer.info` resets at the start of `render()`, so reading it before
    // the call above would always mirror the previous frame's counts.
    diagnostics.update(now);
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
    if (!destroyed && !ctx.reducedMotion && isIntersecting && !document.hidden) {
      rafId = requestAnimationFrame(loop);
    }
  }

  function renderOnce(): void {
    lastFrameTime = performance.now() - 16;
    updateFrame(performance.now());
  }

  function ensureLoopRunning(): void {
    if (destroyed) return;
    if (ctx.reducedMotion) {
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
    if (ctx.reducedMotion) {
      renderOnce();
    } else {
      ensureLoopRunning();
    }
  }

  const resizeObserver = new ResizeObserver(() => {
    handleResize();
  });
  resizeObserver.observe(container);

  function handleResize(): void {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    ctx.renderer.setSize(width, height, false);
    ctx.camera.aspect = width / height;
    stage.updateCameraFraming();
    inspection.reframe();
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
    ctx.reducedMotion = event.matches;
    if (ctx.reducedMotion) {
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
    ctx.darkScheme = event.matches;
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
    // Outside browse the canvas's own relationship with the wheel changes
    // entirely: in inspect it is orbit's zoom to consume (OrbitControls has
    // its own listener on this same canvas and will preventDefault when it
    // does), and mid-transition there is no carriage to scrub at all. Either
    // way, doing nothing here is the correct behaviour, not a gap.
    if (ctx.mode !== 'browse') return;
    const pixels = lateralPixels(event);
    if (pixels === 0) return;
    event.preventDefault();

    if (ctx.reducedMotion) {
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
    startY: number;
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
    // Mid-transition the scripted camera owns the frame; neither the
    // carriage nor orbit should pick up a gesture that started while it was
    // still moving.
    if (ctx.mode === 'focusing' || ctx.mode === 'returning') return;

    if (inspection.ownsPointer()) {
      // OrbitControls has its own listener on this same canvas and will
      // handle the actual orbit; we only watch for a plain tap (no capture
      // of our own, so we never fight its capture) so pointerup can tell a
      // click on the volume from a drag that orbited it.
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastTime: event.timeStamp,
        velocity: 0,
        moved: false,
      };
      return;
    }

    cancelSettle();
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
      moved: false,
    };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (ctx.mode === 'focusing' || ctx.mode === 'returning') return;

    if (inspection.ownsPointer()) {
      // Orbit owns the drag itself; this only decides whether the gesture
      // in progress still counts as a tap once it lets go.
      if (drag && drag.pointerId === event.pointerId && !drag.moved) {
        const travelled = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
        if (travelled > DRAG_MOVE_THRESHOLD) drag.moved = true;
      }
      return;
    }

    if (!ctx.reducedMotion) {
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
      if (nextHover !== ctx.hoverIndex) {
        ctx.hoverIndex = nextHover;
        canvas.style.cursor = ctx.hoverIndex >= 0 ? 'pointer' : 'grab';
        requestRenderSoon();
      }
    }
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const wasOrbit = inspection.ownsPointer();
    const { moved, velocity } = drag;
    drag = null;

    if (ctx.mode === 'focusing' || ctx.mode === 'returning') return;

    if (wasOrbit) {
      if (moved) return; // orbited the volume rather than tapping it
      const clicked = pickBookAt(ndcFromEvent(event));
      if (clicked === ctx.selectedIndex) {
        const target = selectionToActivate();
        if (target) options.onActivate?.(target.book, target.index);
      }
      return;
    }

    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    canvas.style.cursor = ctx.hoverIndex >= 0 ? 'pointer' : 'grab';

    if (moved) {
      settle(ctx.reducedMotion ? 0 : velocity);
      return;
    }

    // A tap in browse: the centred volume enters inspect mode (the caption's
    // own button is the navigation path now), any other volume comes to the
    // centre.
    const clicked = pickBookAt(ndcFromEvent(event));
    if (clicked < 0) return;
    if (clicked === currentIndex) {
      requestInspect(currentIndex);
    } else {
      goToIndex(clicked);
    }
  };

  const onPointerLeave = (): void => {
    pointerTarget.x = 0;
    pointerTarget.y = 0;
    if (!drag) {
      ctx.hoverIndex = -1;
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
    // Works from any non-browse mode; `returnToShelf()` itself no-ops in
    // 'browse' and 'returning', so this needs no mode guard of its own.
    if (event.key === 'Escape') {
      event.preventDefault();
      inspection.returnToShelf();
      return;
    }

    if (ctx.mode === 'inspect') {
      if ((event.key === 'Enter' || event.key === ' ') && event.target === region) {
        event.preventDefault();
        const target = selectionToActivate();
        if (target) options.onActivate?.(target.book, target.index);
      }
      return;
    }

    // Stepping is browse-only: mid-transition there is no carriage to move,
    // and the keys mean something else entirely once inspecting.
    if (ctx.mode !== 'browse') return;

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
      requestInspect(currentIndex);
    }
  };
  region.addEventListener('keydown', onKeyDown);

  // ---------------------------------------------------------------------
  // Initial paint
  // ---------------------------------------------------------------------
  handleResize();
  announceSelection();
  if (currentIndex >= 0) options.onSelect?.(books[currentIndex], currentIndex);
  const initialNow = performance.now();
  const initialPosition = getPosition(initialNow);
  reportProgress(initialPosition);
  layout.update(initialPosition, initialNow, initialNow / 1000, 0.016);
  updateTint(initialNow);
  ctx.renderer.render(ctx.scene, ctx.camera);
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
    inspect(index?: number) {
      requestInspect(index ?? currentIndex);
    },
    returnToShelf() {
      inspection.returnToShelf();
    },
    mode() {
      return ctx.mode;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      ctx.destroyed = true;
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

      inspection.dispose();
      diagnostics.dispose();

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
      ctx.renderer.dispose();
      const contextLoss = ctx.renderer as unknown as { forceContextLoss?: () => void };
      contextLoss.forceContextLoss?.();

      container.innerHTML = '';
    },
  };

  // `createDiagnostics` installs `window.__SHELF__` with inert stubs for the
  // three action functions, since it only receives `ctx` and has no
  // reference to `handle`. Now that the handle exists, wire them for real.
  if (window.__SHELF__) {
    window.__SHELF__.inspect = (index) => handle.inspect(index);
    window.__SHELF__.browse = (index) => handle.select(index ?? currentIndex);
    window.__SHELF__.returnToShelf = () => handle.returnToShelf();
  }

  return handle;
};
