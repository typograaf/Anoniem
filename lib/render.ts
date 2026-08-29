import * as T from './templates'
import { seedContent, type Content, type ImageRef, type Member, type Project, type Service } from './content'

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

/** Attribute order matches Webflow's published markup exactly:
 *  src, loading, alt, sizes, srcset, class. */
function imgTag(image: ImageRef, loading: string, className: string): string {
  const ref = typeof image === 'string' ? { src: image } : image
  const parts = [`src="${esc(ref.src)}"`, `loading="${loading}"`, 'alt=""']
  if (ref.sizes) parts.push(`sizes="${esc(ref.sizes)}"`)
  if (ref.srcset) parts.push(`srcset="${esc(ref.srcset)}"`)
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

function slides(images: string[]): string {
  return images.map((src) => fill(T.itemSlide, { SRC: esc(src) })).join('')
}

function projectItem(p: Project): string {
  const slideHtml = slides(p.images)
  return fill(T.itemProject, {
    TITLE: esc(p.title),
    YEAR: esc(p.year),
    LOCATION: esc(p.location),
    DESCRIPTION: p.description,
    SERVICES: esc(p.services),
    SLIDES: slideHtml,
    // Webflow ships the first repeater item URL-encoded in an inert
    // <script type="text/x-wf-template">. Reproduced so the DOM matches.
    WF_TEMPLATE: encodeURIComponent(
      p.images.length ? fill(T.itemSlide, { SRC: esc(p.images[0]) }) : '',
    ),
  })
}

function serviceItem(s: Service, contactHref: string): string {
  return fill(T.itemService, {
    IMAGE: imgTag(s.image, 'lazy', 'image-4'),
    TITLE: esc(s.title),
    DESCRIPTION: s.description,
    CONTACT_HREF: esc(contactHref),
  })
}

function memberItem(m: Member): string {
  return fill(T.itemMember, {
    IMAGE: esc(m.image),
    NAME: esc(m.name),
    ROLE: esc(m.role),
    BIO: m.bio,
  })
}

/** The two full-bleed backgrounds live in the Webflow stylesheet. Overriding
 *  them from the head keeps the CSS untouched while still making them
 *  editable in /admin. */
function backgroundStyle(c: Content, which: 'about' | 'services'): string {
  const url = c.site?.backgrounds?.[which]
  // Unchanged from the original site: leave the stylesheet to it, so the page
  // stays byte-identical to what Webflow published.
  if (!url || url === seedContent.site.backgrounds[which]) return ''
  const selector = which === 'about' ? '.about_extendedimg' : '.service_extendedimg'
  return `<style>${selector}{background-image:url("${url}");}</style>`
}

export function renderHome(c: Content): string {
  return fill(T.home, {
    ...chrome(c),
    PROJECTS: c.projects.map(projectItem).join(''),
    HEAD_EXTRA: '',
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
    TEAM: c.team.map(memberItem).join(''),
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
