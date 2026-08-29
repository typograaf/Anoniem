# Anoniem

anoniem.be / anoniem.build — moved off Webflow, running on Vercel's free tier
with its own CMS.

## What this is

The pages are the **published Webflow markup, verbatim**. `templates/*.html`
holds the exact HTML Webflow served, with `{{SLOT}}` holes cut where content
goes; `public/css/anoniem.css` is Webflow's own stylesheet and `public/js/` its
own runtime (jQuery, the Webflow IX2 bundle, Swiper). Nothing was redrawn, so
every interaction, easing curve and breakpoint behaves exactly as it did.

Rendered output was diffed byte-for-byte against the live Webflow pages, and
screenshots at 1440×900 and 390×844 are pixel-identical.

## Layout

    templates/       verbatim Webflow markup with {{SLOT}} holes — source of truth
    scripts/         gen-templates.mjs bakes templates/ into lib/templates.ts
    lib/render.ts    fills the slots; nothing else touches the markup
    lib/content.ts   content types; reads/writes the CMS blob
    content.seed.json  the site exactly as it stood on Webflow — the fallback
    app/route.ts     GET /          → renderHome
    app/aanbod       GET /aanbod    → renderAanbod
    app/over-ons     GET /over-ons  → renderOverOns
    app/admin        the CMS
    public/media     every image, pulled off the Webflow CDN

Editing `templates/*.html` is the equivalent of opening the Webflow designer;
run `npm run templates` (or just `npm run build`, which does it) afterwards.

## CMS

`/admin`, password in `SITE_PASSWORD`. It edits projects, services, team, the
Over Ons headings and the footer/contact block. Saving writes one JSON file to
Vercel Blob and the change is live immediately — pages are rendered per request
and never cached.

Uploaded photos are converted to AVIF at 500/800/1080/1600 plus a full-size
render capped at 2560px, matching the ladder Webflow generated.

If the blob is ever empty or unreachable, the pages fall back to
`content.seed.json`, so the site cannot render blank.

## Running it

    npm install
    npm run dev

`vercel env pull .env.local` for `SITE_PASSWORD` and `BLOB_READ_WRITE_TOKEN`.

## Costs

Vercel Hobby, Vercel Blob free tier. No paid service anywhere.

## Performance

The Webflow original shipped **15.7 MB** on the homepage: all forty project
photographs eager and full-size, several still multi-megabyte JPEG, no srcset on
the sliders, a 1 MB TTF on every page, and Webflow's Turnstile widget pulling
84 KB from Cloudflare to guard a form that posts straight to Mailchimp.

On the wire now, first visit, nothing cached:

| | before | after |
|---|---|---|
| `/` | 15.75 MB | **912 KB** |
| `/aanbod` | 3.38 MB | **840 KB** |
| `/over-ons` | 2.96 MB | **~800 KB** |

TTFB 24 ms, FCP 275 ms, LCP 284-324 ms (median of three, 1440x900).

What did it:

| | |
|---|---|
| `scripts/optimize-media.mjs` | every image to AVIF q65 with a 640/1080/1600/2048 ladder, capped at 2560 |
| `lib/render.ts` | srcset and `sizes` taken from the real measured render widths; only the first project loads eagerly |
| `templates/home.html` | each slider is built as it is approached, not all eighteen at load — Swiper's `loop` clones slides on construction, which was defeating the lazy loading |
| `<head>` | preloads the font and the LCP slide, carrying the same srcset the `<img>` does |
| `scripts/build-fonts.py` | HelveticaNowVar 1000 KB -> 231 KB |
| `public/css/anoniem.css` | the two full-viewport backgrounds get a media-query ladder |
| templates | Webflow's `data-turnstile-sitekey` dropped |

Verified by screenshotting both versions at 1440x900 and 390x844 and diffing:
**every text and chrome region is pixel-identical**, and the photographs come
out marginally sharper because a higher-resolution variant now gets picked.

Three things deliberately not done:

* **Glyph subsetting.** Saves 29 KB and moves 3.2% of the pixels in a block of
  body text. See `scripts/build-fonts.py`.
* **Caching the HTML at the edge.** Tried and reverted: neither `revalidateTag`
  nor `revalidatePath` reliably purged the route cache. Rendering per request
  costs 24 ms and keeps publishing as quick as the storage allows.
* **Deferring the scripts.** They already sit at the end of `<body>` and come
  to 130 KB compressed, so `defer` would buy nothing while forcing the three
  inline Webflow scripts out into files.

### Publishing latency

Vercel Blob is eventually consistent, so a save in /admin takes roughly ten
seconds to be readable everywhere — not a caching bug, and not something a
cache-buster fixes. /admin says so after saving. Webflow's own publish was
slower.

### Scrolling

Three things were making sections appear black and pop in:

1. **The slider collapsed to zero width while its photograph loaded.** Swiper's
   own stylesheet gives `.swiper` auto side margins, so as a flex item in the
   column-flex section it shrink-wraps to its content — and with
   `slidesPerView: "auto"` the slide is `width: 100%` of a wrapper sized from
   the slides, which is circular and resolves to nothing until an image gives
   it an intrinsic size. `.swiper.is-slider-main { width: 100% }` breaks it.
   This was the real cause; it just looked like a slow image.
2. **`loading="lazy"` reaches about one and a half screens out**, which is not
   enough for full-viewport scroll-snap sections. `public/js/image-warmup.js`
   warms them further ahead, in two tiers: the slide you will land on four
   screens out, the rest of that section's slides one screen out. Only one
   slide per section is ever on screen, so fetching all fifteen of a section's
   photographs would just delay the next section's first one.
3. **Nothing ran behind an image that had not arrived.** Each photograph's own
   average tone is stored in `media-manifest.json` and set as the `<img>`
   background, so a slow connection resolves out of the picture's own mid-grey
   rather than a black hole. The `grayscale()` filter on the element applies to
   the background too, so it greys out with the photograph. Only on images that
   cover their box — never the contained team portraits, where it would show as
   a border.

The warm-up does not start until the load event, so first paint is untouched:
the work page still loads 989 KB and fills in from there. Measured landing on
seventeen sections in a row, no image cached: 0 blank at 10 Mbps and while
flicking, 1 at 4 Mbps, and on a 1.6 Mbps link the sections that cannot keep up
now show the grey rather than black.
