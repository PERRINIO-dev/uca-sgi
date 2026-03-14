'use client'

import { useRouter }  from 'next/navigation'
import { useIsMobile } from '@/hooks/useIsMobile'
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
function IconLogout({ size = 15, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 4.5l4 5.5-4 5.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17 10H8" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M8 3H5a2 2 0 00-2 2v10a2 2 0 002 2h3" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
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
  profile:       { full_name: string; role: string }
  activeRoute:   string
  onLogout:      () => void
  isMobileOpen?: boolean
  onClose?:      () => void
  badgeCounts?:  BadgeCounts
}) {
  const router   = useRouter()
  const isMobile = useIsMobile()
  const visibleItems = NAV_ITEMS.filter(([,,, roles]) => roles.includes(profile.role))

  const getNavBadge = (href: string): number => {
    if (!badgeCounts) return 0
    if (href === '/dashboard') return badgeCounts.pendingApprovals
    if (href === '/warehouse') return badgeCounts.confirmedOrders
    return 0
  }

  return (
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
            {ROLE_LABELS[profile.role] ?? profile.role}
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
              onClick={() => { router.push(href); onClose?.() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: isMobile ? '13px 12px' : '9px 12px',
                border: 'none',
                borderRadius: 8,
                background: active ? 'rgba(59,130,246,0.14)' : 'transparent',
                borderLeft: active ? '2px solid #3B82F6' : '2px solid transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.48)',
                fontSize: 13, fontWeight: active ? 600 : 400,
                cursor: 'pointer', textAlign: 'left',
                fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
                transition: 'background 0.15s, color 0.15s',
                marginBottom: 2,
              }}
            >
              <Icon
                size={15}
                color={active ? '#93C5FD' : 'rgba(255,255,255,0.38)'}
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
      </nav>

      {/* ── Logout ── */}
      <div style={{ padding: '10px 12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={onLogout}
          style={{
            width: '100%', padding: isMobile ? '13px 12px' : '9px 12px',
            borderRadius: 8,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.38)',
            fontSize: 12, fontWeight: 500,
            cursor: 'pointer',
            fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            transition: 'border-color 0.15s, color 0.15s',
          }}
        >
          <IconLogout size={14} color="rgba(255,255,255,0.38)" />
          Déconnexion
        </button>
      </div>
    </aside>
  )
}
