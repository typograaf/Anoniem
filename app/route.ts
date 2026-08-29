import { getContent } from '@/lib/content'
import { htmlResponse, renderHome } from '@/lib/render'

// Rendered per request: a /admin save has to be live immediately, and Next's
// route-cache revalidation does not reliably purge these.
export const dynamic = 'force-dynamic'

export async function GET() {
  return htmlResponse(renderHome(await getContent()))
}
