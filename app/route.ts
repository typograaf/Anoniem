import { getContent } from '@/lib/content'
import { htmlResponse, renderHome } from '@/lib/render'

export const dynamic = 'force-dynamic'

export async function GET() {
  return htmlResponse(renderHome(await getContent()))
}
