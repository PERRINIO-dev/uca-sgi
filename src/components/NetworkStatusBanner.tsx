'use client'

import { useState, useEffect } from 'react'

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif"

export default function NetworkStatusBanner() {
  const [isOnline,  setIsOnline]  = useState(true)
  const [showBack,  setShowBack]  = useState(false)

  useEffect(() => {
    // Initialise with current state (important if component mounts while offline)
    setIsOnline(navigator.onLine)

    let backTimer: ReturnType<typeof setTimeout> | null = null

    const goOffline = () => {
      setIsOnline(false)
      setShowBack(false)
      if (backTimer) clearTimeout(backTimer)
    }

    const goOnline = () => {
      setIsOnline(true)
      setShowBack(true)
      backTimer = setTimeout(() => setShowBack(false), 3500)
    }

    window.addEventListener('offline', goOffline)
    window.addEventListener('online',  goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online',  goOnline)
      if (backTimer) clearTimeout(backTimer)
    }
  }, [])

  // Nothing to show when fully online and no "back" flash
  if (isOnline && !showBack) return null

  const offline = !isOnline

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position:       'fixed',
        top:            0,
        left:           0,
        right:          0,
        zIndex:         10000,
        background:     offline ? '#DC2626' : '#059669',
        color:          '#fff',
        padding:        '10px 20px',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            10,
        fontFamily:     FONT,
        fontSize:       13,
        fontWeight:     600,
        boxShadow:      '0 2px 12px rgba(0,0,0,0.18)',
        transition:     'background 0.3s ease',
      }}
    >
      {offline ? (
        <>
          {/* Offline icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23"/>
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
            <circle cx="12" cy="20" r="1" fill="currentColor"/>
          </svg>
          Hors ligne — Vérifiez votre connexion internet
        </>
      ) : (
        <>
          {/* Online icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Connexion rétablie
        </>
      )}
    </div>
  )
}
