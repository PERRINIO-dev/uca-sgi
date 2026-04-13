'use client'

import { useRouter }                        from 'next/navigation'
import { useTransition, useEffect, useState } from 'react'
import { useIsMobile }                      from '@/hooks/useIsMobile'
import type { BadgeCounts }                 from '@/lib/supabase/badge-counts'
import { C, F, R, SP, SH, TR, Z }          from '@/lib/design-system'

const ROLE_LABELS: Record<string, string> = {
  owner:     'Propriétaire',
  admin:     'Administrateur',
  vendor:    'Vendeur',
  warehouse: 'Magasinier',
}

// ── Icons ──────────────────────────────────────────────────────────────────────
function IconDashboard({ c = 'currentColor' }: { c?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2"    y="2"    width="7.5" height="7.5" rx="1.8" fill={c} opacity="0.9"/>
      <rect x="10.5" y="2"    width="7.5" height="7.5" rx="1.8" fill={c} opacity="0.45"/>
      <rect x="2"    y="10.5" width="7.5" height="7.5" rx="1.8" fill={c} opacity="0.45"/>
      <rect x="10.5" y="10.5" width="7.5" height="7.5" rx="1.8" fill={c} opacity="0.9"/>
    </svg>
  )
}
function IconSales({ c = 'currentColor' }: { c?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2.5 4h1.8l2.8 8.5h7.5l1.9-5.5H6" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="8"  cy="16" r="1.4" fill={c}/>
      <circle cx="14" cy="16" r="1.4" fill={c}/>
    </svg>
  )
}
function IconWarehouse({ c = 'currentColor' }: { c?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2 8.8L10 3l8 5.8V17.5H2V8.8Z" stroke={c} strokeWidth="1.5" strokeLinejoin="round"/>
      <rect x="7" y="11.5" width="6" height="6" rx="1" stroke={c} strokeWidth="1.3"/>
    </svg>
  )
}
function IconCatalog({ c = 'currentColor' }: { c?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2"  y="2" width="7" height="5" rx="1.5" stroke={c} strokeWidth="1.4"/>
      <rect x="11" y="2" width="7" height="5" rx="1.5" stroke={c} strokeWidth="1.4"/>
      <rect x="2"  y="9" width="7" height="5" rx="1.5" stroke={c} strokeWidth="1.4"/>
      <rect x="11" y="9" width="7" height="5" rx="1.5" stroke={c} strokeWidth="1.4"/>
      <rect x="2"  y="16" width="16" height="2" rx="1" fill={c} opacity="0.45"/>
    </svg>
  )
}
function IconUsers({ c = 'currentColor' }: { c?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="8" cy="6" r="3" stroke={c} strokeWidth="1.5"/>
      <path d="M2 17c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14 8a2.5 2.5 0 100-5"         stroke={c} strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M17 17c0-2.2-1.3-3.8-3-4.5"   stroke={c} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}
function IconReports({ c = 'currentColor' }: { c?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="14" height="16" rx="2" stroke={c} strokeWidth="1.4"/>
      <path d="M7 7h6M7 10.5h6M7 14h4" stroke={c} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}
function IconQuote({ c = 'currentColor' }: { c?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 2h9l4 4v12a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1Z" stroke={c} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M13 2v5h4" stroke={c} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M7 10h6M7 13h6M7 16h4" stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
function IconPlatform({ c = 'currentColor' }: { c?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="5" width="16" height="12" rx="1.5" stroke={c} strokeWidth="1.4"/>
      <path d="M6 10h2M12 10h2M6 13h2M12 13h2" stroke={c} strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M9 17V9" stroke={c} strokeWidth="1.3"/>
      <path d="M6 5V3.5a1 1 0 011-1h6a1 1 0 011 1V5" stroke={c} strokeWidth="1.3"/>
    </svg>
  )
}
function IconBell({ c = 'currentColor', filled = false }: { c?: string; filled?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? c : 'none'}
      stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  )
}
function IconLogout({ c = 'currentColor', size = 15 }: { c?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M13.5 4.5l4 5.5-4 5.5" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17.5 10H8"             stroke={c} strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M8 3H5a2 2 0 00-2 2v10a2 2 0 002 2h3" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function IconX({ size = 14, color }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1 1l12 12M13 1L1 13" stroke={color ?? C.muted} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

// ── Nav config ─────────────────────────────────────────────────────────────────
type NavIcon = React.FC<{ c?: string }>
const NAV_ITEMS: [NavIcon, string, string, string[]][] = [
  [IconDashboard, 'Tableau de bord', '/dashboard',  ['owner', 'admin']],
  [IconSales,     'Ventes',          '/sales',      ['owner', 'admin', 'vendor']],
  [IconQuote,     'Devis',           '/quotes',     ['owner', 'admin', 'vendor']],
  [IconWarehouse, 'Entrepôt',        '/warehouse',  ['owner', 'admin', 'warehouse']],
  [IconCatalog,   'Catalogue',       '/products',   ['owner', 'admin']],
  [IconUsers,     'Utilisateurs',    '/users',      ['owner', 'admin']],
  [IconReports,   'Rapports',        '/reports',    ['owner', 'admin']],
]

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const parts   = name.trim().split(' ')
  const letters = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: 32, height: 32, borderRadius: R.full,
      background:  `linear-gradient(135deg, hsl(${hue},40%,20%), hsl(${(hue+40)%360},50%,30%))`,
      border:      `1.5px solid rgba(160,83,26,0.30)`,
      display:     'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink:  0,
      fontSize:    11, fontWeight: F.bold, color: C.sidebarInk,
      letterSpacing: '0.04em',
      fontFamily:  F.body,
    }}>
      {letters}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
export default function Sidebar({
  profile,
  activeRoute,
  onLogout,
  isMobileOpen = true,
  onClose,
  badgeCounts,
}: {
  profile:       { full_name: string; role: string; is_platform_admin?: boolean }
  activeRoute:   string
  onLogout:      () => void
  isMobileOpen?: boolean
  onClose?:      () => void
  badgeCounts?:  BadgeCounts
}) {
  const router   = useRouter()
  const isMobile = useIsMobile()
  const [isPending,       startTransition]  = useTransition()
  const [notifSupported,  setNotifSupported] = useState(false)
  const [notifState,      setNotifState]     = useState<'subscribed'|'denied'|'default'>('default')
  const [notifLoading,    setNotifLoading]   = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  const isAdmin      = profile.is_platform_admin === true
  const visibleItems = isAdmin
    ? []
    : NAV_ITEMS.filter(([,,, roles]) => roles.includes(profile.role))

  useEffect(() => {
    visibleItems.forEach(([,, href]) => router.prefetch(href))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    setNotifSupported(true)
    if (Notification.permission === 'denied') { setNotifState('denied'); return }
    if (Notification.permission !== 'granted') return
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => {
        if (sub) setNotifState('subscribed')
      })
    )
  }, [])

  const handleNotifToggle = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    setNotifLoading(true)
    try {
      if (notifState === 'subscribed') {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) })
          await sub.unsubscribe()
          setNotifState('default')
        }
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setNotifState('denied'); return }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!key) return
      const reg     = await navigator.serviceWorker.ready
      const padding = '='.repeat((4 - (key.length % 4)) % 4)
      const b64     = (key + padding).replace(/-/g, '+').replace(/_/g, '/')
      const raw     = window.atob(b64)
      const arr     = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: arr.buffer as ArrayBuffer })
      await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) })
      setNotifState('subscribed')
    } finally {
      setNotifLoading(false)
    }
  }

  const getNavBadge = (href: string): number => {
    if (!badgeCounts) return 0
    if (href === '/dashboard') return badgeCounts.pendingApprovals
    if (href === '/warehouse') return badgeCounts.confirmedOrders
    return 0
  }

  // Cognac glow for active nav items (cognac value)
  const activeNavGlow = 'rgba(160,83,26,0.14)'

  return (
    <>
      {/* Navigation loading bar */}
      {isPending && (
        <div style={{
          position:       'fixed', top: 0, left: 0, right: 0, height: 2,
          zIndex:         Z.tooltip,
          background:     `linear-gradient(90deg, ${C.amberActive} 0%, ${C.amber} 50%, ${C.amberActive} 100%)`,
          backgroundSize: '200% 100%',
          animation:      'sidebarLoadbar 1.1s linear infinite',
          pointerEvents:  'none',
        }} />
      )}

      <style>{`
        @keyframes sidebarLoadbar {
          0%   { background-position: 100% 0 }
          100% { background-position: -100% 0 }
        }
        .nav-btn:hover {
          background: ${C.sidebarHov} !important;
          color: ${C.sidebarText} !important;
        }
        .nav-btn:hover svg * {
          stroke: ${C.sidebarMuted} !important;
          fill: ${C.sidebarMuted} !important;
        }
        .nav-btn.active svg * {
          stroke: ${C.amber} !important;
          fill: ${C.amber} !important;
        }
        .nav-btn.active { color: ${C.amber} !important; }
        .notif-btn:hover {
          background: ${C.sidebarHov} !important;
          border-color: ${C.sidebarBd} !important;
        }
        .logout-btn:hover {
          background: rgba(127,29,29,0.28) !important;
          color: #FCA5A5 !important;
          border-color: rgba(127,29,29,0.50) !important;
        }
        .logout-btn:hover svg * { stroke: #FCA5A5 !important; }
      `}</style>

      <aside style={{
        width:          240,
        background:     C.sidebarBg,
        display:        'flex',
        flexDirection:  'column',
        flexShrink:     0,
        position:       'fixed',
        top: 0, left: 0, bottom: 0,
        transform:      isMobileOpen ? 'translateX(0)' : 'translateX(-240px)',
        transition:     `transform ${TR.smooth}`,
        zIndex:         Z.overlay,
        fontFamily:     F.body,
        borderRight:    `1px solid ${C.sidebarBd}`,
        boxShadow:      `4px 0 32px rgba(0,0,0,0.25)`,
      }}>

        {/* Cognac accent stripe */}
        <div style={{ height: 3, background: C.amber, flexShrink: 0 }} />

        {/* Logo */}
        <div style={{
          padding:      `${SP[4]} ${SP[5]} ${SP[4]}`,
          borderBottom: `1px solid ${C.sidebarBd}`,
          flexShrink:   0,
          display:      'flex', alignItems: 'center', gap: SP[2.5],
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: R.lg,
            background:  `linear-gradient(145deg, ${C.amberActive} 0%, ${C.amber} 100%)`,
            display:     'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink:  0,
            boxShadow:   SH.amberSm,
          }}>
            <svg width="16" height="13" viewBox="0 0 20 17" fill="none" aria-hidden="true">
              <path d="M2 15V2L10 9L18 2V15" stroke="#FAF5EE" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 15h16"              stroke="#FAF5EE" strokeWidth="2.4" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div style={{
              fontSize:      F.lg,
              fontWeight:    F.bold,
              fontFamily:    F.display,
              color:         C.sidebarInk,
              letterSpacing: '-0.02em',
              lineHeight:    1,
            }}>
              MERAM
            </div>
            <div style={{
              fontSize:      '8.5px',
              color:         C.sidebarDim,
              letterSpacing: F.lsWidest,
              marginTop:     '2px',
              textTransform: 'uppercase',
              fontWeight:    F.semibold,
            }}>
              Manage · Sell · Optimize
            </div>
          </div>
        </div>

        {/* User card */}
        <div style={{
          padding:      `${SP[3]} ${SP[4]}`,
          borderBottom: `1px solid ${C.sidebarBd}`,
          display:      'flex', alignItems: 'center', gap: SP[2],
          flexShrink:   0,
          background:   C.sidebarEl,
        }}>
          <Avatar name={profile.full_name} />
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize:      F.base,
              fontWeight:    F.semibold,
              color:         C.sidebarInk,
              whiteSpace:    'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              lineHeight:    F.lhSnug,
            }}>
              {profile.full_name}
            </div>
            <div style={{
              fontSize:   F.xs,
              color:      C.sidebarMuted,
              marginTop:  '2px',
              fontWeight: F.medium,
            }}>
              {isAdmin ? 'Opérateur Plateforme' : (ROLE_LABELS[profile.role] ?? profile.role)}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: `${SP[2]} ${SP[2]}`, overflowY: 'auto' }}>

          {visibleItems.length > 0 && (
            <div style={{
              padding:       `${SP[3]} ${SP[3]} ${SP[2]}`,
              fontSize:      '10px',
              fontWeight:    F.bold,
              color:         C.sidebarDim,
              letterSpacing: F.lsWider,
              textTransform: 'uppercase',
            }}>
              Navigation
            </div>
          )}

          {visibleItems.map(([Icon, label, href]) => {
            const active = activeRoute === href
            const badge  = getNavBadge(href)
            return (
              <button
                key={href}
                className={`nav-btn${active ? ' active' : ''}`}
                onMouseEnter={() => router.prefetch(href)}
                onClick={() => { onClose?.(); startTransition(() => router.push(href)) }}
                style={{
                  display:      'flex', alignItems: 'center', gap: SP[3],
                  width:        '100%',
                  padding:      isMobile ? `${SP[3]} ${SP[3]}` : `${SP[2]} ${SP[3]}`,
                  marginBottom: SP[0.5],
                  border:       'none',
                  borderLeft:   `3px solid ${active ? C.amber : 'transparent'}`,
                  borderRadius: `0 ${R.md} ${R.md} 0`,
                  background:   active ? activeNavGlow : 'transparent',
                  color:        active ? C.amber : C.sidebarMuted,
                  fontSize:     F.base,
                  fontWeight:   active ? F.semibold : F.regular,
                  fontFamily:   F.body,
                  cursor:       isPending ? 'default' : 'pointer',
                  textAlign:    'left',
                  opacity:      isPending && !active ? 0.5 : 1,
                  transition:   `background ${TR.fast}, color ${TR.fast}, border-color ${TR.fast}`,
                }}
              >
                <Icon c={active ? C.amber : C.sidebarMuted} />
                <span style={{ flex: 1 }}>{label}</span>
                {badge > 0 && (
                  <span style={{
                    minWidth:     18, height: 18, padding: '0 5px',
                    borderRadius: R.full,
                    background:   C.amber,
                    color:        '#FAF5EE',
                    fontSize:     '10px', fontWeight: F.bold,
                    display:      'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight:   1, flexShrink: 0,
                    boxShadow:    SH.amberSm,
                  }}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </button>
            )
          })}

          {/* Admin nav */}
          {isAdmin && (
            <>
              <div style={{
                padding:       `${SP[4]} ${SP[3]} ${SP[2]}`,
                fontSize:      '10px', fontWeight: F.bold,
                color:         C.sidebarDim, letterSpacing: F.lsWider, textTransform: 'uppercase',
              }}>
                Plateforme
              </div>
              <button
                className={`nav-btn${activeRoute === '/admin' ? ' active' : ''}`}
                onClick={() => { onClose?.(); startTransition(() => router.push('/admin')) }}
                style={{
                  display:      'flex', alignItems: 'center', gap: SP[3],
                  width:        '100%',
                  padding:      isMobile ? `${SP[3]} ${SP[3]}` : `${SP[2]} ${SP[3]}`,
                  border:       'none',
                  borderLeft:   `3px solid ${activeRoute === '/admin' ? C.amber : 'transparent'}`,
                  borderRadius: `0 ${R.md} ${R.md} 0`,
                  background:   activeRoute === '/admin' ? activeNavGlow : 'transparent',
                  color:        activeRoute === '/admin' ? C.amber : C.sidebarMuted,
                  fontSize:     F.base, fontWeight: activeRoute === '/admin' ? F.semibold : F.regular,
                  fontFamily:   F.body, cursor: 'pointer', textAlign: 'left',
                  transition:   `background ${TR.fast}, color ${TR.fast}`,
                }}
              >
                <IconPlatform c={activeRoute === '/admin' ? C.amber : C.sidebarMuted} />
                <span>Administration</span>
              </button>
            </>
          )}
        </nav>

        {/* Notification toggle */}
        {notifSupported && !isAdmin && (
          <div style={{ padding: `0 ${SP[2]} ${SP[1]}`, flexShrink: 0 }}>
            <button
              className="notif-btn"
              disabled={notifLoading || notifState === 'denied'}
              onClick={handleNotifToggle}
              style={{
                width:        '100%', padding: `${SP[2]} ${SP[3]}`,
                borderRadius: R.md,
                background:   notifState === 'subscribed' ? activeNavGlow : 'transparent',
                border:       `1px solid ${notifState === 'subscribed' ? 'rgba(160,83,26,0.35)' : C.sidebarBd}`,
                color:        notifState === 'subscribed' ? C.amber
                            : notifState === 'denied'     ? C.sidebarDim : C.sidebarMuted,
                fontSize:     F.xs, fontWeight: F.medium,
                cursor:       notifLoading || notifState === 'denied' ? 'not-allowed' : 'pointer',
                fontFamily:   F.body,
                display:      'flex', alignItems: 'center', gap: SP[2],
                transition:   `all ${TR.fast}`,
              }}
            >
              {notifLoading
                ? <span className="spinner-light" />
                : <IconBell
                    c={notifState === 'subscribed' ? C.amber : notifState === 'denied' ? C.sidebarDim : C.sidebarMuted}
                    filled={notifState === 'subscribed'}
                  />
              }
              <span>
                {notifLoading             ? 'En cours…'
                 : notifState === 'subscribed' ? 'Notifications activées'
                 : notifState === 'denied'     ? 'Notifications bloquées'
                 : 'Activer les notifications'}
              </span>
            </button>
          </div>
        )}

        {/* Logout */}
        <div style={{
          padding:    `${SP[1]} ${SP[2]} ${SP[5]}`,
          borderTop:  `1px solid ${C.sidebarBd}`,
          flexShrink: 0,
        }}>
          <button
            className="logout-btn"
            onClick={() => setShowLogoutModal(true)}
            style={{
              width:        '100%', padding: `${SP[2]} ${SP[3]}`,
              borderRadius: R.md,
              background:   'transparent',
              border:       `1px solid transparent`,
              color:        C.sidebarDim,
              fontSize:     F.base, fontWeight: F.regular,
              fontFamily:   F.body, cursor: 'pointer',
              display:      'flex', alignItems: 'center', gap: SP[3],
              transition:   `all ${TR.fast}`,
            }}
          >
            <IconLogout c={C.sidebarDim} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* ── Logout confirmation modal (uses light theme — overlaid on cream canvas) ── */}
      {showLogoutModal && (
        <div
          className="modal-overlay"
          style={{
            position:       'fixed', inset: 0,
            background:     'rgba(26,15,6,0.55)',
            display:        'flex', alignItems: 'center', justifyContent: 'center',
            zIndex:         Z.modal, padding: SP[5],
            backdropFilter: 'blur(6px)',
            fontFamily:     F.body,
          }}
        >
          <div
            className="modal-panel"
            style={{
              background:   C.surfaceEl,
              borderRadius: R.xl,
              border:       `1px solid ${C.border}`,
              width:        '100%', maxWidth: 380,
              boxShadow:    SH.xl,
              overflow:     'hidden',
            }}
          >
            {/* Cognac top stripe */}
            <div style={{ height: 3, background: C.red, opacity: 0.7 }} />

            {/* Header */}
            <div style={{
              padding:      `${SP[5]} ${SP[6]} ${SP[4]}`,
              borderBottom: `1px solid ${C.border}`,
              display:      'flex', alignItems: 'flex-start', gap: SP[3],
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: R.lg,
                background:  C.redBg,
                border:      `1px solid ${C.redBd}`,
                display:     'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink:  0,
              }}>
                <IconLogout c={C.red} size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: F.md, fontWeight: F.bold, color: C.ink, marginBottom: SP[1], fontFamily: F.display }}>
                  Confirmer la déconnexion
                </div>
                <div style={{ fontSize: F.sm, color: C.muted, lineHeight: F.lhRelaxed }}>
                  Vous devrez vous reconnecter pour accéder au système.
                </div>
              </div>
              <button
                onClick={() => setShowLogoutModal(false)}
                aria-label="Fermer"
                style={{
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', padding: SP[0.5],
                  display: 'flex', color: C.dim,
                  transition: `color ${TR.fast}`,
                }}
              >
                <IconX size={14} />
              </button>
            </div>

            {/* Actions */}
            <div style={{ padding: `${SP[5]} ${SP[6]}`, display: 'flex', gap: SP[2] }}>
              <button
                className="btn-red"
                onClick={() => { setShowLogoutModal(false); onLogout() }}
                style={{
                  flex: 1, height: 40,
                  border: 'none', borderRadius: R.md,
                  fontSize: F.base, fontWeight: F.bold,
                  cursor: 'pointer', fontFamily: F.body,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SP[2],
                }}
              >
                <IconLogout c="#FEF2F2" size={14} />
                Se déconnecter
              </button>
              <button
                className="btn-ghost"
                onClick={() => setShowLogoutModal(false)}
                style={{
                  padding: `0 ${SP[5]}`, height: 40,
                  borderRadius: R.md, cursor: 'pointer',
                  fontSize: F.base, fontWeight: F.medium,
                  fontFamily: F.body, whiteSpace: 'nowrap',
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
