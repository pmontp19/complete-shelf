import * as THREE from 'three';
import type { ShelfBook } from './types';

const FALLBACK_SERIF = 'Georgia, "Times New Roman", serif';
let cachedSerif: string | null = null;

/**
 * The page's own serif stack, read from the design system's `--font-serif`
 * rather than restated here.
 *
 * A spine sits directly above the caption that names the same book, so if the
 * two disagree the shelf and the page are set in different faces: this file
 * used to hardcode Georgia while the page asks for Iowan Old Style first, which
 * on a Mac put two different serifs a couple of centimetres apart. Reading the
 * property means the shelf follows the design system instead of drifting from
 * it. Cached because a spine texture is drawn per volume and each call would
 * otherwise walk the cascade.
 *
 * The project loads no webfonts (every stack is a system one), so there is
 * nothing to await here: were an `@font-face` ever added, this canvas type
 * would need `document.fonts.ready` before the textures are drawn.
 */
function pageSerif(): string {
  if (cachedSerif) return cachedSerif;
  const raw =
    typeof document === 'undefined'
      ? ''
      : getComputedStyle(document.documentElement).getPropertyValue('--font-serif').trim();
  cachedSerif = raw || FALLBACK_SERIF;
  return cachedSerif;
}

/** Small deterministic hash so per-book procedural textures stay stable across reloads. */
export function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Mulberry32 PRNG — tiny, fast, deterministic for a given seed. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function finalizeCanvasTexture(
  texture: THREE.CanvasTexture,
  options: { srgb?: boolean; anisotropy?: number } = {},
): THREE.CanvasTexture {
  if (options.srgb !== false) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = options.anisotropy ?? 4;
  texture.needsUpdate = true;
  return texture;
}

/** Mixes two hex colors (`#rrggbb`) by `t` in [0, 1]. */
export function mixHexColor(a: string, b: string, t: number): string {
  const colorA = new THREE.Color(a);
  const colorB = new THREE.Color(b);
  colorA.lerp(colorB, t);
  return `#${colorA.getHexString()}`;
}

/**
 * The other end of the ink the palette chose. `textColor` is always one of the
 * pipeline's two foregrounds — near-white or near-black — so its opposite is
 * the direction to push a ground in when it needs to move away from the type.
 */
function oppositeInk(textColor: string): string {
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(textColor).getHSL(hsl);
  return hsl.l > 0.5 ? '#12100e' : '#fbf8f3';
}

/**
 * Restrained, editorial spine artwork: a flat ground colour, the author's
 * surname at the head, the title set vertically (rotated once, so it never
 * mirrors) across the middle, and the imprint near the foot. Used whenever
 * `book.spineUrl` is absent or fails to load.
 *
 * `ratio` is the spine's real proportion — its thickness divided by its height,
 * as the geometry has it. The canvas has to carry the same proportion: a fixed
 * 256x1024 sheet stretched across a face between 0.055 and 0.16 world units
 * wide squashed every glyph to roughly a third of its width along the reading
 * direction, which is why the titles read as a smear rather than as words.
 */
