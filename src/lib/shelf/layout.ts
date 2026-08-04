import type { BookRig, InspectPose, ShelfContext } from './types';
import type { BookDimensions } from './geometry';
import type { HardcoverRig } from './book';
import { clamp01, lerp } from './easing';

const REST_ROTATION_Y = Math.PI / 2; // spine facing the camera
const SELECTED_ROTATION_Y = 0; // front cover facing the camera
// A volume is drawn out before it is turned, the way a hand does it: the turn
// only starts once the book is this far into the centre. Turning on the way
// out is what used to make two half-open covers meet in mid-air and shove the
// whole run sideways at the midpoint of every step.
const TURN_DELAY = 0.3;
// How far the centred volume travels towards the reader. Bounded by the depth
// of the ledge below (`LEDGE_DEPTH` in scene.ts): any further and it stands on air.
// Also read by scene.ts's camera framing, as part of the worst-case forward
// pop a selected volume needs room for.
export const SELECTED_LIFT_Z = 0.24;
/**
 * How far past its resting depth a volume swings on its way to the centre,
 * before settling back onto it.
 *
 * A hand pulling a book off a shelf does not stop it dead at the front: it comes
 * out a little too far and eases back. The Stripe Press reference gets the same
 * character from its "rotation lane", a staging depth that sits forward of where
 * the book finally rests, and that overshoot is most of what makes its handoff
 * read as physical rather than as an interpolation. This is the cheap half of
 * that idea, and unlike the reference's it is a pure function of carriage
 * position, so it stays scrubbable and reverses when the reader reverses.
 *
 * Kept small on purpose: enough to feel sprung, not enough to push the volume
 * over the front edge of the ledge it is standing on.
 */
export const SELECTED_LIFT_OVERSHOOT_Z = 0.09;

/**
 * The forward travel of a volume at a given focus, in world units.
 *
 * `focus * SELECTED_LIFT_Z` alone is monotonic: the volume slides straight out
 * and stops, which is what made the approach read as a value being interpolated
 * rather than as a book being taken off a shelf. The second term is a bump that
 * rises and falls across the approach, peaking where `f * f * (1 - f) * 6.75`
 * reaches exactly 1 (at `focus` 2/3), so the volume swings past its resting depth
 * and then eases back onto it as it finishes centring.
 *
 * The overshoot has to be large enough to actually beat the linear term's own
 * climb, or the sum is still monotonic and nothing springs: below about 0.057 the
 * maximum is just the endpoint. At 0.09 the profile peaks around `focus` 0.83 at
 * roughly 0.27, so a volume comes about 0.03 too far forward (an eighth of its
 * travel) before settling. That also has to stay inside the ledge it stands on:
 * 0.27 plus half the thickest volume is 0.35, against a board front edge at 0.36.
 */
export function liftProfileZ(focus: number): number {
  const bump = focus * focus * (1 - focus) * 6.75;
  return focus * SELECTED_LIFT_Z + bump * SELECTED_LIFT_OVERSHOOT_Z;
}

/**
 * The furthest forward a browsing volume can ever be, which is what `scene.ts`
 * frames the camera against so the peak of the swing cannot clip the top edge.
 *
 * Sampled rather than solved. The maximum of the profile above moves as either
 * constant is tuned, and a hand-derived closed form would quietly stop being the
 * real maximum the first time somebody changed one of them.
 */
export const SELECTED_LIFT_Z_PEAK = (() => {
  let peak = 0;
  for (let i = 0; i <= 200; i += 1) peak = Math.max(peak, liftProfileZ(i / 200));
  return peak;
})();
// Also used, at construction time, for the worst-case `spread` a fully
// turned-out cover needs, see shelf.ts, and by scene.ts's camera framing, as
// the worst-case scale-up a selected volume needs room for.
export const SELECTED_SCALE = 1.05;
// Air left between two volumes that are pressed against each other. The
// layout solver treats this as the closest they may ever come, so it is what
// stops a turning cover from grazing (or entering) the volume beside it. Also
// used, at construction time, for the worst-case `spread` — see shelf.ts.
export const CONTACT_GAP = 0.02;
// How far a focused volume rises off the shelf floor along Y, at full focus.
// Also read by scene.ts's camera framing.
export const FOCUS_RISE_Y = 0.04;
// Extra lift a hovered volume gets, along both Y and Z, at full hover weight.
// Also read by scene.ts's camera framing.
export const HOVER_LIFT = 0.05;

