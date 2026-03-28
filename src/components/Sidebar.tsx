'use client'

import { useRouter }        from 'next/navigation'
import { useTransition, useEffect, useState } from 'react'
import { useIsMobile }      from '@/hooks/useIsMobile'
import type { BadgeCounts } from '@/lib/supabase/badge-counts'

// ── SVG icon set ──────────────────────────────────────────────────────────────
function IconDashboard({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="7" height="7" rx="1.5" fill={color} opacity="0.9"/>
      <rect x="11" y="2" width="7" height="7" rx="1.5" fill={color} opacity="0.9"/>
      <rect x="2" y="11" width="7" height="7" rx="1.5" fill={color} opacity="0.9"/>
      <rect x="11" y="11" width="7" height="7" rx="1.5" fill={color} opacity="0.9"/>
    </svg>
  )
}
function IconSales({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 4h1.5l2.5 8h8l1.5-5H6.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="8.5" cy="15.5" r="1.25" fill={color}/>
      <circle cx="14.5" cy="15.5" r="1.25" fill={color}/>
    </svg>
  )
}
function IconWarehouse({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 8.5L10 3l8 5.5V17H2V8.5Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round"/>
      <rect x="7" y="12" width="6" height="5" rx="1" stroke={color} strokeWidth="1.4"/>
    </svg>
  )
}
function IconCatalog({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="7" height="5" rx="1.5" stroke={color} strokeWidth="1.5"/>
      <rect x="11" y="2" width="7" height="5" rx="1.5" stroke={color} strokeWidth="1.5"/>
      <rect x="2" y="9" width="7" height="5" rx="1.5" stroke={color} strokeWidth="1.5"/>
      <rect x="11" y="9" width="7" height="5" rx="1.5" stroke={color} strokeWidth="1.5"/>
      <rect x="2" y="16" width="16" height="2" rx="1" fill={color} opacity="0.6"/>
    </svg>
  )
}
function IconUsers({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="6" r="3" stroke={color} strokeWidth="1.6"/>
      <path d="M2 17c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M14 8a2.5 2.5 0 100-5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M17 17c0-2.21-1.343-3.79-3-4.5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}
function IconReports({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="14" height="16" rx="2" stroke={color} strokeWidth="1.5"/>
      <path d="M7 7h6M7 10h6M7 13h3.5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}
function IconBell({ size = 15, color = 'currentColor', filled = false }: { size?: number; color?: string; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}
function IconLogout({ size = 15, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 4.5l4 5.5-4 5.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17 10H8" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M8 3H5a2 2 0 00-2 2v10a2 2 0 002 2h3" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function IconPlatform({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="4.5" r="2" stroke={color} strokeWidth="1.5"/>
      <circle cx="4"  cy="15" r="1.75" stroke={color} strokeWidth="1.4"/>
      <circle cx="16" cy="15" r="1.75" stroke={color} strokeWidth="1.4"/>
      <path d="M10 6.5v3.5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M10 10L4 13.25M10 10l6 3.25" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

// ── Nav config ─────────────────────────────────────────────────────────────────
type NavIcon = React.FC<{ size?: number; color?: string }>
const NAV_ITEMS: [NavIcon, string, string, string[]][] = [
  [IconDashboard, 'Tableau de bord', '/dashboard',  ['owner', 'admin']],
  [IconSales,     'Ventes',          '/sales',      ['owner', 'admin', 'vendor']],
  [IconWarehouse, 'Entrepôt',        '/warehouse',  ['owner', 'admin', 'warehouse']],
  [IconCatalog,   'Catalogue',       '/products',   ['owner', 'admin']],
  [IconUsers,     'Utilisateurs',    '/users',      ['owner', 'admin']],
  [IconReports,   'Rapports',        '/reports',    ['owner', 'admin']],
]

const NAV_TOUR_IDS: Record<string, string> = {
  '/sales':     'tour-nav-sales',
  '/warehouse': 'tour-nav-warehouse',
  '/reports':   'tour-nav-reports',
}

const ROLE_LABELS: Record<string, string> = {
  owner:     'Propriétaire',
  admin:     'Administrateur',
  vendor:    'Vendeur',
  warehouse: 'Magasinier',
}

function Initials({ name }: { name: string }) {
  const parts   = name.trim().split(' ')
  const letters = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%',
      background: 'rgba(59,130,246,0.2)',
      border: '1.5px solid rgba(59,130,246,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      fontSize: 12, fontWeight: 700, color: '#93C5FD',
      letterSpacing: '0.04em',
    }}>
      {letters}
    </div>
  )
}

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
  const [isPending, startTransition] = useTransition()
  const [notifSupported, setNotifSupported] = useState(false)
  const [notifState,     setNotifState]     = useState<'subscribed' | 'denied' | 'default'>('default')
  const [notifLoading,   setNotifLoading]   = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  // Prefetch all accessible routes on mount so navigation feels instant
  useEffect(() => {
    visibleItems.forEach(([,, href]) => { router.prefetch(href) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Run only on the client — avoids SSR/hydration mismatch
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
        // Unsubscribe
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
      const reg = await navigator.serviceWorker.ready
      const padding = '='.repeat((4 - (key.length % 4)) % 4)
      const b64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/')
      const raw = window.atob(b64)
      const arr = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: arr.buffer as ArrayBuffer })
      await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) })
      setNotifState('subscribed')
    } finally {
      setNotifLoading(false)
    }
  }

  const visibleItems = profile.is_platform_admin
    ? []  // platform operator: aucun module métier — accès exclusif à /admin
    : NAV_ITEMS.filter(([,,, roles]) => roles.includes(profile.role))

  const getNavBadge = (href: string): number => {
    if (!badgeCounts) return 0
    if (href === '/dashboard') return badgeCounts.pendingApprovals
    if (href === '/warehouse') return badgeCounts.confirmedOrders
    return 0
  }

  return (
    <>
    <aside style={{
      width: 240,
      background: '#0C1A35',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      position: 'fixed',
      top: 0, left: 0, bottom: 0,
      transform: isMobileOpen ? 'translateX(0)' : 'translateX(-240px)',
      transition: 'transform 0.25s ease',
      zIndex: 160,
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      borderRight: '1px solid rgba(255,255,255,0.05)',
    }}>

      {/* ── Logo ── */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{
              fontSize: 13, fontWeight: 900, color: 'white',
              fontFamily: 'Georgia, serif', letterSpacing: '-0.02em',
            }}>U</span>
          </div>
          <div>
            <div style={{
              fontSize: 15, fontWeight: 800, color: 'white',
              letterSpacing: '-0.02em', lineHeight: 1.1,
              fontFamily: 'Georgia, serif',
            }}>
              UCA
            </div>
            <div style={{
              fontSize: 9, color: 'rgba(255,255,255,0.3)',
              letterSpacing: '0.14em', textTransform: 'uppercase',
              fontWeight: 500, marginTop: 1,
            }}>
              Gestion Interne
            </div>
          </div>
        </div>
      </div>

      {/* ── User profile ── */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 10,
        margin: '0 4px',
      }}>
        <Initials name={profile.full_name} />
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.92)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {profile.full_name}
          </div>
          <div style={{
            fontSize: 10.5, color: 'rgba(255,255,255,0.35)',
            marginTop: 1, fontWeight: 500,
          }}>
            {profile.is_platform_admin ? 'Opérateur Plateforme' : (ROLE_LABELS[profile.role] ?? profile.role)}
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
        {visibleItems.map(([Icon, label, href]) => {
          const active = activeRoute === href
          const badge  = getNavBadge(href)
          return (
            <button
              key={href}
              className={`nav-item${active ? ' nav-active' : ''}`}
              {...(NAV_TOUR_IDS[href] ? { 'data-tour': NAV_TOUR_IDS[href] } : {})}
              onClick={() => {
                onClose?.()
                startTransition(() => router.push(href))
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: isMobile ? '13px 12px' : '10px 12px',
                border: 'none',
                borderRadius: 8,
                background: active ? 'rgba(59,130,246,0.16)' : 'transparent',
                borderLeft: active ? '2px solid #3B82F6' : '2px solid transparent',
                color: active ? '#fff' : isPending ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.52)',
                fontSize: 13.5, fontWeight: active ? 600 : 400,
                cursor: isPending ? 'default' : 'pointer', textAlign: 'left',
                fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
                marginBottom: 2,
                opacity: isPending && !active ? 0.55 : 1,
              }}
            >
              <Icon
                size={15}
                color={active ? '#93C5FD' : 'rgba(255,255,255,0.42)'}
              />
              <span style={{ flex: 1 }}>{label}</span>
              {badge > 0 && (
                <span style={{
                  minWidth: 18, height: 18,
                  padding: '0 5px',
                  borderRadius: 9,
                  background: '#EF4444',
                  color: '#fff',
                  fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                  flexShrink: 0,
                }}>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          )
        })}

        {/* ── Platform admin section ── */}
        {profile.is_platform_admin && (
          <>
            <div style={{
              padding: '14px 12px 6px',
              fontSize: 9.5, fontWeight: 700,
              color: 'rgba(255,255,255,0.22)',
              letterSpacing: '0.13em', textTransform: 'uppercase',
            }}>
              Plateforme
            </div>
            <button
              key="/admin"
              className={`nav-item${activeRoute === '/admin' ? ' nav-active' : ''}`}
              onClick={() => {
                onClose?.()
                startTransition(() => router.push('/admin'))
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: isMobile ? '13px 12px' : '10px 12px',
                border: 'none',
                borderRadius: 8,
                background: activeRoute === '/admin' ? 'rgba(180,83,9,0.2)' : 'transparent',
                borderLeft: activeRoute === '/admin' ? '2px solid #D97706' : '2px solid transparent',
                color: activeRoute === '/admin' ? '#FCD34D' : isPending ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.52)',
                fontSize: 13.5, fontWeight: activeRoute === '/admin' ? 600 : 400,
                cursor: isPending ? 'default' : 'pointer', textAlign: 'left',
                fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
                marginBottom: 2,
                opacity: isPending && activeRoute !== '/admin' ? 0.55 : 1,
              }}
            >
              <IconPlatform
                size={15}
                color={activeRoute === '/admin' ? '#FCD34D' : 'rgba(255,255,255,0.42)'}
              />
              <span style={{ flex: 1 }}>Administration</span>
            </button>
          </>
        )}
      </nav>

      {/* ── Notification toggle ── */}
      {notifSupported && (
        <div style={{ padding: '0 12px 6px' }}>
          <button
            disabled={notifLoading || notifState === 'denied'}
            onClick={handleNotifToggle}
            title={notifState === 'subscribed' ? 'Notifications activées — cliquer pour désactiver' : notifState === 'denied' ? 'Notifications bloquées par le navigateur' : 'Activer les notifications'}
            style={{
              width: '100%', padding: '8px 12px',
              borderRadius: 8,
              background: notifState === 'subscribed' ? 'rgba(59,130,246,0.12)' : 'transparent',
              border: notifState === 'subscribed' ? '1px solid rgba(59,130,246,0.25)' : '1px solid rgba(255,255,255,0.06)',
              color: notifLoading ? 'rgba(255,255,255,0.45)' : notifState === 'subscribed' ? '#93C5FD' : notifState === 'denied' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.32)',
              fontSize: 11.5, fontWeight: 500,
              cursor: notifLoading || notifState === 'denied' ? 'not-allowed' : 'pointer',
              fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
              display: 'flex', alignItems: 'center', gap: 7,
              transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            }}
          >
            {notifLoading
              ? <span className="spinner" style={{ width: 12, height: 12 }} />
              : <IconBell
                  size={13}
                  color={notifState === 'subscribed' ? '#93C5FD' : notifState === 'denied' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.32)'}
                  filled={notifState === 'subscribed'}
                />
            }
            {notifLoading
              ? 'En cours…'
              : notifState === 'subscribed' ? 'Notifications activées'
              : notifState === 'denied'     ? 'Notifications bloquées'
              : 'Activer les notifications'}
          </button>
        </div>
      )}

      {/* ── Logout ── */}
      <div style={{ padding: '6px 12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          className="nav-item"
          onClick={() => setShowLogoutModal(true)}
          style={{
            width: '100%', padding: isMobile ? '13px 12px' : '10px 12px',
            borderRadius: 8,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.42)',
            fontSize: 13, fontWeight: 500,
            cursor: 'pointer',
            fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}
        >
          <IconLogout size={14} color="rgba(255,255,255,0.42)" />
          Déconnexion
        </button>
      </div>
    </aside>

    {/* ── Logout confirmation modal ── */}
    {showLogoutModal && (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
        backdropFilter: 'blur(3px)',
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}>
        <div style={{
          background: '#FFFFFF', borderRadius: 14,
          width: '100%', maxWidth: 400,
          boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: '#FEF2F2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <IconLogout size={16} color="#DC2626" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
                Confirmer la déconnexion
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>
                Vous devrez vous reconnecter pour accéder au système.
              </div>
            </div>
          </div>
          {/* Body */}
          <div style={{ padding: '20px 24px' }}>
            <p style={{ fontSize: 14, color: '#475569', margin: '0 0 20px', lineHeight: 1.6 }}>
              Êtes-vous sûr de vouloir vous déconnecter ?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setShowLogoutModal(false); onLogout() }}
                style={{
                  flex: 1, padding: '11px',
                  background: '#DC2626', color: '#FFFFFF',
                  border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Se déconnecter
              </button>
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{
                  padding: '11px 20px',
                  background: '#F8FAFC', color: '#475569',
                  border: '1px solid #E2E8F0', borderRadius: 8,
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  )
}
