'use client'

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { useIsMobile }         from '@/hooks/useIsMobile'
import Sidebar                 from '@/components/Sidebar'
import PushSubscription        from '@/components/PushSubscription'
import type { BadgeCounts }    from '@/lib/supabase/badge-counts'

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif"

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

// ── Mobile header hamburger icon ──────────────────────────────────────────────
function IconMenu({ size = 18, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 14" fill="none">
      <path d="M1 1h16M1 7h16M1 13h10" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

// ── Refresh icon ──────────────────────────────────────────────────────────────
function IconRefresh({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2v6h-6"/>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
      <path d="M3 22v-6h6"/>
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
    </svg>
  )
}

// ── Close icon ────────────────────────────────────────────────────────────────
function IconClose({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M1 1l12 12M13 1L1 13" stroke="#78716C" strokeWidth="2" strokeLinecap="round"/>
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
  const isAdmin   = activeRoute === '/admin'

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateReady(true)
            }
          })
        })
      })
      .catch(err => console.error('[SW]', err))

    // Deduplicate refreshes — both PUSH_RECEIVED and visibilitychange can fire
    // within milliseconds of each other (e.g. user taps a notification: SW fires
    // PUSH_RECEIVED AND the tab visibility changes at the same time).
    // A single pending timer ensures only one refresh fires regardless of how
    // many triggers arrive within the debounce window.
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => { router.refresh() }, 600)
    }

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_RECEIVED') scheduleRefresh()
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
        position: 'fixed', bottom: 80, left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9998,
        background: '#161B22',
        color: '#E6EDF3',
        borderRadius: 14, padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: '0 8px 40px rgba(0,0,0,0.40)',
        maxWidth: 'calc(100vw - 32px)',
        fontFamily: FONT,
        border: '1px solid rgba(255,255,255,0.08)',
        animation: 'slideUp 0.3s ease forwards',
      }}>
        <IconRefresh size={18} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Mise à jour disponible</div>
          <div style={{ fontSize: 11, color: '#8B949E', marginTop: 2 }}>
            Actualisez pour obtenir la dernière version
          </div>
        </div>
        <button
          className="btn-meram"
          onClick={() => window.location.reload()}
          style={{
            border: 'none', color: '#fff',
            borderRadius: 8, padding: '7px 14px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
        >
          Actualiser
        </button>
        <button
          onClick={() => setUpdateReady(false)}
          style={{
            background: 'transparent', border: 'none', color: '#78716C',
            cursor: 'pointer', padding: 4, lineHeight: 1,
            display: 'flex', alignItems: 'center',
          }}
          aria-label="Fermer"
        >
          <IconClose size={14} />
        </button>
      </div>
    )}

    <div style={{
      display: 'flex', minHeight: '100vh',
      fontFamily: FONT,
      background: '#F5F2ED',
    }}>

      {/* ── Mobile top bar ── */}
      {isMobile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          background: '#FDFCF9',
          display: 'flex', flexDirection: 'column',
          zIndex: 200,
          borderBottom: '1px solid #E7E5E4',
          boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
        }}>
          {/* Accent stripe (matches sidebar) */}
          <div style={{
            height: 3,
            background: 'linear-gradient(90deg, #1D4ED8 0%, #3B82F6 60%, #60A5FA 100%)',
            flexShrink: 0,
          }} />

          <div style={{
            display: 'flex', alignItems: 'center',
            padding: '0 14px', gap: 12, height: 52,
          }}>
            <button
              onClick={() => setSidebar(o => !o)}
              style={{
                background: '#EDE9E3',
                border: '1px solid #E7E5E4',
                borderRadius: 9,
                width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
                transition: 'background 0.15s ease',
              }}
            >
              <IconMenu size={17} color="#44403C" />
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 15, fontWeight: 700,
                color: '#1C1917',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {pageTitle}
              </div>
            </div>

            {/* MERAM mini wordmark */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 7,
                background: 'linear-gradient(145deg, #1D4ED8, #3B82F6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(37,99,235,0.38)',
              }}>
                <svg width="13" height="11" viewBox="0 0 20 17" fill="none">
                  <path d="M2 15V2L10 9L18 2V15" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2 15h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>
              <span style={{
                fontSize: 13, fontWeight: 800,
                color: '#1C1917',
                letterSpacing: '-0.02em',
              }}>
                MERAM
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Overlay (mobile) ── */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebar(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 150,
            backdropFilter: 'blur(3px)',
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

      <main style={{
        marginLeft: isMobile ? 0 : 240,
        flex: 1,
        padding: isMobile ? '71px 16px 40px' : '32px 40px',
        minWidth: 0,
      }}>
        {children}
      </main>
    </div>
    </>
  )
}
