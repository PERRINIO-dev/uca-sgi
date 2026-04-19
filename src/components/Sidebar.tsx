'use client'

import { useRouter }                          from 'next/navigation'
import { useTransition, useEffect, useState } from 'react'
import { useIsMobile }                        from '@/hooks/useIsMobile'
import type { BadgeCounts }                   from '@/lib/supabase/badge-counts'
import { C, F, R, SP, SH, TR, Z }            from '@/lib/design-system'

const ROLE_LABELS: Record<string, string> = {
  owner:     'Propriétaire',
  admin:     'Administrateur',
  vendor:    'Vendeur',
  warehouse: 'Magasinier',
}

// ═════════════════════════════════════════════════════════════════════════════
// ICONS
// ═════════════════════════════════════════════════════════════════════════════

function IconDashboard({ c = 'currentColor' }: { c?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2"    y="2"    width="7.5" height="7.5" rx="2" fill={c} opacity="0.85"/>
      <rect x="10.5" y="2"    width="7.5" height="7.5" rx="2" fill={c} opacity="0.35"/>
      <rect x="2"    y="10.5" width="7.5" height="7.5" rx="2" fill={c} opacity="0.35"/>
      <rect x="10.5" y="10.5" width="7.5" height="7.5" rx="2" fill={c} opacity="0.85"/>
    </svg>
  )
}

function IconSales({ c = 'currentColor' }: { c?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2.5 4h2l2.8 8h7.2l2-5.5H6.5" stroke={c} strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="8.5"  cy="15.5" r="1.3" fill={c}/>
      <circle cx="14.5" cy="15.5" r="1.3" fill={c}/>
    </svg>
  )
}

function IconWarehouse({ c = 'currentColor' }: { c?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M2.5 9L10 3.5L17.5 9V17H2.5V9Z" stroke={c} strokeWidth="1.5" strokeLinejoin="round"/>
      <rect x="7.5" y="11.5" width="5" height="5.5" rx="1" stroke={c} strokeWidth="1.3"/>
    </svg>
  )
}

function IconCatalog({ c = 'currentColor' }: { c?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2.5"  y="2.5" width="6" height="5"  rx="1.5" stroke={c} strokeWidth="1.35"/>
      <rect x="11.5" y="2.5" width="6" height="5"  rx="1.5" stroke={c} strokeWidth="1.35"/>
      <rect x="2.5"  y="9.5" width="6" height="5"  rx="1.5" stroke={c} strokeWidth="1.35"/>
      <rect x="11.5" y="9.5" width="6" height="5"  rx="1.5" stroke={c} strokeWidth="1.35"/>
      <rect x="2.5"  y="16.5" width="15" height="1.5" rx="0.75" fill={c} opacity="0.35"/>
    </svg>
  )
}

