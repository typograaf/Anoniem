'use client'

import { useCallback, useMemo, useState } from 'react'
import type { Content, ImageRef, Member, Project, Service } from '@/lib/content'
import { htmlToText, textToHtml } from '@/lib/richtext'

type Tab = 'werk' | 'aanbod' | 'over-ons' | 'site'

const TABS: { id: Tab; label: string }[] = [
  { id: 'werk', label: 'Werk' },
  { id: 'aanbod', label: 'Aanbod' },
  { id: 'over-ons', label: 'Over Ons' },
  { id: 'site', label: 'Site' },
]

function srcOf(image: ImageRef): string {
  return typeof image === 'string' ? image : image?.src ?? ''
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list
  const next = list.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** Phone photographs run to 12 megapixels; decoding one of those on a Hobby
 *  function is most of the upload's time budget. Downscaling here means the
 *  server only ever sees something already close to its output size. */
const MAX_UPLOAD_EDGE = 2560

async function downscale(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_UPLOAD_EDGE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 4_000_000) {
      bitmap.close()
      return file
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.94))
    return blob && blob.size < file.size ? blob : file
  } catch {
    // No createImageBitmap, an unsupported format, a HEIC the canvas cannot
    // read — let the server deal with the original.
    return file
  }
}

async function uploadImage(file: File): Promise<ImageRef> {
  const body = new FormData()
  body.append('file', await downscale(file), file.name)
  const res = await fetch('/api/upload', { method: 'POST', body })
  if (!res.ok) throw new Error(await res.text())
  const data = (await res.json()) as { src: string; srcset?: string }
  // sizes is decided by the slot the image sits in, not by the upload.
  return data.srcset ? { src: data.src, srcset: data.srcset } : { src: data.src }
}

function Field({
  label,
  value,
  onChange,
  textarea,
  rows,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  textarea?: boolean
  rows?: number
  hint?: string
}) {
  return (
    <label className="field">
      <span className="field__label">
        {label}
        {hint ? <em className="field__hint">{hint}</em> : null}
      </span>
      {textarea ? (
        <textarea
          className="field__input field__input--area"
          rows={rows ?? 5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input className="field__input" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  )
}

function ImagePicker({
  image,
  onChange,
  onBusy,
}: {
  image: ImageRef
  onChange: (v: ImageRef) => void
  onBusy: (busy: boolean) => void
}) {
  const [error, setError] = useState('')
  return (
    <div className="picker">
      {srcOf(image) ? <img className="picker__preview" src={srcOf(image)} alt="" /> : <div className="picker__empty">Geen afbeelding</div>}
      <label className="button button--ghost">
        Vervangen
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            setError('')
            onBusy(true)
            try {
              onChange(await uploadImage(file))
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Uploaden mislukt')
            } finally {
              onBusy(false)
            }
          }}
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
    </div>
  )
}

function Gallery({
  images,
  onChange,
  onBusy,
}: {
  images: ImageRef[]
  onChange: (v: ImageRef[]) => void
  onBusy: (busy: boolean) => void
}) {
  const [error, setError] = useState('')
  return (
    <div className="gallery">
      <div className="gallery__grid">
        {images.map((image, i) => (
          <figure className="gallery__item" key={`${srcOf(image)}-${i}`}>
            <img className="gallery__img" src={srcOf(image)} alt="" />
            <figcaption className="gallery__tools">
              <button type="button" className="chip" onClick={() => onChange(move(images, i, i - 1))} disabled={i === 0}>
                ←
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => onChange(move(images, i, i + 1))}
                disabled={i === images.length - 1}
              >
                →
              </button>
              <button
                type="button"
                className="chip chip--danger"
                onClick={() => onChange(images.filter((_, j) => j !== i))}
              >
                Verwijderen
              </button>
            </figcaption>
          </figure>
        ))}
      </div>
      <label className="button button--ghost">
        Foto’s toevoegen
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            if (!files.length) return
            setError('')
            onBusy(true)
            try {
              const uploaded: ImageRef[] = []
              for (const file of files) uploaded.push(await uploadImage(file))
              onChange([...images, ...uploaded])
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Uploaden mislukt')
            } finally {
              onBusy(false)
            }
          }}
        />
      </label>
      {error ? <p className="error">{error}</p> : null}
    </div>
  )
}

