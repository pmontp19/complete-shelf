import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { BookRig, InspectPose, ShelfContext, ShelfMode } from './types';
import type { Stage } from './scene';
import { CAMERA_VERTICAL_FOV } from './scene';
import { SELECTED_SCALE } from './layout';
import { clamp01, easeOutCubic } from './easing';

// Motion budget (SPEC): a hand draws a book out slower than it lets it go,
// so focus-in outlasts focus-out. Reduced motion keeps both directions, just
// fast enough to read as instant rather than as a jump cut.
const FOCUS_IN_MS = 460;
const FOCUS_OUT_MS = 340;
const REDUCED_MOTION_MS = 80;

// Frame-rate independent camera chase (`1 - exp(-lambda*dt)`), never a fixed
// per-frame lerp. Higher lambda going in: the target itself is still moving
// (the book is easing into its inspect pose), so the camera has to keep up
// closely or the shot reads as trailing behind the book. Lower coming back:
// the target (the browse camera) is static, so a gentler settle reads calmer.
const CAMERA_LAMBDA_IN = 13;
const CAMERA_LAMBDA_OUT = 7;

// The rest of the run and the ledge fade out only once the selected volume
// is visually clear of its neighbours, not from the first frame of the
// opening move, or isolation would read as the shelf vanishing under it.
const ISOLATION_CROSSOVER = 0.72;

// The opening move is two overlapping intentions, not one lerp: the volume
// clears its neighbours in Z first, then drifts into the inspection
// composition and turns/scales. Splitting them (rather than doing both at
// once) is what stops the turning cover from grazing the volume beside it
// mid-transition, the same reasoning layout.ts's TURN_DELAY documents for
// the browse step.
const CLEARANCE_SHARE = 0.55;

// World-unit forward travel for each half of the opening move. Added on top
// of whatever the browse layout already lifted the centred volume by
// (`SELECTED_LIFT_Z` in layout.ts), so the total clears the ledge's front
// edge with room to spare.
const CLEARANCE_Z = 0.34;
const COMPOSE_Z = 0.5;
const COMPOSE_LIFT_Y = 0.07;
// Turns the front cover just enough, by the end of the compose half, that
// its spine and board edge read alongside it -- a dead-on shot would look
// like the flat card this refactor replaces. At the long lens scene.ts now
// frames browse with (27 degrees vertical FOV), the camera's own off-axis
// offset barely parallaxes the volume, so most of the three-quarter read has
// to come from turning the volume itself.
const INSPECT_YAW = 0.62;
// On top of the browse "selected" scale (`SELECTED_SCALE` below): the extra
// enlargement the compose half applies as it settles into frame.
const INSPECT_SCALE = 1.2;

// Below this canvas width there is no room for an off-axis composition
// without crowding the frame, so inspect centres the volume and pulls back
// (a smaller fill fraction) instead.
const NARROW_CANVAS_WIDTH = 760;
// Fraction of the frame's full height the (fully scaled) volume should fill
// once composed. Solved for per volume from its real height, never a
// hardcoded half-height -- trims vary now, unlike the picket-fence shelf.
const DESKTOP_FILL = 0.56;
const MOBILE_FILL = 0.46;
const DESKTOP_OFFSET_X = 0.55;
const CAMERA_Y_LIFT = 0.12;

const MIN_DISTANCE_RATIO = 0.55;
const MAX_DISTANCE_RATIO = 1.8;
// Polar limits keep the reader from orbiting up over the head into a
// top-down view or down under the tail -- there is no ledge to hide it once
// furniture fades, but the shot still has a "up" that reads as a shelf.
const POLAR_MIN = Math.PI * 0.28;
const POLAR_MAX = Math.PI * 0.72;
// Azimuth is clamped to an arc around the *starting* off-axis angle (not a
// fixed world angle), so orbiting explores the spine/board edges without
// ever reaching the unlit back board.
const AZIMUTH_ARC = Math.PI / 3.2;

/** Cubic smoothstep -- the classic `t*t*(3-2t)` ease, used to shape each half of the opening move. */
function smoothstep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

export interface Inspection {
  /** Requests inspection of `index`. No-op unless mode is 'browse'. */
  request(index: number): void;
  /** Starts the return. No-op in 'browse'. */
  returnToShelf(): void;
  /** Re-frames on the current volume, e.g. after a resize or a reset. */
  reframe(): void;
  /** Advances the state machine and drives the camera. Called once per frame. */
  update(dt: number, now: number): void;
  /** The inspected volume's extra pose, or null when in browse. */
  pose(): InspectPose | null;
  /** True while orbit input should be consumed by inspection. */
  ownsPointer(): boolean;
  dispose(): void;
}

