'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter }                                   from 'next/navigation'
import { useIsMobile }                                 from '@/hooks/useIsMobile'
import {
  createCompanyWithOwner,
  toggleCompanyActive,
  resetUserPassword,
  togglePlatformUserActive,
} from './actions'
import type { BadgeCounts } from '@/lib/supabase/badge-counts'
import { C, F, R, SP, SH, TR, Z } from '@/lib/design-system'

// ── Admin-specific constants ──────────────────────────────────────────────────
// Shell reuses sidebarBg/El/Hov/Bd tokens — same espresso DNA, no new values.
// Admin canvas uses C.bgDeep instead of C.bg — subtly cooler, signals operator mode.
const CANVAS    = C.bgDeep    // '#EDE5D8' — operator mode canvas
const TOPBAR_H  = 56          // px
const SIDEBAR_W = 220         // px

// Blue-slate: system/data accent (IDs, references, timestamps).
// Distinct from brand cognac — "system value" not "user action".
const SL = {
  color: '#3D6B8A',
  bg:    'rgba(61,107,138,0.10)',
  bd:    'rgba(61,107,138,0.22)',
}

// ── Audit event display ───────────────────────────────────────────────────────
const ACTION_META: Record<string, { label: string; color: string; bg: string; bd: string }> = {
  COMPANY_CREATED:              { label: 'Entreprise créée',     color: C.green,  bg: C.greenBg,   bd: C.greenBd  },
  COMPANY_ACTIVATED:            { label: 'Entreprise réactivée', color: SL.color, bg: SL.bg,       bd: SL.bd      },
  COMPANY_DEACTIVATED:          { label: 'Entreprise suspendue', color: C.orange, bg: C.orangeBg,  bd: C.orangeBd },
  PLATFORM_USER_SUSPENDED:      { label: 'Compte suspendu',      color: C.red,    bg: C.redBg,     bd: C.redBd    },
  PLATFORM_USER_REACTIVATED:    { label: 'Compte réactivé',      color: C.green,  bg: C.greenBg,   bd: C.greenBd  },
  PLATFORM_USER_PASSWORD_RESET: { label: 'MDP réinitialisé',     color: C.amber,  bg: C.amberGlow, bd: 'rgba(160,83,26,0.30)' },
}

// ── Role display ──────────────────────────────────────────────────────────────
const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  owner:     { label: 'Propriétaire', color: C.amber,  bg: C.amberGlow  },
  admin:     { label: 'Admin',        color: SL.color, bg: SL.bg        },
  vendor:    { label: 'Vendeur',      color: C.green,  bg: C.greenBg    },
  warehouse: { label: 'Magasinier',   color: C.muted,  bg: C.surfaceSub },
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
function fmtDateLong(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'à l\'instant'
  if (mins < 60) return `il y a ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs  < 24) return `il y a ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days <  7) return `il y a ${days}j`
  return fmtDate(iso)
}

// ── Types ─────────────────────────────────────────────────────────────────────
type IconProps = { size?: number; color?: string }

