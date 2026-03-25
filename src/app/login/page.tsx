'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const FEATURES = [
  'Suivi des ventes en temps réel',
  'Gestion multi-boutiques',
  'Rapports et analytiques avancés',
  'Contrôle des stocks entrepôt',
]

export default function LoginPage() {
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPwd, setShowPwd]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [loading, setLoading]       = useState(false)
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

    // Block deactivated accounts immediately — avoids a double-redirect via middleware
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
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      background: '#F8FAFC',
    }}>
      {/* ── Left branding panel ── */}
      <div style={{
        flex: '0 0 420px',
        background: 'linear-gradient(160deg, #0F2244 0%, #1B3A6B 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '52px 48px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', width: 320, height: 320,
          borderRadius: '50%', border: '1px solid rgba(255,255,255,0.06)',
          bottom: -80, right: -80, pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', width: 200, height: 200,
          borderRadius: '50%', border: '1px solid rgba(255,255,255,0.06)',
          bottom: 20, right: 20, pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', width: 120, height: 120,
          borderRadius: '50%', background: 'rgba(46,134,171,0.08)',
          top: 80, right: -30, pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div>
          <div style={{
            fontSize: 44, fontWeight: 900, color: 'white',
            letterSpacing: '-0.04em', lineHeight: 1,
            fontFamily: 'Georgia, serif',
          }}>
            UCA
          </div>
          <div style={{
            fontSize: 11, color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.14em', marginTop: 6,
            textTransform: 'uppercase', fontWeight: 500,
          }}>
            Gestion Interne
          </div>
        </div>

        {/* Tagline */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 0' }}>
          <h2 style={{
            fontSize: 26, fontWeight: 700, color: 'white',
            margin: '0 0 14px', letterSpacing: '-0.02em', lineHeight: 1.3,
            fontFamily: 'Georgia, serif',
          }}>
            Pilotez votre activité<br />en temps réel.
          </h2>
          <p style={{
            fontSize: 14, color: 'rgba(255,255,255,0.5)',
            margin: '0 0 36px', lineHeight: 1.7,
          }}>
            Système centralisé pour vos boutiques de carreaux — ventes, stocks, entrepôt et rapports réunis en un seul endroit.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FEATURES.map(feat => (
              <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'rgba(37,99,235,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3.5 6L8 1" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
          © {new Date().getFullYear()} UCA · Usage interne uniquement
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 40px',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          {/* Form header */}
          <div style={{ marginBottom: 36 }}>
            <h1 style={{
              fontSize: 26, fontWeight: 700, color: '#0F172A',
              margin: '0 0 8px', letterSpacing: '-0.02em',
            }}>
              Connexion
            </h1>
            <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
              Entrez vos identifiants pour accéder au système.
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 600,
                color: '#374151', marginBottom: 7,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                Adresse e-mail
              </label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="prenom.nom@uca.cm"
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 8,
                  border: '1.5px solid #E2E8F0', fontSize: 14,
                  boxSizing: 'border-box', outline: 'none',
                  color: '#0F172A', background: 'white',
                  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 600,
                color: '#374151', marginBottom: 7,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                Mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'} required value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{
                    width: '100%', padding: '11px 42px 11px 14px', borderRadius: 8,
                    border: '1.5px solid #E2E8F0', fontSize: 14,
                    boxSizing: 'border-box', outline: 'none',
                    color: '#0F172A', background: 'white',
                    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    cursor: 'pointer', padding: 2, color: '#94A3B8',
                    display: 'flex', alignItems: 'center',
                  }}
                  aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPwd ? (
                    <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                      <path d="M2 2l13 13M7.07 7.1A2 2 0 0 0 9.9 9.93M4.5 4.55C3.17 5.5 2.1 6.87 1.5 8.5c1.2 3.1 4.2 5 7 5 1.3 0 2.56-.4 3.62-1.08M7 3.07A8.1 8.1 0 0 1 8.5 3c2.8 0 5.8 1.9 7 5a9.2 9.2 0 0 1-1.96 3.02" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                      <ellipse cx="8.5" cy="8.5" rx="2.3" ry="2.3" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M1.5 8.5C2.7 5.4 5.7 3.5 8.5 3.5s5.8 1.9 7 5c-1.2 3.1-4.2 5-7 5s-5.8-1.9-7-5Z" stroke="currentColor" strokeWidth="1.4"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {deactivated && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 14px', background: '#FFFBEB',
                border: '1px solid #FCD34D', borderRadius: 8,
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M8 1.5L14.5 13H1.5L8 1.5Z" stroke="#D97706" strokeWidth="1.4" strokeLinejoin="round"/>
                  <path d="M8 6v3.5" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="8" cy="11.5" r="0.75" fill="#D97706"/>
                </svg>
                <p style={{ color: '#92400E', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                  Ce compte a été désactivé. Contactez un administrateur.
                </p>
              </div>
            )}

            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 14px', background: '#FEF2F2',
                border: '1px solid #FECACA', borderRadius: 8,
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="8" cy="8" r="6.5" stroke="#DC2626" strokeWidth="1.4"/>
                  <path d="M8 5v3.5" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="8" cy="11" r="0.75" fill="#DC2626"/>
                </svg>
                <p style={{ color: '#B91C1C', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                  {error}
                </p>
              </div>
            )}

            <button
              className="btn-navy"
              type="submit"
              disabled={loading}
              style={{
                padding: '13px', borderRadius: 8, border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? '#94A3B8' : '#1E3A5F',
                color: 'white', fontSize: 14, fontWeight: 600,
                letterSpacing: '0.01em', marginTop: 4,
                fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? <><span className="spinner" />Connexion en cours…</> : 'Se connecter →'}
            </button>
          </form>

          <p style={{
            textAlign: 'center', fontSize: 12,
            color: '#94A3B8', marginTop: 28, lineHeight: 1.6,
          }}>
            Mot de passe oublié ?<br />Contactez votre administrateur.
          </p>

          <div style={{
            marginTop: 36,
            paddingTop: 20,
            borderTop: '1px solid #F1F5F9',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M8 1l1.854 3.756L14 5.528l-3 2.924.708 4.131L8 10.5l-3.708 2.083L5 8.452 2 5.528l4.146-.772L8 1z"
                fill="#CBD5E1" />
            </svg>
            <span style={{
              fontSize: 11, color: '#CBD5E1',
              letterSpacing: '0.04em', fontWeight: 500,
            }}>
              Développé par Majestor Kepseu
            </span>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M8 1l1.854 3.756L14 5.528l-3 2.924.708 4.131L8 10.5l-3.708 2.083L5 8.452 2 5.528l4.146-.772L8 1z"
                fill="#CBD5E1" />
            </svg>
          </div>
        </div>
      </div>

      {/* Mobile fallback: hide left panel on small screens */}
      <style>{`
        @media (max-width: 680px) {
          main > div:first-child { display: none !important; }
          main > div:last-child { padding: 40px 24px !important; }
        }
      `}</style>
    </main>
  )
}
