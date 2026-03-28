'use client'

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { useIsMobile }         from '@/hooks/useIsMobile'
import Sidebar                 from '@/components/Sidebar'
import PushSubscription        from '@/components/PushSubscription'
import type { BadgeCounts }    from '@/lib/supabase/badge-counts'

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
  const [sidebarOpen,    setSidebar]    = useState(false)
  const [updateReady,    setUpdateReady] = useState(false)

  const PAGE_TITLES: Record<string, string> = {
    '/dashboard': 'Tableau de bord',
    '/sales':     'Ventes',
    '/warehouse': 'Entrepôt',
    '/products':  'Catalogue',
    '/users':     'Utilisateurs',
    '/reports':   'Rapports',
    '/admin':     'Administration Plateforme',
  }
  const pageTitle = PAGE_TITLES[activeRoute] ?? 'UCA SGI'

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Register service worker and detect when a new version is ready
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            // New SW installed and waiting — only notify if a previous SW was controlling
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateReady(true)
            }
          })
        })
      })
      .catch(err => console.error('[SW]', err))

    // Listen for SW broadcast: push notification received while page is open
    // → refresh immediately so data is current before user even taps the notif
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_RECEIVED') {
        router.refresh()
      }
    }
    navigator.serviceWorker.addEventListener('message', handleSwMessage)

    // Refresh when app returns to foreground (e.g. user taps notification,
    // switches back from another app, or reopens the PWA from home screen).
    // Debounced to avoid triggering during SPA navigation transitions.
    let visibilityTimer: ReturnType<typeof setTimeout> | null = null
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (visibilityTimer) clearTimeout(visibilityTimer)
        visibilityTimer = setTimeout(() => { router.refresh() }, 600)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage)
      document.removeEventListener('visibilitychange', handleVisibility)
      if (visibilityTimer) clearTimeout(visibilityTimer)
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
        background: '#1B3A6B', color: '#fff',
        borderRadius: 12, padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
        maxWidth: 'calc(100vw - 32px)',
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 2v6h-6"/>
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
          <path d="M3 22v-6h6"/>
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Mise à jour disponible</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
            Actualisez pour obtenir la dernière version
          </div>
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#2563EB', border: 'none', color: '#fff',
            borderRadius: 8, padding: '8px 14px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
        >
          Actualiser
        </button>
        <button
          onClick={() => setUpdateReady(false)}
          style={{
            background: 'transparent', border: 'none', color: '#64748B',
            cursor: 'pointer', padding: 4, lineHeight: 1,
          }}
          aria-label="Fermer"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="1" y1="1" x2="13" y2="13"/>
            <line x1="13" y1="1" x2="1" y2="13"/>
          </svg>
        </button>
      </div>
    )}

    <div style={{
      display: 'flex', minHeight: '100vh',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      background: '#F8FAFC',
    }}>

      {/* ── Mobile top bar ── */}
      {isMobile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 56,
          background: '#0C1A35',
          display: 'flex', alignItems: 'center',
          padding: '0 16px', gap: 12, zIndex: 200,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}>
          <button
            onClick={() => setSidebar(o => !o)}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: 'white',
              width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M2 8h12M2 12h12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 15, fontWeight: 700, color: 'white',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {pageTitle}
            </div>
            <div style={{
              fontSize: 9.5, color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 1,
              fontFamily: 'Georgia, serif',
            }}>
              UCA SGI
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
            background: 'rgba(0,0,0,0.6)',
            zIndex: 150,
            backdropFilter: 'blur(2px)',
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
        padding: isMobile ? '68px 16px 32px' : '32px 40px',
        minWidth: 0,
      }}>
        {children}
      </main>
    </div>
    </>
  )
}
