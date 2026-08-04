import * as THREE from 'three';
import type { ShelfContext, ThemePalette } from './types';
import { createWoodGrainTexture } from './textures';
import { FOCUS_RISE_Y, HOVER_LIFT, SELECTED_LIFT_Z, SELECTED_SCALE } from './layout';

// Camera framing — recomputed on every resize so the composition (roughly
// this many book-slots visible across the frame, selected book fully
// inside the frame with margin) holds at any container aspect ratio, from
// a wide desktop canvas down to a narrow, squat mobile one.
// A longer lens (narrower vertical FOV) flattens the perspective: covers
// read as flat rectangles shot from further back, closer to a photograph of
// a shelf than to a wide-angle render where the near edge of a turned-out
// cover looms over its neighbours.
export const CAMERA_VERTICAL_FOV = 27;
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
// The camera's vertical lift above the target, as a fraction of distance —
// how far above dead-on the "roughly level, not an elevation drawing" shot
// sits (see `updateCameraFraming` below). Named so it can't be pattern-
// matched into the unrelated divide-by-zero floor a few lines down, which
// happens to share the same 0.05 value by coincidence.
const CAMERA_LIFT_RATIO = 0.05;

const LEDGE_DEPTH = 0.68;

/**
 * Reads a colour off a CSS custom property. The scene has no background of its
 * own — it is drawn onto the page — so the atmosphere has to be mixed from the
 * same paper the CSS is painting, in whichever theme is live.
 */
export function readCssColor(el: HTMLElement, name: string, fallback: string): THREE.Color {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  if (!raw) return new THREE.Color(fallback);
  try {
    return new THREE.Color(raw);
  } catch {
    return new THREE.Color(fallback);
  }
}

/**
 * Mixes the lighting rig from the page's paper colour and the selected cover.
 * Anchoring on paper (rather than on an absolute white) is what lets the canvas
 * sit on the page with no visible seam, in light and dark alike.
 */
