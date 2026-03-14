import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#F1F5F9',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      padding: '24px',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{
          fontSize: 80, fontWeight: 900, color: '#E2E8F0',
          letterSpacing: '-0.05em', lineHeight: 1,
          fontFamily: 'Georgia, serif',
        }}>
          404
        </div>
        <h1 style={{
          fontSize: 20, fontWeight: 700, color: '#0F172A',
          margin: '16px 0 8px', letterSpacing: '-0.02em',
        }}>
          Page introuvable
        </h1>
        <p style={{ fontSize: 14, color: '#64748B', margin: '0 0 28px', lineHeight: 1.6 }}>
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-block', padding: '11px 24px',
            background: '#1B3A6B', color: 'white',
            borderRadius: 8, fontSize: 13, fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          ← Retour au tableau de bord
        </Link>
      </div>
    </div>
  )
}
