import type { Metadata, Viewport } from 'next'
import './globals.css'
import PwaInstallPrompt     from '@/components/PwaInstallPrompt'
import NetworkStatusBanner  from '@/components/NetworkStatusBanner'

export const metadata: Metadata = {
  title:       'MERAM',
  description: 'Manage · Sell · Optimize — Plateforme de gestion commerciale',
  // Explicit icon declarations ensure every browser and device gets the right asset.
  // Next.js also auto-discovers icon.tsx and apple-icon.tsx, but explicit entries
  // prevent any ambiguity and ensure the <link> tags appear correctly in <head>.
  icons: {
    icon: [
      { url: '/icon', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/icon',
  },
  appleWebApp: {
    capable:        true,
    statusBarStyle: 'black-translucent',
    title:          'MERAM',
    startupImage:   '/apple-icon',
  },
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor:   '#0C1A35',
  width:        'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <NetworkStatusBanner />
        {children}
        <PwaInstallPrompt />
      </body>
    </html>
  )
}
