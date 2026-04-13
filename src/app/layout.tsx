import type { Metadata, Viewport } from 'next'
import { Fraunces, DM_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import PwaInstallPrompt    from '@/components/PwaInstallPrompt'
import NetworkStatusBanner from '@/components/NetworkStatusBanner'

// ── Fraunces — display / headings ────────────────────────────────────────────
// An optical-size serif with a warm, editorial quality that communicates
// authority and trust at a glance — critical for a B2B interface that
// business owners must trust immediately.
// Loaded at the weights used for KPI figures, page titles, and card headings.
const fraunces = Fraunces({
  subsets:  ['latin'],
  variable: '--font-fraunces',
  display:  'swap',
  weight:   ['400', '600', '700', '900'],
  style:    ['normal', 'italic'],
})

// ── DM Sans — body / UI ──────────────────────────────────────────────────────
// Clean geometric sans designed specifically for digital interfaces.
// Excellent legibility at 12–14px, built-in tabular numerals for financial
// figures, and a warmth that pairs well with Fraunces.
const dmSans = DM_Sans({
  subsets:  ['latin'],
  variable: '--font-dm',
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
    statusBarStyle: 'default',
    title:          'MERAM',
  },
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor:   '#F5EFE6',  // Papier bg — aged cream
  width:        'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${fraunces.variable} ${dmSans.variable} ${plexMono.variable}`}
    >
      <body>
        <NetworkStatusBanner />
        {children}
        <PwaInstallPrompt />
      </body>
    </html>
  )
}
