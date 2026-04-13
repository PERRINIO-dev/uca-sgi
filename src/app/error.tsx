'use client'

import { useEffect } from 'react'
import { C, F, R, SP, SH } from '@/lib/design-system'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[MERAM] Erreur applicative :', error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: C.bg,
      fontFamily: F.body,
      padding: SP[6],
    }}>
      <div style={{ textAlign: 'center', maxWidth: 460 }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: C.redBg, border: `1.5px solid ${C.redBd}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: `0 auto ${SP[5]}`,
        }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 4L28 26H4L16 4Z" stroke={C.red} strokeWidth="2" strokeLinejoin="round"/>
            <path d="M16 13v7" stroke={C.red} strokeWidth="2" strokeLinecap="round"/>
            <circle cx="16" cy="23" r="1.5" fill={C.red}/>
          </svg>
        </div>

        <h1 style={{
          fontSize: F.xl, fontWeight: F.xbold, color: C.ink,
          margin: `0 0 ${SP[2]}`, letterSpacing: F.lsTighter, fontFamily: F.display,
        }}>
          Une erreur s'est produite
        </h1>
        <p style={{
          fontSize: F.base, color: C.muted, margin: `0 0 ${SP[7]}`, lineHeight: F.lhRelaxed, fontFamily: F.body,
        }}>
          Le système a rencontré un problème inattendu.<br />
          Réessayez ou contactez l'administrateur si le problème persiste.
        </p>

        <div style={{ display: 'flex', gap: SP[2], justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={reset}
            style={{
              padding: `${SP[3]} ${SP[6]}`,
              background: `linear-gradient(135deg, ${C.amberActive}, ${C.amber})`,
              color: C.bg,
              border: 'none', borderRadius: R.md, fontSize: F.sm, fontWeight: F.bold,
              cursor: 'pointer', fontFamily: F.body,
              boxShadow: SH.amber,
              letterSpacing: F.lsTight,
            }}
          >
            Réessayer
          </button>
          <a
            href="/dashboard"
            style={{
              display: 'inline-block', padding: `${SP[3]} ${SP[6]}`,
              background: C.surface, color: C.muted,
              border: `1.5px solid ${C.border}`, borderRadius: R.md,
              fontSize: F.sm, fontWeight: F.medium, textDecoration: 'none',
              fontFamily: F.body,
            }}
          >
            Tableau de bord
          </a>
        </div>
      </div>
    </div>
  )
}