/**
 * The focus/orbit/return state machine: `browse -> focusing -> inspect ->
 * returning -> browse`. `ctx.mode`, `ctx.selectedIndex` and
 * `ctx.focusProgress` are this module's to write; `layout.ts` blends the
 * pose in and `diagnostics.ts` mirrors the mode out.
 */
export function createInspection(
  ctx: ShelfContext,
  deps: {
    stage: Stage;
    onMode: (mode: ShelfMode, index: number) => void;
    requestRender: () => void;
  },
): Inspection {
  const controls = new OrbitControls(ctx.camera, ctx.canvas);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  // Panning would drag `controls.target` off the volume's centre; inspect
  // has nothing else worth panning to, so it stays off entirely.
  controls.enablePan = false;
  controls.enableZoom = true;

  // OrbitControls' constructor above unconditionally called its own
  // `connect()`, which grabs `touch-action: none` on the canvas regardless
  // of `controls.enabled` -- so the canvas is already left untouchable by a
  // vertical swipe, even though we are still in plain browse. The page's
  // own vertical scroll outranks the shelf everywhere except the one state
  // where inspection genuinely owns the gesture, so every mode transition
  // (starting with this one, right after mount, not just the first one)
  // takes the property back rather than trusting OrbitControls to leave it
  // alone.
  function setTouchAction(mode: ShelfMode): void {
    ctx.canvas.style.touchAction = mode === 'inspect' ? 'none' : 'pan-y';
  }
  setTouchAction(ctx.mode);

  // 0..1, linear in time (not eased) -- mirrored onto `ctx.focusProgress`
  // every frame. The *visual* value the pose and camera read is
  // `easeOutCubic` of this, applied fresh each frame; because the raw value
  // itself only ever integrates forward or backward from wherever it is,
  // reversing direction (a return that interrupts a focus-in) continues
  // from the live value instead of retargeting from a snapshot, so there is
  // nothing to teleport.
  let progress = 0;

  // Scratch objects, reused every frame so the hot path (called every frame
  // regardless of mode) never allocates once inspection is actually live.
  const cameraTargetPos = new THREE.Vector3();
  const cameraLookAt = new THREE.Vector3();
  const lookAtScratch = new THREE.Vector3();
  const scratchDelta = new THREE.Vector3();
  const spherical = new THREE.Spherical();
  // `pose()` is on `layout.ts`'s no-allocation path (called every frame it
  // runs at all), so its result is this one object, mutated in place and
  // returned fresh each call -- never a new literal. Safe only because the
  // caller (layout.ts) reads it once within the same frame it was fetched
  // and never retains it past that.
  const poseScratch: InspectPose = { x: 0, y: 0, z: 0, yaw: 0, scale: 1, isolation: 0 };

  function selectedRig(): BookRig | undefined {
    return ctx.selectedIndex >= 0 && ctx.selectedIndex < ctx.rigs.length
      ? ctx.rigs[ctx.selectedIndex]
      : undefined;
  }

  /** Composition constants for the current canvas shape. */
  function framing(rigHeight: number): { distance: number; offsetX: number } {
    const narrow = ctx.canvas.clientWidth < NARROW_CANVAS_WIDTH;
    const halfFovY = THREE.MathUtils.degToRad(CAMERA_VERTICAL_FOV / 2);
    const fill = narrow ? MOBILE_FILL : DESKTOP_FILL;
    // The volume's on-screen height once fully composed: its real height,
    // times the browse "selected" scale it already carries, times the
    // extra inspect scale. Solving distance from this (rather than a fixed
    // distance) is what keeps a tall and a short trim both filling the same
    // fraction of the frame.
    const composedHeight = rigHeight * SELECTED_SCALE * INSPECT_SCALE;
    const distance = composedHeight / (2 * fill * Math.tan(halfFovY));
    return { distance, offsetX: narrow ? 0 : DESKTOP_OFFSET_X };
  }

  /** Fills `outPosition`/`outTarget` with the camera pose the transition and the resting inspect view chase, and returns the framing distance. */
  function targetCameraPose(
    rig: BookRig,
    outPosition: THREE.Vector3,
    outTarget: THREE.Vector3,
  ): number {
    rig.root.getWorldPosition(outTarget);
    const { distance, offsetX } = framing(rig.dims.height);
    outPosition.set(outTarget.x + offsetX, outTarget.y + CAMERA_Y_LIFT, outTarget.z + distance);
    return distance;
  }

  function setControlLimits(distance: number): void {
    controls.minDistance = distance * MIN_DISTANCE_RATIO;
    controls.maxDistance = distance * MAX_DISTANCE_RATIO;
    controls.minPolarAngle = POLAR_MIN;
    controls.maxPolarAngle = POLAR_MAX;
  }

  /** Centres the orbit's azimuth limits on wherever the camera actually starts, so the arc explores around the off-axis composition rather than around due north. */
  function boundAzimuthAround(position: THREE.Vector3, target: THREE.Vector3): void {
    spherical.setFromVector3(scratchDelta.subVectors(position, target));
    controls.minAzimuthAngle = spherical.theta - AZIMUTH_ARC;
    controls.maxAzimuthAngle = spherical.theta + AZIMUTH_ARC;
  }

  /**
   * Everything that must be true once a focus-in has fully landed, whatever
   * got it there: `progress` crossing 1 under normal motion, or a reduced-
   * motion request skipping straight to the end. Shared so the two paths
   * cannot drift apart on which side effects "the end of focusing" means.
   */
  function completeFocusIn(rig: BookRig): void {
    const distance = targetCameraPose(rig, cameraTargetPos, cameraLookAt);
    ctx.camera.position.copy(cameraTargetPos);
    lookAtScratch.copy(cameraLookAt);
    ctx.camera.lookAt(lookAtScratch);
    setControlLimits(distance);
    boundAzimuthAround(cameraTargetPos, cameraLookAt);
    controls.target.copy(cameraLookAt);
    controls.enabled = true;
    ctx.mode = 'inspect';
    ctx.furniture.visible = false;
    setTouchAction('inspect');
    deps.onMode('inspect', ctx.selectedIndex);
  }

  /**
   * Everything that must be true once a return has fully landed, whatever
   * got it there: `progress` crossing 0 under normal motion, or a reduced-
   * motion return skipping straight to the end. Shared for the same reason
   * as `completeFocusIn` above.
   */
  function completeReturn(): void {
    const finishedIndex = ctx.selectedIndex;
    ctx.mode = 'browse';
    ctx.selectedIndex = -1;
    ctx.camera.position.copy(deps.stage.browseCamera.position);
    ctx.camera.lookAt(deps.stage.browseCamera.target);
    ctx.furniture.visible = true;
    setTouchAction('browse');
    deps.onMode('browse', finishedIndex);
  }

  function request(index: number): void {
    if (ctx.mode !== 'browse') return;
    if (index < 0 || index >= ctx.rigs.length) return;
    ctx.selectedIndex = index;

    if (ctx.reducedMotion) {
      // SNAP, don't animate: the render loop that would otherwise advance
      // `progress` towards 1 every frame does not run under reduced motion
      // (`loop()` is gated on `!ctx.reducedMotion`), so an accumulator that
      // only moves when `update()` is called would advance a fraction of
      // the way and then simply never be called again, leaving the shelf
      // stuck half-focused forever. Arrive at the fully-focused state in one
      // step instead -- the same pattern `glideTo()`/`settle()` already use
      // in shelf.ts for the carriage.
      progress = 1;
      ctx.focusProgress = 1;
      completeFocusIn(ctx.rigs[index]);
      deps.requestRender();
      return;
    }

    ctx.mode = 'focusing';
    progress = 0;
    ctx.focusProgress = 0;
    setTouchAction('focusing');
    deps.onMode('focusing', index);
    deps.requestRender();
  }

  function returnToShelf(): void {
    if (ctx.mode === 'browse' || ctx.mode === 'returning') return;
    controls.enabled = false;

    if (ctx.reducedMotion) {
      // Same reasoning as `request()`'s reduced-motion branch: there is no
      // running loop to walk `progress` down to 0, so land on fully browsing
      // in one step.
      progress = 0;
      ctx.focusProgress = 0;
      completeReturn();
      deps.requestRender();
      return;
    }

    ctx.mode = 'returning';
    setTouchAction('returning');
    deps.onMode('returning', ctx.selectedIndex);
    deps.requestRender();
  }

  /** Re-frames on the current volume: recomputed distance/limits, and (in steady `inspect`) a hard snap back to the canonical composition -- the same move a resize and an explicit reset both want. */
  function reframe(): void {
    const rig = selectedRig();
    if (!rig || ctx.mode === 'browse') return;
    const distance = targetCameraPose(rig, cameraTargetPos, cameraLookAt);
    setControlLimits(distance);
    if (ctx.mode === 'inspect') {
      ctx.camera.position.copy(cameraTargetPos);
      lookAtScratch.copy(cameraLookAt);
      ctx.camera.lookAt(lookAtScratch);
      boundAzimuthAround(cameraTargetPos, cameraLookAt);
      controls.target.copy(cameraLookAt);
      controls.update();
      deps.requestRender();
    }
  }

  function pose(): InspectPose | null {
    if (ctx.mode === 'browse' || ctx.selectedIndex < 0) return null;
    const eased = easeOutCubic(clamp01(progress));
    const clearanceT = smoothstep(eased / CLEARANCE_SHARE);
    const composeT = smoothstep((eased - CLEARANCE_SHARE) / (1 - CLEARANCE_SHARE));
    const isolation = smoothstep((eased - ISOLATION_CROSSOVER) / (1 - ISOLATION_CROSSOVER));
    // Mutate the shared scratch object rather than allocate a literal --
    // see its declaration above for why that is safe here.
    poseScratch.x = 0;
    poseScratch.y = COMPOSE_LIFT_Y * composeT;
    poseScratch.z = CLEARANCE_Z * clearanceT + COMPOSE_Z * composeT;
    poseScratch.yaw = INSPECT_YAW * composeT;
    poseScratch.scale = 1 + (INSPECT_SCALE - 1) * composeT;
    poseScratch.isolation = isolation;
    return poseScratch;
  }

  function ownsPointer(): boolean {
    return controls.enabled;
  }

  function update(dt: number, now: number): void {
    if (ctx.mode === 'browse') return;

    const rig = selectedRig();
    if (!rig) {
      // Defensive: the selection vanished from under us (e.g. the catalogue
      // changed). Bail to browse without pretending to animate a volume
      // that no longer exists.
      ctx.mode = 'browse';
      ctx.selectedIndex = -1;
      progress = 0;
      ctx.focusProgress = 0;
      controls.enabled = false;
      ctx.furniture.visible = true;
      setTouchAction('browse');
      return;
    }

    const reduced = ctx.reducedMotion;

    if (ctx.mode === 'focusing') {
      const durationS = (reduced ? REDUCED_MOTION_MS : FOCUS_IN_MS) / 1000;
      progress = clamp01(progress + dt / durationS);
      ctx.focusProgress = progress;

      targetCameraPose(rig, cameraTargetPos, cameraLookAt);
      const t = 1 - Math.exp(-CAMERA_LAMBDA_IN * dt);
      ctx.camera.position.lerp(cameraTargetPos, t);
      lookAtScratch.lerp(cameraLookAt, t);
      ctx.camera.lookAt(lookAtScratch);

      if (progress >= 1) completeFocusIn(rig);
    } else if (ctx.mode === 'inspect') {
      // The scripted camera is off the transform entirely here: orbit owns
      // it, and re-asserting our own target every frame would fight the
      // reader's drag the instant they touched it.
      if (controls.enabled) controls.update();
    } else if (ctx.mode === 'returning') {
      const durationS = (reduced ? REDUCED_MOTION_MS : FOCUS_OUT_MS) / 1000;
      progress = clamp01(progress - dt / durationS);
      ctx.focusProgress = progress;

      const t = 1 - Math.exp(-CAMERA_LAMBDA_OUT * dt);
      ctx.camera.position.lerp(deps.stage.browseCamera.position, t);
      lookAtScratch.lerp(deps.stage.browseCamera.target, t);
      ctx.camera.lookAt(lookAtScratch);

      if (progress <= 0) completeReturn();
    }

    // Isolation is a pure function of progress, so re-deriving it here
    // (rather than caching a flag) means a resize or any other external
    // nudge can never leave the ledge stuck in the wrong state.
    const eased = easeOutCubic(progress);
    ctx.furniture.visible = eased < ISOLATION_CROSSOVER;
  }

  function dispose(): void {
    controls.enabled = false;
    controls.dispose();
    ctx.furniture.visible = true;
    // Every other exit path (a completed return, the defensive bail above)
    // leaves `ctx.mode`/`ctx.selectedIndex` back at their browse resting
    // values; teardown should too, in case anything reads `ctx` after.
    ctx.mode = 'browse';
    ctx.selectedIndex = -1;
    // `controls.dispose()` calls its own `disconnect()`, which resets
    // `touch-action` to `auto`, not to the `pan-y` a mounted-but-browsing
    // shelf needs -- leave the canvas the way a fresh mount would, not with
    // whatever OrbitControls happened to set last.
    ctx.canvas.style.touchAction = 'pan-y';
  }

  return { request, returnToShelf, reframe, update, pose, ownsPointer, dispose };
}
