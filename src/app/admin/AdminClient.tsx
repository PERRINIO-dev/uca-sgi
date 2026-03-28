'use client'

import { useState, useTransition } from 'react'
import { useRouter }               from 'next/navigation'
import PageLayout                  from '@/components/PageLayout'
import { createCompanyWithOwner, toggleCompanyActive } from './actions'
import type { BadgeCounts }        from '@/lib/supabase/badge-counts'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', surface: '#FFFFFF',
  navy: '#1B3A6B', navyDark: '#0C1A35', blue: '#2563EB', blueL: '#EFF6FF',
  green: '#059669', greenL: '#ECFDF5',
  orange: '#D97706', orangeL: '#FFFBEB',
  red: '#DC2626', redL: '#FEF2F2',
  amber: '#B45309', amberL: '#FFFBEB', amberM: '#FDE68A',
}
const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif"

// ── Helpers ───────────────────────────────────────────────────────────────────
function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')     // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')        // keep alphanumeric, spaces, hyphens
    .trim()
    .replace(/\s+/g, '-')               // spaces → hyphens
    .replace(/-+/g, '-')                // collapse multiple hyphens
    .replace(/^-+|-+$/g, '')            // trim edge hyphens
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function CompanyInitials({ name, size = 40 }: { name: string; size?: number }) {
  const parts   = name.trim().split(/\s+/)
  const letters = parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()

  // Deterministic color from name
  const hue   = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  const bg    = `hsl(${hue}, 55%, 18%)`
  const color = `hsl(${hue}, 70%, 72%)`

  return (
    <div style={{
      width: size, height: size, borderRadius: 10,
      background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      fontSize: size * 0.38, fontWeight: 700, color,
      letterSpacing: '-0.02em',
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
      fontSize: 11, fontWeight: 600,
      background: bg, color,
    }}>
      {children}
    </span>
  )
}

// ── SVG icons ─────────────────────────────────────────────────────────────────
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

// ── Types ─────────────────────────────────────────────────────────────────────
interface Company {
  id:             string
  name:           string
  slug:           string
  is_active:      boolean
  created_at:     string
  totalUsers:     number
  activeUsers:    number
  activeProducts: number
}

interface Profile {
  id:               string
  full_name:        string
  role:             string
  is_platform_admin: boolean
}

// ── Empty form factory ────────────────────────────────────────────────────────
const emptyForm = () => ({
  companyName:   '',
  slug:          '',
  ownerFullName: '',
  ownerEmail:    '',
  ownerPassword: '',
})

