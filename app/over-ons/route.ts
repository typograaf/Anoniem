import { getContent } from '@/lib/content'
import { htmlResponse, renderOverOns } from '@/lib/render'

export const dynamic = 'force-dynamic'

export async function GET() {
  return htmlResponse(renderOverOns(await getContent()))
}
