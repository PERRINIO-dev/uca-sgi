import Link from 'next/link'

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif"

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#F5F2ED',
      fontFamily: FONT,
      padding: '24px',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        {/* Subtle 404 number */}
        <div style={{
          fontSize: 80, fontWeight: 900, color: '#E7E5E4',
          letterSpacing: '-0.05em', lineHeight: 1,
          fontFamily: FONT,
        }}>
          404
        </div>

        {/* MERAM logo mark */}
        <div style={{
          display: 'flex', justifyContent: 'center',
          margin: '20px 0 18px',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 13,
            background: 'linear-gradient(145deg, #1D4ED8 0%, #3B82F6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 18px rgba(37,99,235,0.35)',
          }}>
            <svg width="22" height="19" viewBox="0 0 20 17" fill="none">
              <path d="M2 15V2L10 9L18 2V15" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 15h16" stroke="white" strokeWidth="2.3" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        <h1 style={{
          fontSize: 20, fontWeight: 800, color: '#1C1917',
          margin: '0 0 8px', letterSpacing: '-0.02em', fontFamily: FONT,
        }}>
          Page introuvable
        </h1>
        <p style={{ fontSize: 14, color: '#78716C', margin: '0 0 28px', lineHeight: 1.65, fontFamily: FONT }}>
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '11px 24px',
            background: 'linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)',
            color: 'white',
            borderRadius: 9, fontSize: 13, fontWeight: 700,
            textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(37,99,235,0.30)',
            letterSpacing: '-0.01em',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 1L3 7l6 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  )
}
