import type { Metadata, Viewport } from 'next'
import './globals.css'
import PwaInstallPrompt     from '@/components/PwaInstallPrompt'
import NetworkStatusBanner  from '@/components/NetworkStatusBanner'

export const metadata: Metadata = {
  title:       'UCA SGI',
  description: 'Système de gestion interne — UCA',
  appleWebApp: {
    capable:         true,
    statusBarStyle:  'black-translucent',
    title:           'UCA SGI',
  },
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