export function createSpineTexture(book: ShelfBook, ratio: number, height = 1024): THREE.CanvasTexture {
  // Floored so the very thinnest volume still has enough texels across the
  // spine for the type to have edges rather than stairs.
  const width = Math.max(64, Math.round(height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return finalizeCanvasTexture(new THREE.CanvasTexture(canvas));

  // Ground, pushed a few percent *away* from the type rather than towards it.
  // The lift used to run the other way, to keep near-black spine colours from
  // reading as dead bricks — but that darkness is now dealt with where it comes
  // from, in the palette the cover pipeline derives, and here it only ate into
  // the contrast the title needs on a strip this narrow.
  ctx.fillStyle = mixHexColor(book.spineColor, oppositeInk(book.textColor), 0.08);
  ctx.fillRect(0, 0, width, height);

  // Faint cloth-like vertical grain so the spine isn't a dead flat swatch.
  const random = seededRandom(hashSeed(`${book.id}-spine`));
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = book.textColor;
  for (let x = 0; x < width; x += 3) {
    ctx.beginPath();
    ctx.moveTo(x + (random() - 0.5) * 2, 0);
    ctx.lineTo(x + (random() - 0.5) * 2, height);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // A shallow curve of light down the spine — real cloth over boards is never
  // evenly lit, and this is what stops a rack of them looking like a barcode.
  // Kept gentle: the two hinge shadows are what a narrow spine can least
  // afford, since they fall exactly where wrapped title lines reach.
  const round = ctx.createLinearGradient(0, 0, width, 0);
  round.addColorStop(0, 'rgba(0,0,0,0.2)');
  round.addColorStop(0.32, 'rgba(255,255,255,0.12)');
  round.addColorStop(0.72, 'rgba(255,255,255,0.05)');
  round.addColorStop(1, 'rgba(0,0,0,0.17)');
  ctx.fillStyle = round;
  ctx.fillRect(0, 0, width, height);

  // Head/tail rules, editorial not decorative.
  ctx.strokeStyle = book.textColor;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1, width * 0.01);
  const inset = width * 0.16;
  ctx.beginPath();
  ctx.moveTo(inset, height * 0.06);
  ctx.lineTo(width - inset, height * 0.06);
  ctx.moveTo(inset, height * 0.94);
  ctx.lineTo(width - inset, height * 0.94);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Three bands, the way a printed spine is set: the author at the head, the
  // title across the middle, the imprint at the foot. The author is what tells
  // one Crave volume from the next once the titles are down to one word, and
  // the imprint alone never could — 21 of the 22 read "Columna".
  //
  // Each line is fitted to its band rather than set at a fixed size and wrapped:
  // a strip this narrow cannot carry two lines of a title without the hinge
  // shading falling straight through them, so a long title comes down in size
  // instead of stacking.
  //
  // The ceiling on each size is a share of the spine's width — type cannot be
  // taller than the strip it is printed on. The floor is a share of its *height*,
  // which is the constant one: a thick spine is drawn wider on screen in the same
  // proportion as its canvas, so what a glyph ends up measuring for the reader
  // depends on the size against the canvas height and not against its width.
  // Expressing the floor as a share of the width would make the thickest volumes
  // — the ones with the most room — the first to lose their titles.
  drawSpineLine(ctx, (book.spineAuthor ?? book.author).toUpperCase(), {
    at: 0.15,
    length: height * 0.15,
    min: height * 0.011,
    max: width * 0.15,
    weight: 400,
    tracking: 0.12,
    alpha: 0.9,
    ink: book.textColor,
  });
  drawSpineLine(ctx, (book.spineTitle ?? book.title).toUpperCase(), {
    at: 0.525,
    length: height * 0.54,
    min: height * 0.024,
    max: width * 0.42,
    weight: 600,
    tracking: 0.06,
    ink: book.textColor,
  });
  drawSpineLine(ctx, book.publisher.toUpperCase(), {
    at: 0.875,
    length: height * 0.1,
    min: height * 0.009,
    max: width * 0.11,
    weight: 400,
    tracking: 0.16,
    alpha: 0.8,
    ink: book.textColor,
  });

  return finalizeCanvasTexture(new THREE.CanvasTexture(canvas));
}

interface SpineLineOptions {
  /** Where along the spine's length the line sits, 0 (head) to 1 (foot). */
  at: number;
  /** How far the line may run along the spine, in canvas pixels. */
  length: number;
  /** Font size bounds, in canvas pixels. */
  min: number;
  max: number;
  weight: 400 | 600;
  /** Letter-spacing as a fraction of the font size. */
  tracking: number;
  ink: string;
  alpha?: number;
}

/**
 * Sets one line of spine type: rotated a quarter turn so it reads bottom-to-top
 * (the convention everywhere except a handful of German imprints), centred in
 * its band, and scaled down — never wrapped — until it fits.
 */
function drawSpineLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  options: SpineLineOptions,
): void {
  const { width, height } = ctx.canvas;
  const font = (size: number) => `${options.weight} ${size}px ${pageSerif()}`;

  // Text metrics scale linearly with the font size, so one measuring pass at a
  // reference size gives the length per pixel of type and the fit is arithmetic
  // rather than a search.
  const reference = 100;
  ctx.font = font(reference);
  const perPixel = measureTracked(ctx, text, reference * options.tracking) / reference;
  const max = Math.max(options.min, options.max);
  const size = Math.max(options.min, Math.min(max, options.length / perPixel));

  ctx.font = font(size);
  const tracking = size * options.tracking;
  // Only reachable when even `min` is too big for the band, which means the
  // title needs a `spineTitle` in the catalogue rather than more shrinking.
  const line = truncateTracked(ctx, text, tracking, options.length);

  ctx.save();
  ctx.translate(width / 2, height * options.at);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = options.ink;
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // No shadow behind the type. There used to be a blurred halo in the opposite
  // ink, on the theory that it would help the letterforms survive being
  // downsampled to a few dozen screen pixels. What it actually produced was a
  // glow around every glyph, which is not something printed type does: a spine is
  // foil or ink pressed flat into cloth, and nothing about it floats above the
  // surface. The contrast the type needs is the cover palette's job, and it
  // already does it, because `textColor` is derived as the readable ink over
  // `spineColor` rather than picked by hand.

  let cursor = -measureTracked(ctx, line, tracking) / 2;
  for (const character of line) {
    const advance = ctx.measureText(character).width;
    ctx.fillText(character, cursor + advance / 2, 0);
    cursor += advance + tracking;
  }
  ctx.restore();
}

/** Length of `text` at the context's current font with `tracking` px added between glyphs. */
function measureTracked(ctx: CanvasRenderingContext2D, text: string, tracking: number): number {
  let length = 0;
  for (const character of text) length += ctx.measureText(character).width + tracking;
  return Math.max(0, length - tracking);
}

/** Trims `text` to `maxLength`, on a word boundary where one is close enough. */
function truncateTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  tracking: number,
  maxLength: number,
): string {
  if (measureTracked(ctx, text, tracking) <= maxLength) return text;
  let kept = '';
  for (const character of text) {
    if (measureTracked(ctx, `${kept}${character}…`, tracking) > maxLength) break;
    kept += character;
  }
  const lastSpace = kept.lastIndexOf(' ');
  if (lastSpace > kept.length * 0.6) kept = kept.slice(0, lastSpace);
  return `${kept.trimEnd()}…`;
}

