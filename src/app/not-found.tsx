import Link from 'next/link'
import { C, F, R, SP, SH } from '@/lib/design-system'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: C.bg,
      fontFamily: F.body, padding: SP[6],
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>

        {/* Logo mark */}
        <div style={{
          width: 56, height: 56, borderRadius: R.xl,
          background:  `linear-gradient(145deg, ${C.amberActive} 0%, ${C.amber} 100%)`,
          display:     'flex', alignItems: 'center', justifyContent: 'center',
          margin:      `0 auto ${SP[6]}`,
          boxShadow:   SH.amber,
        }}>
          <svg width="26" height="21" viewBox="0 0 20 17" fill="none" aria-hidden="true">
            <path d="M2 15V2L10 9L18 2V15" stroke="#FAF5EE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 15h16"              stroke="#FAF5EE" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Large ghost number */}
        <div style={{
          fontSize: '96px', fontWeight: F.black, lineHeight: 1,
          color: C.borderSub, fontFamily: F.display,
          letterSpacing: F.lsTightest,
          margin: `0 0 ${SP[4]}`,
          userSelect: 'none' as const,
        }}>
          404
        </div>

        <h1 style={{
          fontSize: F.xl, fontWeight: F.bold, color: C.ink,
          margin: `0 0 ${SP[2]}`, letterSpacing: F.lsTighter,
          fontFamily: F.display,
        }}>
          Page introuvable
        </h1>
        <p style={{
          fontSize: F.base, color: C.muted,
          margin: `0 0 ${SP[7]}`, lineHeight: F.lhRelaxed,
          fontFamily: F.body,
        }}>
          La page que vous recherchez n&apos;existe pas ou a été déplacée.
        </p>

        <Link
          href="/dashboard"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: SP[2],
            padding: `${SP[3]} ${SP[6]}`,
            background: `linear-gradient(135deg, ${C.amberActive} 0%, ${C.amber} 100%)`,
            color: '#FAF5EE',
            border: 'none', borderRadius: R.md,
            fontSize: F.sm, fontWeight: F.bold,
            textDecoration: 'none', fontFamily: F.body,
            boxShadow: SH.amber,
          }}
        >
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  )
}
