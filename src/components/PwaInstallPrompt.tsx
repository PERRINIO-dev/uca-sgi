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
      background: '#111827',
      color:      '#fff',
      padding:    '14px 20px',
      display:    'flex',
      alignItems: 'center',
      gap:        12,
      zIndex:     9999,
      boxShadow:  '0 -4px 24px rgba(0,0,0,0.30)',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      borderTop:  '1px solid rgba(255,255,255,0.07)',
    }}>
      {/* App logo chip */}
      <div style={{
        width:          42,
        height:         42,
        borderRadius:   10,
        background:     'linear-gradient(145deg, #1D4ED8 0%, #3B82F6 100%)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
        boxShadow:      '0 3px 12px rgba(37,99,235,0.40)',
      }}>
        <svg width="20" height="17" viewBox="0 0 20 17" fill="none">
          <path d="M2 15V2L10 9L18 2V15" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 15h16" stroke="white" strokeWidth="2.3" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
          Installer MERAM
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
          Accès rapide depuis votre écran d'accueil
        </div>
      </div>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        style={{
          background:   'transparent',
          border:       '1px solid rgba(255,255,255,0.15)',
          color:        '#9CA3AF',
          borderRadius: 8,
          padding:      '7px 14px',
          fontSize:     12,
          cursor:       'pointer',
          flexShrink:   0,
          fontFamily:   'inherit',
          transition:   'border-color 0.15s ease, color 0.15s ease',
        }}
      >
        Plus tard
      </button>

      {/* Install */}
      <button
        onClick={handleInstall}
        style={{
          background:   'linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)',
          border:       'none',
          color:        '#fff',
          borderRadius: 8,
          padding:      '7px 16px',
          fontSize:     12,
          fontWeight:   700,
          cursor:       'pointer',
          flexShrink:   0,
          fontFamily:   'inherit',
          boxShadow:    '0 2px 10px rgba(37,99,235,0.35)',
        }}
      >
        Installer
      </button>
    </div>
  )
}