// ═════════════════════════════════════════════════════════════════════════════
export default function AdminClient({
  profile,
  companies,
  badgeCounts,
}: {
  profile:    Profile
  companies:  Company[]
  badgeCounts?: BadgeCounts
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [showModal,   setShowModal]   = useState(false)
  const [form,        setForm]        = useState(emptyForm)
  const [showPwd,     setShowPwd]     = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [formError,   setFormError]   = useState<string | null>(null)
  const [successMsg,  setSuccessMsg]  = useState<string | null>(null)
  const [toggling,    setToggling]    = useState<string | null>(null)

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalCompanies    = companies.length
  const activeCompanies   = companies.filter(c => c.is_active).length
  const totalUsers        = companies.reduce((s, c) => s + c.totalUsers,    0)
  const totalProducts     = companies.reduce((s, c) => s + c.activeProducts, 0)

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleNameChange(name: string) {
    setForm(f => ({
      ...f,
      companyName: name,
      // Auto-generate slug only if user hasn't edited it manually
      slug: f.slug === slugify(f.companyName) || f.slug === '' ? slugify(name) : f.slug,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)

    const result = await createCompanyWithOwner(form)
    setSubmitting(false)

    if (result.error) {
      setFormError(result.error)
      return
    }

    setSuccessMsg(`Entreprise "${result.companyName}" créée avec succès.`)
    setShowModal(false)
    setForm(emptyForm())
    startTransition(() => router.refresh())
  }

  async function handleToggle(companyId: string, isActive: boolean) {
    setToggling(companyId)
    const result = await toggleCompanyActive(companyId, isActive)
    setToggling(null)
    if (result.error) {
      setFormError(result.error)
    } else {
      startTransition(() => router.refresh())
    }
  }

  // ── Shared input style ────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px',
    border: `1.5px solid ${C.border}`,
    borderRadius: 8, fontSize: 13,
    fontFamily: FONT, color: C.ink,
    background: C.surface, outline: 'none',
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600,
    color: C.slate, letterSpacing: '0.05em',
    textTransform: 'uppercase', marginBottom: 5,
  }

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
      <div style={{ maxWidth: 1100, margin: '0 auto', fontFamily: FONT }}>

        {/* ── Platform admin banner ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', borderRadius: 10, marginBottom: 28,
          background: C.amberL,
          border: `1px solid ${C.amberM}`,
        }}>
          <IconShield size={16} color={C.amber} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: C.amber }}>
            Administration Plateforme — vue transversale, toutes entreprises
          </span>
        </div>

        {/* ── Page header ── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: 16,
          marginBottom: 28, flexWrap: 'wrap',
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em' }}>
              Entreprises clientes
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: C.slate }}>
              Créez et gérez les entreprises qui utilisent la plateforme SGI.
            </p>
          </div>
          <button
            onClick={() => { setShowModal(true); setFormError(null) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 18px',
              background: C.amber, color: '#fff',
              border: 'none', borderRadius: 9,
              fontSize: 13, fontWeight: 700,
              cursor: 'pointer', flexShrink: 0,
              fontFamily: FONT,
            }}
          >
            <IconPlus size={14} color="#fff" />
            Nouvelle entreprise
          </button>
        </div>

        {/* ── Success toast ── */}
        {successMsg && (
          <div style={{
            padding: '12px 16px', borderRadius: 9, marginBottom: 20,
            background: C.greenL, border: `1px solid #BBF7D0`,
            fontSize: 13, fontWeight: 500, color: C.green,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.green, fontSize: 16, lineHeight: 1, padding: 0,
            }}>×</button>
          </div>
        )}

        {/* ── KPI cards ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16, marginBottom: 32,
        }}>
          {[
            {
              label: 'Entreprises actives',
              value: `${activeCompanies} / ${totalCompanies}`,
              Icon:  IconBuilding,
              bg:    C.amberL, iconColor: C.amber,
            },
            {
              label: 'Utilisateurs totaux',
              value: String(totalUsers),
              Icon:  IconUsers,
              bg:    C.blueL, iconColor: C.blue,
            },
            {
              label: 'Produits actifs',
              value: String(totalProducts),
              Icon:  IconBox,
              bg:    C.greenL, iconColor: C.green,
            },
          ].map(({ label, value, Icon, bg, iconColor }) => (
            <div key={label} style={{
              background: C.surface, borderRadius: 12, padding: '18px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              border: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 9,
                background: bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={17} color={iconColor} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.ink, letterSpacing: '-0.02em' }}>
                  {value}
                </div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Companies table ── */}
        <div style={{
          background: C.surface, borderRadius: 12,
          border: `1px solid ${C.border}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 20px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <IconBuilding size={14} color={C.muted} />
            <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>
              {companies.length} entreprise{companies.length !== 1 ? 's' : ''}
            </span>
          </div>

          {companies.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
              Aucune entreprise enregistrée.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: C.bg }}>
                    {['Entreprise', 'Utilisateurs', 'Produits', 'Créée le', 'Statut', ''].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px', textAlign: 'left',
                        fontSize: 11, fontWeight: 600, color: C.muted,
                        letterSpacing: '0.05em', textTransform: 'uppercase',
                        borderBottom: `1px solid ${C.border}`,
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company, i) => (
                    <tr
                      key={company.id}
                      style={{
                        borderBottom: i < companies.length - 1 ? `1px solid ${C.border}` : 'none',
                      }}
                    >
                      {/* Company */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <CompanyInitials name={company.name} size={38} />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>
                              {company.name}
                            </div>
                            <div style={{
                              fontSize: 11, color: C.muted, marginTop: 2,
                              fontFamily: 'monospace',
                              background: C.bg, padding: '1px 6px',
                              borderRadius: 4, display: 'inline-block',
                            }}>
                              {company.slug}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Users */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>
                          {company.activeUsers}
                          <span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}>
                            {' '}/ {company.totalUsers}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: C.muted }}>actifs / total</div>
                      </td>

                      {/* Products */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>
                          {company.activeProducts}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted }}>actifs</div>
                      </td>

                      {/* Created */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', fontSize: 13, color: C.slate }}>
                        {fmtDate(company.created_at)}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <Badge
                          color={company.is_active ? C.green  : C.red}
                          bg={   company.is_active ? C.greenL : C.redL}
                        >
                          {company.is_active ? 'Actif' : 'Suspendu'}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        {/* Don't allow suspending UCA (founding company) */}
                        {company.id !== '00000000-0000-0000-0000-000000000001' && (
                          <button
                            onClick={() => handleToggle(company.id, !company.is_active)}
                            disabled={toggling === company.id}
                            style={{
                              padding: '6px 12px',
                              border: `1px solid ${company.is_active ? C.border : C.orange}`,
                              borderRadius: 7,
                              background: company.is_active ? C.surface : C.orangeL,
                              color: company.is_active ? C.slate : C.orange,
                              fontSize: 12, fontWeight: 500,
                              cursor: toggling === company.id ? 'wait' : 'pointer',
                              fontFamily: FONT,
                              opacity: toggling === company.id ? 0.6 : 1,
                            }}
                          >
                            {toggling === company.id
                              ? '...'
                              : company.is_active ? 'Suspendre' : 'Réactiver'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </PageLayout>

    {/* ═══════════════════════════════════════════════════════════════════════
        New Company Modal
    ════════════════════════════════════════════════════════════════════════ */}
    {showModal && (
      <div
        onClick={e => { if (e.target === e.currentTarget && !submitting) setShowModal(false) }}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15,23,42,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20,
          backdropFilter: 'blur(3px)',
          fontFamily: FONT,
        }}
      >
        <div style={{
          background: C.surface, borderRadius: 16,
          width: '100%', maxWidth: 520,
          boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
          maxHeight: '90vh', overflowY: 'auto',
        }}>

          {/* Modal header */}
          <div style={{
            padding: '18px 22px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                background: C.amberL,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconBuilding size={16} color={C.amber} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>
                  Nouvelle entreprise
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>
                  Crée l'entreprise et son compte propriétaire.
                </div>
              </div>
            </div>
            <button
              onClick={() => !submitting && setShowModal(false)}
              style={{
                background: C.bg, border: `1px solid ${C.border}`,
                borderRadius: 7, width: 30, height: 30,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 16, color: C.muted,
              }}
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '22px' }}>

            {/* ── Section 1: Company info ── */}
            <div style={{
              fontSize: 11, fontWeight: 700, color: C.amber,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <IconBuilding size={12} color={C.amber} />
              Informations de l'entreprise
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Nom de l'entreprise *</label>
              <input
                type="text"
                placeholder="ex : Société TechBuild"
                value={form.companyName}
                onChange={e => handleNameChange(e.target.value)}
                required
                disabled={submitting}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>
                Identifiant unique (slug) *
                <span style={{ fontSize: 10, fontWeight: 400, color: C.muted, marginLeft: 6, textTransform: 'none' }}>
                  — lettres minuscules, chiffres, tirets
                </span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="ex : techbuild"
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                  required
                  disabled={submitting}
                  style={{ ...inputStyle, paddingLeft: 80 }}
                />
                <span style={{
                  position: 'absolute', left: 12, top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 12, color: C.muted, pointerEvents: 'none',
                  fontFamily: 'monospace',
                }}>
                  sgi.app/
                </span>
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: `1px solid ${C.border}`, marginBottom: 18 }} />

            {/* ── Section 2: Owner account ── */}
            <div style={{
              fontSize: 11, fontWeight: 700, color: C.blue,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <IconUsers size={12} color={C.blue} />
              Compte propriétaire
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Nom complet *</label>
              <input
                type="text"
                placeholder="ex : Alain Mbarga"
                value={form.ownerFullName}
                onChange={e => setForm(f => ({ ...f, ownerFullName: e.target.value }))}
                required
                disabled={submitting}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Email *</label>
              <input
                type="email"
                placeholder="ex : alain@techbuild.cm"
                value={form.ownerEmail}
                onChange={e => setForm(f => ({ ...f, ownerEmail: e.target.value }))}
                required
                disabled={submitting}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Mot de passe *
                <span style={{ fontSize: 10, fontWeight: 400, color: C.muted, marginLeft: 6, textTransform: 'none' }}>
                  — min. 8 caractères
                </span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.ownerPassword}
                  onChange={e => setForm(f => ({ ...f, ownerPassword: e.target.value }))}
                  required
                  minLength={8}
                  disabled={submitting}
                  style={{ ...inputStyle, paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(p => !p)}
                  style={{
                    position: 'absolute', right: 10, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    cursor: 'pointer', padding: 4,
                    color: C.muted, display: 'flex',
                  }}
                >
                  {showPwd
                    ? <IconEyeOff size={15} color={C.muted} />
                    : <IconEye    size={15} color={C.muted} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {formError && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 16,
                background: C.redL, border: `1px solid #FECACA`,
                fontSize: 13, color: C.red,
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
                {formError}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  flex: 1, padding: '11px',
                  background: submitting ? C.muted : C.amber,
                  color: '#fff', border: 'none',
                  borderRadius: 9, fontSize: 13.5, fontWeight: 700,
                  cursor: submitting ? 'wait' : 'pointer',
                  fontFamily: FONT,
                  transition: 'background 0.15s',
                }}
              >
                {submitting ? 'Création en cours…' : 'Créer l\'entreprise'}
              </button>
              <button
                type="button"
                onClick={() => !submitting && setShowModal(false)}
                disabled={submitting}
                style={{
                  padding: '11px 18px',
                  background: C.bg, color: C.slate,
                  border: `1px solid ${C.border}`,
                  borderRadius: 9, fontSize: 13, fontWeight: 500,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: FONT,
                }}
              >
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