// ── SVG Icons ─────────────────────────────────────────────────────────────────
function IconGrid({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="2"  y="2"  width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.5"/>
      <rect x="11" y="2"  width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.5"/>
      <rect x="2"  y="11" width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.5"/>
      <rect x="11" y="11" width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.5"/>
    </svg>
  )
}
function IconBuilding({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="5" width="16" height="12" rx="1.5" stroke={color} strokeWidth="1.5"/>
      <path d="M6 10h2M12 10h2M6 13h2M12 13h2" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M9 17V9" stroke={color} strokeWidth="1.4"/>
      <path d="M6 5V3.5a1 1 0 011-1h6a1 1 0 011 1V5" stroke={color} strokeWidth="1.4"/>
    </svg>
  )
}
function IconUsers({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="8" cy="6" r="3" stroke={color} strokeWidth="1.5"/>
      <path d="M2 17c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M14 8a2.5 2.5 0 100-5M17 17c0-2.21-1.343-3.79-3-4.5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}
function IconBox({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M3 6l7-3 7 3v8l-7 3-7-3V6Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M10 3v11M3 6l7 4 7-4" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}
function IconHistory({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M3 10a7 7 0 1 0 .47-2.56" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M3 4v4h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 7v4l2.5 2" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconActivity({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M2 10h3l2-6 3 12 2-8 2 4h4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconPlus({ size = 15, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 15 15" fill="none">
      <path d="M7.5 2v11M2 7.5h11" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}
function IconSearch({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="9" cy="9" r="6" stroke={color} strokeWidth="1.5"/>
      <path d="M13.5 13.5L17 17" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}
function IconClose({ size = 13, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M1 1l12 12M13 1L1 13" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}
function IconKey({ size = 15, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="7.5" cy="8.5" r="4" stroke={color} strokeWidth="1.5"/>
      <path d="M10.5 11.5l6 6M13.5 13.5l2-2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconChevronRight({ size = 13, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M5 3l4 4-4 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconEye({ size = 15, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M1 10s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" stroke={color} strokeWidth="1.5"/>
      <circle cx="10" cy="10" r="2.5" stroke={color} strokeWidth="1.5"/>
    </svg>
  )
}
function IconEyeOff({ size = 15, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M3 3l14 14M8.5 8.6A2.5 2.5 0 0012.4 12.5M6.5 5.4C3.8 6.8 2 10 2 10s3.5 7 8 7a8 8 0 004.2-1.2M10 3c5 0 8 7 8 7a13.4 13.4 0 01-1.7 2.6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function IconLogOut({ size = 15, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M8 3H4a1 1 0 00-1 1v12a1 1 0 001 1h4" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M13 14l4-4-4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17 10H7" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function IconArrowRight({ size = 13, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M2 7h10M8 3l4 4-4 4" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconDots({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="5"  cy="10" r="1.5" fill={color}/>
      <circle cx="10" cy="10" r="1.5" fill={color}/>
      <circle cx="15" cy="10" r="1.5" fill={color}/>
    </svg>
  )
}
function IconUserOff({ size = 13, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M3 3l14 14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="10" cy="6" r="3" stroke={color} strokeWidth="1.5"/>
      <path d="M4 17c0-3.314 2.686-5 6-5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function IconUserCheck({ size = 13, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx="8" cy="6" r="3" stroke={color} strokeWidth="1.5"/>
      <path d="M2 17c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M13 12l2 2 4-3" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, width = 72, height = 24, color = C.amber }: {
  data: number[]; width?: number; height?: number; color?: string
}) {
  if (!data || data.every(v => v === 0)) {
    return (
      <svg width={width} height={height}>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2}
          stroke={C.borderSub} strokeWidth="1" strokeDasharray="3 3"/>
      </svg>
    )
  }
  const max = Math.max(...data, 1)
  const pad = 2
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - pad * 2) + pad
    const y = (height - pad * 2) - (v / max) * (height - pad * 4) + pad
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={width} height={height} style={{ overflow: 'visible', display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.85}/>
    </svg>
  )
}

// ── Small shared components ───────────────────────────────────────────────────
function CompanyAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const parts   = name.trim().split(/\s+/)
  const letters = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
  const hue     = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: R.md, flexShrink: 0,
      background: `linear-gradient(135deg, hsl(${hue},40%,90%), hsl(${(hue + 25) % 360},45%,82%))`,
      border: `1px solid hsl(${hue},35%,76%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: F.bold,
      color: `hsl(${hue},55%,28%)`, letterSpacing: '-0.01em', fontFamily: F.body,
    }}>
      {letters}
    </div>
  )
}

function UserAvatar({ name, size = 30 }: { name: string; size?: number }) {
  const parts   = name.trim().split(/\s+/)
  const letters = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: R.full, flexShrink: 0,
      background: C.surfaceSub, border: `1.5px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.34, fontWeight: F.bold, color: C.muted, fontFamily: F.body,
    }}>
      {letters}
    </div>
  )
}

function Bdg({ children, color, bg, bd }: {
  children: React.ReactNode; color: string; bg: string; bd?: string
}) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: R.full,
      fontSize: 11, fontWeight: F.semibold,
      background: bg, color,
      border: `1px solid ${bd ?? C.transparent}`,
      whiteSpace: 'nowrap', fontFamily: F.body,
    }}>
      {children}
    </span>
  )
}

function SecLabel({ children, top }: { children: React.ReactNode; top?: string }) {
  return (
    <div style={{
      fontSize: F.xs, fontWeight: F.bold, color: C.muted,
      letterSpacing: F.lsWider, textTransform: 'uppercase',
      marginBottom: SP[2.5], marginTop: top,
    }}>
      {children}
    </div>
  )
}

// ── Data types ────────────────────────────────────────────────────────────────
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
  sparkline:      number[]
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

const emptyForm = () => ({
  companyName: '', slug: '', currency: 'FCFA',
  ownerFullName: '', ownerEmail: '', ownerPassword: '',
})

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function AdminClient({
  profile,
  companies,
  auditLogs,
  totalSalesThisMonth,
}: {
  profile:             Profile
  companies:           Company[]
  auditLogs:           AuditEntry[]
  totalSalesThisMonth: number
  badgeCounts?:        BadgeCounts
}) {
  const router    = useRouter()
  const isMobile  = useIsMobile()
  const [isPending, startTransition] = useTransition()

  // ── Navigation ────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'overview' | 'companies' | 'journal'>('overview')

  // ── Companies ─────────────────────────────────────────────────────────────
  const [companySearch, setCompanySearch] = useState('')

  // ── New company modal ─────────────────────────────────────────────────────
  const [showModal,  setShowModal]  = useState(false)
  const [formStep,   setFormStep]   = useState<1 | 2>(1)
  const [form,       setForm]       = useState(emptyForm)
  const [showPwd,    setShowPwd]    = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError,  setFormError]  = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // ── Company toggle ────────────────────────────────────────────────────────
  const [toggling, setToggling] = useState<string | null>(null)

  // ── Drawer ────────────────────────────────────────────────────────────────
  const [drawerCid,    setDrawerCid]    = useState<string | null>(null)
  const [drawerError,  setDrawerError]  = useState<string | null>(null)
  const [togglingUser, setTogglingUser] = useState<string | null>(null)

  // ── Suspend user confirmation ─────────────────────────────────────────────
  const [confirmSuspend, setConfirmSuspend] = useState<{ userId: string; name: string } | null>(null)

  // ── Password reset ────────────────────────────────────────────────────────
  const [resetTarget,  setResetTarget]  = useState<{ userId: string; name: string; email: string } | null>(null)
  const [resetPwd,     setResetPwd]     = useState('')
  const [resetShowPwd, setResetShowPwd] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError,   setResetError]   = useState<string | null>(null)

  // ── Journal filters ───────────────────────────────────────────────────────
  const [jFilterCo,   setJFilterCo]   = useState('all')
  const [jFilterType, setJFilterType] = useState('all')

  // ── Command palette ───────────────────────────────────────────────────────
  const [cmdOpen,  setCmdOpen]  = useState(false)
  const [cmdQuery, setCmdQuery] = useState('')

  // ── Member context menu ───────────────────────────────────────────────────
  const [memberMenu, setMemberMenu] = useState<string | null>(null)

  // ── Mobile nav ────────────────────────────────────────────────────────────
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // ── Logout confirmation ───────────────────────────────────────────────────
  const [confirmLogout,  setConfirmLogout]  = useState(false)
  const [loggingOut,     setLoggingOut]     = useState(false)

  // ── Hover tracking ────────────────────────────────────────────────────────
  const [navHover,  setNavHover]  = useState<string | null>(null)
  const [rowHover,  setRowHover]  = useState<string | null>(null)

  // ── Derived ───────────────────────────────────────────────────────────────
  const drawerCompany    = drawerCid ? (companies.find(c => c.id === drawerCid) ?? null) : null
  const activeCompanies  = companies.filter(c => c.is_active).length
  const totalActiveUsers = companies.reduce((s, c) => s + c.activeUsers, 0)
  const totalProducts    = companies.reduce((s, c) => s + c.activeProducts, 0)

  const visibleCompanies = companySearch.trim()
    ? companies.filter(c =>
        c.name.toLowerCase().includes(companySearch.toLowerCase()) ||
        c.slug.toLowerCase().includes(companySearch.toLowerCase()) ||
        c.owner?.full_name?.toLowerCase().includes(companySearch.toLowerCase()) ||
        c.owner?.email?.toLowerCase().includes(companySearch.toLowerCase())
      )
    : companies

  const filteredAudit = auditLogs.filter(e => {
    const isCoAction = ['COMPANY_CREATED', 'COMPANY_ACTIVATED', 'COMPANY_DEACTIVATED'].includes(e.action_type)
    const coMatch   = jFilterCo   === 'all' || (isCoAction ? e.entity_id : e.company_id) === jFilterCo
    const typeMatch = jFilterType === 'all' || e.action_type === jFilterType
    return coMatch && typeMatch
  })

  const groupedAudit = filteredAudit.reduce((acc, e) => {
    const key = fmtDateLong(e.created_at)
    ;(acc[key] = acc[key] ?? []).push(e)
    return acc
  }, {} as Record<string, AuditEntry[]>)

  // ── Keyboard shortcut Cmd+K ───────────────────────────────────────────────
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); setCmdOpen(o => !o); setCmdQuery('')
      }
      if (e.key === 'Escape') { setCmdOpen(false); setMemberMenu(null); if (!loggingOut) setConfirmLogout(false) }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])

  useEffect(() => {
    if (!memberMenu) return
    const h = () => setMemberMenu(null)
    window.addEventListener('click', h)
    return () => window.removeEventListener('click', h)
  }, [memberMenu])

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

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleNameChange(name: string) {
    setForm(f => ({
      ...f, companyName: name,
      slug: f.slug === slugify(f.companyName) || f.slug === '' ? slugify(name) : f.slug,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null); setSubmitting(true)
    const result = await createCompanyWithOwner(form)
    setSubmitting(false)
    if (result.error) { setFormError(result.error); return }
    setSuccessMsg(`Entreprise "${result.companyName}" créée avec succès.`)
    setShowModal(false); setFormStep(1); setForm(emptyForm())
    startTransition(() => router.refresh())
  }

  async function handleToggleCompany(id: string, active: boolean) {
    setToggling(id)
    const r = await toggleCompanyActive(id, active)
    setToggling(null)
    if (r.error) setDrawerError(r.error)
    else startTransition(() => router.refresh())
  }

  async function handleUserToggle(userId: string, active: boolean) {
    setTogglingUser(userId)
    const r = await togglePlatformUserActive(userId, active)
    setTogglingUser(null)
    if (r.error) setDrawerError(r.error)
    else startTransition(() => router.refresh())
  }

  function requestSuspend(userId: string, name: string) {
    setConfirmSuspend({ userId, name }); setMemberMenu(null)
  }

  async function handlePasswordReset() {
    if (!resetTarget) return
    setResetLoading(true); setResetError(null)
    const r = await resetUserPassword(resetTarget.userId, resetPwd)
    setResetLoading(false)
    if (r.error) { setResetError(r.error); return }
    const name = resetTarget.name
    setResetTarget(null); setResetPwd(''); setResetShowPwd(false)
    setSuccessMsg(`Mot de passe de ${name} réinitialisé.`)
  }

  // ── Audit helpers ──────────────────────────────────────────────────────────
  function affectedCompany(e: AuditEntry) {
    const isCoAction = ['COMPANY_CREATED', 'COMPANY_ACTIVATED', 'COMPANY_DEACTIVATED'].includes(e.action_type)
    const id = isCoAction ? e.entity_id : (e.company_id ?? e.data_after?.target_company_id)
    return id ? (companies.find(c => c.id === id)?.name ?? '—') : '—'
  }

  function auditDetail(e: AuditEntry) {
    const d = e.data_after
    if (!d) return '—'
    switch (e.action_type) {
      case 'COMPANY_CREATED':
        return [d.name, d.ownerEmail].filter(Boolean).join(' · ') || '—'
      case 'COMPANY_ACTIVATED':
      case 'COMPANY_DEACTIVATED':
        return d.affectedUsers != null ? `${d.affectedUsers} compte(s) affecté(s)` : '—'
      case 'PLATFORM_USER_SUSPENDED':
      case 'PLATFORM_USER_REACTIVATED':
      case 'PLATFORM_USER_PASSWORD_RESET':
        return [d.target_name, d.target_email].filter(Boolean).join(' · ') || '—'
      default: return '—'
    }
  }

  // ── Style atoms ───────────────────────────────────────────────────────────
  const inputSt: React.CSSProperties = {
    width: '100%', padding: '9px 12px',
    border: `1.5px solid ${C.border}`, borderRadius: R.md,
    fontSize: F.base, fontFamily: F.body, color: C.ink,
    background: C.surfaceEl, outline: 'none', boxSizing: 'border-box',
  }
  const labelSt: React.CSSProperties = {
    display: 'block', fontSize: F.xs, fontWeight: F.bold,
    color: C.muted, letterSpacing: F.lsWider,
    textTransform: 'uppercase', marginBottom: 5,
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <>

    {/* ── Topbar ───────────────────────────────────────────────────────────── */}
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: TOPBAR_H,
      background: C.sidebarBg, borderBottom: `1px solid ${C.sidebarBd}`,
      display: 'flex', alignItems: 'center',
      paddingLeft: SP[5], paddingRight: SP[5],
      zIndex: Z.sticky + 10, fontFamily: F.body,
    }}>
      {/* Hamburger (mobile only) */}
      {isMobile && (
        <button
          onClick={() => setMobileNavOpen(o => !o)}
          style={{
            width: 34, height: 34, marginRight: SP[3], flexShrink: 0,
            background: mobileNavOpen ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${C.sidebarBd}`, borderRadius: R.sm,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
            cursor: 'pointer', padding: 0,
          }}
        >
          <span style={{ display: 'block', width: 14, height: 1.5, background: mobileNavOpen ? C.amber : C.sidebarMuted, borderRadius: 2, transition: TR.fast }} />
          <span style={{ display: 'block', width: 14, height: 1.5, background: mobileNavOpen ? C.amber : C.sidebarMuted, borderRadius: 2, transition: TR.fast }} />
          <span style={{ display: 'block', width: 9, height: 1.5, background: mobileNavOpen ? C.amber : C.sidebarMuted, borderRadius: 2, transition: TR.fast, alignSelf: 'flex-start', marginLeft: 2.5 }} />
        </button>
      )}

      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SP[2.5], width: isMobile ? 'auto' : SIDEBAR_W - 20, flexShrink: 0 }}>
        <svg width="20" height="15" viewBox="0 0 22 16" fill="none">
          <path d="M2 15V2L10 9L18 2V15" stroke={C.sidebarInk} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 15h16" stroke={C.sidebarInk} strokeWidth="2.2" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: F.md, fontWeight: F.bold, color: C.sidebarInk, fontFamily: F.display, letterSpacing: F.lsTight }}>
          MERAM
        </span>
        <span style={{
          fontSize: 10, fontWeight: F.bold, letterSpacing: F.lsWider,
          color: C.amber, background: 'rgba(160,83,26,0.18)',
          border: '1px solid rgba(160,83,26,0.35)',
          padding: '2px 7px', borderRadius: R.full, textTransform: 'uppercase',
        }}>
          Admin
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* isPending refresh indicator */}
      {isPending && (
        <div style={{ marginRight: SP[3], display: 'flex', alignItems: 'center', gap: SP[1.5] }}>
          <span className="spinner-light" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
          <span style={{ fontSize: 11, color: C.sidebarMuted }}>Actualisation…</span>
        </div>
      )}

      {/* Command palette trigger (hidden on very small screens) */}
      {!isMobile && (
        <button
          onClick={() => { setCmdOpen(true); setCmdQuery('') }}
          style={{
            display: 'flex', alignItems: 'center', gap: SP[2],
            padding: `${SP[1.5]} ${SP[3]}`, borderRadius: R.sm,
            background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.sidebarBd}`,
            color: C.sidebarMuted, fontSize: F.sm, fontFamily: F.body, cursor: 'pointer',
            transition: TR.fast,
          }}
        >
          <IconSearch size={12} color={C.sidebarMuted} />
          <span>Rechercher…</span>
          <kbd style={{
            fontSize: 10, color: C.sidebarDim,
            background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.sidebarBd}`,
            borderRadius: R.xs, padding: '1px 5px', fontFamily: F.mono,
          }}>
            ⌘K
          </kbd>
        </button>
      )}

      {/* Operator avatar */}
      <div style={{
        marginLeft: SP[4], width: 32, height: 32, borderRadius: R.full,
        background: 'rgba(160,83,26,0.18)', border: '1.5px solid rgba(160,83,26,0.40)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: F.bold, color: C.amber, cursor: 'default', flexShrink: 0,
      }}>
        {profile.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
      </div>
    </div>

    {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
    {/* Mobile backdrop */}
    {isMobile && mobileNavOpen && (
      <div
        onClick={() => setMobileNavOpen(false)}
        className="modal-overlay"
        style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,6,0.55)', zIndex: Z.sticky + 8, backdropFilter: 'blur(2px)' }}
      />
    )}
    <div style={{
      position: 'fixed', top: TOPBAR_H, left: 0, bottom: 0, width: SIDEBAR_W,
      background: C.sidebarBg, borderRight: `1px solid ${C.sidebarBd}`,
      display: 'flex', flexDirection: 'column',
      zIndex: Z.sticky + 9,
      paddingTop: SP[3],
      ...(isMobile ? {
        transform: mobileNavOpen ? 'translateX(0)' : `translateX(-${SIDEBAR_W}px)`,
        transition: 'transform 0.26s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: mobileNavOpen ? '8px 0 32px rgba(26,15,6,0.30)' : 'none',
      } : {}),
    }}>
      {([
        { id: 'overview',  label: 'Vue d\'ensemble', Icon: IconGrid     },
        { id: 'companies', label: 'Entreprises',      Icon: IconBuilding },
        { id: 'journal',   label: 'Journal',           Icon: IconHistory  },
      ] as const).map(({ id, label, Icon }) => {
        const active = tab === id
        return (
          <button
            key={id}
            onClick={() => { setTab(id); setMobileNavOpen(false) }}
            onMouseEnter={() => setNavHover(id)}
            onMouseLeave={() => setNavHover(null)}
            style={{
              position: 'relative',
              display: 'flex', alignItems: 'center', gap: SP[2.5],
              margin: `1px ${SP[2]}`, padding: `${SP[2.5]} ${SP[3]}`,
              borderRadius: R.sm,
              background: active ? C.sidebarEl : navHover === id ? C.sidebarHov : 'transparent',
              border: 'none', cursor: 'pointer',
              color: active ? C.sidebarInk : navHover === id ? C.sidebarText : C.sidebarMuted,
              fontSize: F.base, fontWeight: active ? F.semibold : F.regular,
              fontFamily: F.body, textAlign: 'left',
              transition: TR.fast,
            }}
          >
            {active && (
              <span style={{
                position: 'absolute', left: 0, top: '18%', bottom: '18%',
                width: 3, borderRadius: 2,
                background: `linear-gradient(180deg, ${C.amberDim}, ${C.amber})`,
              }} />
            )}
            <Icon size={15} color={active ? C.amber : C.sidebarMuted} />
            {label}
          </button>
        )
      })}

      <div style={{ flex: 1 }} />

      {/* Profile + logout */}
      <div style={{
        borderTop: `1px solid ${C.sidebarBd}`,
        margin: `0 ${SP[2]}`, paddingTop: SP[3], paddingBottom: SP[3],
      }}>
        <div style={{ padding: `0 ${SP[3]}`, marginBottom: SP[2] }}>
          <div style={{ fontSize: F.xs, color: C.sidebarDim, fontWeight: F.semibold, letterSpacing: F.lsWider, textTransform: 'uppercase', marginBottom: 2 }}>
            Opérateur
          </div>
          <div style={{ fontSize: F.sm, color: C.sidebarText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {profile.full_name}
          </div>
        </div>
        <button
          onClick={() => setConfirmLogout(true)}
          onMouseEnter={() => setNavHover('logout')}
          onMouseLeave={() => setNavHover(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: SP[2.5],
            width: '100%', padding: `${SP[2]} ${SP[3]}`,
            background: navHover === 'logout' ? 'rgba(153,27,27,0.12)' : 'transparent',
            border: 'none', cursor: 'pointer',
            color: navHover === 'logout' ? '#FCACA0' : C.sidebarMuted,
            fontSize: F.sm, fontFamily: F.body, textAlign: 'left',
            borderRadius: R.sm, transition: TR.fast,
          }}
        >
          <IconLogOut size={14} color={navHover === 'logout' ? '#FCACA0' : C.sidebarMuted} />
          Déconnexion
        </button>
      </div>
    </div>

    {/* ── Content area ─────────────────────────────────────────────────────── */}
    <div style={{
      marginLeft: isMobile ? 0 : SIDEBAR_W, marginTop: TOPBAR_H,
      minHeight: `calc(100vh - ${TOPBAR_H}px)`,
      background: CANVAS, fontFamily: F.body,
    }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: isMobile ? `${SP[5]} ${SP[4]} ${SP[16]}` : `${SP[8]} ${SP[8]} ${SP[16]}` }}>

        {/* Toast */}
        {successMsg && (
          <div className="toast toast-green" style={{
            zIndex: Z.toast,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: R.full, background: C.green, flexShrink: 0, animation: 'pulseDot 2s ease-in-out infinite' }} />
            <span style={{ fontSize: F.sm, fontWeight: F.medium, color: C.green, flex: 1 }}>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.green, padding: '0 2px', opacity: 0.55, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <IconClose size={11} color={C.green} />
            </button>
          </div>
        )}

        {/* ══ OVERVIEW ══════════════════════════════════════════════════════ */}
        {tab === 'overview' && (
          <div className="fade-in-up">
            <div style={{ marginBottom: SP[8] }}>
              <h1 style={{ margin: 0, fontSize: F['2xl'], fontWeight: F.bold, color: C.ink, letterSpacing: F.lsTighter, fontFamily: F.display, lineHeight: F.lhTight }}>
                Bonjour, {profile.full_name.split(' ')[0]}
              </h1>
              <p style={{ margin: `${SP[1]} 0 0`, fontSize: F.sm, color: C.muted }}>
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}
                <span style={{ color: activeCompanies > 0 ? C.green : C.dim }}>
                  {activeCompanies} entreprise{activeCompanies !== 1 ? 's' : ''} active{activeCompanies !== 1 ? 's' : ''}
                </span>
              </p>
            </div>

            {/* KPI grid */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: SP[3.5], marginBottom: SP[9] }}>
              {([
                {
                  label: 'Entreprises actives',
                  value: `${activeCompanies}/${companies.length}`,
                  sub: `${companies.length - activeCompanies} suspendue${companies.length - activeCompanies !== 1 ? 's' : ''}`,
                  Icon: IconBuilding, color: C.amber,
                },
                {
                  label: 'Utilisateurs actifs',
                  value: String(totalActiveUsers),
                  sub: `${companies.reduce((s, c) => s + c.totalUsers, 0)} au total`,
                  Icon: IconUsers, color: SL.color,
                },
                {
                  label: 'Produits catalogués',
                  value: String(totalProducts),
                  sub: 'toutes entreprises',
                  Icon: IconBox, color: C.green,
                },
                {
                  label: 'Ventes ce mois',
                  value: String(totalSalesThisMonth),
                  sub: 'hors brouillons',
                  Icon: IconActivity, color: C.amber,
                },
              ] as const).map(({ label, value, sub, Icon, color }) => (
                <div key={label} className="kpi-card" style={{
                  background: C.surface, borderRadius: R.xl,
                  border: `1px solid ${C.border}`,
                  padding: `${SP[5]} ${SP[5]}`,
                  boxShadow: SH.xs,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: R.lg, marginBottom: SP[4],
                    background: `${color}1A`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={17} color={color} />
                  </div>
                  <div className="kpi-value" style={{ marginBottom: SP[1.5] }}>
                    {value}
                  </div>
                  <div style={{ fontSize: F.sm, color: C.muted, fontWeight: F.medium, marginBottom: SP[0.5] }}>{label}</div>
                  <div style={{ fontSize: 11, color: C.dim }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Activity feed */}
            <div style={{
              background: C.surface, borderRadius: R.xl,
              border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: SH.xs,
            }}>
              <div style={{
                padding: `${SP[3.5]} ${SP[5]}`, borderBottom: `1px solid ${C.borderSub}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: SP[2] }}>
                  <IconActivity size={14} color={C.amber} />
                  <span style={{ fontSize: F.base, fontWeight: F.semibold, color: C.ink }}>Activité récente</span>
                  <span style={{
                    fontSize: F.xs, color: C.dim, fontFamily: F.mono,
                    background: C.surfaceSub, border: `1px solid ${C.border}`,
                    padding: '1px 7px', borderRadius: R.full,
                  }}>
                    plateforme
                  </span>
                </div>
                <button
                  onClick={() => setTab('journal')}
                  style={{ display: 'flex', alignItems: 'center', gap: SP[1.5], background: 'none', border: 'none', cursor: 'pointer', fontSize: F.sm, color: C.amber, fontFamily: F.body, fontWeight: F.medium }}
                >
                  Voir le journal <IconArrowRight size={11} color={C.amber} />
                </button>
              </div>
              {auditLogs.length === 0 ? (
                <div style={{ padding: `${SP[10]} ${SP[6]}`, textAlign: 'center', color: C.muted, fontSize: F.sm }}>
                  Aucune action enregistrée.
                </div>
              ) : (
                <div>
                  {auditLogs.slice(0, 8).map((entry, i) => {
                    const meta   = ACTION_META[entry.action_type] ?? { label: entry.action_type, color: C.muted }
                    const detail = auditDetail(entry)
                    const co     = affectedCompany(entry)
                    return (
                      <div
                        key={entry.id}
                        onMouseEnter={() => setRowHover(`feed-${entry.id}`)}
                        onMouseLeave={() => setRowHover(null)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: SP[3.5],
                          padding: `${SP[2.5]} ${SP[5]}`,
                          borderBottom: i < Math.min(auditLogs.length, 8) - 1 ? `1px solid ${C.borderSub}` : 'none',
                          background: rowHover === `feed-${entry.id}` ? C.surfaceHov : 'transparent',
                          transition: 'background 0.12s ease', cursor: 'default',
                        }}>
                        <div style={{ width: 8, height: 8, borderRadius: R.full, background: meta.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: SP[2], flexWrap: 'wrap' }}>
                            <span style={{ fontSize: F.sm, fontWeight: F.medium, color: C.ink }}>{meta.label}</span>
                            {co !== '—' && <span style={{ fontSize: F.sm, color: C.muted }}>{co}</span>}
                          </div>
                          {detail !== '—' && (
                            <div style={{ fontSize: 11.5, color: C.dim, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {detail}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: C.dim, fontFamily: F.mono, flexShrink: 0 }}>
                          {relativeTime(entry.created_at)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ COMPANIES ═════════════════════════════════════════════════════ */}
        {tab === 'companies' && (
          <div className="fade-in-up">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: SP[6], gap: SP[4] }}>
              <div>
                <h1 style={{ margin: 0, fontSize: F['2xl'], fontWeight: F.bold, color: C.ink, letterSpacing: F.lsTighter, fontFamily: F.display, lineHeight: F.lhTight, fontOpticalSizing: 'auto' } as any}>Entreprises</h1>
                <p style={{ margin: `${SP[1]} 0 0`, fontSize: F.sm, color: C.muted }}>
                  {companies.length} entreprise{companies.length !== 1 ? 's' : ''} · {activeCompanies} active{activeCompanies !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                className="btn-amber"
                onClick={() => { setDrawerCid(null); setShowModal(true); setFormStep(1); setFormError(null) }}
                style={{ display: 'flex', alignItems: 'center', gap: SP[2], height: 38, padding: `0 ${SP[4]}`, flexShrink: 0 }}
              >
                <IconPlus size={13} color="#FAF5EE" />
                Nouvelle entreprise
              </button>
            </div>

            <div style={{ background: C.surface, borderRadius: R.xl, border: `1px solid ${C.border}`, boxShadow: SH.xs, overflow: 'hidden' }}>
              {/* Search */}
              <div style={{ padding: `${SP[3]} ${SP[4]}`, borderBottom: `1px solid ${C.borderSub}` }}>
                <div style={{ position: 'relative', maxWidth: 340 }}>
                  <div style={{ position: 'absolute', left: SP[3], top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                    <IconSearch size={13} color={C.dim} />
                  </div>
                  <input
                    value={companySearch}
                    onChange={e => setCompanySearch(e.target.value)}
                    placeholder="Nom, slug, propriétaire…"
                    style={{ ...inputSt, background: CANVAS, paddingLeft: SP[9], paddingTop: SP[2], paddingBottom: SP[2] }}
                  />
                </div>
              </div>

              {visibleCompanies.length === 0 ? (
                <EmptyState
                  Icon={IconBuilding}
                  title={companySearch ? 'Aucun résultat' : 'Aucune entreprise'}
                  body={companySearch
                    ? 'Aucune entreprise ne correspond à cette recherche.'
                    : 'Créez votre première entreprise pour démarrer.'}
                  action={!companySearch
                    ? { label: 'Nouvelle entreprise', onClick: () => { setDrawerCid(null); setShowModal(true); setFormStep(1) } }
                    : undefined}
                />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: CANVAS }}>
                        {['Entreprise', 'Propriétaire', 'Équipe', 'Activité 30j', 'Dernière vente', 'Statut', ''].map(h => (
                          <th key={h} style={{
                            padding: `${SP[2.5]} ${SP[4]}`, textAlign: 'left',
                            fontSize: F.xs, fontWeight: F.bold, color: C.muted,
                            letterSpacing: F.lsWider, textTransform: 'uppercase',
                            borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCompanies.map((co, i) => (
                        <tr
                          key={co.id}
                          className="trow-click"
                          style={{ borderBottom: i < visibleCompanies.length - 1 ? `1px solid ${C.borderSub}` : 'none' }}
                        >
                          <td style={{ padding: `${SP[3.5]} ${SP[4]}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: SP[2.5] }}>
                              <CompanyAvatar name={co.name} size={34} />
                              <div>
                                <div style={{ fontSize: F.base, fontWeight: F.bold, color: C.ink }}>{co.name}</div>
                                <div style={{ fontSize: 11, color: C.muted, fontFamily: F.mono, marginTop: 2 }}>{co.slug}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: `${SP[3.5]} ${SP[4]}` }}>
                            {co.owner ? (
                              <>
                                <div style={{ fontSize: F.sm, fontWeight: F.medium, color: C.ink }}>{co.owner.full_name}</div>
                                <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{co.owner.email}</div>
                              </>
                            ) : (
                              <span style={{ fontSize: F.sm, color: C.dim, fontStyle: 'italic' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: `${SP[3.5]} ${SP[4]}`, whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: F.base, fontWeight: F.semibold, color: C.ink, fontFamily: F.mono }}>
                              {co.activeUsers}
                              <span style={{ fontWeight: F.regular, color: C.muted }}>/{co.totalUsers}</span>
                            </span>
                            <div style={{ fontSize: 11, color: C.dim, marginTop: 1 }}>actifs</div>
                          </td>
                          <td style={{ padding: `${SP[3.5]} ${SP[4]}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: SP[2.5] }}>
                              <Sparkline data={co.sparkline} color={co.salesCount > 0 ? C.amber : C.borderSub} />
                              <span style={{ fontSize: F.sm, fontWeight: F.semibold, color: co.salesCount > 0 ? C.ink : C.dim, fontFamily: F.mono }}>
                                {co.salesCount}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: `${SP[3.5]} ${SP[4]}`, whiteSpace: 'nowrap' }}>
                            {co.lastSaleAt
                              ? <span style={{ fontSize: F.sm, color: C.ink, fontFamily: F.mono }}>{fmtDate(co.lastSaleAt)}</span>
                              : <span style={{ fontSize: F.sm, color: C.dim, fontStyle: 'italic' }}>—</span>
                            }
                          </td>
                          <td style={{ padding: `${SP[3.5]} ${SP[4]}` }}>
                            <Bdg
                              color={co.is_active ? C.green : C.red}
                              bg={co.is_active ? C.greenBg : C.redBg}
                              bd={co.is_active ? C.greenBd : C.redBd}
                            >
                              {co.is_active ? 'Actif' : 'Suspendu'}
                            </Bdg>
                          </td>
                          <td style={{ padding: `${SP[3.5]} ${SP[4]}`, textAlign: 'right' }}>
                            <button
                              className="btn-surface"
                              onClick={() => { setDrawerCid(co.id); setDrawerError(null) }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: SP[1.5],
                                padding: `${SP[1.5]} ${SP[3]}`,
                                borderRadius: R.sm,
                                fontSize: F.sm, fontWeight: F.medium,
                                cursor: 'pointer', fontFamily: F.body,
                              }}
                            >
                              Détails <IconChevronRight size={11} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ JOURNAL ═══════════════════════════════════════════════════════ */}
        {tab === 'journal' && (
          <div className="fade-in-up">
            <div style={{ marginBottom: SP[6] }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: SP[2], marginBottom: SP[1] }}>
                <h1 style={{ margin: 0, fontSize: F['2xl'], fontWeight: F.bold, color: C.ink, letterSpacing: F.lsTighter, fontFamily: F.display, lineHeight: F.lhTight, fontOpticalSizing: 'auto' } as any}>Journal</h1>
                <span style={{
                  fontSize: F.xs, fontWeight: F.semibold, color: C.amber,
                  background: C.amberGlow, border: '1px solid rgba(160,83,26,0.28)',
                  padding: '2px 8px', borderRadius: R.full, letterSpacing: F.lsWide,
                }}>
                  PLATEFORME
                </span>
              </div>
              <p style={{ margin: 0, fontSize: F.sm, color: C.muted }}>
                Actions système uniquement · données métier des entreprises non visibles ici
              </p>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: SP[2.5], marginBottom: SP[5], flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={jFilterCo}
                onChange={e => setJFilterCo(e.target.value)}
                style={{ padding: `${SP[2]} ${SP[2.5]}`, borderRadius: R.sm, border: `1px solid ${C.border}`, background: C.surface, fontSize: F.sm, color: C.ink, fontFamily: F.body, cursor: 'pointer', outline: 'none' }}
              >
                <option value="all">Toutes les entreprises</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select
                value={jFilterType}
                onChange={e => setJFilterType(e.target.value)}
                style={{ padding: `${SP[2]} ${SP[2.5]}`, borderRadius: R.sm, border: `1px solid ${C.border}`, background: C.surface, fontSize: F.sm, color: C.ink, fontFamily: F.body, cursor: 'pointer', outline: 'none' }}
              >
                <option value="all">Tous les types</option>
                {Object.entries(ACTION_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              {(jFilterCo !== 'all' || jFilterType !== 'all') && (
                <button
                  onClick={() => { setJFilterCo('all'); setJFilterType('all') }}
                  style={{ fontSize: F.sm, color: C.amber, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F.body }}
                >
                  Réinitialiser
                </button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: F.xs, color: C.dim, fontFamily: F.mono }}>
                {filteredAudit.length} entrée{filteredAudit.length !== 1 ? 's' : ''}
              </span>
            </div>

            {filteredAudit.length === 0 ? (
              <EmptyState
                Icon={IconHistory}
                title="Aucune entrée"
                body="Aucune action plateforme ne correspond aux filtres sélectionnés."
                action={{ label: 'Réinitialiser les filtres', onClick: () => { setJFilterCo('all'); setJFilterType('all') } }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: SP[6] }}>
                {Object.entries(groupedAudit).map(([dateKey, entries]) => (
                  <div key={dateKey}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: SP[2.5],
                      marginBottom: SP[2.5], paddingBottom: SP[2],
                      borderBottom: `1px solid ${C.borderSub}`,
                    }}>
                      <span style={{ fontSize: F.xs, fontWeight: F.bold, color: C.muted, letterSpacing: F.lsWider, textTransform: 'uppercase' }}>
                        {dateKey}
                      </span>
                      <span style={{ fontSize: F.xs, color: C.dim }}>
                        {entries.length} événement{entries.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: SP[1.5] }}>
                      {entries.map(entry => {
                        const meta   = ACTION_META[entry.action_type] ?? { label: entry.action_type, color: C.muted, bg: C.surfaceSub, bd: C.border }
                        const detail = auditDetail(entry)
                        const co     = affectedCompany(entry)
                        return (
                          <div
                            key={entry.id}
                            onMouseEnter={() => setRowHover(`journal-${entry.id}`)}
                            onMouseLeave={() => setRowHover(null)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: SP[3.5],
                              padding: `${SP[2.5]} ${SP[4]}`,
                              borderRadius: R.lg,
                              background: rowHover === `journal-${entry.id}` ? C.surfaceHov : C.surface,
                              border: `1px solid ${rowHover === `journal-${entry.id}` ? C.border : C.borderSub}`,
                              transition: 'background 0.12s ease, border-color 0.12s ease',
                            }}>
                            <div style={{ width: 8, height: 8, borderRadius: R.full, background: meta.color, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: SP[2.5], flexWrap: 'wrap' }}>
                              <Bdg color={meta.color} bg={meta.bg} bd={meta.bd}>{meta.label}</Bdg>
                              {co !== '—' && (
                                <span style={{ fontSize: F.sm, fontWeight: F.medium, color: C.ink }}>{co}</span>
                              )}
                              {detail !== '—' && (
                                <span style={{ fontSize: F.sm, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {detail}
                                </span>
                              )}
                            </div>
                            <div style={{ flexShrink: 0, textAlign: 'right' }}>
                              <div style={{ fontSize: 11.5, color: C.muted, fontFamily: F.mono }}>
                                {new Date(entry.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              {entry.users?.[0]?.full_name && (
                                <div style={{ fontSize: 11, color: C.dim, marginTop: 1 }}>{entry.users[0].full_name}</div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>

    {/* ════════════════════════════════════════════════════════════════════════
        DRAWER — Company detail
    ═══════════════════════════════════════════════════════════════════════ */}
    {drawerCompany && (
      <>
        <div
          onClick={() => { setDrawerCid(null); setDrawerError(null) }}
          className="modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,6,0.35)', zIndex: Z.overlay, backdropFilter: 'blur(2px)' }}
        />
        <div className="drawer-panel" style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: '100%', maxWidth: 460,
          background: C.surfaceEl, zIndex: Z.overlay + 1,
          boxShadow: '-8px 0 48px rgba(60,30,10,0.14)',
          display: 'flex', flexDirection: 'column',
          fontFamily: F.body,
        }}>
          <div style={{ height: 3, background: `linear-gradient(90deg, ${C.amberActive}, ${C.amber}, ${C.amberDim})`, flexShrink: 0 }} />

          {/* Header */}
          <div style={{
            padding: `${SP[4]} ${SP[5]}`, borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', gap: SP[3], flexShrink: 0,
          }}>
            <CompanyAvatar name={drawerCompany.name} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: F.md, fontWeight: F.bold, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {drawerCompany.name}
              </div>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: F.mono, marginTop: 2 }}>
                {drawerCompany.slug} · créée le {fmtDate(drawerCompany.created_at)}
              </div>
            </div>
            <button
              className="btn-icon"
              onClick={() => { setDrawerCid(null); setDrawerError(null) }}
              style={{ width: 30, height: 30, borderRadius: R.sm, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0 }}
            >
              <IconClose size={12} color={C.muted} />
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: SP[5] }}>
            {drawerError && (
              <div style={{ padding: `${SP[2.5]} ${SP[3.5]}`, borderRadius: R.md, marginBottom: SP[4], background: C.redBg, border: `1px solid ${C.redBd}`, fontSize: F.sm, color: C.red }}>
                {drawerError}
              </div>
            )}

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: SP[2.5], marginBottom: SP[5] }}>
              {([
                { label: 'Utilisateurs', value: `${drawerCompany.activeUsers}/${drawerCompany.totalUsers}` },
                { label: 'Produits',     value: String(drawerCompany.activeProducts) },
                { label: 'Ventes',       value: String(drawerCompany.salesCount) },
              ] as const).map(({ label, value }) => (
                <div key={label} style={{ padding: `${SP[2.5]} ${SP[3]}`, borderRadius: R.lg, background: CANVAS, border: `1px solid ${C.border}`, textAlign: 'center' }}>
                  <div style={{ fontSize: F.xl, fontWeight: F.bold, color: C.ink, fontFamily: F.mono, letterSpacing: F.lsTight }}>{value}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Company access */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: `${SP[3]} ${SP[4]}`, borderRadius: R.lg,
              background: CANVAS, border: `1px solid ${C.border}`, marginBottom: SP[6],
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: SP[2.5] }}>
                <span style={{ fontSize: F.xs, fontWeight: F.bold, color: C.muted, letterSpacing: F.lsWide, textTransform: 'uppercase' }}>
                  Accès
                </span>
                <Bdg
                  color={drawerCompany.is_active ? C.green : C.red}
                  bg={drawerCompany.is_active ? C.greenBg : C.redBg}
                  bd={drawerCompany.is_active ? C.greenBd : C.redBd}
                >
                  {drawerCompany.is_active ? 'Actif' : 'Suspendu'}
                </Bdg>
              </div>
              <button
                onClick={() => handleToggleCompany(drawerCompany.id, !drawerCompany.is_active)}
                disabled={toggling === drawerCompany.id}
                style={{
                  padding: `${SP[1.5]} ${SP[3.5]}`,
                  border: `1px solid ${drawerCompany.is_active ? C.redBd : C.greenBd}`,
                  borderRadius: R.sm,
                  background: drawerCompany.is_active ? C.redBg : C.greenBg,
                  color: drawerCompany.is_active ? C.red : C.green,
                  fontSize: F.sm, fontWeight: F.semibold,
                  cursor: toggling === drawerCompany.id ? 'wait' : 'pointer',
                  fontFamily: F.body, opacity: toggling === drawerCompany.id ? 0.6 : 1,
                }}
              >
                {toggling === drawerCompany.id
                  ? <><span className="spinner" style={{ width: 13, height: 13, borderColor: drawerCompany.is_active ? `${C.red}30` : `${C.green}30`, borderTopColor: drawerCompany.is_active ? C.red : C.green }} /> En cours…</>
                  : drawerCompany.is_active ? 'Suspendre l\'entreprise' : 'Réactiver'
                }
              </button>
            </div>

            {/* Owner */}
            <SecLabel>Propriétaire</SecLabel>
            {drawerCompany.owner ? (
              <UserRow
                user={drawerCompany.owner}
                menuOpen={memberMenu === drawerCompany.owner.id}
                isToggling={togglingUser === drawerCompany.owner.id}
                onMenuToggle={e => { e.stopPropagation(); setMemberMenu(id => id === drawerCompany.owner!.id ? null : drawerCompany.owner!.id) }}
                onReset={() => setResetTarget({ userId: drawerCompany.owner!.id, name: drawerCompany.owner!.full_name, email: drawerCompany.owner!.email })}
                onSuspend={() => requestSuspend(drawerCompany.owner!.id, drawerCompany.owner!.full_name)}
                onReactivate={() => handleUserToggle(drawerCompany.owner!.id, true)}
              />
            ) : (
              <p style={{ fontSize: F.sm, color: C.dim, fontStyle: 'italic', marginBottom: SP[5] }}>
                Aucun propriétaire configuré.
              </p>
            )}

            {/* Team */}
            {drawerCompany.members.length > 0 && (
              <>
                <SecLabel top={SP[5]}>Équipe ({drawerCompany.members.length})</SecLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: SP[2] }}>
                  {drawerCompany.members.map(m => (
                    <UserRow
                      key={m.id}
                      user={m}
                      menuOpen={memberMenu === m.id}
                      isToggling={togglingUser === m.id}
                      onMenuToggle={e => { e.stopPropagation(); setMemberMenu(id => id === m.id ? null : m.id) }}
                      onReset={() => setResetTarget({ userId: m.id, name: m.full_name, email: m.email })}
                      onSuspend={() => requestSuspend(m.id, m.full_name)}
                      onReactivate={() => handleUserToggle(m.id, true)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </>
    )}

    {/* ════════════════════════════════════════════════════════════════════════
        COMMAND PALETTE
    ═══════════════════════════════════════════════════════════════════════ */}
    {cmdOpen && (
      <CmdPalette
        query={cmdQuery}
        onQueryChange={setCmdQuery}
        companies={companies}
        onClose={() => { setCmdOpen(false); setCmdQuery('') }}
        onAction={action => {
          setCmdOpen(false); setCmdQuery('')
          if      (action === 'create')    { setDrawerCid(null); setShowModal(true); setFormStep(1) }
          else if (action === 'companies') setTab('companies')
          else if (action === 'journal')   setTab('journal')
          else if (action === 'overview')  setTab('overview')
          else if (action.startsWith('co:')) { setDrawerCid(action.slice(3)); setTab('companies') }
        }}
      />
    )}

    {/* ════════════════════════════════════════════════════════════════════════
        SUSPEND USER CONFIRMATION
    ═══════════════════════════════════════════════════════════════════════ */}
    {confirmSuspend && (
      <div
        onClick={e => { if (e.target === e.currentTarget) setConfirmSuspend(null) }}
        className="modal-overlay"
        style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,6,0.50)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: Z.modal + 10, padding: SP[5], backdropFilter: 'blur(4px)', fontFamily: F.body }}
      >
        <div className="modal-panel" style={{ background: C.surfaceEl, borderRadius: R.xl, width: '100%', maxWidth: 380, border: `1px solid ${C.border}`, boxShadow: SH.xl, overflow: 'hidden' }}>
          <div style={{ height: 3, background: `linear-gradient(90deg, ${C.amberActive}, ${C.amber}, ${C.amberDim})` }} />
          <div style={{ padding: `${SP[5]} ${SP[6]}` }}>
            <div style={{ fontSize: F.md, fontWeight: F.bold, color: C.ink, marginBottom: SP[2] }}>Suspendre ce compte ?</div>
            <p style={{ margin: `0 0 ${SP[5]}`, fontSize: F.sm, color: C.muted, lineHeight: F.lhRelaxed }}>
              Le compte de <strong style={{ color: C.ink }}>{confirmSuspend.name}</strong> sera suspendu immédiatement. Cette action est réversible depuis ce panneau.
            </p>
            <div style={{ display: 'flex', gap: SP[2.5] }}>
              <button
                className="btn-red"
                onClick={async () => { const t = confirmSuspend; setConfirmSuspend(null); await handleUserToggle(t.userId, false) }}
                style={{ flex: 1, height: 40, border: 'none', borderRadius: R.md, fontSize: F.sm, fontWeight: F.semibold, cursor: 'pointer', fontFamily: F.body, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SP[2] }}
              >
                Confirmer la suspension
              </button>
              <button
                onClick={() => setConfirmSuspend(null)}
                style={{ padding: `0 ${SP[4]}`, background: CANVAS, color: C.muted, border: `1px solid ${C.border}`, borderRadius: R.sm, fontSize: F.sm, fontWeight: F.medium, cursor: 'pointer', fontFamily: F.body }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ════════════════════════════════════════════════════════════════════════
        PASSWORD RESET
    ═══════════════════════════════════════════════════════════════════════ */}
    {resetTarget && (
      <div
        onClick={e => { if (e.target === e.currentTarget && !resetLoading) { setResetTarget(null); setResetError(null); setResetPwd('') } }}
        className="modal-overlay"
        style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,6,0.50)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: Z.modal + 10, padding: SP[5], backdropFilter: 'blur(4px)', fontFamily: F.body }}
      >
        <div className="modal-panel" style={{ background: C.surfaceEl, borderRadius: R.xl, width: '100%', maxWidth: 400, border: `1px solid ${C.border}`, boxShadow: SH.xl, overflow: 'hidden' }}>
          <div style={{ height: 3, background: `linear-gradient(90deg, ${C.amberActive}, ${C.amber}, ${C.amberDim})` }} />
          <div style={{ padding: `${SP[4]} ${SP[5]}`, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: SP[3] }}>
            <div style={{ width: 36, height: 36, borderRadius: R.lg, background: C.amberGlow, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconKey size={16} color={C.amber} />
            </div>
            <div>
              <div style={{ fontSize: F.md, fontWeight: F.bold, color: C.ink }}>Réinitialiser le mot de passe</div>
              <div style={{ fontSize: F.xs, color: C.muted, marginTop: 2 }}>{resetTarget.name} · {resetTarget.email}</div>
            </div>
          </div>
          <div style={{ padding: `${SP[5]} ${SP[5]}` }}>
            <p style={{ margin: `0 0 ${SP[4]}`, fontSize: F.sm, color: C.muted, lineHeight: F.lhRelaxed }}>
              Définissez un mot de passe temporaire et communiquez-le au client via un canal sécurisé.
            </p>
            <div style={{ marginBottom: SP[3.5] }}>
              <label style={labelSt}>
                Nouveau mot de passe *{' '}
                <span style={{ fontSize: F.xs, fontWeight: F.regular, color: C.muted, textTransform: 'none' }}>min. 8 car.</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={resetShowPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={resetPwd}
                  onChange={e => setResetPwd(e.target.value)}
                  disabled={resetLoading}
                  autoFocus
                  style={{ ...inputSt, paddingRight: SP[10] }}
                />
                <button
                  type="button"
                  onClick={() => setResetShowPwd(p => !p)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: C.muted, display: 'flex' }}
                >
                  {resetShowPwd ? <IconEyeOff size={14} color={C.muted} /> : <IconEye size={14} color={C.muted} />}
                </button>
              </div>
            </div>
            {resetError && (
              <div style={{ padding: `${SP[2.5]} ${SP[3.5]}`, borderRadius: R.md, marginBottom: SP[3.5], background: C.redBg, border: `1px solid ${C.redBd}`, fontSize: F.sm, color: C.red }}>
                {resetError}
              </div>
            )}
            <div style={{ display: 'flex', gap: SP[2.5] }}>
              <button
                className="btn-amber"
                onClick={handlePasswordReset}
                disabled={resetLoading || resetPwd.length < 8}
                style={{ flex: 1, height: 42, border: 'none', borderRadius: R.md, fontSize: F.sm, fontWeight: F.bold, cursor: resetLoading || resetPwd.length < 8 ? 'not-allowed' : 'pointer', fontFamily: F.body, opacity: resetPwd.length < 8 ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SP[2] }}
              >
                {resetLoading ? <><span className="spinner-dark" style={{ width: 13, height: 13 }} /> En cours…</> : 'Confirmer'}
              </button>
              <button
                onClick={() => { setResetTarget(null); setResetError(null); setResetPwd('') }}
                disabled={resetLoading}
                style={{ padding: `0 ${SP[4]}`, background: CANVAS, color: C.muted, border: `1px solid ${C.border}`, borderRadius: R.sm, fontSize: F.sm, fontWeight: F.medium, cursor: resetLoading ? 'not-allowed' : 'pointer', fontFamily: F.body }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ════════════════════════════════════════════════════════════════════════
        NEW COMPANY MODAL (stepper)
    ═══════════════════════════════════════════════════════════════════════ */}
    {showModal && (
      <div
        onClick={e => { if (e.target === e.currentTarget && !submitting) { setShowModal(false); setFormStep(1); setForm(emptyForm()); setFormError(null) } }}
        className="modal-overlay"
        style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,6,0.48)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: Z.modal, padding: SP[5], backdropFilter: 'blur(4px)', fontFamily: F.body }}
      >
        <div className="modal-panel" style={{ background: C.surfaceEl, borderRadius: R.xl, width: '100%', maxWidth: 520, border: `1px solid ${C.border}`, boxShadow: SH.xl, overflow: 'hidden' }}>
          <div style={{ height: 3, background: `linear-gradient(90deg, ${C.amberActive}, ${C.amber}, ${C.amberDim})`, flexShrink: 0 }} />

          {/* Modal header with stepper */}
          <div style={{ padding: `${SP[4]} ${SP[5]}`, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: F.md, fontWeight: F.bold, color: C.ink }}>Nouvelle entreprise</div>
              <div style={{ fontSize: F.xs, color: C.muted, marginTop: 2, fontFamily: F.mono }}>
                {formStep === 1 ? '① Informations entreprise' : '② Compte propriétaire'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: SP[2] }}>
              {([1, 2] as const).map(s => (
                <div key={s} style={{
                  height: 6, borderRadius: R.full,
                  width: s === formStep ? 24 : 8,
                  background: s <= formStep ? C.amber : C.border,
                  transition: TR.smooth,
                }} />
              ))}
              <button
                onClick={() => { if (!submitting) { setShowModal(false); setFormStep(1); setForm(emptyForm()); setFormError(null) } }}
                className="btn-icon"
                style={{ marginLeft: SP[2], width: 30, height: 30, borderRadius: R.sm, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
              >
                <IconClose size={12} color={C.muted} />
              </button>
            </div>
          </div>

          <form
            onSubmit={formStep === 1
              ? (e => { e.preventDefault(); setFormError(null); setFormStep(2) })
              : handleSubmit
            }
            style={{ padding: SP[5] }}
          >
            {formStep === 1 && (
              <>
                <div style={{ marginBottom: SP[4] }}>
                  <label style={labelSt}>Nom de l'entreprise *</label>
                  <input type="text" placeholder="ex : Société TechBuild" value={form.companyName} onChange={e => handleNameChange(e.target.value)} required disabled={submitting} style={inputSt} />
                </div>
                <div style={{ marginBottom: SP[4] }}>
                  <label style={labelSt}>Identifiant (slug) *</label>
                  <div style={{ position: 'relative' }}>
                    <input type="text" placeholder="techbuild" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} required disabled={submitting} style={{ ...inputSt, paddingLeft: 80 }} />
                    <span style={{ position: 'absolute', left: SP[3], top: '50%', transform: 'translateY(-50%)', fontSize: F.sm, color: C.muted, pointerEvents: 'none', fontFamily: F.mono }}>sgi.app/</span>
                  </div>
                </div>
                <div style={{ marginBottom: SP[6] }}>
                  <label style={labelSt}>Devise *</label>
                  <input type="text" placeholder="FCFA" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} required disabled={submitting} style={inputSt} maxLength={10} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn-amber" style={{ display: 'flex', alignItems: 'center', gap: SP[2], height: 40, padding: `0 ${SP[5]}`, border: 'none', borderRadius: R.md, fontSize: F.sm, fontWeight: F.bold, cursor: 'pointer', fontFamily: F.body }}>
                    Suivant <IconArrowRight size={13} color="#FAF5EE" />
                  </button>
                </div>
              </>
            )}
            {formStep === 2 && (
              <>
                <div style={{ marginBottom: SP[4] }}>
                  <label style={labelSt}>Nom complet *</label>
                  <input type="text" placeholder="ex : Alain Mbarga" value={form.ownerFullName} onChange={e => setForm(f => ({ ...f, ownerFullName: e.target.value }))} required disabled={submitting} style={inputSt} />
                </div>
                <div style={{ marginBottom: SP[4] }}>
                  <label style={labelSt}>Email *</label>
                  <input type="email" placeholder="ex : alain@techbuild.cm" value={form.ownerEmail} onChange={e => setForm(f => ({ ...f, ownerEmail: e.target.value }))} required disabled={submitting} style={inputSt} />
                </div>
                <div style={{ marginBottom: SP[6] }}>
                  <label style={labelSt}>
                    Mot de passe *{' '}
                    <span style={{ fontSize: F.xs, fontWeight: F.regular, color: C.muted, textTransform: 'none' }}>min. 8 car.</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPwd ? 'text' : 'password'} placeholder="••••••••" value={form.ownerPassword} onChange={e => setForm(f => ({ ...f, ownerPassword: e.target.value }))} required minLength={8} disabled={submitting} style={{ ...inputSt, paddingRight: SP[10] }} />
                    <button type="button" onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: C.muted, display: 'flex' }}>
                      {showPwd ? <IconEyeOff size={14} color={C.muted} /> : <IconEye size={14} color={C.muted} />}
                    </button>
                  </div>
                </div>
                {formError && (
                  <div style={{ padding: `${SP[2.5]} ${SP[3.5]}`, borderRadius: R.md, marginBottom: SP[4], background: C.redBg, border: `1px solid ${C.redBd}`, fontSize: F.sm, color: C.red }}>
                    {formError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: SP[2.5] }}>
                  <button type="button" onClick={() => { setFormStep(1); setFormError(null) }} disabled={submitting} style={{ padding: `0 ${SP[4]}`, height: 42, background: CANVAS, color: C.muted, border: `1px solid ${C.border}`, borderRadius: R.sm, fontSize: F.sm, fontWeight: F.medium, cursor: 'pointer', fontFamily: F.body }}>
                    Retour
                  </button>
                  <button type="submit" className="btn-amber" disabled={submitting} style={{ flex: 1, height: 42, border: 'none', borderRadius: R.md, fontSize: F.sm, fontWeight: F.bold, cursor: submitting ? 'wait' : 'pointer', fontFamily: F.body, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SP[2] }}>
                    {submitting ? <><span className="spinner-dark" style={{ width: 13, height: 13 }} /> Création en cours…</> : 'Créer l\'entreprise'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    )}
    {/* ════════════════════════════════════════════════════════════════════════
        LOGOUT CONFIRMATION
    ═══════════════════════════════════════════════════════════════════════ */}
    {confirmLogout && (
      <div
        onClick={e => { if (e.target === e.currentTarget && !loggingOut) setConfirmLogout(false) }}
        className="modal-overlay"
        style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,6,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: Z.modal + 30, padding: SP[5], backdropFilter: 'blur(4px)', fontFamily: F.body }}
      >
        <div className="modal-panel" style={{ background: C.surfaceEl, borderRadius: R.xl, width: '100%', maxWidth: 360, border: `1px solid ${C.border}`, boxShadow: SH.xl, overflow: 'hidden' }}>
          <div style={{ height: 3, background: `linear-gradient(90deg, ${C.amberActive}, ${C.amber}, ${C.amberDim})` }} />
          <div style={{ padding: `${SP[5]} ${SP[6]}` }}>
            <div style={{ width: 44, height: 44, borderRadius: R.lg, background: C.surfaceSub, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: SP[4] }}>
              <IconLogOut size={18} color={C.muted} />
            </div>
            <div style={{ fontSize: F.md, fontWeight: F.bold, color: C.ink, marginBottom: SP[2] }}>Déconnexion</div>
            <p style={{ margin: `0 0 ${SP[5]}`, fontSize: F.sm, color: C.muted, lineHeight: F.lhRelaxed }}>
              Vous allez être déconnecté de la console d'administration. Cette action mettra fin à votre session en cours.
            </p>
            <div style={{ display: 'flex', gap: SP[2.5] }}>
              <button
                onClick={async () => {
                  setLoggingOut(true)
                  const { createClient } = await import('@/lib/supabase/client')
                  await createClient().auth.signOut()
                  router.push('/login')
                }}
                disabled={loggingOut}
                className="btn-red"
                style={{ flex: 1, height: 40, border: 'none', borderRadius: R.md, fontSize: F.sm, fontWeight: F.semibold, cursor: loggingOut ? 'wait' : 'pointer', fontFamily: F.body, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: SP[2] }}
              >
                {loggingOut ? <><span className="spinner-dark" style={{ width: 13, height: 13 }} /> Déconnexion…</> : 'Se déconnecter'}
              </button>
              <button
                onClick={() => setConfirmLogout(false)}
                disabled={loggingOut}
                style={{ padding: `0 ${SP[4]}`, background: CANVAS, color: C.muted, border: `1px solid ${C.border}`, borderRadius: R.sm, fontSize: F.sm, fontWeight: F.medium, cursor: loggingOut ? 'not-allowed' : 'pointer', fontFamily: F.body }}
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

// ═════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═════════════════════════════════════════════════════════════════════════════

function EmptyState({ Icon, title, body, action }: {
  Icon:    React.ComponentType<IconProps>
  title:   string
  body:    string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div style={{ padding: `${SP[14]} ${SP[6]}`, textAlign: 'center' }}>
      <div style={{
        width: 48, height: 48, borderRadius: R.xl,
        background: C.surfaceSub, border: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: `0 auto ${SP[3.5]}`,
      }}>
        <Icon size={20} color={C.dim} />
      </div>
      <div style={{ fontSize: F.md, fontWeight: F.semibold, color: C.ink, marginBottom: SP[1.5] }}>{title}</div>
      <div style={{ fontSize: F.sm, color: C.muted, maxWidth: 300, margin: '0 auto', lineHeight: F.lhRelaxed }}>{body}</div>
      {action && (
        <button
          onClick={action.onClick}
          style={{ marginTop: SP[4], padding: `${SP[2]} ${SP[4]}`, background: C.amberGlow, border: '1px solid rgba(160,83,26,0.28)', borderRadius: R.md, color: C.amber, fontSize: F.sm, fontWeight: F.semibold, cursor: 'pointer', fontFamily: F.body }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

function UserRow({ user, menuOpen, isToggling, onMenuToggle, onReset, onSuspend, onReactivate }: {
  user:         CompanyUser
  menuOpen:     boolean
  isToggling:   boolean
  onMenuToggle: (e: React.MouseEvent) => void
  onReset:      () => void
  onSuspend:    () => void
  onReactivate: () => void
}) {
  const rm = ROLE_META[user.role] ?? ROLE_META.vendor
  return (
    <div style={{ padding: `${SP[3]} ${SP[3.5]}`, borderRadius: R.lg, border: `1px solid ${C.border}`, background: C.surface }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: SP[2.5] }}>
        <UserAvatar name={user.full_name} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: F.sm, fontWeight: F.semibold, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.full_name}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{user.email}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: SP[1.5], flexShrink: 0 }}>
          <Bdg color={rm.color} bg={rm.bg}>{rm.label}</Bdg>
          <Bdg color={user.is_active ? C.green : C.red} bg={user.is_active ? C.greenBg : C.redBg}>
            {user.is_active ? 'Actif' : 'Inactif'}
          </Bdg>
          {/* Context menu trigger */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={onMenuToggle}
              style={{
                width: 28, height: 28, borderRadius: R.sm,
                background: menuOpen ? C.surfaceSub : 'transparent',
                border: `1px solid ${menuOpen ? C.border : 'transparent'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: TR.fast,
              }}
            >
              <IconDots size={13} color={C.muted} />
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 34,
                background: C.surfaceEl, border: `1px solid ${C.border}`,
                borderRadius: R.lg, boxShadow: SH.lg,
                minWidth: 190, overflow: 'hidden',
                zIndex: Z.dropdown,
              }}>
                <button
                  onClick={e => { e.stopPropagation(); onReset() }}
                  style={{ display: 'flex', alignItems: 'center', gap: SP[2.5], width: '100%', padding: `${SP[2.5]} ${SP[3.5]}`, background: 'none', border: 'none', cursor: 'pointer', fontSize: F.sm, color: C.ink, fontFamily: F.body, textAlign: 'left' }}
                >
                  <IconKey size={13} color={C.amber} /> Réinitialiser MDP
                </button>
                <div style={{ height: 1, background: C.borderSub, margin: `0 ${SP[2.5]}` }} />
                {user.is_active ? (
                  <button
                    onClick={e => { e.stopPropagation(); onSuspend() }}
                    disabled={isToggling}
                    style={{ display: 'flex', alignItems: 'center', gap: SP[2.5], width: '100%', padding: `${SP[2.5]} ${SP[3.5]}`, background: 'none', border: 'none', cursor: isToggling ? 'wait' : 'pointer', fontSize: F.sm, color: C.red, fontFamily: F.body, textAlign: 'left', opacity: isToggling ? 0.5 : 1 }}
                  >
                    {isToggling ? <span className="spinner-amber" style={{ width: 12, height: 12, borderColor: `${C.red}30`, borderTopColor: C.red }} /> : <IconUserOff size={13} color={C.red} />}
                    Suspendre
                  </button>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); onReactivate() }}
                    disabled={isToggling}
                    style={{ display: 'flex', alignItems: 'center', gap: SP[2.5], width: '100%', padding: `${SP[2.5]} ${SP[3.5]}`, background: 'none', border: 'none', cursor: isToggling ? 'wait' : 'pointer', fontSize: F.sm, color: C.green, fontFamily: F.body, textAlign: 'left', opacity: isToggling ? 0.5 : 1 }}
                  >
                    {isToggling ? <span className="spinner-amber" style={{ width: 12, height: 12, borderColor: `${C.green}30`, borderTopColor: C.green }} /> : <IconUserCheck size={13} color={C.green} />}
                    Réactiver
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CmdPalette({ query, onQueryChange, companies, onClose, onAction }: {
  query:         string
  onQueryChange: (q: string) => void
  companies:     Company[]
  onClose:       () => void
  onAction:      (a: string) => void
}) {
  const inputRef  = useRef<HTMLInputElement>(null)
  const listRef   = useRef<HTMLDivElement>(null)
  const [selIdx, setSelIdx] = useState(-1)

  useEffect(() => { inputRef.current?.focus() }, [])

  const ACTIONS = [
    { id: 'create',    label: 'Nouvelle entreprise', sub: 'Créer un compte client',       Icon: IconPlus     },
    { id: 'companies', label: 'Entreprises',          sub: 'Voir toutes les entreprises',  Icon: IconBuilding },
    { id: 'journal',   label: 'Journal',              sub: 'Historique des actions',       Icon: IconHistory  },
    { id: 'overview',  label: "Vue d'ensemble",        sub: 'Tableau de bord principal',    Icon: IconGrid     },
  ]

  const q           = query.toLowerCase()
  const matchedCos  = q ? companies.filter(c =>
    c.name.toLowerCase().includes(q) || c.slug.includes(q) || (c.owner?.email ?? '').toLowerCase().includes(q)
  ).slice(0, 5) : []
  const matchedActs = q ? ACTIONS.filter(a => a.label.toLowerCase().includes(q) || a.sub.toLowerCase().includes(q)) : ACTIONS

  // flat ordered list of action IDs for keyboard nav
  const allIds: string[] = [
    ...matchedCos.map(c => `co:${c.id}`),
    ...matchedActs.map(a => a.id),
  ]
  const total = allIds.length

  // reset selection when query changes
  useEffect(() => { setSelIdx(-1) }, [query])

  // scroll selected item into view
  useEffect(() => {
    if (selIdx < 0 || !listRef.current) return
    const el = listRef.current.querySelector(`[data-cmd-idx="${selIdx}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [selIdx])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelIdx(i => (i + 1) % total)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelIdx(i => i <= 0 ? total - 1 : i - 1)
    } else if (e.key === 'Enter' && selIdx >= 0 && selIdx < total) {
      e.preventDefault()
      onAction(allIds[selIdx])
    }
  }

  function itemStyle(id: string): React.CSSProperties {
    const myIdx = allIds.indexOf(id)
    const active = selIdx === myIdx
    return {
      display: 'flex', alignItems: 'center', gap: SP[3],
      width: '100%', padding: `${SP[2.5]} ${SP[4]}`,
      background: active ? C.surfaceHov : 'none',
      border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: F.body,
      transition: 'background 0.08s ease',
      outline: active ? `2px solid ${C.amber}` : 'none',
      outlineOffset: '-2px',
    }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className="modal-overlay"
      style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,6,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '14vh', zIndex: Z.modal + 20, backdropFilter: 'blur(4px)', fontFamily: F.body }}
    >
      <div style={{
        background: C.surfaceEl, borderRadius: R.xl,
        width: '100%', maxWidth: 520,
        border: `1px solid ${C.border}`,
        boxShadow: `0 24px 72px rgba(26,15,6,0.24)`,
        overflow: 'hidden',
      }}>
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: SP[3], padding: `${SP[3.5]} ${SP[4]}`, borderBottom: `1px solid ${C.borderSub}` }}>
          <IconSearch size={16} color={C.muted} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { onQueryChange(e.target.value) }}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher une action, une entreprise…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: F.base, fontFamily: F.body, color: C.ink, background: 'transparent' }}
          />
          <kbd style={{ fontSize: 10, color: C.dim, background: C.surfaceSub, border: `1px solid ${C.border}`, borderRadius: R.xs, padding: '1px 6px', fontFamily: F.mono }}>
            ESC
          </kbd>
        </div>

        <div ref={listRef} style={{ maxHeight: 400, overflowY: 'auto', paddingBottom: SP[1.5] }}>
          {/* Company results */}
          {matchedCos.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: F.bold, color: C.dim, letterSpacing: F.lsWider, textTransform: 'uppercase', padding: `${SP[2.5]} ${SP[4]} ${SP[1]}` }}>
                Entreprises
              </div>
              {matchedCos.map(c => {
                const idx = allIds.indexOf(`co:${c.id}`)
                return (
                  <button
                    key={c.id}
                    data-cmd-idx={idx}
                    onClick={() => onAction(`co:${c.id}`)}
                    onMouseEnter={() => setSelIdx(idx)}
                    style={itemStyle(`co:${c.id}`)}
                  >
                    <CompanyAvatar name={c.name} size={26} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: F.sm, fontWeight: F.medium, color: C.ink }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: C.muted, fontFamily: F.mono }}>{c.slug}</div>
                    </div>
                    <Bdg color={c.is_active ? C.green : C.red} bg={c.is_active ? C.greenBg : C.redBg}>
                      {c.is_active ? 'Actif' : 'Suspendu'}
                    </Bdg>
                  </button>
                )
              })}
            </>
          )}

          {/* Action results */}
          {matchedActs.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: F.bold, color: C.dim, letterSpacing: F.lsWider, textTransform: 'uppercase', padding: `${SP[2.5]} ${SP[4]} ${SP[1]}` }}>
                Actions
              </div>
              {matchedActs.map(({ id, label, sub, Icon }) => {
                const idx = allIds.indexOf(id)
                return (
                  <button
                    key={id}
                    data-cmd-idx={idx}
                    onClick={() => onAction(id)}
                    onMouseEnter={() => setSelIdx(idx)}
                    style={itemStyle(id)}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: R.md, background: C.surfaceSub, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={14} color={C.muted} />
                    </div>
                    <div>
                      <div style={{ fontSize: F.sm, fontWeight: F.medium, color: C.ink }}>{label}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{sub}</div>
                    </div>
                    {idx === selIdx && (
                      <kbd style={{ marginLeft: 'auto', fontSize: 10, color: C.dim, background: C.surfaceSub, border: `1px solid ${C.border}`, borderRadius: R.xs, padding: '1px 6px', fontFamily: F.mono, flexShrink: 0 }}>↵</kbd>
                    )}
                  </button>
                )
              })}
            </>
          )}

          {matchedCos.length === 0 && matchedActs.length === 0 && (
            <div style={{ padding: `${SP[7]} ${SP[6]}`, textAlign: 'center', color: C.muted, fontSize: F.sm }}>
              Aucun résultat pour «{query}»
            </div>
          )}
        </div>

        {/* Footer hint */}
        {total > 0 && (
          <div style={{ padding: `${SP[2]} ${SP[4]}`, borderTop: `1px solid ${C.borderSub}`, display: 'flex', gap: SP[3], alignItems: 'center' }}>
            {[['↑↓', 'Naviguer'], ['↵', 'Sélectionner'], ['ESC', 'Fermer']].map(([key, desc]) => (
              <span key={key} style={{ display: 'flex', alignItems: 'center', gap: SP[1.5], fontSize: 10, color: C.dim }}>
                <kbd style={{ background: C.surfaceSub, border: `1px solid ${C.border}`, borderRadius: R.xs, padding: '1px 5px', fontFamily: F.mono, fontSize: 10 }}>{key}</kbd>
                {desc}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
