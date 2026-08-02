// Builds a typographic fallback cover (SVG -> rasterised by sharp) for
// books where no real cover art could be resolved. Designed to look like a
// deliberate, minimal editorial cover — not an error placeholder.

import { paletteForId, hexToRgb } from "./palette.mjs";
import { readableTextColor } from "./color.mjs";

const WIDTH = 800;
const HEIGHT = 1200;

export function escapeXml(str) {
  return String(str).replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

/** Rough average glyph width for the serif stack we render with, as a fraction of font size. */
const GLYPH_WIDTH_FACTOR = 0.52;

function estimateLineWidth(line, fontSize) {
  return line.length * fontSize * GLYPH_WIDTH_FACTOR;
}

function wrapWords(words, fontSize, maxWidth) {
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || estimateLineWidth(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Word-wrap a title to fit a box, shrinking the font size as needed.
 * Returns { lines, fontSize, lineHeight }.
 */
export function layoutTitle(title, { maxWidth, maxHeight, startFontSize = 60, minFontSize = 30 }) {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [""], fontSize: startFontSize, lineHeight: startFontSize * 1.3 };

  let fontSize = startFontSize;
  let lines = wrapWords(words, fontSize, maxWidth);

  const fits = () => {
    const lineHeight = fontSize * 1.28;
    const withinHeight = lines.length * lineHeight <= maxHeight;
    const withinWidth = lines.every((l) => estimateLineWidth(l, fontSize) <= maxWidth * 1.1);
    return withinHeight && withinWidth;
  };

  while (!fits() && fontSize > minFontSize) {
    fontSize -= 2;
    lines = wrapWords(words, fontSize, maxWidth);
  }

  // If we hit the floor and it still overflows vertically, cap the number of
  // lines and ellipsize the last visible one rather than spilling off-canvas.
  const lineHeight = fontSize * 1.28;
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (estimateLineWidth(`${last}…`, fontSize) > maxWidth && last.length > 1) {
      last = last.slice(0, -1);
    }
    kept[maxLines - 1] = `${last}…`;
    lines = kept;
  }

  return { lines, fontSize, lineHeight };
}

function smallCapsSpacedText(author) {
  return author.toUpperCase();
}

/**
 * Build the fallback cover SVG markup for a book. Returns
 * { svg, backgroundHex, textHex } so callers can reuse the intentional
 * background/foreground pair (the pipeline still re-derives the "official"
 * spineColor/textColor from the rasterised pixels for consistency with real
 * covers, but these are what we deliberately painted).
 */
export function buildFallbackSvg({ id, title, author, publisher }) {
  const palette = paletteForId(id);
  const backgroundHex = palette.hex;
  const textHex = readableTextColor(hexToRgb(backgroundHex));

  const marginX = 88;
  const titleBoxWidth = WIDTH - marginX * 2;
  const titleBoxHeight = 520;

  const { lines: titleLines, fontSize: titleFontSize, lineHeight } = layoutTitle(title || "Sin título", {
    maxWidth: titleBoxWidth,
    maxHeight: titleBoxHeight,
    startFontSize: 60,
    minFontSize: 30,
  });

  const titleBlockHeight = titleLines.length * lineHeight;
  const titleStartY = HEIGHT / 2 - titleBlockHeight / 2 + lineHeight * 0.78;

  const titleTspans = titleLines
    .map((line, i) => `<tspan x="${WIDTH / 2}" y="${titleStartY + i * lineHeight}">${escapeXml(line)}</tspan>`)
    .join("");

  const authorText = author ? escapeXml(smallCapsSpacedText(author)) : "";
  const publisherText = publisher ? escapeXml(publisher.toUpperCase()) : "";

  const inset = 40;
  const ruleOpacity = 0.55;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="${backgroundHex}" />
  <rect x="${inset}" y="${inset}" width="${WIDTH - inset * 2}" height="${HEIGHT - inset * 2}"
        fill="none" stroke="${textHex}" stroke-opacity="${ruleOpacity}" stroke-width="2" />
  ${authorText ? `<text x="${WIDTH / 2}" y="290" text-anchor="middle" font-family="Georgia, 'Liberation Serif', 'DejaVu Serif', serif" font-size="24" letter-spacing="6" fill="${textHex}" fill-opacity="0.88">${authorText}</text>` : ""}
  <text text-anchor="middle" font-family="Georgia, 'Liberation Serif', 'DejaVu Serif', serif" font-weight="600" font-size="${titleFontSize}" fill="${textHex}">${titleTspans}</text>
  ${publisherText ? `<text x="${WIDTH / 2}" y="${HEIGHT - 78}" text-anchor="middle" font-family="Georgia, 'Liberation Serif', 'DejaVu Serif', serif" font-size="18" letter-spacing="3" fill="${textHex}" fill-opacity="0.75">${publisherText}</text>` : ""}
</svg>`;

  return { svg, backgroundHex, textHex };
}

export const FALLBACK_CANVAS = { width: WIDTH, height: HEIGHT };
