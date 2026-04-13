import Link from 'next/link'
import { C, F, R, SP, SH } from '@/lib/design-system'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: C.bg,
      fontFamily: F.body,
      padding: SP[6],
    }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        {/* Subtle 404 number */}
        <div style={{
          fontSize: 80, fontWeight: F.black, color: C.surfaceEl,
          letterSpacing: '-0.05em', lineHeight: 1,
          fontFamily: F.display,
        }}>
          404
        </div>

        {/* MERAM logo mark */}
        <div style={{
          display: 'flex', justifyContent: 'center',
          margin: `${SP[5]} 0 ${SP[4]}`,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: R.lg,
            background: `linear-gradient(145deg, ${C.amberActive}, ${C.amber})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: SH.amber,
          }}>
            <svg width="22" height="19" viewBox="0 0 20 17" fill="none">
              <path d="M2 15V2L10 9L18 2V15" stroke={C.bg} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 15h16" stroke={C.bg} strokeWidth="2.3" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        <h1 style={{
          fontSize: F.xl, fontWeight: F.xbold, color: C.ink,
          margin: `0 0 ${SP[2]}`, letterSpacing: F.lsTighter, fontFamily: F.display,
        }}>
          Page introuvable
        </h1>
        <p style={{ fontSize: F.base, color: C.muted, margin: `0 0 ${SP[7]}`, lineHeight: F.lhRelaxed, fontFamily: F.body }}>
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: SP[2],
            padding: `${SP[3]} ${SP[6]}`,
            background: `linear-gradient(135deg, ${C.amberActive}, ${C.amber})`,
            color: C.bg,
            borderRadius: R.md, fontSize: F.sm, fontWeight: F.bold,
            textDecoration: 'none',
            boxShadow: SH.amber,
            letterSpacing: F.lsTight,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 1L3 7l6 6" stroke={C.bg} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  )
}
