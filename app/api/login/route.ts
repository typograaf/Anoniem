import { AUTH_COOKIE } from '@/lib/auth'

export async function POST(req: Request) {
  const form = await req.formData()
  const password = String(form.get('password') ?? '')
  const expected = process.env.SITE_PASSWORD

  if (!expected || password !== expected) {
    return Response.redirect(new URL('/admin?fout=1', req.url), 303)
  }

  const res = new Response(null, { status: 303, headers: { location: new URL('/admin', req.url).toString() } })
  res.headers.append(
    'set-cookie',
    `${AUTH_COOKIE}=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}; Secure`,
  )
  return res
}
