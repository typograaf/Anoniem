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
