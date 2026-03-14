'use client'

import { useState, useEffect } from 'react'
import { useIsMobile }         from '@/hooks/useIsMobile'
import Sidebar                 from '@/components/Sidebar'
import type { BadgeCounts }    from '@/lib/supabase/badge-counts'

export default function PageLayout({
  profile,
  activeRoute,
  onLogout,
  children,
  badgeCounts,
}: {
  profile:      { full_name: string; role: string }
  activeRoute:  string
  onLogout:     () => void
  children:     React.ReactNode
  badgeCounts?: BadgeCounts
}) {
  const isMobile                  = useIsMobile()
  const [sidebarOpen, setSidebar] = useState(false)

  const PAGE_TITLES: Record<string, string> = {
    '/dashboard': 'Tableau de bord',
    '/sales':     'Ventes',
    '/warehouse': 'Entrepôt',
    '/products':  'Catalogue',
    '/users':     'Utilisateurs',
    '/reports':   'Rapports',
  }
  const pageTitle = PAGE_TITLES[activeRoute] ?? 'UCA SGI'

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(err => console.error('[SW]', err))
    }
  }, [])

  return (
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
  )
}
