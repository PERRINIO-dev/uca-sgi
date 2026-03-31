'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif"

const FEATURES = [
  { icon: '▸', text: 'Suivi des ventes en temps réel' },
  { icon: '▸', text: 'Gestion multi-boutiques centralisée' },
  { icon: '▸', text: 'Rapports et analytiques avancés' },
  { icon: '▸', text: 'Contrôle des stocks entrepôt' },
]

// ── Icons ─────────────────────────────────────────────────────────────────────
function IconEye({ show }: { show: boolean }) {
  return show ? (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
      <path d="M2 2l13 13M7.07 7.1A2 2 0 009.9 9.93M4.5 4.55C3.17 5.5 2.1 6.87 1.5 8.5c1.2 3.1 4.2 5 7 5 1.3 0 2.56-.4 3.62-1.08M7 3.07A8.1 8.1 0 018.5 3c2.8 0 5.8 1.9 7 5a9.2 9.2 0 01-1.96 3.02"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
      <ellipse cx="8.5" cy="8.5" rx="2.3" ry="2.3" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M1.5 8.5C2.7 5.4 5.7 3.5 8.5 3.5s5.8 1.9 7 5c-1.2 3.1-4.2 5-7 5s-5.8-1.9-7-5Z"
        stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  )
}

function IconWarning() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M8 1.5L14.5 13H1.5L8 1.5Z" stroke="#D97706" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M8 6v3.5" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8" cy="11.5" r="0.75" fill="#D97706"/>
    </svg>
  )
}

