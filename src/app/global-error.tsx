'use client'

import { useEffect } from 'react'

// Catches errors in the root layout itself — must include its own <html> and <body>
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[SGI] Erreur critique (layout) :', error)
  }, [error])

  return (
    <html lang="fr">
      <body style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#F1F5F9',
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        margin: 0, padding: '24px', boxSizing: 'border-box',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 460 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: '#FEF2F2', border: '1px solid #FECACA',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
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
            Erreur critique de l'application
          </h1>
          <p style={{
            fontSize: 14, color: '#64748B', margin: '0 0 28px', lineHeight: 1.6,
          }}>
            Le système a rencontré une erreur inattendue dans le chargement de la page.<br />
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
              href="/login"
              style={{
                display: 'inline-block', padding: '11px 24px',
                background: 'white', color: '#64748B',
                border: '1px solid #E2E8F0', borderRadius: 8,
                fontSize: 13, fontWeight: 500, textDecoration: 'none',
              }}
            >
              Retour à la connexion
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
