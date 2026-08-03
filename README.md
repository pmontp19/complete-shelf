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

  Each spine is set the way a printed one is: the author's surname at the head, the title across the
  middle, the imprint at the foot. The canvas carries the spine's real proportions, so a volume 0.06
  world units thick is drawn on a strip that narrow rather than on a fixed sheet stretched to fit —
  which is what used to squash every glyph to about a third of its width. Long titles come down in
  size rather than wrapping, and a title too long even for that gets a short form in the record
  (`spineTitle`).
- **View transitions between the catalogue and a record**, done by the browser across an ordinary
  navigation. Opening a translation lifts its cover and title out of the grid and sets them down on
  their own page; the header and footer hold still. This is `@view-transition` plus
  `view-transition-name` in
  [`src/styles/view-transitions.css`](src/styles/view-transitions.css) and costs no JavaScript at
  all — Astro's `<ClientRouter />` would have added ~5.5 kB gzipped to every page and made the shelf
  a client-side island to tear down and rebuild, for the same animation. The shelf page sits out:
  snapshotting a live WebGL canvas is the most expensive thing here, and the shelf cannot travel
  anyway. Browsers without the feature just navigate.
- **Five languages** — Catalan (default), Spanish, English, German and French — with localised URL
  segments (`/ca/traduccions/`, `/de/uebersetzungen/`, …), `hreflang` alternates on every page, and a
  language switcher that keeps you on the page you were reading.
- **A record per translation**: original title and author, publisher, year, ISBN, page count,
  co-translators, a synopsis in the reader's language, and the sources that verify the credit.
- **Progressive enhancement.** Without JavaScript, or without WebGL, the shelf is replaced by a
  complete cover grid. Nothing is only reachable through the 3D scene.
