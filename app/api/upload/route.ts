import { put } from '@vercel/blob'
import sharp from 'sharp'
import { isAuthed } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Same ladder Webflow generated for this site, so uploads slot into the
 *  existing srcset shape. The full-size render is capped at FULL_WIDTH. */
const WIDTHS = [500, 800, 1080, 1600]
const FULL_WIDTH = 2560
const QUALITY = 62

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

  async function encode(width: number | null): Promise<Buffer> {
    const pipeline = sharp(input).rotate()
    if (width) pipeline.resize({ width, withoutEnlargement: true })
    return pipeline.avif({ quality: QUALITY }).toBuffer()
  }

  const fullWidth = Math.min(sourceWidth, FULL_WIDTH)
  const full = await put(`media/${stem}.avif`, await encode(fullWidth), {
    access: 'public',
    contentType: 'image/avif',
    addRandomSuffix: false,
    allowOverwrite: true,
  })

  const srcsetParts: string[] = []
  for (const w of WIDTHS) {
    if (w >= fullWidth) continue
    const variant = await put(`media/${stem}-p-${w}.avif`, await encode(w), {
      access: 'public',
      contentType: 'image/avif',
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    srcsetParts.push(`${variant.url} ${w}w`)
  }
  srcsetParts.push(`${full.url} ${fullWidth}w`)

  return Response.json({
    src: full.url,
    srcset: srcsetParts.join(', '),
    sizes: '(max-width: 479px) 100vw, 50vw',
    width: fullWidth,
  })
}
