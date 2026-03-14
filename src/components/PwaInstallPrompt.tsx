'use client'

import { useEffect, useState } from 'react'

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [visible, setVisible]               = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('pwa-dismissed')) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setVisible(false)
    setDeferredPrompt(null)
    if (outcome === 'dismissed') {
      sessionStorage.setItem('pwa-dismissed', '1')
    }
  }

  const handleDismiss = () => {
    sessionStorage.setItem('pwa-dismissed', '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position:   'fixed',
      bottom:     0,
      left:       0,
      right:      0,
      background: '#0C1A35',
      color:      '#fff',
      padding:    '14px 20px',
      display:    'flex',
      alignItems: 'center',
      gap:        12,
      zIndex:     9999,
      boxShadow:  '0 -4px 24px rgba(0,0,0,0.25)',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    }}>
      {/* UCA logo chip */}
      <div style={{
        width:          44,
        height:         44,
        borderRadius:   10,
        background:     '#1B3A6B',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
        fontSize:       15,
        fontWeight:     800,
        fontFamily:     'Georgia, serif',
        color:          '#fff',
        letterSpacing:  '1px',
      }}>
        UCA
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
          Installer UCA SGI
        </div>
        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>
          Accès rapide depuis votre écran d'accueil
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        style={{
          background:   'transparent',
          border:       '1px solid #334155',
          color:        '#94A3B8',
          borderRadius: 8,
          padding:      '7px 14px',
          fontSize:     12,
          cursor:       'pointer',
          flexShrink:   0,
          fontFamily:   'inherit',
        }}
      >
        Plus tard
      </button>

      {/* Install */}
      <button
        onClick={handleInstall}
        style={{
          background:   '#2563EB',
          border:       'none',
          color:        '#fff',
          borderRadius: 8,
          padding:      '7px 16px',
          fontSize:     12,
          fontWeight:   600,
          cursor:       'pointer',
          flexShrink:   0,
          fontFamily:   'inherit',
        }}
      >
        Installer
      </button>
    </div>
  )
}
