import type { Metadata, Viewport } from 'next'
import { Sora, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import PwaInstallPrompt    from '@/components/PwaInstallPrompt'
import NetworkStatusBanner from '@/components/NetworkStatusBanner'

// ── Sora — display / headings ────────────────────────────────────────────────
// Loaded with the weights used in the design system: 400 (labels), 600 (card
// titles), 700 (page titles), 800 (KPI), 900 (hero callout).
const sora = Sora({
  subsets:  ['latin'],
  variable: '--font-sora',
  display:  'swap',
  weight:   ['400', '600', '700', '800'],
})

// ── IBM Plex Sans — body / UI ────────────────────────────────────────────────
// The interface workhorse: forms, tables, labels, body copy.
// Built-in tabular numerals (font-feature-settings "tnum") — critical for
// aligned financial figures throughout the app.
const plexSans = IBM_Plex_Sans({
  subsets:  ['latin'],
  variable: '--font-plex',
  display:  'swap',
  weight:   ['400', '500', '600', '700'],
})

// ── IBM Plex Mono — codes / reference numbers ────────────────────────────────
// Used exclusively for sale numbers (VNT-2026-0042), quote numbers, IDs,
// and any machine-generated reference that benefits from monospace alignment.
const plexMono = IBM_Plex_Mono({
  subsets:  ['latin'],
  variable: '--font-plex-mono',
  display:  'swap',
  weight:   ['400', '500', '600'],
})

export const metadata: Metadata = {
  title:       'MERAM',
  description: 'Manage · Sell · Optimize — Plateforme de gestion commerciale',
  icons: {
    icon:     '/icon',
    shortcut: '/icon',
    apple:    '/apple-icon',
  },
  appleWebApp: {
    capable:        true,
    statusBarStyle: 'black-translucent',
    title:          'MERAM',
  },
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor:   '#1C1917',  // Minerals bg — volcanic stone
  width:        'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${sora.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>
        <NetworkStatusBanner />
        {children}
        <PwaInstallPrompt />
      </body>
    </html>
  )
}
