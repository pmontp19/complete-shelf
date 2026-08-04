import type { ShelfContext } from './types';

/** At most twice a second (cheap enough to call every frame, but a DOM write on every frame would not be free). */
const MIRROR_INTERVAL_MS = 500;

interface ShelfDebugApi {
  diagnostics(): Record<string, unknown>;
  inspect(index?: number): void;
  browse(index?: number): void;
  returnToShelf(): void;
}

declare global {
  interface Window {
    __SHELF__?: ShelfDebugApi;
  }
}

/**
 * Cheap per-frame counters mirrored onto the canvas's `data-*` attributes
 * (at most twice a second) and onto `window.__SHELF__.diagnostics()`, so a
 * real browser or an end-to-end test can read them without an inspector.
 *
 * `window.__SHELF__.inspect` / `.browse` / `.returnToShelf` are installed as
 * inert stubs here, because `createDiagnostics` only receives `ctx` and has
 * no reference of its own to the handle they need to drive. `shelf.ts`
 * overwrites the three of them, right after building the handle, to delegate
 * to it.
 */
export function createDiagnostics(ctx: ShelfContext): {
  update(now: number): void;
  read(): Record<string, unknown>;
  dispose(): void;
} {
  let lastMirror = Number.NEGATIVE_INFINITY;

  function read(): Record<string, unknown> {
    const info = ctx.renderer.info;
    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      pixelRatio: ctx.renderer.getPixelRatio(),
      mode: ctx.mode,
      motionPhase: ctx.diagnostics.motionPhase,
      collisionRejects: ctx.diagnostics.collisionRejects,
    };
  }

  function update(now: number): void {
    if (now - lastMirror < MIRROR_INTERVAL_MS) return;
    lastMirror = now;
    const snapshot = read();
    const dataset = ctx.canvas.dataset;
    for (const [key, value] of Object.entries(snapshot)) {
      dataset[key] = String(value);
    }
  }

  // Kept so `dispose()` can tell whether it still owns the global (see
  // below) rather than assuming it does.
  const api: ShelfDebugApi = {
    diagnostics: () => read(),
    inspect: () => {},
    browse: () => {},
    returnToShelf: () => {},
  };
  window.__SHELF__ = api;

  function dispose(): void {
    // Only remove the global if it is still the object this instance
    // installed: if a second shelf instance mounted after this one, its own
    // `createDiagnostics` call has already overwritten `window.__SHELF__`
    // with its own `api`, and deleting unconditionally here would steal the
    // debug API out from under the still-live instance.
    if (window.__SHELF__ === api) delete window.__SHELF__;
  }

  return { update, read, dispose };
}
