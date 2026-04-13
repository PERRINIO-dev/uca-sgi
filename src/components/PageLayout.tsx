'use client'

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { useIsMobile }         from '@/hooks/useIsMobile'
import Sidebar                 from '@/components/Sidebar'
import PushSubscription        from '@/components/PushSubscription'
import type { BadgeCounts }    from '@/lib/supabase/badge-counts'
import { C, F, R, SP, SH, TR, Z } from '@/lib/design-system'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/sales':     'Ventes',
  '/quotes':    'Devis',
  '/warehouse': 'Entrepôt',
  '/products':  'Catalogue',
  '/users':     'Utilisateurs',
  '/reports':   'Rapports',
  '/admin':     'Administration',
}

function IconMenu() {
  return (
    <svg width="17" height="13" viewBox="0 0 17 13" fill="none" aria-hidden="true">
      <path d="M1 1h15M1 6.5h15M1 12h9" stroke={C.muted} strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  )
}

function IconRefresh() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke={C.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 2v6h-6"/>
      <path d="M3 12a9 9 0 0115-6.7L21 8"/>
      <path d="M3 22v-6h6"/>
      <path d="M21 12a9 9 0 01-15 6.7L3 16"/>
    </svg>
  )
}

function IconX() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1 1l12 12M13 1L1 13" stroke={C.muted} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
export default function PageLayout({
  profile,
  activeRoute,
  onLogout,
  children,
  badgeCounts,
}: {
  profile:      { full_name: string; role: string; is_platform_admin?: boolean }
  activeRoute:  string
  onLogout:     () => void
  children:     React.ReactNode
  badgeCounts?: BadgeCounts
}) {
  const router                    = useRouter()
  const isMobile                  = useIsMobile()
  const [sidebarOpen, setSidebar] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)

  const pageTitle = PAGE_TITLES[activeRoute] ?? 'MERAM'

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        reg.addEventListener('updatefound', () => {
          const w = reg.installing
          if (!w) return
          w.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateReady(true)
            }
          })
        })
      })
      .catch(err => console.error('[SW]', err))

    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => { router.refresh() }, 600)
    }

    const handleSwMessage = (e: MessageEvent) => {
      if (e.data?.type === 'PUSH_RECEIVED') scheduleRefresh()
    }
    navigator.serviceWorker.addEventListener('message', handleSwMessage)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') scheduleRefresh()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage)
      document.removeEventListener('visibilitychange', handleVisibility)
      if (refreshTimer) clearTimeout(refreshTimer)
    }
  }, [router])

  return (
    <>
      <PushSubscription />

      {/* ── SW update toast ── */}
      {updateReady && (
        <div style={{
          position:     'fixed', bottom: 80, left: '50%',
          transform:    'translateX(-50%)',
          zIndex:       Z.toast,
          background:   C.surfaceEl,
          border:       `1px solid ${C.border}`,
          color:        C.text,
          borderRadius: R.xl,
          padding:      `${SP[3]} ${SP[4]}`,
          display:      'flex', alignItems: 'center', gap: SP[3],
          boxShadow:    SH.xl,
          maxWidth:     'calc(100vw - 32px)',
          fontFamily:   F.body,
          animation:    'slideUp 0.28s ease both',
          borderLeft:   `3px solid ${C.amber}`,
        }}>
          <IconRefresh />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: F.base, fontWeight: F.semibold, color: C.ink }}>
              Mise à jour disponible
            </div>
            <div style={{ fontSize: F.xs, color: C.muted, marginTop: '2px' }}>
              Actualisez pour obtenir la dernière version
            </div>
          </div>
          <button
            className="btn-amber"
            onClick={() => window.location.reload()}
            style={{
              border: 'none', borderRadius: R.sm,
              padding: `${SP[1.5]} ${SP[3]}`,
              fontSize: F.xs, fontWeight: F.bold,
              cursor: 'pointer', fontFamily: F.body,
              whiteSpace: 'nowrap', height: 30,
            }}
          >
            Actualiser
          </button>
          <button
            onClick={() => setUpdateReady(false)}
            aria-label="Fermer"
            style={{
              background: 'transparent', border: 'none',
              cursor: 'pointer', padding: SP[1],
              display: 'flex', alignItems: 'center',
              color: C.dim,
            }}
          >
            <IconX />
          </button>
        </div>
      )}

      <div style={{
        display:    'flex',
        minHeight:  '100dvh',
        fontFamily: F.body,
        background: C.bg,
      }}>

        {/* ── Mobile top bar ── */}
        {isMobile && (
          <div style={{
            position:      'fixed', top: 0, left: 0, right: 0,
            background:    C.surface,
            display:       'flex', flexDirection: 'column',
            zIndex:        Z.sticky,
            borderBottom:  `1px solid ${C.border}`,
            boxShadow:     SH.sm,
          }}>
            {/* Cognac accent stripe */}
            <div style={{ height: 3, background: C.amber, flexShrink: 0 }} />

            <div style={{
              display:    'flex', alignItems: 'center',
              padding:    `0 ${SP[3]}`, gap: SP[3], height: 52,
            }}>
              {/* Hamburger */}
              <button
                onClick={() => setSidebar(o => !o)}
                aria-label="Ouvrir le menu"
                style={{
                  background:   C.surfaceHov,
                  border:       `1px solid ${C.border}`,
                  borderRadius: R.md,
                  width: 36, height: 36,
                  display:      'flex', alignItems: 'center', justifyContent: 'center',
                  cursor:       'pointer', flexShrink: 0,
                  transition:   `background ${TR.fast}`,
                }}
              >
                <IconMenu />
              </button>

              {/* Page title */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize:      F.md,
                  fontWeight:    F.bold,
                  fontFamily:    F.display,
                  color:         C.ink,
                  letterSpacing: F.lsTight,
                  whiteSpace:    'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {pageTitle}
                </div>
              </div>

              {/* MERAM wordmark */}
              <div style={{ display: 'flex', alignItems: 'center', gap: SP[1.5], flexShrink: 0 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: R.sm,
                  background:  `linear-gradient(145deg, ${C.amberActive}, ${C.amber})`,
                  display:     'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow:   SH.amberSm,
                }}>
                  <svg width="12" height="10" viewBox="0 0 20 17" fill="none" aria-hidden="true">
                    <path d="M2 15V2L10 9L18 2V15" stroke="#FAF5EE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 15h16"              stroke="#FAF5EE" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <span style={{
                  fontSize:      F.base,
                  fontWeight:    F.bold,
                  fontFamily:    F.display,
                  color:         C.ink,
                  letterSpacing: F.lsTighter,
                }}>
                  MERAM
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Mobile overlay ── */}
        {isMobile && sidebarOpen && (
          <div
            onClick={() => setSidebar(false)}
            style={{
              position:       'fixed', inset: 0,
              background:     'rgba(26,15,6,0.55)',
              zIndex:         Z.overlay - 10,
              backdropFilter: 'blur(4px)',
            }}
          />
        )}

        <Sidebar
          profile={profile}
          activeRoute={activeRoute}
          onLogout={onLogout}
          isMobileOpen={!isMobile || sidebarOpen}
          onClose={() => setSidebar(false)}
          badgeCounts={badgeCounts}
        />

        {/* ── Page content ── */}
        <main style={{
          marginLeft: isMobile ? 0 : 240,
          flex:       1,
          padding:    isMobile
            ? `${SP[14]} ${SP[4]} ${SP[10]}`
            : `${SP[8]} ${SP[10]}`,
          minWidth:   0,
        }}>
          {children}
        </main>
      </div>
    </>
  )
}