function IconError() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="8" cy="8" r="6.5" stroke="#DC2626" strokeWidth="1.4"/>
      <path d="M8 5v3.5" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8" cy="11" r="0.75" fill="#DC2626"/>
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
      <path d="M1 4L3.5 6.5L9 1" stroke="#3B82F6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [deactivated, setDeactivated] = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('raison') === 'desactive') setDeactivated(true)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Identifiants incorrects. Vérifiez votre e-mail et mot de passe.')
      setLoading(false)
      return
    }

    const { data: { user: loggedInUser } } = await supabase.auth.getUser()
    const { data: prof } = await supabase
      .from('users')
      .select('role, is_active')
      .eq('id', loggedInUser?.id)
      .single()

    if (prof && !prof.is_active) {
      await supabase.auth.signOut()
      setError('Ce compte a été désactivé. Contactez votre administrateur.')
      setLoading(false)
      return
    }

    const dest: Record<string, string> = {
      owner:     '/dashboard',
      admin:     '/dashboard',
      vendor:    '/sales',
      warehouse: '/warehouse',
    }
    router.push(dest[prof?.role ?? ''] ?? '/dashboard')
    router.refresh()
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: FONT,
      background: '#0D1117',
    }}>
      {/* ── Left branding panel ── */}
      <div style={{
        flex: '0 0 460px',
        background: 'linear-gradient(160deg, #0D1117 0%, #0F1923 40%, #0D1F3C 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '52px 52px 44px',
        position: 'relative',
        overflow: 'hidden',
        borderRight: '1px solid rgba(255,255,255,0.04)',
      }}>

        {/* Decorative glow blobs */}
        <div style={{
          position: 'absolute',
          width: 360, height: 360,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)',
          top: -80, right: -80,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          width: 280, height: 280,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
          bottom: 80, left: -60,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          width: 1, height: '100%',
          background: 'linear-gradient(180deg, transparent 0%, rgba(59,130,246,0.12) 50%, transparent 100%)',
          right: 0, top: 0,
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: 'linear-gradient(145deg, #1D4ED8 0%, #3B82F6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 20px rgba(37,99,235,0.50)',
          }}>
            <svg width="24" height="20" viewBox="0 0 18 15" fill="none">
              <path d="M1 14V2L9 9.5L17 2V14" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div style={{
              fontSize: 26, fontWeight: 900, color: 'white',
              letterSpacing: '-0.04em', lineHeight: 1,
              fontFamily: FONT,
            }}>
              MERAM
            </div>
            <div style={{
              fontSize: 10, color: 'rgba(255,255,255,0.28)',
              letterSpacing: '0.18em', marginTop: 4,
              textTransform: 'uppercase', fontWeight: 600,
            }}>
              Manage · Sell · Optimize
            </div>
          </div>
        </div>

        {/* Main tagline */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 0', position: 'relative' }}>
          <h2 style={{
            fontSize: 32, fontWeight: 800, color: 'white',
            margin: '0 0 16px', letterSpacing: '-0.03em', lineHeight: 1.25,
            fontFamily: FONT,
          }}>
            Pilotez votre<br />
            <span style={{
              background: 'linear-gradient(135deg, #60A5FA 0%, #93C5FD 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              activité en temps réel.
            </span>
          </h2>
          <p style={{
            fontSize: 14.5, color: 'rgba(255,255,255,0.42)',
            margin: '0 0 40px', lineHeight: 1.75,
          }}>
            Plateforme centralisée de gestion commerciale — ventes, stocks, entrepôt et rapports réunis en un seul endroit.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {FEATURES.map(feat => (
              <div key={feat.text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: 'rgba(37,99,235,0.18)',
                  border: '1px solid rgba(59,130,246,0.22)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <IconCheck />
                </div>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.58)', lineHeight: 1.4 }}>
                  {feat.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          <div style={{
            width: 4, height: 4, borderRadius: '50%',
            background: 'rgba(59,130,246,0.5)',
          }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>
            © {new Date().getFullYear()} MERAM · Tous droits réservés
          </span>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 40px',
        background: '#FFFFFF',
        position: 'relative',
      }}>

        {/* Subtle top accent */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: 'linear-gradient(90deg, #1D4ED8 0%, #3B82F6 50%, #60A5FA 100%)',
        }} />

        <div style={{ width: '100%', maxWidth: 380 }}>

          {/* Form header */}
          <div style={{ marginBottom: 36 }}>
            {/* Mobile-only logo */}
            <div className="mobile-logo" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: 'linear-gradient(145deg, #1D4ED8, #3B82F6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 3px 12px rgba(37,99,235,0.35)',
              }}>
                <svg width="18" height="15" viewBox="0 0 18 15" fill="none">
                  <path d="M1 14V2L9 9.5L17 2V14" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{
                fontSize: 20, fontWeight: 900, color: '#0D1117',
                letterSpacing: '-0.03em',
              }}>
                MERAM
              </div>
            </div>

            <h1 style={{
              fontSize: 26, fontWeight: 800, color: '#0D1117',
              margin: '0 0 8px', letterSpacing: '-0.03em',
            }}>
              Connexion
            </h1>
            <p style={{ fontSize: 14, color: '#64748B', margin: 0, lineHeight: 1.6 }}>
              Entrez vos identifiants pour accéder à votre espace.
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Email */}
            <div>
              <label style={{
                display: 'block', fontSize: 11.5, fontWeight: 700,
                color: '#374151', marginBottom: 7,
                textTransform: 'uppercase', letterSpacing: '0.07em',
              }}>
                Adresse e-mail
              </label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.com"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 9,
                  border: '1.5px solid #E2E8F0', fontSize: 14,
                  boxSizing: 'border-box', outline: 'none',
                  color: '#0D1117', background: '#FAFAFA',
                  fontFamily: FONT,
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{
                display: 'block', fontSize: 11.5, fontWeight: 700,
                color: '#374151', marginBottom: 7,
                textTransform: 'uppercase', letterSpacing: '0.07em',
              }}>
                Mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'} required value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 44px 12px 14px', borderRadius: 9,
                    border: '1.5px solid #E2E8F0', fontSize: 14,
                    boxSizing: 'border-box', outline: 'none',
                    color: '#0D1117', background: '#FAFAFA',
                    fontFamily: FONT,
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  style={{
                    position: 'absolute', right: 13, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    cursor: 'pointer', padding: 2, color: '#94A3B8',
                    display: 'flex', alignItems: 'center',
                    transition: 'color 0.15s ease',
                  }}
                  aria-label={showPwd ? 'Masquer' : 'Afficher'}
                >
                  <IconEye show={showPwd} />
                </button>
              </div>
            </div>

            {/* Alerts */}
            {deactivated && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 14px', background: '#FFFBEB',
                border: '1px solid #FDE68A', borderRadius: 9,
              }}>
                <IconWarning />
                <p style={{ color: '#92400E', fontSize: 13, margin: 0, lineHeight: 1.55 }}>
                  Ce compte a été désactivé. Contactez un administrateur.
                </p>
              </div>
            )}

            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 14px', background: '#FEF2F2',
                border: '1px solid #FECACA', borderRadius: 9,
                animation: 'slideDown 0.2s ease forwards',
              }}>
                <IconError />
                <p style={{ color: '#B91C1C', fontSize: 13, margin: 0, lineHeight: 1.55 }}>
                  {error}
                </p>
              </div>
            )}

            {/* Submit button */}
            <button
              className="btn-meram"
              type="submit"
              disabled={loading}
              style={{
                padding: '14px', borderRadius: 9, border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                color: 'white', fontSize: 14.5, fontWeight: 700,
                letterSpacing: '-0.01em', marginTop: 4,
                fontFamily: FONT,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                opacity: loading ? 0.75 : 1,
              }}
            >
              {loading
                ? <><span className="spinner" />Connexion en cours…</>
                : <>Se connecter
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8h10M8 3l5 5-5 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </>
              }
            </button>
          </form>

          <p style={{
            textAlign: 'center', fontSize: 12.5,
            color: '#94A3B8', marginTop: 28, lineHeight: 1.65,
          }}>
            Mot de passe oublié ?
            <br />
            <span style={{ color: '#CBD5E1' }}>Contactez votre administrateur.</span>
          </p>

          {/* Footer */}
          <div style={{
            marginTop: 40, paddingTop: 20,
            borderTop: '1px solid #F1F5F9',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: 5,
              background: 'linear-gradient(145deg, #1D4ED8, #3B82F6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="11" height="9" viewBox="0 0 18 15" fill="none">
                <path d="M1 14V2L9 9.5L17 2V14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{
              fontSize: 11.5, color: '#CBD5E1',
              letterSpacing: '0.02em', fontWeight: 500,
            }}>
              Développé par Majestor Kepseu
            </span>
          </div>
        </div>
      </div>

      {/* Responsive: hide left panel on small screens */}
      <style>{`
        .mobile-logo { display: none !important; }
        @media (max-width: 720px) {
          main > div:first-child { display: none !important; }
          main > div:last-child { padding: 40px 24px !important; }
          .mobile-logo { display: flex !important; }
        }
      `}</style>
    </main>
  )
}
