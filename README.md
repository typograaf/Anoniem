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

The Webflow original shipped ~15.7 MB on the homepage: every one of the 40
project photographs eager, several still multi-megabyte JPEG, no srcset on the
sliders, a 1 MB TTF on every page, and Webflow's Turnstile widget pulling 84 KB
from Cloudflare for a form that posts straight to Mailchimp.

What changed, and what it is worth:

| | |
|---|---|
| `scripts/optimize-media.mjs` | every image to AVIF q65 with a 640/1080/1600/2048 ladder, capped at 2560 |
| `lib/render.ts` | srcset + measured `sizes`; only the first project loads eagerly, the rest lazily |
| `<head>` | preloads the font and the LCP slide, with the same srcset the `<img>` carries |
| `scripts/build-fonts.py` | HelveticaNowVar 1000 KB -> 231 KB |
| `public/css/anoniem.css` | the two full-viewport backgrounds get a media-query ladder |
| templates | Webflow's `data-turnstile-sitekey` dropped |

Verified by screenshotting both versions at 1440x900 and 390x844 and diffing:
**every text and chrome region is pixel-identical**, and the photographs come
out marginally sharper because a higher-resolution variant now gets picked.

Two things deliberately left alone:

* **Glyph subsetting.** A Latin subset saves another 28 KB but moves 3.2% of
  the pixels in a block of body text. Pinning the unused `wdth` axis is free;
  subsetting is not. See `scripts/build-fonts.py`.
* **Caching the HTML at the edge.** Tried, and reverted: neither
  `revalidateTag` nor `revalidatePath` reliably purged the route cache, so a
  save did not reach the page. Rendering per request costs ~30 ms warm and
  keeps publishing immediate, which matters more.
