/**
 * Deterministic, time-based easing helpers.
 *
 * Every transition here is a pure function of wall-clock time: given a start
 * timestamp and a duration, `progressAt(now)` always returns the same value
 * for the same `now`, and returns exactly `1` once `now >= start + duration`.
 * This is what lets navigation land on an exact final pose instead of
 * asymptotically creeping towards it (as frame-rate-dependent `lerp`/`damp`
 * loops do), so nothing "jumps" when a transition is interrupted and retargeted.
 */

export type EaseFn = (t: number) => number;

export const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const easeLinear: EaseFn = (t) => t;

export const easeInOutCubic: EaseFn = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeOutCubic: EaseFn = (t) => 1 - Math.pow(1 - t, 3);

export const easeOutQuint: EaseFn = (t) => 1 - Math.pow(1 - t, 5);

/**
 * A single-value tween between two numbers, driven entirely by timestamps
 * passed into `valueAt`/`progressAt`. Retargeting mid-flight snapshots the
 * current interpolated value as the new starting point, so motion stays
 * continuous instead of snapping backwards.
 */
export class Tween {
  private fromValue: number;
  private toValue: number;
  private startTime: number;
  private duration: number;
  private ease: EaseFn;

  constructor(initialValue: number, duration: number, ease: EaseFn = easeInOutCubic) {
    this.fromValue = initialValue;
    this.toValue = initialValue;
    this.startTime = 0;
    this.duration = Math.max(1, duration);
    this.ease = ease;
  }

  /**
   * Snapshot the current value and begin easing towards `target`. An `ease`
   * may be supplied per leg: a step taken with a key wants a symmetric curve,
   * while a carriage let go of mid-throw wants to decelerate only.
   */
  retarget(target: number, now: number, duration?: number, ease?: EaseFn): void {
    this.fromValue = this.valueAt(now);
    this.toValue = target;
    this.startTime = now;
    if (duration !== undefined) this.duration = Math.max(1, duration);
    if (ease !== undefined) this.ease = ease;
  }

  /** Jump immediately to `target` with no animation (used for reduced motion). */
  snapTo(target: number): void {
    this.fromValue = target;
    this.toValue = target;
    this.startTime = 0;
  }

  progressAt(now: number): number {
    if (this.duration <= 0) return 1;
    const t = clamp01((now - this.startTime) / this.duration);
    return this.ease(t);
  }

  valueAt(now: number): number {
    return lerp(this.fromValue, this.toValue, this.progressAt(now));
  }

  isSettled(now: number): boolean {
    return now - this.startTime >= this.duration;
  }

  get target(): number {
    return this.toValue;
  }
}
