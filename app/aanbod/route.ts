import { getContent } from '@/lib/content'
import { htmlResponse, renderAanbod } from '@/lib/render'

export const dynamic = 'force-dynamic'

export async function GET() {
  return htmlResponse(renderAanbod(await getContent()))
}
