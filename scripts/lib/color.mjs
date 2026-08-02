// Colour helpers: WCAG contrast for picking readable foreground text, plus
// small utilities for taming a raw dominant colour into something that
// reads well as a book spine (darker, less saturated than the raw average).

/** Clamp a number into [min, max]. */
function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

export function toHex({ r, g, b }) {
  const c = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance, 0 (black) .. 1 (white). */
export function relativeLuminance({ r, g, b }) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** WCAG contrast ratio between two colours, 1..21. */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

const LIGHT_TEXT = { hex: "#faf7f2", rgb: { r: 0xfa, g: 0xf7, b: 0xf2 } };
const DARK_TEXT = { hex: "#1a1613", rgb: { r: 0x1a, g: 0x16, b: 0x13 } };

/** Pick whichever of the two standard text colours contrasts better against `bg`. */
export function readableTextColor(bg) {
  const withLight = contrastRatio(bg, LIGHT_TEXT.rgb);
  const withDark = contrastRatio(bg, DARK_TEXT.rgb);
  return withLight >= withDark ? LIGHT_TEXT.hex : DARK_TEXT.hex;
}

/** Convert RGB to HSL ({h: 0..360, s: 0..1, l: 0..1}). */
export function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = 60 * (((gn - bn) / d) % 6);
        break;
      case gn:
        h = 60 * ((bn - rn) / d + 2);
        break;
      default:
        h = 60 * ((rn - gn) / d + 4);
    }
  }
  if (h < 0) h += 360;
  return { h, s, l };
}

export function hslToRgb({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

/**
 * Take a raw dominant colour extracted from a photograph and tame it into
 * something that reads as an intentional "spine colour": a touch darker and
 * a touch less saturated than the literal pixel average, which tends to be
 * washed out or overly bright.
 */
export function tameForSpine(rgb) {
  const hsl = rgbToHsl(rgb);
  const tamed = {
    h: hsl.h,
    s: clamp(hsl.s * 0.82, 0, 0.65),
    l: clamp(hsl.l * 0.78, 0.12, 0.55),
  };
  return hslToRgb(tamed);
}
