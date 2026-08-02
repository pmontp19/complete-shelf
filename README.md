# Judith Raigal Aran — literary translator

The personal site of [Judith Raigal Aran](https://www.deaa.urv.cat/ca/departament/staff/raigal/), a
Catalan literary translator working from English, German and French into Catalan and Spanish. The
home page is an interactive 3D shelf holding every book she has translated, each volume carrying its
real published cover.

Built with [Astro](https://astro.build/) and [three.js](https://threejs.org/). Static output, five
languages, no backend and no third-party requests at runtime.

## What is here

- **A WebGL shelf** of 22 hardcovers on the home page, full-bleed and looping: the run has no ends,
  so it always reads as continuing past both edges of the frame. Drag it, flick it (the carriage
  carries on and settles onto a volume), swipe sideways on a trackpad, use the arrow keys, the two
  steppers, or click a spine to bring it to the centre. Hovering a spine tips it out of the run. The
  centred volume turns to face you and the whole page — the wash behind the stage, the lighting in
  the scene, the caption's rule and button — tints to its cover palette. Clicking it opens the
  book's record. There is no page-turning: this is a bibliography, not a reader.

  Vertical scrolling always belongs to the page. A looping shelf has no end to escape past, so
  swallowing the wheel would strand the reader on it.
- **Five languages** — Catalan (default), Spanish, English, German and French — with localised URL
  segments (`/ca/traduccions/`, `/de/uebersetzungen/`, …), `hreflang` alternates on every page, and a
  language switcher that keeps you on the page you were reading.
- **A record per translation**: original title and author, publisher, year, ISBN, page count,
  co-translators, a synopsis in the reader's language, and the sources that verify the credit.
- **Progressive enhancement.** Without JavaScript, or without WebGL, the shelf is replaced by a
  complete cover grid. Nothing is only reachable through the 3D scene.

## Project structure

```text
├── astro.config.mjs        # locales, base path, static output
├── scripts/                # asset pipeline (see scripts/README.md)
│   ├── build-covers-input.mjs
│   ├── fetch-covers.mjs    # download + resize covers, extract palettes
│   ├── merge-synopses.mjs
│   └── build-og.mjs        # social preview card
├── public/covers/          # committed .webp covers (800px + 320px thumb)
└── src/
    ├── data/
    │   ├── books.json      # the bibliography — the single source of truth
    │   ├── cover-sources.json
    │   ├── cover-meta.json # generated: per-cover palette
    │   ├── books.ts        # typed loader, sorting, helpers
    │   └── profile.ts      # biography, timeline and links, in five languages
    ├── i18n/               # locales, localised routes, UI dictionaries
    ├── lib/shelf/          # the three.js shelf, dependency-free
    ├── components/
    ├── layouts/
    └── pages/
```

## Running it

```bash
npm install
npm run dev        # http://localhost:4321/complete-shelf/
npm run build      # type-checks, then writes dist/
npm run preview
npm test           # drives the built site in Chromium (needs `npm run preview` running)
```

Needs Node 22.12 or newer — Astro 6 dropped Node 18 and 20.

`npm run build` runs `astro check` first, so a broken translation key or a malformed book record
fails the build rather than shipping.

On Astro 7 `astro dev` starts a managed background daemon rather than holding the terminal;
`npm run astro dev stop`, `… dev status` and `… dev logs` control it.

## Adding or editing a translation

1. Add the record to `src/data/books.json`. `id` becomes the URL slug; `sources` should hold the
   publisher or retailer pages that name her as translator.
2. If you have the publisher's cover URL, add it to `src/data/cover-sources.json` under the same id.
3. Run `npm run assets`. This downloads the cover, writes `public/covers/<id>.webp` and a thumbnail,
   extracts a spine colour and a readable foreground into `src/data/cover-meta.json`, and regenerates
   the social card. Books without a resolvable cover get a typographic one generated for them, so
   the shelf never has a hole in it.
4. Synopses live in the record's `synopsis` object, keyed by locale. Missing locales fall back
   through Catalan → Spanish → English rather than rendering empty.

Everything else — the catalogue, the filters, the shelf, the sitemap, the five language versions —
derives from that one record.

## Deployment

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`. The
covers are committed, so the build needs no network access.

### Vercel

Detected automatically. Vercel serves the build at the domain root, so the
GitHub Pages sub-path is dropped there (`base: '/'`) and `site` is taken from
`VERCEL_PROJECT_PRODUCTION_URL`. Nothing to configure; `vercel.json` just pins
the framework preset, the output directory and trailing slashes.

Without this the site 404s on Vercel: every asset and link would be requested
under `/complete-shelf/`, which only exists on GitHub Pages.

### Publishing on her own domain

`site` and `base` are read from the environment, so moving to `judithraigal.com` needs no source
change:

```bash
SITE_URL=https://judithraigal.com SITE_BASE=/ npm run build
```

Canonicals, `hreflang` alternates, the sitemap, `robots.txt` and every internal link and image path
follow automatically. To make it the default, set those two variables in the workflow's `build` step
and add a `public/CNAME` file containing the bare domain.

## About the data

The bibliography was compiled from the publisher's own catalogue (grup62.cat, for the Columna and
Edicions 62 imprints) and cross-checked against todostuslibros (CEGAL), Open Library and the
Catalan public library catalogue. Every title carries two sources: the publisher's record, which
names her in its `Traductora` field, and the todostuslibros record for the same ISBN. Both were
re-checked in August 2026, and each of the 22 credits was confirmed on the publisher's page.
Retailer links were dropped in favour of those two — product pages churn, catalogue records do not.

The research list is kept in step with her [ORCID record](https://orcid.org/0000-0002-0387-0867)
and her Dialnet author records, which between them cover the journal articles, book chapters,
reports and the thesis.

Cover images are reproduced from the publishers' own artwork and are shown for bibliographic
identification only; they remain the property of the respective publishers.
