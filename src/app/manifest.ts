import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'UCA SGI',
    short_name:       'UCA SGI',
    description:      'Système de gestion interne — UCA',
    start_url:        '/',
    display:          'standalone',
    background_color: '#F8FAFC',
    theme_color:      '#0C1A35',
    orientation:      'portrait-primary',
    icons: [
      {
        src:     '/icon',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/icon',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'maskable',
      },
      {
        src:     '/apple-icon',
        sizes:   '180x180',
        type:    'image/png',
      },
    ],
  }
}
