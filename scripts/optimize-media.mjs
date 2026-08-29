/**
 * Rebuilds public/media as AVIF with a responsive ladder.
 *
 * Webflow left a lot of the newer photography as multi-megabyte JPEG and never
 * generated srcset for the project sliders, so the homepage shipped ~14 MB of
 * images. This produces one AVIF per width per image and writes a manifest the
 * content seed and the renderer use to emit srcset.
 *
 * Idempotent: re-running skips derivatives that already exist and are newer
 * than their source. `--force` rebuilds everything.
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const DIR = path.join(process.cwd(), 'public', 'media')
const MANIFEST = path.join(process.cwd(), 'media-manifest.json')

// Chosen against the measured render sizes: the sliders are 100vw, the service
// images 50vw, the team portraits cap at 402 CSS px.
const LADDER = [640, 1080, 1600, 2048]
const FULL_CAP = 2560
const QUALITY = 65
const EFFORT = 6

const force = process.argv.includes('--force')
const isVariant = (f) => /-p-\d+\.[a-z]+$/i.test(f)
const stemOf = (f) => f.replace(/\.[^.]+$/, '')

function newerThan(a, b) {
  try {
    return fs.statSync(a).mtimeMs >= fs.statSync(b).mtimeMs
  } catch {
    return false
  }
}

const sources = fs
  .readdirSync(DIR)
  .filter((f) => /\.(jpe?g|png|avif|webp)$/i.test(f) && !isVariant(f))
  .sort()

const manifest = {}
let before = 0
let after = 0

for (const file of sources) {
  const src = path.join(DIR, file)
  const stem = stemOf(file)
  const input = fs.readFileSync(src)
  const meta = await sharp(input).metadata()
  const srcW = meta.width ?? FULL_CAP
  before += input.length

  const fullW = Math.min(srcW, FULL_CAP)
  const fullName = `${stem}.avif`
  const fullPath = path.join(DIR, fullName)

  // An image Webflow already delivered as AVIF at a sane size is left alone —
  // re-encoding it would only shed quality. Anything larger than the cap, and
  // every JPEG/PNG, gets encoded. Note the `fullPath === src` case: an AVIF
  // being rewritten in place is always newer than itself, so the mtime check
  // would skip it.
  const alreadyAvif = path.extname(file).toLowerCase() === '.avif' && srcW <= FULL_CAP
  if (alreadyAvif) {
    if (fullPath !== src) fs.copyFileSync(src, fullPath)
  } else if (force || fullPath === src || !fs.existsSync(fullPath) || !newerThan(fullPath, src)) {
    const body = await sharp(input).rotate().resize({ width: fullW, withoutEnlargement: true })
      .avif({ quality: QUALITY, effort: EFFORT }).toBuffer()
    fs.writeFileSync(fullPath, body)
  }

  const entries = []
  for (const w of LADDER) {
    // Skip a width that is within 12% of the full render — not worth a file.
    if (w >= fullW * 0.88) continue
    const name = `${stem}-p-${w}.avif`
    const out = path.join(DIR, name)
    if (force || !fs.existsSync(out) || !newerThan(out, src)) {
      const body = await sharp(input).rotate().resize({ width: w, withoutEnlargement: true })
        .avif({ quality: QUALITY, effort: EFFORT }).toBuffer()
      fs.writeFileSync(out, body)
    }
    entries.push({ w, src: `/media/${name}` })
  }
  entries.push({ w: fullW, src: `/media/${fullName}` })

  for (const e of entries) after += fs.statSync(path.join(process.cwd(), 'public', e.src.slice(1).replace('media/', 'media/'))).size

  manifest[`/media/${file}`] = {
    src: `/media/${fullName}`,
    srcset: entries.map((e) => `${e.src} ${e.w}w`).join(', '),
    width: fullW,
    height: Math.round((meta.height ?? fullW) * (fullW / srcW)),
  }
  process.stdout.write('.')
}

// Sweep every file no longer referenced by the manifest.
const keep = new Set()
for (const m of Object.values(manifest)) {
  keep.add(path.basename(m.src))
  for (const part of m.srcset.split(',')) keep.add(path.basename(part.trim().split(' ')[0]))
}
let removed = 0
for (const f of fs.readdirSync(DIR)) {
  if (!keep.has(f)) {
    fs.unlinkSync(path.join(DIR, f))
    removed++
  }
}

fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2))
const total = fs.readdirSync(DIR).reduce((a, f) => a + fs.statSync(path.join(DIR, f)).size, 0)
console.log(`\n${sources.length} images -> ${fs.readdirSync(DIR).length} files, ${removed} stale removed`)
console.log(`sources were ${(before / 1024 / 1024).toFixed(2)} MB; media dir is now ${(total / 1024 / 1024).toFixed(2)} MB`)
