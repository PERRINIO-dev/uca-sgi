'use client'

import { useState, useEffect } from 'react'
import { createClient }        from '@/lib/supabase/client'
import { useRouter }           from 'next/navigation'
import { C, F, R, SH, SP, TR } from '@/lib/design-system'

const FEATURES = [
  'Suivi des ventes en temps réel',
  'Gestion multi-boutiques centralisée',
  'Rapports et analytiques avancés',
  'Contrôle des stocks entrepôt',
]

// ── Icons ──────────────────────────────────────────────────────────────────────
function IconEye({ show }: { show: boolean }) {
  return show ? (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 2l12 12M6.6 6.63A2 2 0 009.37 9.4M4.2 4.26C3.06 5.1 2.1 6.36 1.5 8c1.1 2.9 3.9 4.75 6.5 4.75 1.22 0 2.38-.37 3.36-1.02M6.5 2.8A7.7 7.7 0 018 2.5c2.6 0 5.4 1.85 6.5 4.75a8.6 8.6 0 01-1.82 2.82"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <ellipse cx="8" cy="8" rx="2.2" ry="2.2" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M1.5 8C2.6 5.1 5.4 3.25 8 3.25s5.4 1.85 6.5 4.75C13.4 10.9 10.6 12.75 8 12.75S2.6 10.9 1.5 8Z"
        stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden="true">
      <path d="M1 3.5L3.2 5.8L8 1" stroke={C.amber} strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M8 3l5 5-5 5" stroke="#FAF5EE" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// The MERAM M-with-baseline lettermark
function MeramMark({ size = 20, color = '#FAF5EE' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={Math.round(size * 0.8)} viewBox="0 0 20 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 14V2.5L10 9L17.5 2.5V14"
        stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"
      />
      <path d="M2.5 14h15" stroke={color} strokeWidth="2.3" strokeLinecap="round"/>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function LoginPage() {
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [showPwd,     setShowPwd]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [deactivated, setDeactivated] = useState(false)
  const [shake,       setShake]       = useState(false)

  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('raison') === 'desactive') setDeactivated(true)
  }, [])

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 520)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Identifiants incorrects. Vérifiez votre e-mail et mot de passe.')
      setLoading(false)
      triggerShake()
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
      triggerShake()
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
      minHeight:  '100dvh',
      display:    'flex',
      fontFamily: F.body,
      background: C.bg,
    }}>

      {/* ════════════════════════════════════════════════════════════════════
          LEFT — Brand panel (dark espresso, matches sidebar)
          ════════════════════════════════════════════════════════════════════ */}
      <div
        className="login-brand-panel"
        style={{
          flex:           '0 0 460px',
          background:     C.sidebarBg,
          display:        'flex',
          flexDirection:  'column',
          justifyContent: 'space-between',
          padding:        '52px 48px 44px',
          position:       'relative',
          overflow:       'hidden',
          borderRight:    `1px solid ${C.sidebarBd}`,
        }}
      >
        {/* Subtle dot grid overlay */}
        <div style={{
          position:        'absolute', inset: 0,
          backgroundImage: `radial-gradient(circle, rgba(250,245,238,0.025) 1px, transparent 1px)`,
          backgroundSize:  '24px 24px',
          pointerEvents:   'none',
        }} />

        {/* Cognac glow — bottom left */}
        <div style={{
          position:     'absolute',
          width: 360, height: 360, borderRadius: '50%',
          background:   'radial-gradient(circle, rgba(160,83,26,0.10) 0%, transparent 65%)',
          bottom: -100, left: -80,
          pointerEvents: 'none',
        }} />

        {/* Subtle warm glow — top right */}
        <div style={{
          position:     'absolute',
          width: 260, height: 260, borderRadius: '50%',
          background:   'radial-gradient(circle, rgba(160,83,26,0.06) 0%, transparent 65%)',
          top: -60, right: -40,
          pointerEvents: 'none',
        }} />

        {/* ── Logo ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: SP[3], position: 'relative',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: R.xl,
            background:  `linear-gradient(150deg, ${C.amberActive} 0%, ${C.amber} 65%, ${C.amberDim} 100%)`,
            display:     'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink:  0,
            boxShadow:   `${SH.amber}, inset 0 1px 0 rgba(255,255,255,0.14)`,
          }}>
            <MeramMark size={22} color="#FAF5EE" />
          </div>
          <div>
            <div style={{
              fontSize:      F['2xl'],
              fontWeight:    F.xbold,
              fontFamily:    F.display,
              color:         C.sidebarInk,
              letterSpacing: '-0.025em',
              lineHeight:    1,
            }}>
              MERAM
            </div>
            <div style={{
              fontSize:      '10px',
              color:         C.sidebarMuted,
              letterSpacing: F.lsWidest,
              marginTop:     SP[1],
              textTransform: 'uppercase',
              fontWeight:    F.medium,
            }}>
              Manage · Sell · Optimize
            </div>
          </div>
        </div>

        {/* ── Tagline + feature list ── */}
        <div style={{
          flex:      1,
          display:   'flex', flexDirection: 'column', justifyContent: 'center',
          padding:   `${SP[12]} 0`,
          position:  'relative',
        }}>
          <h2 style={{
            fontSize:      F['4xl'],
            fontWeight:    F.xbold,
            fontFamily:    F.display,
            color:         C.sidebarInk,
            margin:        `0 0 ${SP[4]}`,
            letterSpacing: '-0.03em',
            lineHeight:    F.lhTight,
            fontOpticalSizing: 'auto' as any,
          }}>
            Pilotez votre<br />
            <span style={{
              background:           `linear-gradient(135deg, ${C.amberHov} 0%, ${C.amber} 50%, ${C.amberDim} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor:  'transparent',
              backgroundClip:       'text',
            }}>
              activité.
            </span>
          </h2>

          <p style={{
            fontSize:   F.sm,
            color:      C.sidebarMuted,
            margin:     `0 0 ${SP[8]}`,
            lineHeight: F.lhRelaxed,
            maxWidth:   320,
          }}>
            Plateforme centralisée de gestion commerciale — ventes, stocks,
            entrepôt et rapports réunis en un seul endroit.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: SP[2.5] }}>
            {FEATURES.map((feat, i) => (
              <div key={feat} style={{
                display:        'flex', alignItems: 'center', gap: SP[3],
                animation:      'fadeInUp 0.44s ease both',
                animationDelay: `${0.10 + i * 0.07}s`,
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: R.xs,
                  background:  'rgba(160,83,26,0.18)',
                  border:      `1px solid rgba(160,83,26,0.28)`,
                  display:     'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink:  0,
                }}>
                  <IconCheck />
                </div>
                <span style={{
                  fontSize:   F.sm,
                  color:      C.sidebarText,
                  lineHeight: F.lhSnug,
                }}>
                  {feat}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Panel footer ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: SP[2], position: 'relative',
        }}>
          <div style={{
            width: 4, height: 4, borderRadius: R.full,
            background: `rgba(160,83,26,0.50)`,
          }} />
          <span style={{ fontSize: F.xs, color: C.sidebarDim }}>
            © {new Date().getFullYear()} MERAM · Tous droits réservés
          </span>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          RIGHT — Form panel
          ════════════════════════════════════════════════════════════════════ */}
      <div
        className="login-form-panel"
        style={{
          flex:           1,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          padding:        `${SP[12]} ${SP[10]}`,
          background:     C.surface,
          position:       'relative',
          overflowY:      'auto',
        }}
      >
        {/* Cognac top accent stripe */}
        <div style={{
          position:   'absolute', top: 0, left: 0, right: 0, height: 3,
          background: C.amber, opacity: 0.85,
        }} />

        {/* SR live region for errors */}
        <div
          role="status" aria-live="polite" aria-atomic="true"
          style={{
            position: 'absolute', width: 1, height: 1,
            overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap',
          }}
        >
          {error ?? ''}
        </div>

        {/* Form container */}
        <div
          className="login-inner"
          style={{ width: '100%', maxWidth: 360, animation: 'fadeInUp 0.36s ease both' }}
        >
          {/* Mobile-only logo */}
          <div className="login-mobile-logo" style={{
            display: 'none', alignItems: 'center', gap: SP[2.5], marginBottom: SP[8],
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: R.lg,
              background:  `linear-gradient(150deg, ${C.amberActive}, ${C.amber})`,
              display:     'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow:   SH.amberSm,
            }}>
              <MeramMark size={17} color="#FAF5EE" />
            </div>
            <div style={{
              fontSize:      F.xl,
              fontWeight:    F.xbold,
              fontFamily:    F.display,
              color:         C.ink,
              letterSpacing: '-0.025em',
            }}>
              MERAM
            </div>
          </div>

          {/* Form header */}
          <div style={{ marginBottom: SP[7] }}>
            <p className="page-kicker" style={{ marginBottom: SP[2] }}>
              Connexion sécurisée
            </p>
            <h1 style={{
              fontSize:      F['2xl'],
              fontWeight:    F.xbold,
              fontFamily:    F.display,
              color:         C.ink,
              margin:        0,
              letterSpacing: '-0.03em',
              lineHeight:    F.lhTight,
              fontOpticalSizing: 'auto' as any,
            }}>
              Bienvenue
            </h1>
            <p style={{
              fontSize:   F.base,
              color:      C.muted,
              margin:     `${SP[2]} 0 0`,
              lineHeight: F.lhRelaxed,
            }}>
              Entrez vos identifiants pour accéder à votre espace.
            </p>
          </div>

          {/* ── Form ── */}
          <form
            onSubmit={handleLogin}
            noValidate
            className={shake ? 'login-shake' : ''}
            style={{ display: 'flex', flexDirection: 'column', gap: SP[4] }}
          >

            {/* Email field */}
            <div>
              <label htmlFor="login-email" className="form-label">
                Adresse e-mail
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.com"
                autoComplete="email"
                inputMode="email"
                aria-describedby={error ? 'login-error' : undefined}
                className="login-input input-field"
                style={{
                  width:        '100%',
                  height:       '42px',
                  padding:      `0 ${SP[3]}`,
                  borderRadius: R.md,
                  border:       `1.5px solid ${C.border}`,
                  fontSize:     F.base,
                  boxSizing:    'border-box',
                  outline:      'none',
                  color:        C.ink,
                  background:   C.bg,
                  fontFamily:   F.body,
                  transition:   `border-color ${TR.fast}, box-shadow ${TR.fast}`,
                }}
              />
            </div>

            {/* Password field */}
            <div>
              <label htmlFor="login-password" className="form-label">
                Mot de passe
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="login-password"
                  type={showPwd ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-describedby={error ? 'login-error' : undefined}
                  className="login-input input-field"
                  style={{
                    width:        '100%',
                    height:       '42px',
                    padding:      `0 ${SP[12]} 0 ${SP[3]}`,
                    borderRadius: R.md,
                    border:       `1.5px solid ${C.border}`,
                    fontSize:     F.base,
                    boxSizing:    'border-box',
                    outline:      'none',
                    color:        C.ink,
                    background:   C.bg,
                    fontFamily:   F.body,
                    transition:   `border-color ${TR.fast}, box-shadow ${TR.fast}`,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="pwd-toggle"
                  aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  aria-pressed={showPwd}
                  style={{
                    position:      'absolute', right: 0, top: 0, bottom: 0,
                    width:         '42px',
                    background:    'none', border: 'none',
                    cursor:        'pointer',
                    color:         C.dim,
                    display:       'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius:  `0 ${R.md} ${R.md} 0`,
                    transition:    `color ${TR.fast}`,
                  }}
                >
                  <IconEye show={showPwd} />
                </button>
              </div>
            </div>

            {/* Deactivated warning */}
            {deactivated && (
              <div style={{
                display:      'flex', alignItems: 'flex-start', gap: SP[2.5],
                padding:      `${SP[3]} ${SP[3.5]}`,
                background:   C.orangeBg,
                border:       `1px solid ${C.orangeBd}`,
                borderRadius: R.md,
                animation:    'slideDown 0.2s ease both',
              }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"
                  style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M8 1.5L14.5 13H1.5L8 1.5Z" stroke={C.orange}
                    strokeWidth="1.3" strokeLinejoin="round"/>
                  <path d="M8 6v3.5" stroke={C.orange} strokeWidth="1.4" strokeLinecap="round"/>
                  <circle cx="8" cy="11.5" r="0.75" fill={C.orange}/>
                </svg>
                <p style={{
                  color: C.orange, fontSize: F.sm, margin: 0, lineHeight: F.lhRelaxed,
                }}>
                  Ce compte a été désactivé. Contactez un administrateur.
                </p>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div id="login-error" role="alert" style={{
                display:      'flex', alignItems: 'flex-start', gap: SP[2.5],
                padding:      `${SP[3]} ${SP[3.5]}`,
                background:   C.redBg,
                border:       `1px solid ${C.redBd}`,
                borderRadius: R.md,
                animation:    'slideDown 0.2s ease both',
              }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"
                  style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="8" cy="8" r="6.5" stroke={C.red} strokeWidth="1.3"/>
                  <path d="M8 5v3.5" stroke={C.red} strokeWidth="1.4" strokeLinecap="round"/>
                  <circle cx="8" cy="11" r="0.75" fill={C.red}/>
                </svg>
                <p style={{
                  color: C.red, fontSize: F.sm, margin: 0, lineHeight: F.lhRelaxed,
                }}>
                  {error}
                </p>
              </div>
            )}

            {/* Submit */}
            <button
              className="btn-amber"
              type="submit"
              disabled={loading}
              style={{
                padding:       `0 ${SP[6]}`,
                height:        '48px',
                borderRadius:  R.md,
                border:        'none',
                cursor:        loading ? 'not-allowed' : 'pointer',
                fontSize:      F.base,
                fontWeight:    F.bold,
                fontFamily:    F.body,
                letterSpacing: '-0.01em',
                marginTop:     SP[1],
                display:       'flex', alignItems: 'center',
                justifyContent: 'center', gap: SP[2],
                width:         '100%',
              }}
            >
              {loading ? (
                <><span className="spinner" />Connexion…</>
              ) : (
                <>Se connecter <IconArrow /></>
              )}
            </button>
          </form>

          {/* Forgot password */}
          <p style={{
            textAlign:  'center',
            fontSize:   F.sm,
            color:      C.dim,
            marginTop:  SP[5],
            lineHeight: F.lhRelaxed,
          }}>
            Mot de passe oublié ?{' '}
            <span style={{ color: C.muted, fontWeight: F.medium }}>
              Contactez votre administrateur.
            </span>
          </p>

          {/* Footer */}
          <div style={{
            marginTop:   SP[10],
            paddingTop:  SP[5],
            borderTop:   `1px solid ${C.borderSub}`,
            display:     'flex', alignItems: 'center',
            justifyContent: 'center', gap: SP[2],
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: R.xs,
              background:  `linear-gradient(150deg, ${C.amberActive}, ${C.amber})`,
              display:     'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MeramMark size={10} color="#FAF5EE" />
            </div>
            <span style={{
              fontSize:      F.xs, color: C.dim,
              letterSpacing: F.lsWide, fontWeight: F.medium,
            }}>
              Développé par Majestor Kepseu
            </span>
          </div>
        </div>
      </div>

      {/* ── Scoped styles ── */}
      <style>{`
        .login-input::placeholder { color: ${C.dim}; opacity: 1; }
        .pwd-toggle:hover { color: ${C.muted} !important; }

        @keyframes loginShake {
          0%,100% { transform: translateX(0); }
          15%     { transform: translateX(-5px); }
          30%     { transform: translateX(5px); }
          45%     { transform: translateX(-4px); }
          60%     { transform: translateX(4px); }
          75%     { transform: translateX(-2px); }
          90%     { transform: translateX(2px); }
        }
        .login-shake { animation: loginShake 0.52s cubic-bezier(0.36,0.07,0.19,0.97) both; }

        /* Mobile: collapse brand panel, show compact logo */
        @media (max-width: 740px) {
          .login-brand-panel { display: none !important; }

          .login-form-panel {
            padding:     0 !important;
            align-items: stretch !important;
          }

          .login-inner {
            padding:         max(56px, env(safe-area-inset-top, 56px)) 24px
                             max(40px, env(safe-area-inset-bottom, 40px)) 24px !important;
            min-height:      100dvh !important;
            display:         flex !important;
            flex-direction:  column !important;
            justify-content: center !important;
            animation:       none !important;
          }

          .login-mobile-logo { display: flex !important; }
        }

        @media (max-width: 740px) and (max-height: 580px) {
          .login-inner {
            justify-content: flex-start !important;
            padding-top: max(32px, env(safe-area-inset-top, 32px)) !important;
          }
        }
      `}</style>
    </main>
  )
}
