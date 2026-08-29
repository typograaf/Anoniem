import { getContent, saveContent, type Content } from '@/lib/content'
import { isAuthed } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await isAuthed())) return new Response('Unauthorized', { status: 401 })
  return Response.json(await getContent())
}

export async function PUT(req: Request) {
  if (!(await isAuthed())) return new Response('Unauthorized', { status: 401 })
  let body: Content
  try {
    body = (await req.json()) as Content
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }
  if (!body?.site || !Array.isArray(body.projects) || !Array.isArray(body.services) || !Array.isArray(body.team)) {
    return new Response('Content is missing a top-level section', { status: 400 })
  }
  await saveContent(body)
  return Response.json({ ok: true })
}
