import * as T from './templates'
import manifest from '../media-manifest.json'
import { seedContent, type Content, type ImageRef, type Member, type Project, type Service } from './content'

type ManifestEntry = { src: string; srcset: string; width: number; height: number; tone?: string }
const MEDIA = manifest as Record<string, ManifestEntry>

/** Every bundled image has a responsive AVIF ladder built by
 *  scripts/optimize-media.mjs. Images uploaded through /admin carry their own
 *  srcset, so both shapes resolve the same way here. */
function resolve(image: ImageRef): { src: string; srcset?: string; sizes?: string; tone?: string } {
  const src = typeof image === 'string' ? image : image?.src
  if (!src) return { src: '' }
  const hit =
    MEDIA[src] ??
    // Content saved before the media was converted still names the JPEG, and
    // may carry Webflow's old variant list — the manifest wins for anything
    // bundled, so those stale URLs never reach the page.
    MEDIA[src.replace(/\.[^./]+$/, '.avif')] ??
    Object.values(MEDIA).find((m) => m.src === src)
  if (hit) return { src: hit.src, srcset: hit.srcset, tone: hit.tone }
  return typeof image === 'string' ? { src: image } : image
}

/** Measured against the real layout at 390 / 768 / 1440 / 1920 / 2560:
 *  sliders fill the viewport, service photos are half of it above 480px, and
 *  team portraits stop growing at 402px. */
const SIZES = {
  slide: '100vw',
  service: '(max-width: 479px) 100vw, 50vw',
  member: '(max-width: 767px) 78vw, (max-width: 991px) 42vw, 402px',
}

/** Escape a plain-text field before it lands in markup. Rich-text fields are
 *  stored as HTML and deliberately pass through untouched. */
function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (m, key: string) =>
    key in values ? values[key] : m,
  )
}

/** Attribute order matches Webflow's published markup: src, loading, alt,
 *  sizes, srcset, class — with height and fetchpriority slotted in where
 *  Webflow put them. */
function imgTag(
  image: ImageRef,
  { loading, className, sizes, height, priority, tone }: {
    loading: 'eager' | 'lazy'
    className: string
    sizes: string
    height?: string
    priority?: boolean
    /** Paint the photograph's own average tone behind it while it loads. Only
     *  for images that cover their box, never for the contained portraits,
     *  where it would show as a border. The grayscale filter on the element
     *  applies to the background too, so this greys out with the photograph. */
    tone?: boolean
  },
): string {
  const ref = resolve(image)
  const parts = [`src="${esc(ref.src)}"`, `loading="${loading}"`, 'alt=""']
  if (tone && ref.tone) parts.push(`style="background-color:${esc(ref.tone)}"`)
  if (height) parts.push(`height="${height}"`)
  const s = ref.sizes ?? (ref.srcset ? sizes : undefined)
  if (s) parts.push(`sizes="${esc(s)}"`)
  if (ref.srcset) parts.push(`srcset="${esc(ref.srcset)}"`)
  // Tells the browser this is the LCP candidate before layout happens.
  if (priority) parts.push('fetchpriority="high"')
  parts.push(`class="${className}"`)
  return `<img ${parts.join(' ')}/>`
}

/** Webflow separates the footer address lines with U+2028; kept verbatim. */
const LINE_SEP = '<br/>\u2028'

/** Values for the static chrome — footer, contact block, newsletter — that is
 *  identical on every page. */
function chrome(c: Content): Record<string, string> {
  const { contact, office, newsletter, legal } = c.site
  return {
    EMAIL_HREF: esc(`mailto:${contact.email}`),
    EMAIL_LABEL: esc(contact.emailLabel),
    PHONE: esc(contact.phone),
    PHONE_HREF: esc(contact.phoneHref),
    INSTAGRAM_HREF: esc(contact.instagram),
    INSTAGRAM_LABEL: esc(contact.instagramLabel),
    LINKEDIN_HREF: esc(contact.linkedin),
    ADDRESS: office.address.map(esc).join(LINE_SEP),
    HOURS: office.hours.map(esc).join(LINE_SEP),
    NEWSLETTER_HEADING: esc(newsletter.heading),
    NEWSLETTER_BODY: esc(newsletter.body),
    NEWSLETTER_ACTION: esc(newsletter.action),
    NEWSLETTER_PLACEHOLDER: esc(newsletter.placeholder),
    NEWSLETTER_SUCCESS: esc(newsletter.success),
    NEWSLETTER_ERROR: esc(newsletter.error),
    VAT: esc(legal.vat),
    PRIVACY_LABEL: esc(legal.privacyLabel),
    TERMS_LABEL: esc(legal.termsLabel),
  }
}

const BULLET_PARTS = ['lefttop', 'righttop', 'leftbottom', 'rightbottom']
  .map((corner) => `<div class="pagination_bullet_part ${corner}"></div>`)
  .join('')

/** Webflow's markup carries three of these regardless of how many photographs
 *  a project has; Swiper re-renders them on init. Since the sliders are built
 *  as they are approached rather than all at load, emitting the real count
 *  means the pagination is right even in the moment before that happens. */
function bullets(count: number): string {
  return Array.from(
    { length: Math.max(count, 1) },
    (_, i) => `<div class="swiper-bullet${i === 0 ? ' is-active' : ''}">${BULLET_PARTS}</div>`,
  ).join('')
}

/** Only the project on screen at load needs its photographs; the rest are a
 *  full viewport apart, so the browser fetches them as they are scrolled to.
 *  This is what takes the homepage from ~14 MB of images to well under one. */
