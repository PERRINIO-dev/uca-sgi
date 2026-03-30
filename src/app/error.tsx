'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[SGI] Erreur applicative :', error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#F1F5F9',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      padding: '24px',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: '#FEF2F2', border: '1px solid #FECACA',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: 32,
        }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 4L28 26H4L16 4Z" stroke="#DC2626" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M16 13v7" stroke="#DC2626" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="16" cy="23" r="1.5" fill="#DC2626"/>
          </svg>
        </div>
        <h1 style={{
          fontSize: 20, fontWeight: 700, color: '#0F172A',
          margin: '0 0 8px', letterSpacing: '-0.02em',
        }}>
          Une erreur s'est produite
        </h1>
        <p style={{
          fontSize: 14, color: '#64748B', margin: '0 0 28px', lineHeight: 1.6,
        }}>
          Le système a rencontré un problème inattendu.<br />
          Réessayez ou contactez l'administrateur si le problème persiste.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={reset}
            style={{
              padding: '11px 24px', background: '#1B3A6B', color: 'white',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
            }}
          >
            Réessayer
          </button>
          <a
            href="/dashboard"
            style={{
              display: 'inline-block', padding: '11px 24px',
              background: 'white', color: '#64748B',
              border: '1px solid #E2E8F0', borderRadius: 8,
              fontSize: 13, fontWeight: 500, textDecoration: 'none',
            }}
          >
            Tableau de bord
          </a>
        </div>
      </div>
    </div>
  )
}
