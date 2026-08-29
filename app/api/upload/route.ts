import { put } from '@vercel/blob'
import sharp from 'sharp'
import { isAuthed } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Same ladder Webflow generated for this site, so uploads slot into the
 *  existing srcset shape. The full-size render is capped at FULL_WIDTH. */
// Same ladder and quality as scripts/optimize-media.mjs, so an uploaded photo
// behaves exactly like the bundled ones.
const WIDTHS = [640, 1080, 1600, 2048]
const FULL_WIDTH = 2560
const QUALITY = 65
// AVIF encoding is the slow part and this runs inside a 60s function, so keep
// the search effort low and encode every width at once.
const EFFORT = 3

function slugify(name: string): string {
  const base = name.replace(/\.[^.]+$/, '')
  const slug = base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'afbeelding'
}

export async function POST(req: Request) {
  if (!(await isAuthed())) return new Response('Unauthorized', { status: 401 })

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return new Response('Geen bestand ontvangen', { status: 400 })

  const input = Buffer.from(await file.arrayBuffer())
  let meta: sharp.Metadata
  try {
    meta = await sharp(input).metadata()
  } catch {
    return new Response('Dit bestand is geen afbeelding', { status: 400 })
  }

  const sourceWidth = meta.width ?? FULL_WIDTH
  // A unique-enough prefix keeps two uploads of "IMG_1234.jpg" apart.
  const stem = `${Date.now().toString(36)}-${slugify(file.name)}`

  const fullWidth = Math.min(sourceWidth, FULL_WIDTH)

  // Decode and orient once; every width is encoded from that single bitmap.
  const oriented = await sharp(input).rotate().resize({ width: fullWidth, withoutEnlargement: true }).toBuffer()

  async function store(pathname: string, width: number | null) {
    const pipeline = sharp(oriented)
    if (width) pipeline.resize({ width, withoutEnlargement: true })
    const body = await pipeline.avif({ quality: QUALITY, effort: EFFORT }).toBuffer()
    return put(pathname, body, {
      access: 'public' as const,
      contentType: 'image/avif',
      addRandomSuffix: false,
      allowOverwrite: true,
    })
  }

  const widths = WIDTHS.filter((w) => w < fullWidth * 0.88)
  const [full, ...variants] = await Promise.all([
    store(`media/${stem}.avif`, null),
    ...widths.map((w) => store(`media/${stem}-p-${w}.avif`, w)),
  ])

  const srcsetParts = variants.map((v, i) => `${v.url} ${widths[i]}w`)
  srcsetParts.push(`${full.url} ${fullWidth}w`)

  return Response.json({
    src: full.url,
    srcset: srcsetParts.join(', '),
    // Left off deliberately: the renderer knows the slot each image sits in.
    width: fullWidth,
  })
}