export function themePalette(paper: THREE.Color, spineColorHex: string, dark: boolean): ThemePalette {
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

export interface Stage {
  /** Re-solves camera distance, ledge length, shadow camera, fog, ctx.fade, ctx.frame. */
  updateCameraFraming(): void;
  /** Ledge colour and anything else that depends on the colour scheme. */
  applySurfaceTheme(): void;
  /** Writes an interpolated palette into fog and lights. */
  applyPalette(palette: ThemePalette): void;
  /** The canonical browse camera pose, recomputed by updateCameraFraming. */
  browseCamera: { position: THREE.Vector3; target: THREE.Vector3 };
}

/**
 * Builds renderer-adjacent scene furniture and lights, and fills in the
 * scene/camera/lights/furniture fields of `ctx`.
 */
export function createStage(ctx: ShelfContext): Stage {
  const cameraTarget = new THREE.Vector3(0, 0.54, 0);
  ctx.camera.position.set(0.3, 0.9, 3);
  ctx.camera.lookAt(cameraTarget);

  // No background: the page shows through. Fog is what dissolves the far end
  // of the run, so it must be the paper colour exactly. The colour set here
  // is a placeholder: shelf.ts's initial paint calls `applyPalette` before the
  // first frame ever renders, so this value is never actually seen.
  ctx.scene.fog = new THREE.Fog(ctx.paperColor.getHex(), 2.4, 15);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x33241a, 0.95);
  ctx.scene.add(hemiLight);

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
  ctx.scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xcfe0ea, 0.42);
  fillLight.position.set(2.6, 1.6, 2.4);
  ctx.scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffe3b0, 0.55);
  rimLight.position.set(0.4, 2.4, -1.6);
  ctx.scene.add(rimLight);

  // The ledge. A unit-length board scaled on every resize so it always runs
  // clear off both edges of the frame, whatever shape the canvas takes.
  const woodTexture = createWoodGrainTexture();
  ctx.disposables.push(woodTexture);

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
  shelfBoard.position.set(0, ctx.shelfTopY - 0.035, 0.02);
  shelfBoard.receiveShadow = true;
  ctx.furniture.add(shelfBoard);
  ctx.disposables.push(shelfBoardGeometry, shelfBoardMaterial);

  ctx.scene.add(ctx.furniture);
  ctx.scene.add(ctx.shelfGroup);

  /**
   * Tints the ledge so it belongs to the current theme rather than to a wood
   * swatch. `createWoodGrainTexture` is deliberately drawn near-white (a
   * luminance detail map only), so this colour alone decides how the board
   * reads.
   *
   * In dark mode the ambient light hitting the ledge is much dimmer than in
   * light mode (the hemisphere light's ground term is a fraction of the near-
   * black paper), so a colour this material would render as a legible mid
   * brown in daylight goes almost fully into the shadows here. A lighter,
   * warmer brown than the light-mode board keeps the ledge reading as a lit
   * board rather than as an extension of the dark page, while its lightness
   * still sits well under the covers and jackets it carries, so the volumes
   * stay the brightest thing in frame.
   */
  function applySurfaceTheme(): void {
    shelfBoardMaterial.color.setHex(ctx.darkScheme ? 0xb49b7d : 0xc7b294);
  }
  applySurfaceTheme();

  /** Writes an interpolated palette into fog and lights. */
  function applyPalette(palette: ThemePalette): void {
    if (ctx.scene.fog instanceof THREE.Fog) ctx.scene.fog.color.copy(palette.fog);
    hemiLight.color.copy(palette.hemiSky);
    hemiLight.groundColor.copy(palette.hemiGround);
    keyLight.color.copy(palette.key);
    rimLight.color.copy(palette.rim);
  }

  const browseCamera = { position: new THREE.Vector3(), target: cameraTarget.clone() };

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
    const aspect = ctx.camera.aspect;

    // A narrow canvas frames fewer volumes instead of rendering them tiny.
    const slots = THREE.MathUtils.clamp(
      TARGET_VISIBLE_SLOTS * (aspect / REFERENCE_ASPECT),
      MIN_VISIBLE_SLOTS,
      TARGET_VISIBLE_SLOTS,
    );
    const frameHalfWidth = (slots * ctx.spacing) / 2 + ctx.spread;
    // 0.05 here is just a divide-by-zero floor (aspect could theoretically
    // be 0 on a zero-width container); unrelated to CAMERA_LIFT_RATIO below.
    const distanceForSlots = frameHalfWidth / Math.max(0.05, tanHalf * aspect);
    // Half the *tallest* volume's height (trim heights vary per book, so this
    // has to track the real worst case rather than a fixed number), scaled up
    // for the selected state and for the small extra rise a focused, hovered
    // volume gets along Y (FOCUS_RISE_Y, HOVER_LIFT — see layout.ts).
    const selectedHalfHeight = (ctx.maxHeight / 2) * SELECTED_SCALE + FOCUS_RISE_Y + HOVER_LIFT;
    // The selected volume also pops toward the camera (SELECTED_LIFT_Z, plus
    // HOVER_LIFT again on hover), which is a shorter distance to look across
    // and so reads larger than its world size for the same FOV. Folding that
    // pop straight into the required distance — solving
    // tanHalf * (distance - pop) >= selectedHalfHeight + VERTICAL_MARGIN for
    // `distance` — is exact, unlike inflating the half-height by a guessed
    // factor, and guarantees the tallest, most-forward volume's head never
    // reaches the top edge.
    const forwardPop = SELECTED_LIFT_Z + HOVER_LIFT;
    const distanceForHeight = forwardPop + (selectedHalfHeight + VERTICAL_MARGIN) / tanHalf;
    const distance = THREE.MathUtils.clamp(
      Math.max(distanceForSlots, distanceForHeight),
      CAMERA_MIN_DISTANCE,
      CAMERA_MAX_DISTANCE,
    );

    // Dead-on and slightly above. Yawing the camera off-axis put the ledge on
    // a diagonal, which fights every horizontal rule on the page; the lift
    // alone is enough to keep the shot from reading as an elevation drawing.
    ctx.camera.position.set(0, cameraTarget.y + distance * CAMERA_LIFT_RATIO, distance);
    ctx.camera.lookAt(cameraTarget);
    ctx.camera.updateProjectionMatrix();
    browseCamera.position.copy(ctx.camera.position);
    browseCamera.target.copy(cameraTarget);

    // How much of the run the frame can actually hold, in slots — the fade has
    // to *finish* inside that (fully transparent at or just inside the edge),
    // or a volume that is still geometrically inside the frustum is handed to
    // the renderer at non-trivial opacity and pops the instant it is clipped.
    // The window's width scales with how much of the run is visible, rather
    // than staying a fixed number of slots, so it reads as the same soft haze
    // whether a narrow canvas shows only a handful of slots or a very wide one
    // shows many: a fixed width would eat most of a short visible range and
    // look like a sudden dip rather than atmosphere on a long one.
    const visibleHalfWidth = tanHalf * aspect * distance;
    const visibleHalfSlots = visibleHalfWidth / ctx.spacing;
    const hardLimit = ctx.wraps ? ctx.total / 2 : Number.POSITIVE_INFINITY;
    const fadeWindow = THREE.MathUtils.clamp(visibleHalfSlots * 0.4, 1.6, 3.2);
    // 0.4 slots of inset keeps the end just inside the geometric edge rather
    // than exactly on it, absorbing frustum/rounding jitter at the boundary.
    ctx.fade.end = Math.max(2.1, Math.min(hardLimit, visibleHalfSlots - 0.4));
    ctx.fade.start = Math.max(1.2, ctx.fade.end - fadeWindow);
    ctx.frame.distance = distance;
    ctx.frame.visibleHalfWidth = visibleHalfWidth;
    ctx.frame.aspect = aspect;

    // The ledge runs clear off both edges, and the shadow camera covers it.
    const ledgeLength = visibleHalfWidth * 2 + ctx.maxWidth * 2 + 1;
    shelfBoard.scale.x = ledgeLength;
    woodTexture.repeat.set(ledgeLength * 1.6, 1);
    keyLight.shadow.camera.left = -(visibleHalfWidth + 1);
    keyLight.shadow.camera.right = visibleHalfWidth + 1;
    keyLight.shadow.camera.updateProjectionMatrix();

    // Gentle haze: nothing in front of the selected volume is touched, and the
    // far end of the run dissolves into the page instead of stopping.
    if (ctx.scene.fog instanceof THREE.Fog) {
      ctx.scene.fog.near = distance * 0.95;
      ctx.scene.fog.far = distance + Math.max(3, visibleHalfWidth * 2.4);
    }
  }

  return { updateCameraFraming, applySurfaceTheme, applyPalette, browseCamera };
}
