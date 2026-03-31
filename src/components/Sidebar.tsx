'use client'

import { useRouter }        from 'next/navigation'
import { useTransition, useEffect, useState } from 'react'
import { useIsMobile }      from '@/hooks/useIsMobile'
import type { BadgeCounts } from '@/lib/supabase/badge-counts'

// ── Design tokens ──────────────────────────────────────────────────────────────
const S = {
  bg:          '#0D1117',
  surface:     '#161B22',
  border:      'rgba(255,255,255,0.06)',
  text:        'rgba(255,255,255,0.90)',
  textMuted:   'rgba(255,255,255,0.42)',
  textDim:     'rgba(255,255,255,0.24)',
  activeText:  '#FFFFFF',
  activeBg:    'rgba(59,130,246,0.14)',
  activeBorder:'#3B82F6',
  hoverBg:     'rgba(255,255,255,0.05)',
  blue:        '#3B82F6',
  blueGlow:    'rgba(59,130,246,0.35)',
  red:         '#F85149',
  amber:       '#D29922',
  amberBg:     'rgba(210,153,34,0.14)',
}
const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif"

// ── SVG icon set ──────────────────────────────────────────────────────────────
function IconDashboard({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="2" width="7.5" height="7.5" rx="2" fill={color} opacity="0.85"/>
      <rect x="10.5" y="2" width="7.5" height="7.5" rx="2" fill={color} opacity="0.55"/>
      <rect x="2" y="10.5" width="7.5" height="7.5" rx="2" fill={color} opacity="0.55"/>
      <rect x="10.5" y="10.5" width="7.5" height="7.5" rx="2" fill={color} opacity="0.85"/>
    </svg>
  )
}
function IconSales({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M2.5 4h1.8l2.8 8.5h7.5l1.9-5.5H6" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="8" cy="16" r="1.4" fill={color}/>
      <circle cx="14" cy="16" r="1.4" fill={color}/>
    </svg>
  )
}
function IconWarehouse({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M2 8.8L10 3l8 5.8V17.5H2V8.8Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round"/>
      <rect x="7" y="11.5" width="6" height="6" rx="1" stroke={color} strokeWidth="1.4"/>
    </svg>
  )
}
function IconCatalog({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="2" width="7" height="5" rx="1.5" stroke={color} strokeWidth="1.5"/>
      <rect x="11" y="2" width="7" height="5" rx="1.5" stroke={color} strokeWidth="1.5"/>
      <rect x="2" y="9" width="7" height="5" rx="1.5" stroke={color} strokeWidth="1.5"/>
      <rect x="11" y="9" width="7" height="5" rx="1.5" stroke={color} strokeWidth="1.5"/>
      <rect x="2" y="16" width="16" height="2" rx="1" fill={color} opacity="0.5"/>
    </svg>
  )
}
function IconUsers({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="8" cy="6" r="3" stroke={color} strokeWidth="1.6"/>
      <path d="M2 17c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M14 8a2.5 2.5 0 100-5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M17 17c0-2.2-1.3-3.8-3-4.5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}
function IconReports({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="3" y="2" width="14" height="16" rx="2" stroke={color} strokeWidth="1.5"/>
      <path d="M7 7h6M7 10.5h6M7 14h4" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}
function IconBell({ size = 16, color = 'currentColor', filled = false }: { size?: number; color?: string; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}
function IconLogout({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M13.5 4.5l4 5.5-4 5.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17.5 10H8" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M8 3H5a2 2 0 00-2 2v10a2 2 0 002 2h3" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function IconPlatform({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="5" width="16" height="12" rx="1.5" stroke={color} strokeWidth="1.5"/>
      <path d="M6 10h2M12 10h2M6 13h2M12 13h2" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M9 17V9" stroke={color} strokeWidth="1.4"/>
      <path d="M6 5V3.5a1 1 0 011-1h6a1 1 0 011 1V5" stroke={color} strokeWidth="1.4"/>
    </svg>
  )
}
function IconClose({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M1 1l12 12M13 1L1 13" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

// ── Meram wordmark ────────────────────────────────────────────────────────────
function MeramLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {/* M monogram */}
      <div style={{
        width: 34, height: 34, borderRadius: 9,
        background: 'linear-gradient(145deg, #1D4ED8 0%, #3B82F6 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 2px 10px rgba(37,99,235,0.45)',
      }}>
        <svg width="18" height="15" viewBox="0 0 18 15" fill="none">
          <path d="M1 14V2L9 9.5L17 2V14" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div>
        <div style={{
          fontSize: 17, fontWeight: 800, color: '#FFFFFF',
          letterSpacing: '-0.03em', lineHeight: 1,
          fontFamily: FONT,
        }}>
          MERAM
        </div>
        <div style={{
          fontSize: 9, color: S.textDim,
          letterSpacing: '0.18em', textTransform: 'uppercase',
          fontWeight: 600, marginTop: 3,
        }}>
          Manage · Sell · Optimize
        </div>
      </div>
    </div>
  )
}

// ── User avatar ───────────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const parts   = name.trim().split(' ')
  const letters = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()

  // Deterministic hue from name
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360

  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: `linear-gradient(135deg, hsl(${hue},60%,35%) 0%, hsl(${(hue+30)%360},70%,50%) 100%)`,
      border: '2px solid rgba(255,255,255,0.12)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      fontSize: 13, fontWeight: 700, color: '#FFFFFF',
      letterSpacing: '0.03em',
      boxShadow: '0 0 0 3px rgba(255,255,255,0.06)',
    }}>
      {letters}
    </div>
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
  const [isPending, startTransition] = useTransition()
  const [notifSupported, setNotifSupported] = useState(false)
  const [notifState,     setNotifState]     = useState<'subscribed' | 'denied' | 'default'>('default')
  const [notifLoading,   setNotifLoading]   = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  useEffect(() => {
    visibleItems.forEach(([,, href]) => { router.prefetch(href) })
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
    ? []
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
      background: S.bg,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      position: 'fixed',
      top: 0, left: 0, bottom: 0,
      transform: isMobileOpen ? 'translateX(0)' : 'translateX(-240px)',
      transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
      zIndex: 160,
      fontFamily: FONT,
      borderRight: `1px solid ${S.border}`,
    }}>

      {/* ── Logo / Brand ── */}
      <div style={{
        padding: '22px 20px 18px',
        borderBottom: `1px solid ${S.border}`,
        flexShrink: 0,
      }}>
        <MeramLogo />
      </div>

      {/* ── User profile ── */}
      <div style={{
        padding: '14px 16px',
        borderBottom: `1px solid ${S.border}`,
        display: 'flex', alignItems: 'center', gap: 11,
        flexShrink: 0,
      }}>
        <Avatar name={profile.full_name} />
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: S.text,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {profile.full_name}
          </div>
          <div style={{
            fontSize: 11, color: S.textMuted,
            marginTop: 2, fontWeight: 500,
          }}>
            {profile.is_platform_admin ? 'Opérateur Plateforme' : (ROLE_LABELS[profile.role] ?? profile.role)}
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>

        {/* Section label */}
        {visibleItems.length > 0 && (
          <div style={{
            padding: '4px 10px 8px',
            fontSize: 9.5, fontWeight: 700, color: S.textDim,
            letterSpacing: '0.14em', textTransform: 'uppercase',
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
              className={`nav-item${active ? ' nav-active' : ''}`}
              {...(NAV_TOUR_IDS[href] ? { 'data-tour': NAV_TOUR_IDS[href] } : {})}
              onClick={() => {
                onClose?.()
                startTransition(() => router.push(href))
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                width: '100%', padding: isMobile ? '13px 12px' : '11px 12px',
                border: 'none',
                borderRadius: 8,
                background: active ? S.activeBg : 'transparent',
                borderLeft: `2px solid ${active ? S.activeBorder : 'transparent'}`,
                color: active ? S.activeText : isPending ? S.textDim : S.textMuted,
                fontSize: 13.5, fontWeight: active ? 600 : 400,
                cursor: isPending ? 'default' : 'pointer', textAlign: 'left',
                fontFamily: FONT,
                marginBottom: 2,
                opacity: isPending && !active ? 0.5 : 1,
                transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
              }}
            >
              <Icon
                size={17}
                color={active ? '#93C5FD' : S.textMuted}
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
                  lineHeight: 1, flexShrink: 0,
                  boxShadow: '0 1px 4px rgba(239,68,68,0.45)',
                }}>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          )
        })}

        {/* ── Platform admin nav ── */}
        {profile.is_platform_admin && (
          <>
            <div style={{
              padding: '14px 10px 8px',
              fontSize: 9.5, fontWeight: 700,
              color: S.textDim,
              letterSpacing: '0.14em', textTransform: 'uppercase',
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
                display: 'flex', alignItems: 'center', gap: 11,
                width: '100%', padding: isMobile ? '13px 12px' : '11px 12px',
                border: 'none',
                borderRadius: 8,
                background: activeRoute === '/admin' ? S.amberBg : 'transparent',
                borderLeft: `2px solid ${activeRoute === '/admin' ? S.amber : 'transparent'}`,
                color: activeRoute === '/admin' ? '#FCD34D' : S.textMuted,
                fontSize: 13.5, fontWeight: activeRoute === '/admin' ? 600 : 400,
                cursor: isPending ? 'default' : 'pointer', textAlign: 'left',
                fontFamily: FONT, marginBottom: 2,
              }}
            >
              <IconPlatform
                size={17}
                color={activeRoute === '/admin' ? '#FCD34D' : S.textMuted}
              />
              <span style={{ flex: 1 }}>Administration</span>
            </button>
          </>
        )}
      </nav>

      {/* ── Notification toggle ── */}
      {notifSupported && !profile.is_platform_admin && (
        <div style={{ padding: '0 10px 6px', flexShrink: 0 }}>
          <button
            disabled={notifLoading || notifState === 'denied'}
            onClick={handleNotifToggle}
            title={
              notifState === 'subscribed' ? 'Notifications activées — cliquer pour désactiver'
              : notifState === 'denied'   ? 'Notifications bloquées par le navigateur'
              : 'Activer les notifications push'
            }
            style={{
              width: '100%', padding: '8px 12px',
              borderRadius: 8,
              background: notifState === 'subscribed' ? 'rgba(59,130,246,0.10)' : 'transparent',
              border: `1px solid ${notifState === 'subscribed' ? 'rgba(59,130,246,0.22)' : S.border}`,
              color: notifLoading ? S.textDim
                : notifState === 'subscribed' ? '#93C5FD'
                : notifState === 'denied'     ? S.textDim
                : S.textMuted,
              fontSize: 11.5, fontWeight: 500,
              cursor: notifLoading || notifState === 'denied' ? 'not-allowed' : 'pointer',
              fontFamily: FONT,
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.15s ease',
            }}
          >
            {notifLoading
              ? <span className="spinner" style={{ width: 12, height: 12 }} />
              : <IconBell
                  size={13}
                  color={notifState === 'subscribed' ? '#93C5FD' : notifState === 'denied' ? S.textDim : S.textMuted}
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
      <div style={{ padding: '6px 10px 20px', borderTop: `1px solid ${S.border}`, flexShrink: 0 }}>
        <button
          className="nav-item"
          onClick={() => setShowLogoutModal(true)}
          style={{
            width: '100%', padding: isMobile ? '13px 12px' : '11px 12px',
            borderRadius: 8,
            background: 'transparent',
            border: 'none',
            borderLeft: '2px solid transparent',
            color: S.textMuted,
            fontSize: 13.5, fontWeight: 400,
            cursor: 'pointer',
            fontFamily: FONT,
            display: 'flex', alignItems: 'center', gap: 11,
          }}
        >
          <IconLogout size={16} color={S.textMuted} />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>

    {/* ── Logout confirmation modal ── */}
    {showLogoutModal && (
      <div
        className="modal-overlay"
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20,
          backdropFilter: 'blur(4px)',
          fontFamily: FONT,
        }}
      >
        <div className="modal-panel" style={{
          background: '#FFFFFF', borderRadius: 16,
          width: '100%', maxWidth: 400,
          boxShadow: '0 32px 80px rgba(0,0,0,0.22)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex', alignItems: 'flex-start', gap: 14,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: '#FEF2F2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <IconLogout size={18} color="#DC2626" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0D1117', marginBottom: 4 }}>
                Confirmer la déconnexion
              </div>
              <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>
                Vous devrez vous reconnecter pour accéder au système.
              </div>
            </div>
            <button
              onClick={() => setShowLogoutModal(false)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#94A3B8', padding: 2, flexShrink: 0,
              }}
            >
              <IconClose size={14} color="#94A3B8" />
            </button>
          </div>
          {/* Body */}
          <div style={{ padding: '20px 24px 24px' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn-red"
                onClick={() => { setShowLogoutModal(false); onLogout() }}
                style={{
                  flex: 1, padding: '12px',
                  background: '#DC2626', color: '#FFFFFF',
                  border: 'none', borderRadius: 9,
                  fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <IconLogout size={15} color="white" />
                Se déconnecter
              </button>
              <button
                className="btn-ghost"
                onClick={() => setShowLogoutModal(false)}
                style={{
                  padding: '12px 20px',
                  background: '#F8FAFC', color: '#475569',
                  border: '1.5px solid #E2E8F0', borderRadius: 9,
                  fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
                  whiteSpace: 'nowrap',
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