function IconUsers({ c = 'currentColor' }: { c?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="8" cy="6.5" r="2.8" stroke={c} strokeWidth="1.5"/>
      <path d="M2 17c0-3 2.5-5 6-5s6 2 6 5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14.5 8.5a2.5 2.5 0 100-5"        stroke={c} strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M17.5 17c0-2-1.2-3.6-3-4.3"       stroke={c} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

function IconReports({ c = 'currentColor' }: { c?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3.5" y="2.5" width="13" height="15" rx="2" stroke={c} strokeWidth="1.4"/>
      <path d="M7 7.5h6M7 11h6M7 14.5h4" stroke={c} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

function IconQuote({ c = 'currentColor' }: { c?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4.5 2.5h8.5l4 4v11a1 1 0 01-1 1H4.5a1 1 0 01-1-1V3.5a1 1 0 011-1Z"
        stroke={c} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M13 2.5V7h4" stroke={c} strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M7 10.5h6M7 13.5h6M7 16.5h4" stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

function IconCustomers({ c = 'currentColor' }: { c?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="9.5" cy="6.5" r="2.8" stroke={c} strokeWidth="1.5"/>
      <path d="M3 18c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="15.5" cy="5" r="2.2" fill={c} opacity="0.55"/>
      <path d="M14.8 5h1.4M15.5 4.3v1.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0"/>
    </svg>
  )
}

function IconPlatform({ c = 'currentColor' }: { c?: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2.5" y="5" width="15" height="11" rx="1.5" stroke={c} strokeWidth="1.4"/>
      <path d="M6 9.5h2M12 9.5h2M6 12.5h2M12 12.5h2" stroke={c} strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M9.5 16.5V9" stroke={c} strokeWidth="1.3"/>
      <path d="M6.5 5V3.5a1 1 0 011-1h5a1 1 0 011 1V5" stroke={c} strokeWidth="1.3"/>
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

// ── MERAM Logo Mark ─────────────────────────────────────────────────────────
// The M-with-baseline: two pillars + diagonal valley + horizontal baseline.
// A geometric lettermark — clean, architectural, unmistakable at all sizes.
function MeramMark({ size = 17, color = '#FAF5EE' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={Math.round(size * 0.8)} viewBox="0 0 20 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 14V2.5L10 9L17.5 2.5V14"
        stroke={color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M2.5 14h15"
        stroke={color} strokeWidth="2.3" strokeLinecap="round"
      />
    </svg>
  )
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const parts   = name.trim().split(' ')
  const letters = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
  const hue = name.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: 32, height: 32, borderRadius: R.full,
      background: `linear-gradient(135deg, hsl(${hue},45%,22%), hsl(${(hue+40)%360},52%,32%))`,
      border:     `1.5px solid rgba(160,83,26,0.28)`,
      display:    'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      fontSize:   11, fontWeight: F.bold, color: C.sidebarInk,
      letterSpacing: '0.04em', fontFamily: F.body,
    }}>
      {letters}
    </div>
  )
}

// ── Nav config ─────────────────────────────────────────────────────────────────
type NavIcon = React.FC<{ c?: string }>
const NAV_ITEMS: [NavIcon, string, string, string[]][] = [
  [IconDashboard, 'Tableau de bord', '/dashboard',  ['owner', 'admin']],
  [IconSales,     'Ventes',          '/sales',      ['owner', 'admin', 'vendor']],
  [IconQuote,     'Devis',           '/quotes',     ['owner', 'admin', 'vendor']],
  [IconWarehouse, 'Entrepôt',        '/warehouse',  ['owner', 'admin', 'warehouse']],
  [IconCustomers, 'Clients',         '/customers',  ['owner', 'admin', 'vendor']],
  [IconCatalog,   'Catalogue',       '/products',   ['owner', 'admin']],
  [IconUsers,     'Utilisateurs',    '/users',      ['owner', 'admin']],
  [IconReports,   'Rapports',        '/reports',    ['owner', 'admin']],
]

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
  const [isPending,       startTransition]   = useTransition()
  const [notifSupported,  setNotifSupported]  = useState(false)
  const [notifState,      setNotifState]      = useState<'subscribed'|'denied'|'default'>('default')
  const [notifLoading,    setNotifLoading]    = useState(false)
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
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
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
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: arr.buffer as ArrayBuffer,
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })
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

  const activeGlow = 'rgba(160,83,26,0.12)'

  return (
    <>
      {/* ── Navigation loading bar ── */}
      {isPending && (
        <div style={{
          position:       'fixed', top: 0, left: 0, right: 0, height: 2,
          zIndex:         Z.tooltip,
          background:     `linear-gradient(90deg, ${C.amberActive} 0%, ${C.amber} 50%, ${C.amberDim} 100%)`,
          backgroundSize: '200% 100%',
          animation:      'sidebarLoadbar 1.2s linear infinite',
          pointerEvents:  'none',
        }} />
      )}

      <style>{`
        @keyframes sidebarLoadbar {
          0%   { background-position: 100% 0 }
          100% { background-position: -100% 0 }
        }
        .nav-item:hover {
          background: ${C.sidebarHov} !important;
        }
        .nav-item.active {
          background: ${activeGlow} !important;
          border-left-color: ${C.amber} !important;
        }
        .nav-item.active .nav-label {
          color: ${C.amber} !important;
          font-weight: 600 !important;
        }
        .nav-item:not(.active):hover .nav-label {
          color: ${C.sidebarText} !important;
        }
        .notif-btn:hover {
          background: ${C.sidebarHov} !important;
        }
        .logout-btn:hover {
          background: rgba(127,29,29,0.22) !important;
          border-color: rgba(127,29,29,0.45) !important;
        }
        .logout-btn:hover .logout-label {
          color: #FCA5A5 !important;
        }
        .logout-btn:hover svg path {
          stroke: #FCA5A5 !important;
        }
      `}</style>

      {/* ── Sidebar panel ── */}
      <aside style={{
        width:         240,
        background:    C.sidebarBg,
        display:       'flex',
        flexDirection: 'column',
        flexShrink:    0,
        position:      'fixed',
        top: 0, left: 0, bottom: 0,
        transform:     isMobileOpen ? 'translateX(0)' : 'translateX(-240px)',
        transition:    `transform ${TR.smooth}`,
        zIndex:        Z.overlay,
        fontFamily:    F.body,
        borderRight:   `1px solid ${C.sidebarBd}`,
        boxShadow:     `6px 0 40px rgba(0,0,0,0.22)`,
      }}>

        {/* Cognac accent line at top */}
        <div style={{ height: 3, background: C.amber, flexShrink: 0, opacity: 0.9 }} />

        {/* ── Logo area ── */}
        <div style={{
          padding:      `${SP[4]} ${SP[5]}`,
          borderBottom: `1px solid ${C.sidebarBd}`,
          display:      'flex', alignItems: 'center', gap: SP[3],
          flexShrink:   0,
        }}>
          {/* Icon container — cognac gradient with subtle inner highlight */}
          <div style={{
            width:        34,
            height:       34,
            borderRadius: R.lg,
            background:   `linear-gradient(150deg, ${C.amberActive} 0%, ${C.amber} 65%, ${C.amberDim} 100%)`,
            display:      'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink:   0,
            boxShadow:    `${SH.amberSm}, inset 0 1px 0 rgba(255,255,255,0.14)`,
          }}>
            <MeramMark size={17} color="#FAF5EE" />
          </div>

          {/* Wordmark */}
          <div style={{
            fontSize:      F.xl,
            fontWeight:    F.xbold,
            fontFamily:    F.display,
            color:         C.sidebarInk,
            letterSpacing: '-0.025em',
            lineHeight:    1,
          }}>
            MERAM
          </div>
        </div>

        {/* ── User card ── */}
        <div style={{
          padding:      `${SP[3]} ${SP[4]}`,
          borderBottom: `1px solid ${C.sidebarBd}`,
          display:      'flex', alignItems: 'center', gap: SP[2.5],
          flexShrink:   0,
          background:   C.sidebarEl,
        }}>
          <Avatar name={profile.full_name} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize:      F.sm,
              fontWeight:    F.semibold,
              color:         C.sidebarInk,
              whiteSpace:    'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              lineHeight:    F.lhSnug,
            }}>
              {profile.full_name}
            </div>
            <div style={{
              fontSize:    F.xs,
              color:       C.sidebarMuted,
              marginTop:   '2px',
              fontWeight:  F.medium,
              lineHeight:  1.2,
            }}>
              {isAdmin ? 'Opérateur Plateforme' : (ROLE_LABELS[profile.role] ?? profile.role)}
            </div>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav style={{ flex: 1, padding: `${SP[2]} ${SP[2]}`, overflowY: 'auto' }} aria-label="Navigation principale">


          {visibleItems.map(([Icon, label, href]) => {
            const active = activeRoute === href
            const badge  = getNavBadge(href)
            return (
              <button
                key={href}
                className={`nav-item${active ? ' active' : ''}`}
                onMouseEnter={() => router.prefetch(href)}
                onClick={() => { onClose?.(); startTransition(() => router.push(href)) }}
                aria-current={active ? 'page' : undefined}
                style={{
                  display:      'flex', alignItems: 'center', gap: SP[3],
                  width:        '100%',
                  padding:      isMobile ? `${SP[3.5]} ${SP[3]}` : `${SP[3]} ${SP[3]}`,
                  marginBottom: SP[0.5],
                  border:       'none',
                  borderLeft:   `3px solid ${active ? C.amber : 'transparent'}`,
                  borderRadius: `0 ${R.md} ${R.md} 0`,
                  background:   active ? activeGlow : 'transparent',
                  cursor:       isPending ? 'default' : 'pointer',
                  textAlign:    'left',
                  opacity:      isPending && !active ? 0.5 : 1,
                  transition:   `background ${TR.fast}, border-color ${TR.fast}`,
                }}
              >
                <Icon c={active ? C.amber : C.sidebarMuted} />
                <span className="nav-label" style={{
                  flex:       1,
                  fontSize:   '13px',
                  color:      active ? C.amber : C.sidebarMuted,
                  fontWeight: active ? F.semibold : F.regular,
                  fontFamily: F.body,
                  lineHeight: F.lhSnug,
                }}>
                  {label}
                </span>
                {badge > 0 && (
                  <span className="count-badge" style={{
                    background: C.amber,
                    color:      '#FAF5EE',
                    boxShadow:  SH.amberSm,
                    fontSize:   '10px', fontWeight: F.bold,
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
                padding:       `${SP[4]} ${SP[3]} ${SP[1.5]}`,
                fontSize:      '10px', fontWeight: F.bold,
                color:         C.sidebarDim, letterSpacing: F.lsWider, textTransform: 'uppercase',
              }}>
                Plateforme
              </div>
              <button
                className={`nav-item${activeRoute === '/admin' ? ' active' : ''}`}
                onClick={() => { onClose?.(); startTransition(() => router.push('/admin')) }}
                style={{
                  display:      'flex', alignItems: 'center', gap: SP[3],
                  width:        '100%',
                  padding:      isMobile ? `${SP[3.5]} ${SP[3]}` : `${SP[3]} ${SP[3]}`,
                  border:       'none',
                  borderLeft:   `3px solid ${activeRoute === '/admin' ? C.amber : 'transparent'}`,
                  borderRadius: `0 ${R.md} ${R.md} 0`,
                  background:   activeRoute === '/admin' ? activeGlow : 'transparent',
                  cursor:       'pointer', textAlign: 'left',
                  transition:   `background ${TR.fast}, border-color ${TR.fast}`,
                }}
              >
                <IconPlatform c={activeRoute === '/admin' ? C.amber : C.sidebarMuted} />
                <span className="nav-label" style={{
                  fontSize: '13px',
                  color:    activeRoute === '/admin' ? C.amber : C.sidebarMuted,
                  fontWeight: activeRoute === '/admin' ? F.semibold : F.regular,
                  fontFamily: F.body,
                }}>
                  Administration
                </span>
              </button>
            </>
          )}
        </nav>

        {/* ── Notification toggle ── */}
        {notifSupported && !isAdmin && (
          <div style={{ padding: `0 ${SP[2]} ${SP[1]}`, flexShrink: 0 }}>
            <button
              className="notif-btn"
              disabled={notifLoading || notifState === 'denied'}
              onClick={handleNotifToggle}
              style={{
                width:        '100%', padding: `${SP[2]} ${SP[3]}`,
                borderRadius: R.md,
                background:   notifState === 'subscribed' ? 'rgba(160,83,26,0.10)' : 'transparent',
                border:       `1px solid ${notifState === 'subscribed' ? 'rgba(160,83,26,0.30)' : C.sidebarBd}`,
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
                ? <span className="spinner-light" style={{ width: 13, height: 13 }} />
                : <IconBell
                    c={notifState === 'subscribed' ? C.amber
                       : notifState === 'denied'   ? C.sidebarDim : C.sidebarMuted}
                    filled={notifState === 'subscribed'}
                  />
              }
              <span>
                {notifLoading              ? 'En cours…'
                 : notifState === 'subscribed' ? 'Notifications activées'
                 : notifState === 'denied'     ? 'Notifications bloquées'
                 : 'Activer les notifications'}
              </span>
            </button>
          </div>
        )}

        {/* ── Logout ── */}
        <div style={{
          padding:   `${SP[1]} ${SP[2]} ${SP[5]}`,
          borderTop: `1px solid ${C.sidebarBd}`,
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
              cursor:       'pointer',
              display:      'flex', alignItems: 'center', gap: SP[3],
              transition:   `all ${TR.fast}`,
            }}
          >
            <IconLogout c={C.sidebarDim} />
            <span className="logout-label" style={{
              fontSize: F.sm, fontWeight: F.regular,
              color:    C.sidebarDim, fontFamily: F.body,
            }}>
              Déconnexion
            </span>
          </button>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════════════════
          LOGOUT CONFIRMATION MODAL
          ═══════════════════════════════════════════════════════════════════════ */}
      {showLogoutModal && (
        <div
          className="modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) setShowLogoutModal(false) }}
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
              width:        '100%', maxWidth: 376,
              boxShadow:    SH.xl,
              overflow:     'hidden',
            }}
          >
            {/* Red accent stripe */}
            <div style={{ height: 3, background: C.red, opacity: 0.75 }} />

            {/* Header */}
            <div style={{
              padding:      `${SP[5]} ${SP[6]} ${SP[4]}`,
              borderBottom: `1px solid ${C.border}`,
              display:      'flex', alignItems: 'flex-start', gap: SP[3],
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: R.lg,
                background: C.redBg, border: `1px solid ${C.redBd}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <IconLogout c={C.red} size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: F.md, fontWeight: F.bold, color: C.ink,
                  marginBottom: SP[1], fontFamily: F.display, letterSpacing: '-0.01em',
                }}>
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
                  borderRadius: R.sm,
                  transition: `color ${TR.fast}`,
                }}
              >
                <IconX size={14} />
              </button>
            </div>

            {/* Actions */}
            <div style={{
              padding: `${SP[4]} ${SP[6]} ${SP[5]}`,
              display: 'flex', gap: SP[2],
            }}>
              <button
                className="btn-red"
                onClick={() => { setShowLogoutModal(false); onLogout() }}
                style={{
                  flex: 1, height: 40,
                  border: 'none', borderRadius: R.md,
                  fontSize: F.sm, fontWeight: F.bold,
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
                  fontSize: F.sm, fontWeight: F.medium,
                  fontFamily: F.body, whiteSpace: 'nowrap',
                  flex: 0,
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