function slides(images: ImageRef[], eager: boolean): string {
  return images
    .map((image, i) =>
      fill(T.itemSlide, {
        IMG: imgTag(image, {
          loading: eager ? 'eager' : 'lazy',
          className: 'image-3',
          sizes: SIZES.slide,
          height: 'Auto',
          priority: eager && i === 0,
          tone: true,
        }),
      }),
    )
    .join('')
}

function projectItem(p: Project, first: boolean): string {
  const slideHtml = slides(p.images, first)
  return fill(T.itemProject, {
    BULLETS: bullets(p.images.length),
    TITLE: esc(p.title),
    YEAR: esc(p.year),
    LOCATION: esc(p.location),
    DESCRIPTION: p.description,
    SERVICES: esc(p.services),
    SLIDES: slideHtml,
    // Webflow ships the first repeater item URL-encoded in an inert
    // <script type="text/x-wf-template">. Reproduced so the DOM matches.
    WF_TEMPLATE: encodeURIComponent(p.images.length ? slideHtml.split('</div>')[0] + '</div>' : ''),
  })
}

function serviceItem(s: Service, contactHref: string): string {
  return fill(T.itemService, {
    IMAGE: imgTag(s.image, { loading: 'lazy', className: 'image-4', sizes: SIZES.service, tone: true }),
    TITLE: esc(s.title),
    DESCRIPTION: s.description,
    CONTACT_HREF: esc(contactHref),
  })
}

function memberItem(m: Member, first: boolean): string {
  return fill(T.itemMember, {
    IMAGE: imgTag(m.image, {
      loading: first ? 'eager' : 'lazy',
      className: 'image-6',
      sizes: SIZES.member,
      priority: first,
    }),
    NAME: esc(m.name),
    ROLE: esc(m.role),
    BIO: m.bio,
  })
}

/** The two full-bleed backgrounds live in the stylesheet, which already
 *  carries their responsive ladder. Only a background changed in /admin needs
 *  overriding here — and it gets the same ladder treatment. */
function backgroundStyle(c: Content, which: 'about' | 'services'): string {
  const url = c.site?.backgrounds?.[which]
  if (!url || url === seedContent.site.backgrounds[which]) return ''
  const selector = which === 'about' ? '.about_extendedimg' : '.service_extendedimg'
  const ref = resolve(url)

  // Width -> url, from whichever srcset the image carries.
  const steps = new Map<number, string>()
  for (const part of (ref.srcset ?? '').split(',')) {
    const [u, w] = part.trim().split(/\s+/)
    if (u && w?.endsWith('w')) steps.set(Number(w.slice(0, -1)), u)
  }
  if (!steps.size) return `<style>${selector}{background-image:url("${url}")}</style>`

  const widths = [...steps.keys()].sort((a, b) => a - b)
  const at = (want: number) => steps.get(widths.find((w) => w >= want) ?? widths[widths.length - 1])!

  return (
    `<style>${selector}{background-image:url("${at(1080)}")}` +
    [[700, 1600], [1200, 2048], [1700, 4000]]
      .map(([mq, want]) => `@media (min-width:${mq}px){${selector}{background-image:url("${at(want)}")}}`)
      .join('') +
    '</style>'
  )
}

/** The first slide is the largest-contentful paint on the homepage. Preloading
 *  it — with the same srcset the <img> carries, so the browser picks the same
 *  file — starts the fetch before the markup for it has even been parsed. */
function lcpPreload(c: Content): string {
  const first = c.projects[0]?.images?.[0]
  if (!first) return ''
  const ref = resolve(first)
  const srcset = ref.srcset ? ` imagesrcset="${esc(ref.srcset)}" imagesizes="${SIZES.slide}"` : ''
  return `<link rel="preload" href="${esc(ref.src)}" as="image" type="image/avif"${srcset} fetchpriority="high"/>`
}

export function renderHome(c: Content): string {
  return fill(T.home, {
    ...chrome(c),
    PROJECTS: c.projects.map((p, i) => projectItem(p, i === 0)).join(''),
    HEAD_EXTRA: lcpPreload(c),
  })
}

export function renderAanbod(c: Content): string {
  return fill(T.aanbod, {
    ...chrome(c),
    SERVICES: c.services
      .map((s) => serviceItem(s, c.site.contact.serviceButtonHref))
      .join(''),
    HEAD_EXTRA: backgroundStyle(c, 'services'),
  })
}

export function renderOverOns(c: Content): string {
  return fill(T.overOns, {
    ...chrome(c),
    TEAM: c.team.map((m, i) => memberItem(m, i === 0)).join(''),
    ABOUT_HEADING: c.site.about.heading,
    ABOUT_SUBHEADING: c.site.about.subheading,
    HEAD_EXTRA: backgroundStyle(c, 'about'),
  })
}

/** Webflow only ever served its own generic system 404, which carries Webflow
 *  branding. This one is the site's own chrome — same nav, heading block and
 *  footer — with the message in its place. */
export function renderNotFound(c: Content): string {
  return fill(T.notFound, {
    ...chrome(c),
    ABOUT_HEADING: '404.',
    ABOUT_SUBHEADING: 'Deze pagina bestaat niet, of bestaat niet meer.',
    HEAD_EXTRA: backgroundStyle(c, 'about'),
  })
}

export function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Content is editable in /admin and must appear the moment it is saved.
      'cache-control': 'no-store',
    },
  })
}
