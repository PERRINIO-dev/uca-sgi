'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter }                           from 'next/navigation'
import PageLayout                              from '@/components/PageLayout'
import {
  createCompanyWithOwner,
  toggleCompanyActive,
  resetUserPassword,
  togglePlatformUserActive,
} from './actions'
import type { BadgeCounts } from '@/lib/supabase/badge-counts'

import { C, F, R, SP, SH, TR, Z } from '@/lib/design-system'

// ── Role display ──────────────────────────────────────────────────────────────
const ROLE_META: Record<string, { label: string; color: string; bg: string; bd: string }> = {
  owner:     { label: 'Propriétaire', color: C.amber,  bg: C.amberDim,  bd: C.amberDim },
  admin:     { label: 'Admin',        color: C.blue,   bg: C.blueBg,    bd: C.blueBd   },
  vendor:    { label: 'Vendeur',      color: C.green,  bg: C.greenBg,   bd: C.greenBd  },
  warehouse: { label: 'Magasinier',   color: C.muted,  bg: C.surfaceEl, bd: C.border   },
}

// ── Audit action display ──────────────────────────────────────────────────────
// Restricted to platform-level events only.
// Tenant operational data (sales, payments, stock, employees) is their
// proprietary business data — it must not appear in the operator console.
const ACTION_META: Record<string, { label: string; color: string; bg: string; bd: string }> = {
  COMPANY_CREATED:              { label: 'Entreprise créée',     color: C.green,  bg: C.greenBg,  bd: C.greenBd  },
  COMPANY_ACTIVATED:            { label: 'Entreprise réactivée', color: C.blue,   bg: C.blueBg,   bd: C.blueBd   },
  COMPANY_DEACTIVATED:          { label: 'Entreprise suspendue', color: C.orange, bg: C.orangeBg, bd: C.orangeBd },
  PLATFORM_USER_SUSPENDED:      { label: 'Compte suspendu',      color: C.red,    bg: C.redBg,    bd: C.redBd    },
  PLATFORM_USER_REACTIVATED:    { label: 'Compte réactivé',      color: C.green,  bg: C.greenBg,  bd: C.greenBd  },
  PLATFORM_USER_PASSWORD_RESET: { label: 'MDP réinitialisé',     color: C.blue,   bg: C.blueBg,   bd: C.blueBd   },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function slugify(text: string) {
  return text
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────
function IconBuilding({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="5" width="16" height="12" rx="1.5" stroke={color} strokeWidth="1.5"/>
      <path d="M6 10h2M12 10h2M6 13h2M12 13h2" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M9 17V9" stroke={color} strokeWidth="1.4"/>
      <path d="M6 5V3.5a1 1 0 011-1h6a1 1 0 011 1V5" stroke={color} strokeWidth="1.4"/>
    </svg>
  )
}
function IconUsers({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="8" cy="6" r="3" stroke={color} strokeWidth="1.5"/>
      <path d="M2 17c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14 8a2.5 2.5 0 100-5M17 17c0-2.21-1.343-3.79-3-4.5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}
function IconBox({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M3 6l7-3 7 3v8l-7 3-7-3V6Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M10 3v11M3 6l7 4 7-4" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}
function IconPlus({ size = 15, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 15 15" fill="none">
      <path d="M7.5 2v11M2 7.5h11" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}
function IconEye({ size = 15, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M1 10s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" stroke={color} strokeWidth="1.5"/>
      <circle cx="10" cy="10" r="2.5" stroke={color} strokeWidth="1.5"/>
    </svg>
  )
}
function IconEyeOff({ size = 15, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M3 3l14 14M8.5 8.6A2.5 2.5 0 0012.4 12.5M6.5 5.4C3.8 6.8 2 10 2 10s3.5 7 8 7a8 8 0 004.2-1.2M10 3c5 0 8 7 8 7a13.4 13.4 0 01-1.7 2.6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function IconShield({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M10 2l7 3v5c0 4-3 7-7 8C7 17 4 14 3 10V5l7-3Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M7 10l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconKey({ size = 15, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="7.5" cy="8.5" r="4" stroke={color} strokeWidth="1.5"/>
      <path d="M10.5 11.5l6 6M13.5 13.5l2-2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconClose({ size = 13, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M1 1l12 12M13 1L1 13" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}
function IconChevronRight({ size = 13, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M5 3l4 4-4 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconHistory({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M3 10a7 7 0 1 0 .47-2.56" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M3 4v4h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 7v4l2.5 2" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ── Small components ──────────────────────────────────────────────────────────
function CompanyInitials({ name, size = 40 }: { name: string; size?: number }) {
  const parts   = name.trim().split(/\s+/)
  const letters = parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
  const hue   = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: 10,
      background: `linear-gradient(135deg, hsl(${hue},55%,88%) 0%, hsl(${(hue+30)%360},60%,80%) 100%)`,
      border: `1px solid hsl(${hue},40%,78%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      fontSize: size * 0.38, fontWeight: 700, color: `hsl(${hue}, 60%, 28%)`,
      letterSpacing: '-0.02em',
    }}>
      {letters}
    </div>
  )
}

function UserInitials({ name, size = 32 }: { name: string; size?: number }) {
  const parts   = name.trim().split(/\s+/)
  const letters = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#E2E8F0', border: '1.5px solid #CBD5E1',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      fontSize: size * 0.34, fontWeight: 700, color: '#475569', letterSpacing: '0.04em',
    }}>
      {letters}
    </div>
  )
}

function Badge({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, background: bg, color,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface CompanyUser {
  id:        string
  full_name: string
  email:     string
  role:      string
  is_active: boolean
}

interface Company {
  id:             string
  name:           string
  slug:           string
  is_active:      boolean
  created_at:     string
  totalUsers:     number
  activeUsers:    number
  activeProducts: number
  salesCount:     number
  lastSaleAt:     string | null
  owner:          CompanyUser | null
  members:        CompanyUser[]
}

interface AuditEntry {
  id:                 string
  created_at:         string
  action_type:        string
  entity_type:        string
  entity_id:          string
  company_id:         string | null
  user_role_snapshot: string
  data_after:         Record<string, any> | null
  users:              { full_name: string }[] | null
}

interface Profile {
  id:                string
  full_name:         string
  role:              string
  is_platform_admin: boolean
}

// ── Form factory ──────────────────────────────────────────────────────────────
const emptyForm = () => ({
  companyName: '', slug: '', currency: 'FCFA', ownerFullName: '', ownerEmail: '', ownerPassword: '',
})

// ═════════════════════════════════════════════════════════════════════════════
export default function AdminClient({
  profile,
  companies,
  auditLogs,
  totalSalesThisMonth,
  badgeCounts,
}: {
  profile:               Profile
  companies:             Company[]
  auditLogs:             AuditEntry[]
  totalSalesThisMonth:   number
  badgeCounts?:          BadgeCounts
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // ── Tab ───────────────────────────────────────────────────────────────────
  const [activeTab,      setActiveTab]      = useState<'companies' | 'journal'>('companies')
  const [companySearch,  setCompanySearch]  = useState('')

  // ── New company modal ─────────────────────────────────────────────────────
  const [showModal,  setShowModal]  = useState(false)
  const [form,       setForm]       = useState(emptyForm)
  const [showPwd,    setShowPwd]    = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError,  setFormError]  = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // ── Company toggle ────────────────────────────────────────────────────────
  const [toggling, setToggling] = useState<string | null>(null)

  // ── Drawer ────────────────────────────────────────────────────────────────
  const [drawerCompanyId, setDrawerCompanyId] = useState<string | null>(null)
  const [drawerError,     setDrawerError]     = useState<string | null>(null)
  const [togglingUser,    setTogglingUser]    = useState<string | null>(null)

  // ── Password reset modal ──────────────────────────────────────────────────
  const [resetTarget,  setResetTarget]  = useState<{ userId: string; name: string; email: string } | null>(null)
  const [resetPwd,     setResetPwd]     = useState('')
  const [resetShowPwd, setResetShowPwd] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError,   setResetError]   = useState<string | null>(null)

  // ── Journal filter ────────────────────────────────────────────────────────
  const [journalFilter, setJournalFilter] = useState('all')

  // ── Derived ───────────────────────────────────────────────────────────────
  const drawerCompany     = drawerCompanyId ? (companies.find(c => c.id === drawerCompanyId) ?? null) : null
  const activeCompanies   = companies.filter(c => c.is_active).length
  const totalUsers        = companies.reduce((s, c) => s + c.totalUsers, 0)
  const totalProducts     = companies.reduce((s, c) => s + c.activeProducts, 0)

  // ── Auto-clear toasts ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 5000)
    return () => clearTimeout(t)
  }, [successMsg])

  useEffect(() => {
    if (!drawerError) return
    const t = setTimeout(() => setDrawerError(null), 5000)
    return () => clearTimeout(t)
  }, [drawerError])

  // ── Shared styles ─────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px',
    border: `1.5px solid ${C.border}`, borderRadius: 8,
    fontSize: 13, fontFamily: F.body, color: C.ink,
    background: '#FDFCF9', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600,
    color: C.muted, letterSpacing: '0.05em',
    textTransform: 'uppercase', marginBottom: 5,
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleNameChange(name: string) {
    setForm(f => ({
      ...f,
      companyName: name,
      slug: f.slug === slugify(f.companyName) || f.slug === '' ? slugify(name) : f.slug,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    const result = await createCompanyWithOwner(form)
    setSubmitting(false)
    if (result.error) { setFormError(result.error); return }
    setSuccessMsg(`Entreprise "${result.companyName}" créée avec succès.`)
    setShowModal(false)
    setForm(emptyForm())
    startTransition(() => router.refresh())
  }

  async function handleToggle(companyId: string, isActive: boolean) {
    setToggling(companyId)
    const result = await toggleCompanyActive(companyId, isActive)
    setToggling(null)
    if (result.error) setDrawerError(result.error)
    else startTransition(() => router.refresh())
  }

  async function handleUserToggle(userId: string, isActive: boolean) {
    setTogglingUser(userId)
    const result = await togglePlatformUserActive(userId, isActive)
    setTogglingUser(null)
    if (result.error) setDrawerError(result.error)
    else startTransition(() => router.refresh())
  }

  async function handlePasswordReset() {
    if (!resetTarget) return
    setResetLoading(true)
    setResetError(null)
    const result = await resetUserPassword(resetTarget.userId, resetPwd)
    setResetLoading(false)
    if (result.error) { setResetError(result.error); return }
    const name = resetTarget.name
    setResetTarget(null)
    setResetPwd('')
    setResetShowPwd(false)
    setSuccessMsg(`Mot de passe de ${name} réinitialisé avec succès.`)
  }

  // ── Journal helpers ───────────────────────────────────────────────────────
  function getAffectedCompanyName(entry: AuditEntry): string {
    // All audit_logs rows carry company_id — use it directly for tenant events.
    // For company-level actions (CREATE/ACTIVATE/DEACTIVATE) use entity_id instead
    // because the platform admin's own company_id would be stored otherwise.
    const isCompanyAction = ['COMPANY_CREATED', 'COMPANY_ACTIVATED', 'COMPANY_DEACTIVATED'].includes(entry.action_type)
    const id = isCompanyAction ? entry.entity_id : (entry.company_id ?? entry.data_after?.target_company_id)
    if (!id) return '—'
    return companies.find(c => c.id === id)?.name ?? '—'
  }

  function getAuditDetail(entry: AuditEntry): string {
    const d = entry.data_after
    if (!d) return '—'
    switch (entry.action_type) {
      case 'COMPANY_CREATED':
        return [d.name, d.ownerEmail].filter(Boolean).join(' · ') || '—'
      case 'COMPANY_ACTIVATED':
      case 'COMPANY_DEACTIVATED':
        return d.affectedUsers != null ? `${d.affectedUsers} compte(s) affecté(s)` : '—'
      case 'PLATFORM_USER_SUSPENDED':
      case 'PLATFORM_USER_REACTIVATED':
      case 'PLATFORM_USER_PASSWORD_RESET':
        return [d.target_name, d.target_email].filter(Boolean).join(' · ') || d.target_email || '—'
      default:
        return '—'
    }
  }

  const filteredAudit = journalFilter === 'all'
    ? auditLogs
    : auditLogs.filter(e => e.company_id === journalFilter)

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
    <PageLayout
      profile={profile}
      activeRoute="/admin"
      badgeCounts={badgeCounts}
      onLogout={async () => {
        const { createClient } = await import('@/lib/supabase/client')
        await createClient().auth.signOut()
        router.push('/login')
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', fontFamily: F.body }}>

        {/* ── Banner ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: SP[2],
          padding: `${SP[2.5]} ${SP[4]}`, borderRadius: R.lg, marginBottom: SP[7],
          background: C.amberGlow,
          border: `1px solid rgba(160,83,26,0.22)`,
        }}>
          <IconShield size={15} color={C.amber} />
          <span style={{ fontSize: F.xs, fontWeight: F.semibold, color: C.amber, letterSpacing: '0.01em', fontFamily: F.body }}>
            Administration Plateforme — vue transversale, toutes entreprises
          </span>
        </div>

        {/* ── Header ── */}
        <div className="fade-in-up page-header">
          <div>
            <p className="page-kicker">MERAM Platform</p>
            <h1 className="page-title">Gestion de la plateforme</h1>
            <p className="page-subtitle">
              Gérez les entreprises clientes et consultez l'historique des actions.
            </p>
          </div>
          <button
            className="btn-amber"
            onClick={() => { setShowModal(true); setFormError(null) }}
            style={{ height: 40, padding: `0 ${SP[4]}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
          >
            <IconPlus size={14} color="#FAF5EE" />
            Nouvelle entreprise
          </button>
        </div>

        {/* ── Success toast ── */}
        {successMsg && (
          <div style={{
            padding: '12px 16px', borderRadius: 9, marginBottom: 20,
            background: C.greenBg, border: `1px solid #BBF7D0`,
            fontSize: 13, fontWeight: 500, color: C.green,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: C.green,
              fontSize: 18, lineHeight: 1, padding: '0 0 0 12px',
            }}>×</button>
          </div>
        )}

        {/* ── KPI cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Entreprises actives', value: `${activeCompanies} / ${companies.length}`, Icon: IconBuilding, accent: C.amber,  bg: C.goldBg  },
            { label: 'Utilisateurs totaux', value: String(totalUsers),                         Icon: IconUsers,    accent: C.amber,  bg: C.goldBg  },
            { label: 'Produits catalogués', value: String(totalProducts),                      Icon: IconBox,      accent: C.green,  bg: C.greenBg },
            { label: 'Ventes ce mois',      value: String(totalSalesThisMonth),                Icon: IconHistory,  accent: C.blue,   bg: C.blueBg  },
          ].map(({ label, value, Icon, accent, bg }) => (
            <div key={label} className="card-hover" style={{
              background: C.surface, borderRadius: 14, overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(60,30,10,0.06)', border: `1px solid ${C.border}`,
            }}>
              <div style={{ height: 3, background: `linear-gradient(90deg, ${accent} 0%, ${accent}66 100%)` }} />
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} color={accent} />
                </div>
                <div>
                  <div className="num" style={{ fontSize: 24, fontWeight: 800, color: C.ink, letterSpacing: '-0.03em' }}>{value}</div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tab bar ── */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, padding: '4px', background: C.bg, borderRadius: 10, width: 'fit-content', border: `1px solid ${C.border}` }}>
          {([
            { id: 'companies', label: `Entreprises (${companies.length})`, Icon: IconBuilding },
            { id: 'journal',   label: `Journal (${auditLogs.length})`,      Icon: IconHistory },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 16px', borderRadius: 7,
                background: activeTab === id ? C.surface : 'transparent',
                border: activeTab === id ? `1px solid ${C.border}` : '1px solid transparent',
                color: activeTab === id ? C.ink : C.muted,
                fontSize: 13, fontWeight: activeTab === id ? 600 : 400,
                cursor: 'pointer', fontFamily: F.body,
                boxShadow: activeTab === id ? '0 1px 4px rgba(60,30,10,0.08)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={14} color={activeTab === id ? C.amber : C.muted} />
              {label}
            </button>
          ))}
        </div>

        {/* ══ COMPANIES TAB ══════════════════════════════════════════════════ */}
        {activeTab === 'companies' && (
          <div style={{
            background: C.surface, borderRadius: 12,
            border: `1px solid ${C.border}`,
            boxShadow: '0 1px 3px rgba(60,30,10,0.05)', overflow: 'hidden',
          }}>
            {/* Search */}
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderSub}` }}>
              <div style={{ position: 'relative', maxWidth: 340 }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <circle cx="6" cy="6" r="4.5" stroke={C.dim} strokeWidth="1.5"/>
                  <path d="M9.5 9.5L12.5 12.5" stroke={C.dim} strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  value={companySearch}
                  onChange={e => setCompanySearch(e.target.value)}
                  placeholder="Rechercher une entreprise…"
                  style={{
                    width: '100%', paddingLeft: 32, paddingRight: 12,
                    paddingTop: 8, paddingBottom: 8,
                    borderRadius: 8, border: `1.5px solid ${C.border}`,
                    fontSize: 13, color: C.ink, background: C.bg,
                    outline: 'none', fontFamily: F.body, boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {(() => {
              const visibleCompanies = companySearch
                ? companies.filter(c =>
                    c.name.toLowerCase().includes(companySearch.toLowerCase()) ||
                    c.slug.toLowerCase().includes(companySearch.toLowerCase()) ||
                    c.owner?.full_name?.toLowerCase().includes(companySearch.toLowerCase()) ||
                    c.owner?.email?.toLowerCase().includes(companySearch.toLowerCase())
                  )
                : companies

              return visibleCompanies.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
                {companySearch ? 'Aucune entreprise ne correspond à cette recherche.' : 'Aucune entreprise enregistrée.'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: C.bg }}>
                      {['Entreprise', 'Propriétaire', 'Équipe', 'Produits', 'Ventes', 'Dernière activité', 'Créée le', 'Statut', ''].map(h => (
                        <th key={h} style={{
                          padding: '10px 16px', textAlign: 'left',
                          fontSize: 11, fontWeight: 700, color: C.muted,
                          letterSpacing: '0.08em', textTransform: 'uppercase',
                          borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCompanies.map((company, i) => (
                      <tr
                        key={company.id}
                        className="trow-click"
                        style={{ borderBottom: i < companies.length - 1 ? `1px solid ${C.border}` : 'none' }}
                      >
                        {/* Company */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <CompanyInitials name={company.name} size={36} />
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{company.name}</div>
                              <div style={{
                                fontSize: 12, color: C.muted, marginTop: 2,
                                fontFamily: 'monospace', background: C.bg,
                                border: `1px solid ${C.border}`,
                                padding: '1px 6px', borderRadius: 4, display: 'inline-block',
                              }}>
                                {company.slug}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Owner */}
                        <td style={{ padding: '14px 16px' }}>
                          {company.owner ? (
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{company.owner.full_name}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{company.owner.email}</div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: C.muted }}>—</span>
                          )}
                        </td>

                        {/* Team */}
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>
                            {company.activeUsers}
                            <span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}> / {company.totalUsers}</span>
                          </div>
                          <div style={{ fontSize: 11, color: C.muted }}>actifs / total</div>
                        </td>

                        {/* Products */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{company.activeProducts}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>actifs</div>
                        </td>

                        {/* Sales count */}
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: company.salesCount > 0 ? C.ink : C.dim }}>
                            {new Intl.NumberFormat('fr-FR').format(company.salesCount)}
                          </div>
                          <div style={{ fontSize: 11, color: C.muted }}>au total</div>
                        </td>

                        {/* Last activity */}
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                          {company.lastSaleAt ? (
                            <>
                              <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{fmtDate(company.lastSaleAt)}</div>
                              <div style={{ fontSize: 11, color: C.muted }}>dernière vente</div>
                            </>
                          ) : (
                            <span style={{ fontSize: 12, color: C.dim, fontStyle: 'italic' }}>Aucune activité</span>
                          )}
                        </td>

                        {/* Created */}
                        <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', fontSize: 13, color: C.muted }}>
                          {fmtDate(company.created_at)}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '14px 16px' }}>
                          <Badge color={company.is_active ? C.green : C.red} bg={company.is_active ? C.greenBg : C.redBg}>
                            {company.is_active ? 'Actif' : 'Suspendu'}
                          </Badge>
                        </td>

                        {/* Details button */}
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <button
                            onClick={() => setDrawerCompanyId(company.id)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '6px 12px',
                              border: `1px solid ${C.border}`, borderRadius: 7,
                              background: C.surface, color: C.muted,
                              fontSize: 12, fontWeight: 500,
                              cursor: 'pointer', fontFamily: F.body,
                            }}
                          >
                            Détails <IconChevronRight size={12} color={C.muted} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
            })()}
          </div>
        )}

        {/* ══ JOURNAL TAB ════════════════════════════════════════════════════ */}
        {activeTab === 'journal' && (
          <div style={{
            background: C.surface, borderRadius: 12,
            border: `1px solid ${C.border}`,
            boxShadow: '0 1px 3px rgba(60,30,10,0.05)', overflow: 'hidden',
          }}>
            {/* Filter bar */}
            <div style={{
              padding: '12px 16px', borderBottom: `1px solid ${C.borderSub}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconShield size={13} color={C.amber} />
                <span style={{ fontSize: 12, fontWeight: 600, color: C.amber, letterSpacing: '0.03em' }}>
                  Actions plateforme uniquement
                </span>
                <span style={{ fontSize: 11, color: C.muted }}>— données métier non visibles ici</span>
              </div>
              <select
                value={journalFilter}
                onChange={e => setJournalFilter(e.target.value)}
                style={{
                  padding: '6px 10px', borderRadius: 7,
                  border: `1px solid ${C.border}`, background: C.bg,
                  fontSize: 12.5, color: C.ink, fontFamily: F.body,
                  cursor: 'pointer', outline: 'none',
                }}
              >
                <option value="all">Toutes les entreprises</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {filteredAudit.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
                Aucune action enregistrée.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: C.bg }}>
                      {['Date / Heure', 'Action', 'Entreprise', 'Détail', 'Opérateur'].map(h => (
                        <th key={h} style={{
                          padding: '10px 16px', textAlign: 'left',
                          fontSize: 11, fontWeight: 600, color: C.muted,
                          letterSpacing: '0.05em', textTransform: 'uppercase',
                          borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAudit.map((entry, i) => {
                      const meta    = ACTION_META[entry.action_type] ?? { label: entry.action_type, color: C.muted, bg: C.bg }
                      const company = getAffectedCompanyName(entry)
                      const detail  = getAuditDetail(entry)
                      return (
                        <tr key={entry.id} className="trow" style={{ borderBottom: i < filteredAudit.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                          <td style={{ padding: '12px 16px', fontSize: 12.5, color: C.muted, whiteSpace: 'nowrap' }}>
                            {fmtDateTime(entry.created_at)}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <Badge color={meta.color} bg={meta.bg}>{meta.label}</Badge>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 13, color: C.ink, fontWeight: 500 }}>
                            {company}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12.5, color: C.muted, maxWidth: 240 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                              {detail}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12.5, color: C.muted }}>
                            {entry.users?.[0]?.full_name ?? '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </PageLayout>

    {/* ═══════════════════════════════════════════════════════════════════════
        Company Drawer
    ════════════════════════════════════════════════════════════════════════ */}
    {drawerCompany && (
      <>
        {/* Overlay */}
        <div
          onClick={() => { setDrawerCompanyId(null); setDrawerError(null) }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(26,15,6,0.35)', zIndex: 500,
            backdropFilter: 'blur(2px)',
          }}
        />

        {/* Panel */}
        <div className="drawer-panel" style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: '100%', maxWidth: 440,
          background: '#FDFCF9', zIndex: 501,
          boxShadow: '-8px 0 40px rgba(60,30,10,0.12)',
          display: 'flex', flexDirection: 'column',
          fontFamily: F.body,
        }}>
          <div style={{ height: 3, background: 'linear-gradient(90deg,#1D4ED8,#3B82F6,#60A5FA)', flexShrink: 0 }} />

          {/* Sticky header */}
          <div style={{
            padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          }}>
            <CompanyInitials name={drawerCompany.name} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 15, fontWeight: 700, color: C.ink,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {drawerCompany.name}
              </div>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace', marginTop: 2 }}>
                {drawerCompany.slug}
              </div>
            </div>
            <button
              onClick={() => { setDrawerCompanyId(null); setDrawerError(null) }}
              style={{
                background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7,
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <IconClose size={13} color={C.muted} />
            </button>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

            {/* Drawer error */}
            {drawerError && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                background: C.redBg, border: `1px solid #FECACA`,
                fontSize: 12.5, color: C.red,
              }}>
                {drawerError}
              </div>
            )}

            {/* Status + company suspension */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderRadius: 10,
              background: C.bg, border: `1px solid ${C.border}`,
              marginBottom: 24,
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>Statut</div>
                <Badge color={drawerCompany.is_active ? C.green : C.red} bg={drawerCompany.is_active ? C.greenBg : C.redBg}>
                  {drawerCompany.is_active ? 'Actif' : 'Suspendu'}
                </Badge>
              </div>
              <button
                  onClick={() => handleToggle(drawerCompany.id, !drawerCompany.is_active)}
                  disabled={toggling === drawerCompany.id}
                  style={{
                    padding: '7px 14px',
                    border: `1px solid ${drawerCompany.is_active ? '#FECACA' : C.orange}`,
                    borderRadius: 8,
                    background: drawerCompany.is_active ? C.redBg : C.orangeBg,
                    color: drawerCompany.is_active ? C.red : C.orange,
                    fontSize: 12.5, fontWeight: 600,
                    cursor: toggling === drawerCompany.id ? 'wait' : 'pointer',
                    fontFamily: F.body, opacity: toggling === drawerCompany.id ? 0.6 : 1,
                  }}
                >
                  {toggling === drawerCompany.id ? '…' : drawerCompany.is_active ? 'Suspendre l\'entreprise' : 'Réactiver l\'entreprise'}
                </button>
            </div>

            {/* ── Owner section ── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: C.muted,
                letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12,
              }}>
                Propriétaire
              </div>

              {drawerCompany.owner ? (() => {
                const owner = drawerCompany.owner!
                return (
                  <div style={{
                    padding: '14px 16px', borderRadius: 10,
                    border: `1px solid ${C.border}`, background: C.surface,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <UserInitials name={owner.full_name} size={34} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{owner.full_name}</div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{owner.email}</div>
                      </div>
                      <Badge color={owner.is_active ? C.green : C.red} bg={owner.is_active ? C.greenBg : C.redBg}>
                        {owner.is_active ? 'Actif' : 'Inactif'}
                      </Badge>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setResetTarget({ userId: owner.id, name: owner.full_name, email: owner.email })}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          padding: '7px 12px',
                          border: `1px solid rgba(160,83,26,0.28)`, borderRadius: 7,
                          background: C.amberGlow, color: C.amber,
                          fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', fontFamily: F.body,
                        }}
                      >
                        <IconKey size={12} color={C.amber} />
                        Réinitialiser MDP
                      </button>
                      <button
                        onClick={() => handleUserToggle(owner.id, !owner.is_active)}
                        disabled={togglingUser === owner.id}
                        style={{
                          flex: 1, padding: '7px 12px',
                          border: `1px solid ${owner.is_active ? '#FECACA' : C.orange}`,
                          borderRadius: 7,
                          background: owner.is_active ? C.redBg : C.orangeBg,
                          color: owner.is_active ? C.red : C.orange,
                          fontSize: 12, fontWeight: 600,
                          cursor: togglingUser === owner.id ? 'wait' : 'pointer',
                          fontFamily: F.body, opacity: togglingUser === owner.id ? 0.6 : 1,
                        }}
                      >
                        {togglingUser === owner.id ? '…' : owner.is_active ? 'Suspendre' : 'Réactiver'}
                      </button>
                    </div>
                  </div>
                )
              })() : (
                <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>Aucun propriétaire configuré.</div>
              )}
            </div>

            {/* ── Team members ── */}
            {drawerCompany.members.length > 0 && (
              <div>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: C.muted,
                  letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12,
                }}>
                  Équipe ({drawerCompany.members.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {drawerCompany.members.map(member => {
                    const rm = ROLE_META[member.role] ?? ROLE_META.vendor
                    return (
                      <div key={member.id} style={{
                        padding: '12px 14px', borderRadius: 10,
                        border: `1px solid ${C.border}`, background: C.surface,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <UserInitials name={member.full_name} size={32} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.full_name}</div>
                            <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{member.email}</div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <Badge color={rm.color} bg={rm.bg}>{rm.label}</Badge>
                            <Badge color={member.is_active ? C.green : C.red} bg={member.is_active ? C.greenBg : C.redBg}>
                              {member.is_active ? 'Actif' : 'Inactif'}
                            </Badge>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 7 }}>
                          <button
                            onClick={() => setResetTarget({ userId: member.id, name: member.full_name, email: member.email })}
                            style={{
                              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                              padding: '6px 10px',
                              border: `1px solid rgba(160,83,26,0.28)`, borderRadius: 7,
                              background: C.amberGlow, color: C.amber,
                              fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: F.body,
                            }}
                          >
                            <IconKey size={11} color={C.amber} />
                            Réinit. MDP
                          </button>
                          <button
                            onClick={() => handleUserToggle(member.id, !member.is_active)}
                            disabled={togglingUser === member.id}
                            style={{
                              flex: 1, padding: '6px 10px',
                              border: `1px solid ${member.is_active ? C.redBd : C.orangeBd}`,
                              borderRadius: 7,
                              background: member.is_active ? C.redBg : C.orangeBg,
                              color: member.is_active ? C.red : C.orange,
                              fontSize: 11.5, fontWeight: 600,
                              cursor: togglingUser === member.id ? 'wait' : 'pointer',
                              fontFamily: F.body, opacity: togglingUser === member.id ? 0.6 : 1,
                            }}
                          >
                            {togglingUser === member.id ? '…' : member.is_active ? 'Suspendre' : 'Réactiver'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    )}

    {/* ═══════════════════════════════════════════════════════════════════════
        Password Reset Modal
    ════════════════════════════════════════════════════════════════════════ */}
    {resetTarget && (
      <div
        onClick={e => { if (e.target === e.currentTarget && !resetLoading) { setResetTarget(null); setResetError(null); setResetPwd('') } }}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(26,15,6,0.50)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: Z.modal, padding: SP[5], backdropFilter: 'blur(4px)', fontFamily: F.body,
        }}
      >
        <div className="modal-panel" style={{
          background: C.surfaceEl, borderRadius: R.xl,
          width: '100%', maxWidth: 420,
          border: `1px solid ${C.border}`,
          boxShadow: SH.xl, overflow: 'hidden',
        }}>
          <div style={{ height: 3, background: `linear-gradient(90deg, ${C.amberActive}, ${C.amber}, ${C.amberDim})` }} />
          {/* Header */}
          <div style={{
            padding: `${SP[4]} ${SP[5]}`, borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', gap: SP[3],
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: R.md,
              background: C.amberGlow, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <IconKey size={16} color={C.amber} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Réinitialiser le mot de passe</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{resetTarget.name} · {resetTarget.email}</div>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '20px 22px' }}>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              Définissez un nouveau mot de passe temporaire. Communiquez-le au client via un canal sécurisé et invitez-le à le modifier dès sa prochaine connexion.
            </p>

            {/* Password input */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Nouveau mot de passe *
                <span style={{ fontSize: 11, fontWeight: 400, color: C.muted, marginLeft: 6, textTransform: 'none' }}>
                  — min. 8 caractères
                </span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={resetShowPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={resetPwd}
                  onChange={e => setResetPwd(e.target.value)}
                  disabled={resetLoading}
                  autoFocus
                  style={{ ...inputStyle, paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setResetShowPwd(p => !p)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                    color: C.muted, display: 'flex',
                  }}
                >
                  {resetShowPwd ? <IconEyeOff size={15} color={C.muted} /> : <IconEye size={15} color={C.muted} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {resetError && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 14,
                background: C.redBg, border: `1px solid #FECACA`,
                fontSize: 13, color: C.red,
              }}>
                {resetError}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn-amber"
                onClick={handlePasswordReset}
                disabled={resetLoading || resetPwd.length < 8}
                style={{
                  flex: 1, height: 44,
                  border: 'none', borderRadius: R.md,
                  fontSize: F.sm, fontWeight: F.bold,
                  cursor: resetLoading || resetPwd.length < 8 ? 'not-allowed' : 'pointer',
                  fontFamily: F.body,
                  opacity: resetPwd.length < 8 ? 0.45 : 1,
                }}
              >
                {resetLoading ? 'En cours…' : 'Confirmer'}
              </button>
              <button
                className="btn-ghost"
                onClick={() => { setResetTarget(null); setResetError(null); setResetPwd('') }}
                disabled={resetLoading}
                style={{
                  padding: '11px 18px', background: C.bg, color: C.muted,
                  border: `1px solid ${C.border}`, borderRadius: 9,
                  fontSize: 13, fontWeight: 500,
                  cursor: resetLoading ? 'not-allowed' : 'pointer', fontFamily: F.body,
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ═══════════════════════════════════════════════════════════════════════
        New Company Modal
    ════════════════════════════════════════════════════════════════════════ */}
    {showModal && (
      <div
        onClick={e => { if (e.target === e.currentTarget && !submitting) setShowModal(false) }}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(26,15,6,0.48)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: Z.modal, padding: SP[5], backdropFilter: 'blur(4px)', fontFamily: F.body,
        }}
      >
        <div className="modal-panel" style={{
          background: C.surfaceEl, borderRadius: R.xl,
          width: '100%', maxWidth: 520,
          border: `1px solid ${C.border}`,
          boxShadow: SH.xl,
          maxHeight: '90vh', overflowY: 'auto',
        }}>
          <div style={{ height: 3, background: `linear-gradient(90deg, ${C.amberActive}, ${C.amber}, ${C.amberDim})`, flexShrink: 0 }} />

          {/* Modal header */}
          <div style={{
            padding: `${SP[4]} ${SP[5]}`, borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SP[2.5] }}>
              <div style={{ width: 36, height: 36, borderRadius: R.md, background: C.amberGlow, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconBuilding size={16} color={C.amber} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>Nouvelle entreprise</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>Crée l'entreprise et son compte propriétaire.</div>
              </div>
            </div>
            <button
              onClick={() => !submitting && setShowModal(false)}
              style={{
                background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7,
                width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 16, color: C.muted,
              }}
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '22px' }}>
            {/* Section 1 */}
            <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6, fontFamily: F.body }}>
              <IconBuilding size={12} color={C.amber} />
              Informations de l'entreprise
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Nom de l'entreprise *</label>
              <input type="text" placeholder="ex : Société TechBuild" value={form.companyName} onChange={e => handleNameChange(e.target.value)} required disabled={submitting} style={inputStyle} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>
                Identifiant unique (slug) *
                <span style={{ fontSize: 11, fontWeight: 400, color: C.muted, marginLeft: 6, textTransform: 'none' }}>— lettres minuscules, chiffres, tirets</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input type="text" placeholder="ex : techbuild" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} required disabled={submitting} style={{ ...inputStyle, paddingLeft: 80 }} />
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.muted, pointerEvents: 'none', fontFamily: 'monospace' }}>sgi.app/</span>
              </div>
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>
                Devise *
                <span style={{ fontSize: 11, fontWeight: 400, color: C.muted, marginLeft: 6, textTransform: 'none' }}>— ex : FCFA, EUR, USD, XAF</span>
              </label>
              <input type="text" placeholder="FCFA" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} required disabled={submitting} style={inputStyle} maxLength={10} />
            </div>

            <div style={{ borderTop: `1px solid ${C.border}`, marginBottom: 18 }} />

            {/* Section 2 */}
            <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6, fontFamily: F.body }}>
              <IconUsers size={12} color={C.amber} />
              Compte propriétaire
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Nom complet *</label>
              <input type="text" placeholder="ex : Alain Mbarga" value={form.ownerFullName} onChange={e => setForm(f => ({ ...f, ownerFullName: e.target.value }))} required disabled={submitting} style={inputStyle} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Email *</label>
              <input type="email" placeholder="ex : alain@techbuild.cm" value={form.ownerEmail} onChange={e => setForm(f => ({ ...f, ownerEmail: e.target.value }))} required disabled={submitting} style={inputStyle} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Mot de passe *
                <span style={{ fontSize: 11, fontWeight: 400, color: C.muted, marginLeft: 6, textTransform: 'none' }}>— min. 8 caractères</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input type={showPwd ? 'text' : 'password'} placeholder="••••••••" value={form.ownerPassword} onChange={e => setForm(f => ({ ...f, ownerPassword: e.target.value }))} required minLength={8} disabled={submitting} style={{ ...inputStyle, paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: C.muted, display: 'flex' }}>
                  {showPwd ? <IconEyeOff size={15} color={C.muted} /> : <IconEye size={15} color={C.muted} />}
                </button>
              </div>
            </div>

            {formError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: C.redBg, border: `1px solid #FECACA`, fontSize: 13, color: C.red, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn-amber" disabled={submitting} style={{ flex: 1, height: 44, border: 'none', borderRadius: R.md, fontSize: F.sm, fontWeight: F.bold, cursor: submitting ? 'wait' : 'pointer', fontFamily: F.body }}>
                {submitting ? 'Création en cours…' : 'Créer l\'entreprise'}
              </button>
              <button type="button" className="btn-ghost" onClick={() => !submitting && setShowModal(false)} disabled={submitting} style={{ padding: '11px 18px', background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: F.body }}>
                Annuler
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    </>
  )
}
