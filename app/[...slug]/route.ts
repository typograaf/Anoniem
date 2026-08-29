import { getContent } from '@/lib/content'
import { htmlResponse, renderNotFound } from '@/lib/render'

export const dynamic = 'force-dynamic'

/** Anything that is not one of the three pages, /admin or an API route. */
export async function GET() {
  return htmlResponse(renderNotFound(await getContent()), 404)
}
