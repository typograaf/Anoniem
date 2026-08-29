import { cookies } from 'next/headers'

export const AUTH_COOKIE = 'anoniem_admin'

export async function isAuthed(): Promise<boolean> {
  const jar = await cookies()
  return jar.get(AUTH_COOKIE)?.value === '1'
}
