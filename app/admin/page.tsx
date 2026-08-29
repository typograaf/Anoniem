import { isAuthed } from '@/lib/auth'
import { getContent } from '@/lib/content'
import Editor from './Editor'
import Login from './Login'
import './admin.css'

export const dynamic = 'force-dynamic'

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ fout?: string }>
}) {
  const { fout } = await searchParams
  if (!(await isAuthed())) return <Login failed={fout === '1'} />
  return <Editor initial={await getContent()} />
}
