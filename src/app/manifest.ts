import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'MERAM',
    short_name:       'MERAM',
    description:      'Manage · Sell · Optimize — Plateforme de gestion commerciale',
    start_url:        '/dashboard',
    display:          'standalone',
    background_color: '#1D4ED8',   // matches icon gradient start — no white flash on launch
    theme_color:      '#0C1A35',
    orientation:      'portrait-primary',
    icons: [
      // Standard icon — used for browser display and general PWA install
      {
        src:     '/icon',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'any',
      },
      // Maskable icon — Android adaptive icons apply a mask (squircle/circle).
      // Safe zone rule: logo must be fully within the center 80% of the canvas.
      // Our M logo at 62% of 512px = 318px wide, centered → safely within safe zone.
      {
        src:     '/icon',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'maskable',
      },
      // Apple touch icon — referenced here for Android Chrome "Add to Home Screen"
      {
        src:     '/apple-icon',
        sizes:   '180x180',
        type:    'image/png',
        purpose: 'any',
      },
    ],
  }
}
