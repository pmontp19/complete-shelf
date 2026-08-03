// Picks the colour a cover actually reads as.
//
// The obvious approach — sharp's `.stats()` channel means — is the average of
// every pixel, and an average is not a colour anyone sees. A vivid blue cover
// with white type, black linework and a dark vignette averages to a muddy
// grey-teal; a red one averages to greyish brown. Averaging is why the shelf's
// spines drifted away from the artwork they are supposed to echo.
//
// Instead: sample the raster small, throw away the pixels that carry no hue
// (paper-white type, near-black outlines), bucket what's left by hue, and let
// the largest saturation-weighted bucket win. That returns the ink the cover is
// printed in rather than the arithmetic middle of it.

import sharp from "sharp";
import { rgbToHsl } from "./color.mjs";

/** Sampling width. Small on purpose: this is a colour census, not a thumbnail. */
const SAMPLE_WIDTH = 120;
/** 15° buckets — fine enough to separate teal from blue, coarse enough not to shatter a gradient. */
const HUE_BUCKETS = 24;
/** Below this saturation a pixel's hue is noise, so it is counted as neutral instead. */
const NEUTRAL_SATURATION = 0.12;
/** Type and linework: extremes of lightness say nothing about the cover's colour. */
const MIN_LIGHTNESS = 0.07;
const MAX_LIGHTNESS = 0.93;

/**
 * How much a pixel counts towards its bucket. Saturated pixels count for more
 * than washed-out ones, so a small area of true cover colour outvotes a large
 * area of the shading around it — but the floor keeps a genuinely muted cover
 * from being decided by its few brightest pixels.
 */
const weigh = (saturation) => 0.3 + saturation;

/**
 * Dominant colour of a cover raster, as {r, g, b} in 0..255.
 *
 * @param {Buffer} buffer any raster sharp can read
 * @returns {Promise<{r: number, g: number, b: number}>}
 */
export async function dominantCoverColor(buffer) {
  const image = sharp(buffer);
  const { data, info } = await image
    .resize({ width: SAMPLE_WIDTH, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" }) // composite any transparency onto paper, don't sample the void
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const buckets = new Map();
  let fallbackR = 0;
  let fallbackG = 0;
  let fallbackB = 0;
  let fallbackCount = 0;

  for (let i = 0; i + channels - 1 < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    fallbackR += r;
    fallbackG += g;
    fallbackB += b;
    fallbackCount += 1;

    const { h, s, l } = rgbToHsl({ r, g, b });
    if (l < MIN_LIGHTNESS || l > MAX_LIGHTNESS) continue;

    const key = s < NEUTRAL_SATURATION ? "neutral" : Math.floor((h / 360) * HUE_BUCKETS) % HUE_BUCKETS;
    const weight = weigh(s);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.weight += weight;
      bucket.r += r * weight;
      bucket.g += g * weight;
      bucket.b += b * weight;
    } else {
      buckets.set(key, { weight, r: r * weight, g: g * weight, b: b * weight });
    }
  }

  // Nothing but pure black and pure white (a line-art cover, say) — the plain
  // average is the honest answer there.
  if (buckets.size === 0) {
    if (fallbackCount === 0) return { r: 128, g: 128, b: 128 };
    return {
      r: fallbackR / fallbackCount,
      g: fallbackG / fallbackCount,
      b: fallbackB / fallbackCount,
    };
  }

  let winner = null;
  for (const bucket of buckets.values()) {
    if (!winner || bucket.weight > winner.weight) winner = bucket;
  }

  return {
    r: winner.r / winner.weight,
    g: winner.g / winner.weight,
    b: winner.b / winner.weight,
  };
}
