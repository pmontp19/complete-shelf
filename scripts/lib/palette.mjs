// Curated warm editorial palette used for generated fallback covers, and a
// deterministic hash to pick one entry per book id — so re-running the
// script always produces the same colour for the same book.

import { createHash } from "node:crypto";

export const PALETTE = [
  { name: "deep olive", hex: "#3f4a2b" },
  { name: "oxblood", hex: "#5c2328" },
  { name: "ink navy", hex: "#1f2b42" },
  { name: "clay", hex: "#7a4530" },
  { name: "slate", hex: "#3d4a52" },
  { name: "ochre", hex: "#7d5f1f" },
  { name: "forest", hex: "#2c4436" },
  { name: "aubergine", hex: "#432c3f" },
  { name: "rust", hex: "#6b3624" },
  { name: "charcoal blue", hex: "#2b3846" },
];

export function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

/** Deterministically pick a palette entry for a given id string. */
export function paletteForId(id) {
  const digest = createHash("sha256").update(id).digest();
  const index = digest[0] % PALETTE.length;
  return PALETTE[index];
}