- **Findable, by a search engine and by an answer engine.** One linked `@graph` of structured data
  per page, `hreflang` alternates, a sitemap that declares every cover, and `/llms.txt` — the whole
  bibliography as plain text, for a reader that cannot see a WebGL shelf. See
  [Findability](#findability).

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
    │   ├── facts.ts        # figures derived from the bibliography, in one place
    │   ├── faq.ts          # the contact page's answers, with those figures in them
    │   └── profile.ts      # biography, timeline and links, in five languages
    ├── i18n/               # locales, localised routes, UI dictionaries
    ├── lib/
    │   ├── seo/schema.ts   # the JSON-LD graph every page carries
    │   └── shelf/          # the three.js shelf, dependency-free
    ├── styles/
    │   ├── global.css      # the design system
    │   └── view-transitions.css  # imported only by the pages that take part
    ├── components/
    ├── layouts/
    └── pages/
        ├── robots.txt.ts
        ├── sitemap.xml.ts
        ├── llms.txt.ts     # the site as an index, for answer engines
        └── llms-full.txt.ts  # …and as one plain-text document
```

## Running it

```bash
npm install
npm run dev        # http://localhost:4321/
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
5. The shelf's spine takes the title cut down to what a strip of type can carry: everything after the
   first sentence break goes, as long as what is left still names the book. Add `spineTitle` to the
   record where that rule can't win — a title that *is* one word, or one whose distinguishing half
   comes second (“Campus Drivers 2. Nòvio perfecte” → “Nòvio perfecte”). The author line is derived,
   never stored: surnames only, joined by · when a book has two.

Everything else — the catalogue, the filters, the shelf, the sitemap, the five language versions —
derives from that one record.

## Findability

The site has one job beyond looking like itself: when someone asks who translated a given novel into
Catalan — of a search engine, or of something that answers in prose — the answer should be here and
should be attributable. Everything below is generated from `books.json` and `profile.ts`, the same
records the visible pages render, so the machine-readable version cannot drift from the human one.

- **One `@graph` per page** ([`src/lib/seo/schema.ts`](src/lib/seo/schema.ts)), not a scattering of
  loose blocks. Every page carries the same `Person` and `WebSite` nodes under stable `@id`s, plus
  the page itself and its breadcrumb trail. A record page's `mainEntity` is the `Book`, with
  `translationOfWork` naming the original and `translator` pointing at that one `Person` `@id` — so
  "translated by" is a relation between two identified things rather than a coincidence of names.
  The catalogue is a `CollectionPage` holding an `ItemList` of all of them, the biography a
  `ProfilePage` with the research record attached as `ScholarlyArticle`, `Chapter`, `Report` and
  `Thesis` nodes she authors, the contact page a `ContactPage` that is also an `FAQPage`.
- **The `Person` node is the anchor.** ORCID as an `identifier` and `sameAs` links to the URV staff
  page, ORCID, Dialnet and X are what let an engine decide this Judith Raigal Aran is the one who
  wrote the thesis, and not a namesake. `worksFor`, `alumniOf`, `knowsLanguage`, `knowsAbout`,
  `address` and `workLocation` (Tarragona, Barcelona) say the rest. No birth date, no street address,
  no nationality: only what is already published about her professionally.
- **Six questions, answered twice.** The contact page's FAQ is rendered from
  [`src/data/faq.ts`](src/data/faq.ts) — once as prose a reader sees, once as `Question`/`Answer`
  nodes — and the counts and publishers inside the answers come from the bibliography, so they
  cannot go stale. `npm test` checks that every answer in the markup is also text on the page; markup
  that says something the page does not is worth less than none.
- **`hreflang` is language-only** (`ca`, `es`, `en`, `de`, `fr`, plus `x-default`), while `lang`
  stays regional. `hreflang="en-GB"` would have claimed the English version is *for the United
  Kingdom* and left a reader in Dublin or Chicago matching nothing but the Catalan default.
- **The sitemap** carries the full `xhtml:link` alternate set on all 130 URLs and an `image:image`
  for each of the 110 record pages, so a cover can be found on its own and lead back to the record.
  It has no `lastmod`: nothing here records when a record changed, and one build timestamp stamped
  onto every URL is a date about the deploy.
- **`robots.txt` names the answer engines** — GPTBot, ClaudeBot, PerplexityBot, Google-Extended and
  the rest — and allows every one of them. Two of those agents exist only as an opt-out, so saying
  yes explicitly is the only way to say it at all; it also means a future decision to shut one out is
  a visible edit rather than a silent default.
- **`/llms.txt` and `/llms-full.txt`.** The first is an index: what the site is, what is verifiable
  about it, and one line per record with its ISBN. The second is the whole thing as plain text —
  biography, all 22 records with their synopses, the research list. A retrieval step that has decided
  this site answers the question can quote it in one fetch instead of crawling 132 pages whose home
  page is a canvas.
- **Social cards** get explicit dimensions and alt text, and a record page uses its own jacket. A
  portrait cover in a wide card is cropped through the middle, so those pages ask for the small card
  instead of `summary_large_image`.
- **Core Web Vitals**: the record page preloads its cover, the catalogue's first row loads eagerly
  and the rest lazily, and `vercel.json` sets immutable caching on the hashed assets and a week on
  the covers. There are still no third-party requests and no webfonts.

`npm test` covers all of it as data rather than by eye: the head of each kind of page, the JSON-LD
graph on each (it has to parse, and its page URL has to agree with the canonical), the sitemap counts,
the `robots.txt` groups, and every ISBN in `llms.txt`.

## Deployment

Vercel, on every push. It runs `npm run build`, which runs `astro check` first, so a broken
translation key or a malformed book record fails the deploy rather than shipping. The covers are
committed under `public/`, so the build needs no network access.

`site` comes from `VERCEL_PROJECT_PRODUCTION_URL`, which Vercel injects into preview builds too —
a preview should not publish canonicals pointing at itself. There is no `base`: the site is served
from the root of its domain.

### The bare domain

Every page lives under a locale segment, so `/` is always a redirect. `vercel.json` answers it at
the edge, with no document in between: a 307 to `/es/`, `/en/`, `/de/` or `/fr/` when that is the
first language in the visitor's `Accept-Language`, and to `/ca/` for everyone else — crawlers
included, since they send no `Accept-Language` and `/ca/` is the `x-default` in every `hreflang` set
and in the sitemap.

Temporary rather than permanent on purpose: the answer varies by request header, and a 308 would be
cached by the browser for the wrong language. The trade is that `/` does not consolidate its weight
onto `/ca/` the way a permanent redirect would; the self-canonical and the `hreflang` set on `/ca/`
do that job instead.

The match is a regex on the header, so it reads the visitor's *first* language and cannot weigh
`q=` values: someone whose browser asks for Japanese first and German second gets Catalan, not
German. Widening that needs real parsing at the edge, which is a runtime this site does not have.

[`src/pages/index.astro`](src/pages/index.astro) is the fallback for anything serving the built
artifact without those rules — local `astro preview`, or a plain static host: an immediate
`<meta http-equiv="refresh">`, `noindex,follow`, an absolute canonical, the same negotiation done in
the client, and a plain list of the five locales for anyone who has neither the refresh nor
JavaScript. It only ships because `routing.redirectToDefaultLocale` is off — with it on, Astro
overwrites that page with a bare *two-second* refresh of its own, unstyled and with no negotiation,
which is what the root used to serve. `npm test` checks the root for exactly that regression.

### Publishing on her own domain

Add the domain in Vercel and `site` follows it, since Vercel injects it. To build for a domain from
anywhere else:

```bash
SITE_URL=https://judithraigal.com npm run build
```

Canonicals, `hreflang` alternates, the sitemap, `robots.txt` and every internal link and image path
follow automatically.

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