/**
 * Procedural grain for the ledge — no external assets. Deliberately drawn
 * near-white: it is a luminance detail map, and the material's own colour
 * (set per theme) decides whether the ledge reads as pale oak on paper or as
 * a dark walnut edge at night. Baking a walnut brown in here instead would
 * multiply down to mud in both.
 */
export function createWoodGrainTexture(width = 1024, height = 256, seed = 0xb00c): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return finalizeCanvasTexture(new THREE.CanvasTexture(canvas));

  const random = seededRandom(seed);
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, '#efe7dc');
  base.addColorStop(0.5, '#fbf6ee');
  base.addColorStop(1, '#e6dccf');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // Long horizontal grain fibres with gentle sinusoidal wander.
  const fibreCount = 90;
  for (let i = 0; i < fibreCount; i += 1) {
    const y0 = random() * height;
    const amp = 2 + random() * 8;
    const freq = 0.004 + random() * 0.01;
    const phase = random() * Math.PI * 2;
    const warmth = random() > 0.5 ? 1 : -1;
    ctx.strokeStyle = `rgba(126,102,74,${0.04 + random() * 0.08})`;
    ctx.lineWidth = 0.6 + random() * 1.6;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 8) {
      const y = y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1 + phase) * amp * 0.25 * warmth;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Occasional knots.
  const knotCount = 2 + Math.floor(random() * 2);
  for (let i = 0; i < knotCount; i += 1) {
    const kx = random() * width;
    const ky = height * (0.2 + random() * 0.6);
    const radius = 6 + random() * 10;
    const knot = ctx.createRadialGradient(kx, ky, 0, kx, ky, radius * 2.4);
    knot.addColorStop(0, 'rgba(120,94,64,0.24)');
    knot.addColorStop(0.5, 'rgba(120,94,64,0.1)');
    knot.addColorStop(1, 'rgba(120,94,64,0)');
    ctx.fillStyle = knot;
    ctx.beginPath();
    ctx.ellipse(kx, ky, radius * 2.4, radius, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle overall vignette so tiled repeats read as one continuous board.
  const vignette = ctx.createLinearGradient(0, 0, 0, height);
  vignette.addColorStop(0, 'rgba(70,54,36,0.12)');
  vignette.addColorStop(0.15, 'rgba(70,54,36,0)');
  vignette.addColorStop(0.85, 'rgba(70,54,36,0)');
  vignette.addColorStop(1, 'rgba(70,54,36,0.16)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return finalizeCanvasTexture(texture, { anisotropy: 8 });
}

/** Creamy, faintly striated page-block edge — used for the fore-edge and head/tail faces. */
export function createPageEdgeTexture(width = 64, height = 512, seed = 0x9a9e): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return finalizeCanvasTexture(new THREE.CanvasTexture(canvas), { srgb: true });

  const random = seededRandom(seed);
  ctx.fillStyle = '#e7ddc7';
  ctx.fillRect(0, 0, width, height);

  for (let y = 0; y < height; y += 1.4) {
    const shade = Math.round(200 + random() * 40);
    ctx.strokeStyle = `rgba(${shade - 20},${shade - 26},${shade - 42},${0.12 + random() * 0.16})`;
    ctx.lineWidth = 0.5 + random() * 0.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y + (random() - 0.5));
    ctx.stroke();
  }

  const shade = ctx.createLinearGradient(0, 0, width, 0);
  shade.addColorStop(0, 'rgba(50,38,24,0.16)');
  shade.addColorStop(0.12, 'rgba(255,255,255,0.05)');
  shade.addColorStop(0.9, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(50,38,24,0.1)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);

  return finalizeCanvasTexture(new THREE.CanvasTexture(canvas));
}

/** Soft radial falloff used as an alpha map for contact shadows under each book. */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return finalizeCanvasTexture(new THREE.CanvasTexture(canvas), { srgb: false });

  const gradient = ctx.createRadialGradient(128, 64, 4, 128, 64, 126);
  gradient.addColorStop(0, 'rgba(0,0,0,0.9)');
  gradient.addColorStop(0.4, 'rgba(0,0,0,0.55)');
  gradient.addColorStop(0.75, 'rgba(0,0,0,0.16)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return finalizeCanvasTexture(new THREE.CanvasTexture(canvas), { srgb: false, anisotropy: 4 });
}

/**
 * Loads a texture, resolving `null` instead of rejecting on failure so
 * callers can fall back gracefully without a try/catch around a promise
 * that never rejects the way they'd expect.
 */
export function loadTextureSafe(
  loader: THREE.TextureLoader,
  url: string,
  colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace,
): Promise<THREE.Texture | null> {
  return new Promise((resolve) => {
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = colorSpace;
        texture.needsUpdate = true;
        resolve(texture);
      },
      undefined,
      () => resolve(null),
    );
  });
}
