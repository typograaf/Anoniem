import { list, put } from '@vercel/blob'
import seed from '../content.seed.json'

export type ImageRef = string | { src: string; srcset?: string; sizes?: string }

export type Project = {
  id: string
  title: string
  year: string
  location: string
  /** Verbatim rich-text HTML, exactly as Webflow emitted it. */
  description: string
  /** Comma-separated tag list; the Webflow page script splits it into buttons. */
  services: string
  /** A bundled path resolves its srcset from media-manifest.json; an upload
   *  carries its own. */
  images: ImageRef[]
}

export type Service = {
  id: string
  title: string
  description: string
  image: ImageRef
}

export type Member = {
  id: string
  name: string
  role: string
  bio: string
  image: string
}

export type Site = {
  title: string
  metaDescription: string
  about: { heading: string; subheading: string }
  contact: {
    email: string
    emailLabel: string
    phone: string
    phoneHref: string
    instagram: string
    instagramLabel: string
    linkedin: string
    /** The "Contacteer ons" button on /aanbod points at a different mailbox
     *  than the footer does — as it does on the original site. */
    serviceButtonHref: string
  }
  office: { address: string[]; hours: string[] }
  newsletter: {
    heading: string
    body: string
    action: string
    success: string
    error: string
    placeholder: string
  }
  legal: {
    vat: string
    privacyLabel: string
    termsLabel: string
  }
  backgrounds: { about: string; services: string }
}

export type Content = {
  site: Site
  projects: Project[]
  services: Service[]
  team: Member[]
}

const BLOB_PATH = 'cms/content.json'

/** The bundled seed is the site exactly as it stood on Webflow. It is the
 *  fallback whenever the Blob store has nothing yet, so a fresh deploy — or a
 *  blob outage — still renders the real site rather than an empty shell. */
export const seedContent = seed as unknown as Content

let blobUrlCache: string | null = null

/** The public URL of the content blob. Looked up once per cold start rather
 *  than derived from the token, so it survives any change in URL shape. */
async function blobUrl(): Promise<string | null> {
  if (blobUrlCache) return blobUrlCache
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null
  try {
    const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 })
    const hit = blobs.find((b) => b.pathname === BLOB_PATH)
    if (!hit) return null
    blobUrlCache = hit.url
    return blobUrlCache
  } catch {
    return null
  }
}

export async function getContent(): Promise<Content> {
  try {
    const url = await blobUrl()
    if (!url) return seedContent
    // Cache-buster: the blob's public URL sits behind a CDN, and a save has
    // to be visible on the very next request.
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return seedContent
    const data = (await res.json()) as Content
    if (!data || !Array.isArray(data.projects)) return seedContent
    return data
  } catch {
    return seedContent
  }
}

export async function saveContent(content: Content): Promise<void> {
  const { url } = await put(BLOB_PATH, JSON.stringify(content, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  })
  blobUrlCache = url
}
