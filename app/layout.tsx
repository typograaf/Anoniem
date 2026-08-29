import type { ReactNode } from 'react'

export const metadata = {
  title: 'Anoniem — Beheer',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  )
}