export function smootherstep(x: number): number {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * The shortest signed distance, in slots, from a continuous carriage
 * position to a book — the whole of the looping illusion lives here. Each
 * volume is drawn exactly once, at whichever side of the carriage it is
 * nearer to, so the run has no ends to fall off.
 */
export function slotOffset(ctx: ShelfContext, index: number, position: number): number {
  const raw = index - position;
  if (!ctx.wraps) return raw;
  let d = ((raw % ctx.total) + ctx.total) % ctx.total;
  if (d > ctx.total / 2) d -= ctx.total;
  return d;
}

/**
 * Half the footprint, along the camera's X axis, of a book-sized box turned
 * `angle` radians about Y. Racked (angle = π/2) that is half its spine
 * thickness; turned out (angle = 0) it is half its full cover width, and in
 * between it is the width the two swept corners actually need.
 */
export function halfExtentX(dims: BookDimensions, angle: number, scale: number): number {
  return (scale * (Math.abs(Math.cos(angle)) * dims.width + Math.abs(Math.sin(angle)) * dims.depth)) / 2;
}

export interface LayoutDeps {
  /** The inspected volume's extra pose, or null in browse. */
  inspectPose: () => InspectPose | null;
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
  /**
   * Smoothed 0..1: how far this volume has eased into being inspected. 0 is
   * ordinary browse (full ambient bob/parallax); 1 is fully inspected (both
   * gated off, see pass two). Smoothed rather than a snap so the volume the
   * reader is orbiting doesn't stop twitching on one frame and start again
   * abruptly if they back out.
   */
  inspectBlend: number;
}

/** One frame of poses for the whole run. Must not allocate. */
export function createLayout(ctx: ShelfContext, deps: LayoutDeps): {
  update(position: number, now: number, elapsed: number, dt: number): void;
} {
  const slots: LayoutSlot[] = ctx.rigs.map((rig) => ({
    rig,
    offset: 0,
    focus: 0,
    hover: 0,
    rotationY: REST_ROTATION_Y,
    scale: 1,
    halfX: 0,
    x: 0,
    inspectBlend: 0,
  }));
  /** Extra room pair `i`..`i+1` needs beyond one slot of pitch. */
  const gapExtras = new Float64Array(Math.max(0, slots.length - 1));
  const byOffset = (a: LayoutSlot, b: LayoutSlot): number => a.offset - b.offset;

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
      gapExtras[i] = Math.max(0, slots[i].halfX + slots[i + 1].halfX + CONTACT_GAP - ctx.spacing);
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
      slots[i].x = slots[i].offset * ctx.spacing + acc;
      if (i < count - 1) acc += gapExtras[i];
    }
    acc = leftShare;
    for (let i = pivot; i >= 0; i -= 1) {
      slots[i].x = slots[i].offset * ctx.spacing - acc;
      if (i > 0) acc += gapExtras[i - 1];
    }
  }

  function update(position: number, now: number, elapsed: number, dt: number): void {
    const hoverRate = Math.min(1, dt * 9);
    const count = slots.length;
    const pose = deps.inspectPose();
    // Guard against an impossible state: `ctx.selectedIndex` should always be
    // a valid rig index whenever `inspectPose()` returns non-null, but if the
    // two ever disagree (e.g. the selection got cleared to -1 the same frame
    // a pose is still ramping down), no rig's index would ever equal it,
    // `isInspected` would be false for every volume below, and the isolation
    // fade meant to exempt just the inspected volume would instead land on
    // the whole run at once — the shelf would blank out with nothing to
    // recover it. Requiring a valid index here makes that broken invariant
    // degrade to "no inspection" instead of "no shelf".
    const selectedIndexValid = ctx.selectedIndex >= 0 && ctx.selectedIndex < count;

    // Pass one: every volume's own pose, and the room it needs for it. This
    // includes blending in the inspect pose's yaw and scale for whichever
    // volume is being inspected, *before* `halfX` is derived below — the
    // solver has to see the real (possibly turned and enlarged) footprint,
    // not the smaller browse-only one, or it can pack a neighbour into space
    // the inspected volume is actually occupying.
    for (let i = 0; i < count; i += 1) {
      const slot = slots[i];
      const rig = slot.rig;
      const offset = slotOffset(ctx, rig.index, position);
      const proximity = clamp01(1 - Math.abs(offset));
      const focus = smootherstep(proximity);
      // The turn trails the draw-out, so a volume is already clear of the run
      // before its cover starts sweeping sideways.
      const turn = smootherstep(clamp01((proximity - TURN_DELAY) / (1 - TURN_DELAY)));

      const wantsHover = ctx.hoverIndex === rig.index && focus < 0.9 ? 1 : 0;
      rig.hover += (wantsHover - rig.hover) * hoverRate;
      const hover = ctx.reducedMotion ? wantsHover : rig.hover;

      const isInspected = pose !== null && selectedIndexValid && rig.index === ctx.selectedIndex;
      // Eases towards 1 while this volume is inspected and back to 0 once it
      // isn't, at the same rate hover already blends at.
      const wantsInspectBlend = isInspected ? 1 : 0;
      slot.inspectBlend += (wantsInspectBlend - slot.inspectBlend) * hoverRate;
      const inspectBlend = ctx.reducedMotion ? wantsInspectBlend : slot.inspectBlend;

      const browseScale = 1 + focus * (SELECTED_SCALE - 1);
      // The ambient parallax yaw is part of the pose, so the spacing has to
      // account for it too — otherwise a cover tilted towards the pointer
      // reaches past the clearance that was solved for. It is faded out by
      // `inspectBlend` here too, in step with the actual pointer parallax
      // rotation being faded out in pass two, so the footprint the solver
      // sees never asks for room a gated-off wobble no longer needs.
      const parallaxYaw = ctx.reducedMotion
        ? 0
        : -ctx.pointerSmooth.x * 0.05 * focus * (1 - inspectBlend);
      const browseRotationY = lerp(REST_ROTATION_Y, SELECTED_ROTATION_Y, turn);
      // The inspect pose replaces yaw and multiplies scale outright once a
      // volume is being inspected — blended in here rather than in pass two.
      const rotationY = isInspected && pose ? pose.yaw : browseRotationY;
      const scale = isInspected && pose ? browseScale * pose.scale : browseScale;

      slot.offset = offset;
      slot.focus = focus;
      slot.hover = hover;
      slot.rotationY = rotationY;
      slot.scale = scale;
      slot.halfX = halfExtentX(rig.dims, rotationY + parallaxYaw, scale);
    }

    slots.sort(byOffset);
    spaceOutRun(count);

    // Cheap invariant guard: `spaceOutRun` promises adjacent footprints never
    // overlap by more than `CONTACT_GAP`, but that promise is only as good as
    // the `halfX` it was fed. If a future change (e.g. a larger inspect scale)
    // ever lets pass two draw a bigger footprint than pass one measured here,
    // this is what catches it — `ctx.diagnostics.collisionRejects` is mirrored
    // onto `window.__SHELF__.diagnostics()` and is otherwise never written, so
    // it staying 0 is a real check, not a vacuous one.
    for (let i = 0; i < count - 1; i += 1) {
      const gap = slots[i + 1].x - slots[i].x;
      const needed = slots[i].halfX + slots[i + 1].halfX + CONTACT_GAP;
      if (gap < needed - 0.001) ctx.diagnostics.collisionRejects += 1;
    }

    // Pass two: commit the solved X and the rest of the pose. Yaw and scale
    // were already blended with the inspect pose in pass one (above), so
    // they are applied here as-is rather than recomputed; only the extra
    // position offset is inspect-only, since it doesn't affect the footprint
    // the solver packed against. The rest of the run fades further by
    // however far isolated the inspected volume is.
    for (let i = 0; i < count; i += 1) {
      const { rig, offset, focus, hover, rotationY, scale, x, inspectBlend } = slots[i];
      const distance = Math.abs(offset);
      const isInspected = pose !== null && selectedIndexValid && rig.index === ctx.selectedIndex;

      let px = x;
      let y = ctx.shelfTopY + rig.dims.height / 2 + focus * FOCUS_RISE_Y + hover * HOVER_LIFT;
      let z = liftProfileZ(focus) + hover * HOVER_LIFT;

      if (isInspected && pose) {
        px += pose.x;
        y += pose.y;
        z += pose.z;
      }

      rig.root.position.set(px, y, z);
      rig.root.rotation.y = rotationY;
      // Books lean while they are racked and stand up as they come forward.
      rig.root.rotation.z = rig.lean * (1 - focus) * (1 - hover * 0.6);
      rig.root.scale.setScalar(scale);

      // The idle bob and the pointer parallax both fade out with
      // `inspectBlend`: a volume the reader is closely inspecting shouldn't
      // still twitch with the cursor, and once orbit controls take over it
      // must not fight the reader's own drag with its own tilt.
      const ambientMotion = 1 - inspectBlend;
      const idle = ctx.reducedMotion
        ? 0
        : Math.sin(elapsed * 0.9 + rig.index * 0.7) * 0.01 * focus * ambientMotion;
      rig.motion.position.y = idle;
      if (!ctx.reducedMotion) {
        rig.motion.rotation.x = ctx.pointerSmooth.y * 0.05 * focus * ambientMotion;
        rig.motion.rotation.y = -ctx.pointerSmooth.x * 0.05 * focus * ambientMotion;
      } else {
        rig.motion.rotation.x = 0;
        rig.motion.rotation.y = 0;
      }

      // The inspected volume is exempt from the distance fade: it is meant to
      // read as fully present while every other volume fades for isolation,
      // regardless of how far its browse-pose offset happens to sit from the
      // carriage.
      const fadeT = isInspected
        ? 0
        : clamp01((distance - ctx.fade.start) / Math.max(0.001, ctx.fade.end - ctx.fade.start));
      let opacity = 1 - smootherstep(fadeT);
      if (pose && selectedIndexValid && !isInspected) opacity *= 1 - pose.isolation;
      for (const material of rig.materials) material.opacity = opacity;
      rig.setVisible(opacity > 0.02);
      // Below full opacity every material's translucency stacks across the
      // composite hardcover's layers (every one of them is `transparent:
      // true`), which is what makes a fading volume read as glass you can
      // see your own insides through. The meshes the outer shell already
      // fully occludes at opacity 1 (text block, back board, headbands: see
      // `BookCase.interiorMeshes`) are dropped the instant opacity is
      // anything less, collapsing the stack down to a thin, nearly-coplanar
      // shell whose translucency reads as a dimming silhouette instead.
      // `rig` is a `BookRig` here (the frozen contract `ctx.rigs` is typed
      // with), but every element was actually built by `buildBookRig`, which
      // returns the superset `HardcoverRig`, safe to narrow back to.
      (rig as HardcoverRig).setInteriorVisible(opacity >= 1);

      // The varnish highlight only makes sense on a jacket the reader can
      // actually see, so it follows `focus` (1 only for the volume turned out at
      // the centre) and is scaled by the volume's own opacity so it fades out
      // with it rather than surviving as a floating streak. Reusing
      // `ambientMotion` also stops it while a volume is being inspected, where
      // the reader is turning it under orbit and the real specular is already
      // theirs to move.
      //
      // Where the band sits is derived from what the reader is doing, never from
      // a clock: the pointer's position across the stage (the same value that
      // tilts the volume, so the highlight and the tilt agree with each other)
      // and how far the volume has turned out of the run, which is what sweeps it
      // as the carriage scrubs past. So it holds still when nothing moves, the
      // way a reflection does. Under reduced motion the pointer term is already
      // pinned to 0 and the volume does not tilt, but the highlight would still
      // be a bright diagonal sitting on the cover with nothing to explain it, so
      // it is switched off there rather than left frozen.
      const turnedOut = 1 - rotationY / REST_ROTATION_Y;
      (rig as HardcoverRig).setSheen(
        ctx.reducedMotion ? 0 : focus * opacity * ambientMotion,
        0.5 - ctx.pointerSmooth.x * 0.45 + turnedOut * 0.35,
      );

      rig.shadowMesh.position.set(px, ctx.shelfTopY - 0.001, z + rig.dims.depth * 0.5 + 0.06);
      rig.shadowMaterial.opacity = 0.32 * opacity * (1 - hover * 0.45);
      rig.shadowMesh.visible = opacity > 0.02;
    }
  }

  return { update };
}
