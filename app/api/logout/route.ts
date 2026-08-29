import { AUTH_COOKIE } from '@/lib/auth'

export async function POST(req: Request) {
  // Secure would make the cookie unusable over plain http, i.e. local dev.
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : ''
  const res = new Response(null, { status: 303, headers: { location: new URL('/admin', req.url).toString() } })
  res.headers.append('set-cookie', `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`)
  return res
}
