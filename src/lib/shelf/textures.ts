import * as THREE from 'three';
import type { ShelfBook } from './types';

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
 * Restrained, editorial spine artwork: a flat ground colour, the title set
 * vertically (rotated once, so it never mirrors), and the publisher name in
 * small caps near the foot. Used whenever `book.spineUrl` is absent or fails
 * to load.
 */
export function createSpineTexture(book: ShelfBook, width = 256, height = 1024): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return finalizeCanvasTexture(new THREE.CanvasTexture(canvas));

  ctx.fillStyle = book.spineColor;
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

  // Title, set vertically bottom-to-top (the conventional spine reading
  // direction). Drawn once, upright, then rotated as a whole — never mirrored.
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = book.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const titleSize = Math.max(22, Math.round(width * 0.11));
  ctx.font = `${titleSize}px Georgia, "Times New Roman", serif`;
  drawTracked(ctx, book.title.toUpperCase(), 0, 0, titleSize * 0.06);
  ctx.restore();

  // Publisher, small, near the foot of the spine.
  ctx.save();
  ctx.translate(width / 2, height * 0.86);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = book.textColor;
  ctx.globalAlpha = 0.85;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const pubSize = Math.max(14, Math.round(width * 0.052));
  ctx.font = `${pubSize}px Georgia, "Times New Roman", serif`;
  drawTracked(ctx, book.publisher.toUpperCase(), 0, 0, pubSize * 0.1);
  ctx.restore();

  return finalizeCanvasTexture(new THREE.CanvasTexture(canvas));
}

/** Draws text centered at (x, y) with manual letter-spacing, wrapping if too wide. */
function drawTracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, tracking: number): void {
  const maxWidth = ctx.canvas.height * 0.82;
  const measure = (s: string) => {
    let w = 0;
    for (const ch of s) w += ctx.measureText(ch).width + tracking;
    return w - tracking;
  };
  const lines: string[] = [];
  let current = '';
  const words = text.split(' ');
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  const cappedLines = lines.slice(0, 3);
  const lineHeight = parseInt(ctx.font, 10) * 1.25;
  const startY = y - ((cappedLines.length - 1) * lineHeight) / 2;

  cappedLines.forEach((line, lineIndex) => {
    const width = measure(line);
    let cursor = x - width / 2;
    const lineY = startY + lineIndex * lineHeight;
    for (const ch of line) {
      const charWidth = ctx.measureText(ch).width;
      ctx.fillText(ch, cursor + charWidth / 2, lineY);
      cursor += charWidth + tracking;
    }
  });
}

/** Procedural walnut-toned wood grain for the shelf board — no external assets. */
export function createWoodGrainTexture(width = 1024, height = 256, seed = 0xb00c): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return finalizeCanvasTexture(new THREE.CanvasTexture(canvas));

  const random = seededRandom(seed);
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, '#5b4128');
  base.addColorStop(0.5, '#6b4c2e');
  base.addColorStop(1, '#523c24');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // Long horizontal grain fibres with gentle sinusoidal wander.
  const fibreCount = 90;
  for (let i = 0; i < fibreCount; i += 1) {
    const y0 = random() * height;
    const amp = 2 + random() * 8;
    const freq = 0.004 + random() * 0.01;
    const phase = random() * Math.PI * 2;
    const shade = Math.round(30 + random() * 60);
    const warmth = random() > 0.5 ? 1 : -1;
    ctx.strokeStyle = `rgba(${shade + 30},${shade + 12},${Math.max(0, shade - 8)},${0.08 + random() * 0.16})`;
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
    knot.addColorStop(0, 'rgba(30,18,10,0.55)');
    knot.addColorStop(0.5, 'rgba(40,24,14,0.22)');
    knot.addColorStop(1, 'rgba(40,24,14,0)');
    ctx.fillStyle = knot;
    ctx.beginPath();
    ctx.ellipse(kx, ky, radius * 2.4, radius, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle overall vignette so tiled repeats read as one continuous board.
  const vignette = ctx.createLinearGradient(0, 0, 0, height);
  vignette.addColorStop(0, 'rgba(0,0,0,0.18)');
  vignette.addColorStop(0.15, 'rgba(0,0,0,0)');
  vignette.addColorStop(0.85, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.22)');
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
