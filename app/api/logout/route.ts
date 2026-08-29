import { AUTH_COOKIE } from '@/lib/auth'

export async function POST(req: Request) {
  const res = new Response(null, { status: 303, headers: { location: new URL('/admin', req.url).toString() } })
  res.headers.append('set-cookie', `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`)
  return res
}