export default function Editor({ initial }: { initial: Content }) {
  const [content, setContent] = useState<Content>(initial)
  const [tab, setTab] = useState<Tab>('werk')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)

  const update = useCallback((fn: (draft: Content) => Content) => {
    setContent((prev) => fn(structuredClone(prev)))
    setDirty(true)
    setStatus('idle')
  }, [])

  const save = useCallback(async () => {
    setStatus('saving')
    setMessage('')
    try {
      const res = await fetch('/api/content', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(content),
      })
      if (!res.ok) throw new Error(await res.text())
      setStatus('saved')
      setDirty(false)
      // Vercel Blob is eventually consistent: the save is stored at once but
      // takes a few seconds to be readable everywhere.
      setMessage('Opgeslagen. Binnen ongeveer tien seconden zichtbaar op de site.')
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Opslaan mislukt')
    }
  }, [content])

  const setProjects = (projects: Project[]) => update((d) => ({ ...d, projects }))
  const setServices = (services: Service[]) => update((d) => ({ ...d, services }))
  const setTeam = (team: Member[]) => update((d) => ({ ...d, team }))

  const label = useMemo(
    () => ({ idle: dirty ? 'Publiceren' : 'Opgeslagen', saving: 'Bezig…', saved: 'Gepubliceerd', error: 'Opnieuw proberen' })[status],
    [status, dirty],
  )

  return (
    <div className="admin">
      <header className="bar">
        <span className="bar__brand">Anoniem</span>
        <nav className="bar__tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`bar__tab${tab === t.id ? ' is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="bar__actions">
          <a className="button button--ghost" href="/" target="_blank" rel="noreferrer">
            Site bekijken
          </a>
          <button type="button" className="button" onClick={save} disabled={busy || status === 'saving'}>
            {label}
          </button>
          <form action="/api/logout" method="post">
            <button type="submit" className="button button--ghost">
              Afmelden
            </button>
          </form>
        </div>
      </header>

      {message ? (
        <p className={`banner${status === 'error' ? ' banner--error' : ''}`}>{message}</p>
      ) : null}
      {busy ? <p className="banner">Afbeelding wordt verwerkt…</p> : null}

      <main className="page">
        {tab === 'werk' && (
          <section>
            <div className="section__head">
              <h2 className="section__title">Projecten</h2>
              <button
                type="button"
                className="button"
                onClick={() =>
                  setProjects([
                    {
                      id: `project-${Date.now().toString(36)}`,
                      title: 'Nieuw project',
                      year: String(new Date().getFullYear()),
                      location: '',
                      description: '',
                      services: '',
                      images: [],
                    },
                    ...content.projects,
                  ])
                }
              >
                Project toevoegen
              </button>
            </div>
            {content.projects.map((p, i) => (
              <article className="card" key={p.id}>
                <div className="card__head">
                  <h3 className="card__title">{p.title || 'Zonder titel'}</h3>
                  <div className="card__tools">
                    <button type="button" className="chip" onClick={() => setProjects(move(content.projects, i, i - 1))} disabled={i === 0}>
                      ↑
                    </button>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => setProjects(move(content.projects, i, i + 1))}
                      disabled={i === content.projects.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="chip chip--danger"
                      onClick={() => {
                        if (confirm(`“${p.title}” verwijderen?`)) setProjects(content.projects.filter((_, j) => j !== i))
                      }}
                    >
                      Verwijderen
                    </button>
                  </div>
                </div>
                <div className="grid grid--3">
                  <Field label="Titel" value={p.title} onChange={(v) => setProjects(content.projects.map((x, j) => (j === i ? { ...x, title: v, id: x.id || slugify(v) } : x)))} />
                  <Field label="Jaar" value={p.year} onChange={(v) => setProjects(content.projects.map((x, j) => (j === i ? { ...x, year: v } : x)))} />
                  <Field label="Plaats" value={p.location} onChange={(v) => setProjects(content.projects.map((x, j) => (j === i ? { ...x, location: v } : x)))} />
                </div>
                <Field
                  label="Omschrijving"
                  textarea
                  value={htmlToText(p.description)}
                  onChange={(v) => setProjects(content.projects.map((x, j) => (j === i ? { ...x, description: textToHtml(v) } : x)))}
                />
                <Field
                  label="Diensten"
                  hint="gescheiden door komma’s"
                  value={p.services}
                  onChange={(v) => setProjects(content.projects.map((x, j) => (j === i ? { ...x, services: v } : x)))}
                />
                <Gallery
                  images={p.images}
                  onBusy={setBusy}
                  onChange={(images) => setProjects(content.projects.map((x, j) => (j === i ? { ...x, images } : x)))}
                />
              </article>
            ))}
          </section>
        )}

        {tab === 'aanbod' && (
          <section>
            <h2 className="section__title">Diensten</h2>
            {content.services.map((s, i) => (
              <article className="card" key={s.id}>
                <div className="card__head">
                  <h3 className="card__title">{s.title}</h3>
                  <div className="card__tools">
                    <button type="button" className="chip" onClick={() => setServices(move(content.services, i, i - 1))} disabled={i === 0}>
                      ↑
                    </button>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => setServices(move(content.services, i, i + 1))}
                      disabled={i === content.services.length - 1}
                    >
                      ↓
                    </button>
                  </div>
                </div>
                <Field label="Titel" value={s.title} onChange={(v) => setServices(content.services.map((x, j) => (j === i ? { ...x, title: v } : x)))} />
                <Field
                  label="Omschrijving"
                  textarea
                  value={htmlToText(s.description)}
                  onChange={(v) => setServices(content.services.map((x, j) => (j === i ? { ...x, description: textToHtml(v) } : x)))}
                />
                <ImagePicker
                  image={s.image}
                  onBusy={setBusy}
                  onChange={(image) => setServices(content.services.map((x, j) => (j === i ? { ...x, image } : x)))}
                />
              </article>
            ))}
          </section>
        )}

        {tab === 'over-ons' && (
          <section>
            <h2 className="section__title">Over Ons</h2>
            <article className="card">
              <Field
                label="Titel"
                hint="regeleinde = nieuwe regel"
                textarea
                rows={2}
                value={content.site.about.heading.replace(/<br\s*\/?>/gi, '\n')}
                onChange={(v) =>
                  update((d) => ({
                    ...d,
                    site: { ...d.site, about: { ...d.site.about, heading: v.split('\n').join('<br/>') } },
                  }))
                }
              />
              <Field
                label="Ondertitel"
                textarea
                rows={2}
                value={content.site.about.subheading}
                onChange={(v) =>
                  update((d) => ({ ...d, site: { ...d.site, about: { ...d.site.about, subheading: v } } }))
                }
              />
            </article>
            <div className="section__head">
              <h2 className="section__title">Team</h2>
              <button
                type="button"
                className="button"
                onClick={() =>
                  setTeam([
                    ...content.team,
                    { id: `lid-${Date.now().toString(36)}`, name: 'Nieuw teamlid', role: '', bio: '', image: '' },
                  ])
                }
              >
                Teamlid toevoegen
              </button>
            </div>
            {content.team.map((m, i) => (
              <article className="card" key={m.id}>
                <div className="card__head">
                  <h3 className="card__title">{m.name || 'Zonder naam'}</h3>
                  <div className="card__tools">
                    <button type="button" className="chip" onClick={() => setTeam(move(content.team, i, i - 1))} disabled={i === 0}>
                      ↑
                    </button>
                    <button type="button" className="chip" onClick={() => setTeam(move(content.team, i, i + 1))} disabled={i === content.team.length - 1}>
                      ↓
                    </button>
                    <button
                      type="button"
                      className="chip chip--danger"
                      onClick={() => {
                        if (confirm(`“${m.name}” verwijderen?`)) setTeam(content.team.filter((_, j) => j !== i))
                      }}
                    >
                      Verwijderen
                    </button>
                  </div>
                </div>
                <div className="grid grid--2">
                  <Field label="Naam" value={m.name} onChange={(v) => setTeam(content.team.map((x, j) => (j === i ? { ...x, name: v } : x)))} />
                  <Field label="Functie" value={m.role} onChange={(v) => setTeam(content.team.map((x, j) => (j === i ? { ...x, role: v } : x)))} />
                </div>
                <Field
                  label="Biografie"
                  textarea
                  rows={8}
                  value={htmlToText(m.bio)}
                  onChange={(v) => setTeam(content.team.map((x, j) => (j === i ? { ...x, bio: textToHtml(v) } : x)))}
                />
                <ImagePicker
                  image={m.image}
                  onBusy={setBusy}
                  onChange={(image) => setTeam(content.team.map((x, j) => (j === i ? { ...x, image: srcOf(image) } : x)))}
                />
              </article>
            ))}
          </section>
        )}

        {tab === 'site' && (
          <section>
            <h2 className="section__title">Contact</h2>
            <article className="card">
              <div className="grid grid--2">
                <Field label="E-mailadres" value={content.site.contact.email} onChange={(v) => update((d) => ({ ...d, site: { ...d.site, contact: { ...d.site.contact, email: v } } }))} />
                <Field label="E-mail zoals getoond" value={content.site.contact.emailLabel} onChange={(v) => update((d) => ({ ...d, site: { ...d.site, contact: { ...d.site.contact, emailLabel: v } } }))} />
                <Field label="Telefoon" value={content.site.contact.phone} onChange={(v) => update((d) => ({ ...d, site: { ...d.site, contact: { ...d.site.contact, phone: v } } }))} />
                <Field label="Telefoon-link" value={content.site.contact.phoneHref} onChange={(v) => update((d) => ({ ...d, site: { ...d.site, contact: { ...d.site.contact, phoneHref: v } } }))} />
                <Field label="Instagram" value={content.site.contact.instagram} onChange={(v) => update((d) => ({ ...d, site: { ...d.site, contact: { ...d.site.contact, instagram: v } } }))} />
                <Field label="LinkedIn" value={content.site.contact.linkedin} onChange={(v) => update((d) => ({ ...d, site: { ...d.site, contact: { ...d.site.contact, linkedin: v } } }))} />
                <Field label="Knop “Contacteer ons”" hint="op de pagina Aanbod" value={content.site.contact.serviceButtonHref} onChange={(v) => update((d) => ({ ...d, site: { ...d.site, contact: { ...d.site.contact, serviceButtonHref: v } } }))} />
              </div>
            </article>

            <h2 className="section__title">Kantoor</h2>
            <article className="card">
              <div className="grid grid--2">
                <Field label="Adres" textarea rows={3} value={content.site.office.address.join('\n')} onChange={(v) => update((d) => ({ ...d, site: { ...d.site, office: { ...d.site.office, address: v.split('\n') } } }))} />
                <Field label="Openingsuren" textarea rows={3} value={content.site.office.hours.join('\n')} onChange={(v) => update((d) => ({ ...d, site: { ...d.site, office: { ...d.site.office, hours: v.split('\n') } } }))} />
              </div>
            </article>

            <h2 className="section__title">Nieuwsbrief</h2>
            <article className="card">
              <Field label="Tekst" textarea rows={2} value={content.site.newsletter.body} onChange={(v) => update((d) => ({ ...d, site: { ...d.site, newsletter: { ...d.site.newsletter, body: v } } }))} />
              <Field label="Mailchimp-formulier (action)" value={content.site.newsletter.action} onChange={(v) => update((d) => ({ ...d, site: { ...d.site, newsletter: { ...d.site.newsletter, action: v } } }))} />
            </article>

            <h2 className="section__title">Achtergronden</h2>
            <article className="card">
              <div className="grid grid--2">
                <div>
                  <span className="field__label">Over Ons</span>
                  <ImagePicker image={content.site.backgrounds.about} onBusy={setBusy} onChange={(img) => update((d) => ({ ...d, site: { ...d.site, backgrounds: { ...d.site.backgrounds, about: srcOf(img) } } }))} />
                </div>
                <div>
                  <span className="field__label">Aanbod</span>
                  <ImagePicker image={content.site.backgrounds.services} onBusy={setBusy} onChange={(img) => update((d) => ({ ...d, site: { ...d.site, backgrounds: { ...d.site.backgrounds, services: srcOf(img) } } }))} />
                </div>
              </div>
            </article>

            <h2 className="section__title">Wettelijk</h2>
            <article className="card">
              <Field label="Ondernemingsnummer" value={content.site.legal.vat} onChange={(v) => update((d) => ({ ...d, site: { ...d.site, legal: { ...d.site.legal, vat: v } } }))} />
            </article>
          </section>
        )}
      </main>
    </div>
  )
}
