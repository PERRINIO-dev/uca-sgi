'use client'

import React, { useState, useMemo, useEffect, useTransition, useCallback } from 'react'
import { useRouter }    from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageLayout       from '@/components/PageLayout'
import { cancelSale, addPayment } from './actions'
import type { BadgeCounts } from '@/lib/supabase/badge-counts'
import { fmtCurrency }       from '@/lib/format'

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtNum = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(n)
const fmtM2 = (n: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' m²'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', surface: '#FFFFFF',
  navy: '#1B3A6B', blue: '#2563EB', blueL: '#EFF6FF',
  green: '#059669', greenL: '#ECFDF5',
  orange: '#D97706', orangeL: '#FFFBEB',
  red: '#DC2626', redL: '#FEF2F2',
}
const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif"

const PAYMENT_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  paid:    { label: 'Payé',    bg: '#ECFDF5', color: '#059669' },
  partial: { label: 'Acompte', bg: '#FFFBEB', color: '#D97706' },
  unpaid:  { label: 'Impayé',  bg: '#FEF2F2', color: '#DC2626' },
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  draft:     { label: 'Brouillon',      bg: C.bg,      color: C.muted,   dot: C.muted },
  confirmed: { label: 'Confirmée',      bg: C.blueL,   color: C.blue,    dot: C.blue },
  preparing: { label: 'En préparation', bg: C.orangeL, color: C.orange,  dot: C.orange },
  ready:     { label: 'Prête',          bg: C.greenL,  color: C.green,   dot: C.green },
  delivered: { label: 'Livrée',         bg: '#F0F0F0', color: C.muted,   dot: C.muted },
  cancelled: { label: 'Annulée',        bg: C.redL,    color: C.red,     dot: C.red },
}

const TH_STYLE: React.CSSProperties = {
  padding: '11px 14px', textAlign: 'left',
  fontSize: 11, fontWeight: 600, color: C.muted,
  textTransform: 'uppercase', letterSpacing: '0.07em',
  borderBottom: `1.5px solid ${C.border}`,
  whiteSpace: 'nowrap', fontFamily: FONT,
}
const TD_STYLE: React.CSSProperties = {
  padding: '13px 14px', fontSize: 13, color: C.ink,
  borderBottom: `1px solid ${C.border}`,
  verticalAlign: 'middle', fontFamily: FONT,
}

function IconChevronDown({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M2 4l4 4 4-4" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconChevronUp({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M2 8l4-4 4 4" stroke={C.blue} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconCart({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="20" fill={C.bg}/>
      <path d="M11 13h2.5l3.5 10h9l2-6H16" stroke={C.muted} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="17" cy="26.5" r="1.5" fill={C.muted}/>
      <circle cx="24" cy="26.5" r="1.5" fill={C.muted}/>
    </svg>
  )
}
function IconSearch({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke={C.muted} strokeWidth="1.4"/>
      <path d="M10 10l2.5 2.5" stroke={C.muted} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}
function IconFilter({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none">
      <path d="M1.5 3h10M3 6.5h7M5 10h3" stroke={C.slate} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}
function IconX({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 11 11" fill="none">
      <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke={C.slate} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SalesListClient({
  profile,
  currency,
  sales,
  badgeCounts,
  errorCode,
  hasBoutiques = true,
  ownerName = 'Le Propriétaire',
  currentPage = 1,
  totalPages = 1,
  totalCount = 0,
}: {
  profile:       any
  currency:      string
  sales:         any[]
  badgeCounts?:  BadgeCounts
  errorCode?:    string
  hasBoutiques?: boolean
  ownerName?:    string
  currentPage?:  number
  totalPages?:   number
  totalCount?:   number
}) {
  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const fmt = (n: number) => fmtCurrency(n, currency)
  const [navPending,       startNavTransition]       = useTransition()
  const [firstSalePending, startFirstSaleTransition] = useTransition()

  // ── Prefetch new-sale page so the click feels instant ─────────────────────
  useEffect(() => { router.prefetch('/sales/new') }, [router])

  // ── Real-time: refresh when sales change ──────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('sales-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [noBoutiqueWarning, setNoBoutiqueWarning] = useState(false)

  const [expanded,    setExpanded]   = useState<string | null>(null)
  const [cancelId,    setCancelId]   = useState<string | null>(null)
  const [cancelNum,   setCancelNum]  = useState('')
  const [cancelling,  setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  // ── Filters ──
  const [search,         setSearch]          = useState('')
  const [statusFilter,   setStatusFilter]    = useState('')
  const [paymentFilter,  setPaymentFilter]   = useState('')
  const [dateFrom,       setDateFrom]        = useState('')
  const [dateTo,         setDateTo]          = useState('')
  const [boutiqueFilter, setBoutiqueFilter]  = useState('')

  // Unique boutiques from loaded data
  const boutiques = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of sales) {
      const name = s.boutiques?.name
      if (name) map.set(name, name)
    }
    return Array.from(map.keys()).sort()
  }, [sales])

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase()
    const from = dateFrom ? new Date(dateFrom) : null
    const to   = dateTo   ? new Date(dateTo + 'T23:59:59') : null
    return sales.filter(s => {
      if (q && !s.sale_number?.toLowerCase().includes(q) && !s.customer_name?.toLowerCase().includes(q) && !s.customer_phone?.toLowerCase().includes(q)) return false
      if (statusFilter && s.status !== statusFilter) return false
      if (paymentFilter && s.payment_status !== paymentFilter) return false
      if (from && new Date(s.created_at) < from) return false
      if (to   && new Date(s.created_at) > to)   return false
      if (boutiqueFilter && s.boutiques?.name !== boutiqueFilter) return false
      return true
    })
  }, [sales, search, statusFilter, paymentFilter, dateFrom, dateTo, boutiqueFilter])

  const hasFilters = search || statusFilter || paymentFilter || dateFrom || dateTo || boutiqueFilter
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setPaymentFilter(''); setDateFrom(''); setDateTo(''); setBoutiqueFilter('') }

  // ── Server-side page navigation ───────────────────────────────────────────
  const goToPage = (p: number) => {
    startNavTransition(() => router.push(`/sales?page=${p}`))
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleCancelConfirm = async () => {
    if (!cancelId) return
    setCancelling(true)
    setCancelError(null)
    const result = await cancelSale(cancelId)
    setCancelling(false)
    if (result.error) { setCancelError(result.error); return }
    setCancelId(null)
    setCancelNum('')
  }

  return (
    <PageLayout profile={profile} activeRoute="/sales" onLogout={handleLogout} badgeCounts={badgeCounts}>

      {/* ── No-boutique error banner ── */}
      {(errorCode === 'no_boutique' || noBoutiqueWarning) && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '14px 18px', marginBottom: 20,
          background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 10,
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M9 1.5L16.5 15H1.5L9 1.5Z" stroke="#D97706" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M9 7v4" stroke="#D97706" strokeWidth="1.6" strokeLinecap="round"/>
            <circle cx="9" cy="13" r="0.9" fill="#D97706"/>
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 3, fontFamily: FONT }}>
              Aucune boutique disponible
            </div>
            <div style={{ fontSize: 13, color: '#92400E', lineHeight: 1.5, fontFamily: FONT }}>
              Vous devez créer au moins une boutique avant de pouvoir enregistrer une vente.
              Rendez-vous dans la section <strong>Utilisateurs</strong> pour ajouter une boutique.
            </div>
          </div>
        </div>
      )}

      {/* ── Page header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 24,
        flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.ink, margin: '0 0 4px', letterSpacing: '-0.02em', fontFamily: FONT }}>
            Ventes
          </h1>
          <p style={{ fontSize: 13, color: C.slate, margin: 0, fontFamily: FONT }}>
            {sales.length === 0
              ? 'Aucune vente enregistrée'
              : hasFilters
              ? `${filteredSales.length} résultat${filteredSales.length !== 1 ? 's' : ''} sur ${sales.length} vente${sales.length > 1 ? 's' : ''}`
              : `${sales.length} vente${sales.length > 1 ? 's' : ''} · cliquer une ligne pour le détail`}
            {sales.length >= 500 && (
              <span style={{ marginLeft: 8, color: C.orange, fontWeight: 600 }}>
                · Affichage limité aux 500 dernières ventes
              </span>
            )}
          </p>
        </div>
        {['owner', 'admin', 'vendor'].includes(profile.role) && (
          <button
            className="btn-navy"
            disabled={navPending}
            onClick={() => {
              if (!hasBoutiques && ['owner', 'admin'].includes(profile.role)) {
                setNoBoutiqueWarning(true)
                window.scrollTo({ top: 0, behavior: 'smooth' })
                return
              }
              startNavTransition(() => router.push('/sales/new'))
            }}
            style={{
              padding: '10px 20px',
              background: navPending ? C.slate : C.navy, color: 'white',
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              cursor: navPending ? 'not-allowed' : 'pointer',
              fontFamily: FONT,
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'background 0.15s',
            }}
          >
            {navPending ? (
              <><span className="spinner" />Chargement…</>
            ) : '+ Nouvelle vente'}
          </button>
        )}
      </div>

      {/* ── Filter bar ── */}
      {sales.length > 0 && (
        <div style={{
          background: C.surface, borderRadius: 10,
          border: `1px solid ${C.border}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          padding: '12px 14px', marginBottom: 14,
          display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
        }}>
          <IconFilter />
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 140 }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <IconSearch />
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="N°, client ou téléphone…"
              style={{
                width: '100%', paddingLeft: 28, paddingRight: 8,
                height: 32, border: `1px solid ${C.border}`,
                borderRadius: 6, fontSize: 12, fontFamily: FONT,
                color: C.ink, background: C.bg, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          {/* Status */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              height: 32, paddingLeft: 8, paddingRight: 24,
              border: `1px solid ${C.border}`, borderRadius: 6,
              fontSize: 12, fontFamily: FONT, color: statusFilter ? C.ink : C.muted,
              background: C.bg, cursor: 'pointer', outline: 'none', flex: '0 0 auto',
            }}
          >
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          {/* Payment status */}
          <select
            value={paymentFilter}
            onChange={e => setPaymentFilter(e.target.value)}
            style={{
              height: 32, paddingLeft: 8, paddingRight: 24,
              border: `1px solid ${paymentFilter === 'unpaid' || paymentFilter === 'partial' ? C.orange : C.border}`, borderRadius: 6,
              fontSize: 12, fontFamily: FONT, color: paymentFilter ? C.ink : C.muted,
              background: paymentFilter === 'unpaid' || paymentFilter === 'partial' ? C.orangeL : C.bg,
              cursor: 'pointer', outline: 'none', flex: '0 0 auto',
            }}
          >
            <option value="">Tous les paiements</option>
            <option value="unpaid">Impayé</option>
            <option value="partial">Acompte versé</option>
            <option value="paid">Payé</option>
          </select>
          {/* Date from */}
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{
              height: 32, padding: '0 8px',
              border: `1px solid ${C.border}`, borderRadius: 6,
              fontSize: 12, fontFamily: FONT, color: dateFrom ? C.ink : C.muted,
              background: C.bg, outline: 'none', flex: '0 0 auto',
            }}
          />
          <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>→</span>
          {/* Date to */}
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{
              height: 32, padding: '0 8px',
              border: `1px solid ${C.border}`, borderRadius: 6,
              fontSize: 12, fontFamily: FONT, color: dateTo ? C.ink : C.muted,
              background: C.bg, outline: 'none', flex: '0 0 auto',
            }}
          />
          {/* Boutique (only for admin/owner who can see all boutiques) */}
          {['owner', 'admin'].includes(profile.role) && boutiques.length > 1 && (
            <select
              value={boutiqueFilter}
              onChange={e => setBoutiqueFilter(e.target.value)}
              style={{
                height: 32, paddingLeft: 8, paddingRight: 24,
                border: `1px solid ${C.border}`, borderRadius: 6,
                fontSize: 12, fontFamily: FONT, color: boutiqueFilter ? C.ink : C.muted,
                background: C.bg, cursor: 'pointer', outline: 'none', flex: '0 0 auto',
              }}
            >
              <option value="">Toutes les boutiques</option>
              {boutiques.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
          {/* Clear */}
          {hasFilters && (
            <button
              className="btn-ghost"
              onClick={clearFilters}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                height: 32, padding: '0 10px',
                background: 'transparent', border: `1px solid ${C.border}`,
                borderRadius: 6, fontSize: 11, fontWeight: 600,
                color: C.slate, cursor: 'pointer', fontFamily: FONT,
                flexShrink: 0,
              }}
            >
              <IconX /> Effacer
            </button>
          )}
        </div>
      )}

      {/* ── Sales table ── */}
      <div style={{
        background: C.surface, borderRadius: 12,
        border: `1px solid ${C.border}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden',
      }}>
        {sales.length === 0 ? (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <IconCart size={56} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, marginBottom: 6, fontFamily: FONT }}>
              Aucune vente pour le moment
            </div>
            <p style={{ fontSize: 13, color: C.slate, margin: '0 0 20px', fontFamily: FONT }}>
              Les ventes apparaîtront ici une fois créées.
            </p>
            {['owner', 'admin', 'vendor'].includes(profile.role) && (
              <button
                className="btn-navy"
                disabled={firstSalePending}
                onClick={() => {
                  if (!hasBoutiques && ['owner', 'admin'].includes(profile.role)) {
                    setNoBoutiqueWarning(true)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                    return
                  }
                  startFirstSaleTransition(() => router.push('/sales/new'))
                }}
                style={{
                  padding: '10px 24px',
                  background: firstSalePending ? C.slate : C.navy, color: 'white',
                  border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 600,
                  cursor: firstSalePending ? 'not-allowed' : 'pointer',
                  fontFamily: FONT,
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                }}
              >
                {firstSalePending ? (
                  <><span className="spinner" />Chargement…</>
                ) : 'Créer la première vente'}
              </button>
            )}
          </div>
        ) : filteredSales.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 6, fontFamily: FONT }}>
              Aucun résultat
            </div>
            <p style={{ fontSize: 13, color: C.slate, margin: '0 0 16px', fontFamily: FONT }}>
              Aucune vente ne correspond aux filtres sélectionnés.
            </p>
            <button
              className="btn-ghost"
              onClick={clearFilters}
              style={{
                padding: '8px 18px', background: C.bg, color: C.slate,
                border: `1px solid ${C.border}`, borderRadius: 7,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
              }}
            >
              Effacer les filtres
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: C.bg }}>
                <tr>
                  {['N° Vente', 'Date', 'Client', 'Boutique', ...(profile.role !== 'vendor' ? ['Vendeur'] : []), 'Montant', 'Statut', ''].map(h => (
                    <th key={h} style={TH_STYLE}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale: any) => {
                  const cfg    = STATUS_CONFIG[sale.status] ?? STATUS_CONFIG.draft
                  const isOpen = expanded === sale.id
                  return (
                    <React.Fragment key={sale.id}>
                      <tr
                        className="trow-click"
                        onClick={() => setExpanded(isOpen ? null : sale.id)}
                        style={{ background: isOpen ? C.bg : C.surface }}
                      >
                        <td style={{ ...TD_STYLE, fontWeight: 700, color: C.navy }}>
                          {sale.sale_number}
                        </td>
                        <td style={{ ...TD_STYLE, color: C.slate, fontSize: 12 }}>
                          {new Date(sale.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit', month: 'short',
                          })}
                          <br />
                          <span style={{ color: C.muted, fontSize: 11 }}>
                            {new Date(sale.created_at).toLocaleTimeString('fr-FR', {
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </td>
                        <td style={TD_STYLE}>{sale.customer_name || <span style={{ color: C.muted }}>—</span>}</td>
                        <td style={{ ...TD_STYLE, fontSize: 12, color: C.slate }}>{sale.boutiques?.name ?? '—'}</td>
                        {profile.role !== 'vendor' && (
                          <td style={{ ...TD_STYLE, fontSize: 12, color: C.slate }}>{sale.users?.full_name ?? '—'}</td>
                        )}
                        <td style={{ ...TD_STYLE, fontWeight: 700 }}>
                          {fmt(sale.total_amount)}
                        </td>
                        <td style={TD_STYLE}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              fontSize: 11, fontWeight: 600,
                              padding: '4px 10px', borderRadius: 100,
                              background: cfg.bg, color: cfg.color,
                              fontFamily: FONT,
                            }}>
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                              {cfg.label}
                            </span>
                            {sale.payment_status && sale.status !== 'cancelled' && (() => {
                              const pc = PAYMENT_CONFIG[sale.payment_status]
                              if (!pc) return null
                              return (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 5,
                                  fontSize: 10, fontWeight: 700,
                                  padding: '3px 8px', borderRadius: 100,
                                  background: pc.bg, color: pc.color,
                                  fontFamily: FONT,
                                }}>
                                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: pc.color, flexShrink: 0 }} />
                                  {pc.label}
                                </span>
                              )
                            })()}
                          </div>
                        </td>
                        <td
                          style={{ ...TD_STYLE, textAlign: 'right', whiteSpace: 'nowrap' }}
                          onClick={e => e.stopPropagation()}
                        >
                          {(
                            ['confirmed', 'draft'].includes(sale.status) ||
                            (['preparing', 'ready'].includes(sale.status) && ['owner', 'admin'].includes(profile.role))
                          ) &&
                           (profile.role !== 'vendor' || sale.vendor_id === profile.id) && (
                            <button
                              className="btn-ghost-danger"
                              onClick={() => { setCancelId(sale.id); setCancelNum(sale.sale_number); setCancelError(null) }}
                              style={{
                                marginRight: 10, padding: '4px 10px',
                                background: 'transparent', color: C.red,
                                border: `1px solid ${C.red}`, borderRadius: 6,
                                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                fontFamily: FONT,
                              }}
                            >
                              Annuler
                            </button>
                          )}
                          <span
                            onClick={(e) => { e.stopPropagation(); setExpanded(isOpen ? null : sale.id) }}
                            style={{ cursor: 'pointer', padding: '2px 4px', display: 'inline-flex' }}
                          >
                            {isOpen ? <IconChevronUp /> : <IconChevronDown />}
                          </span>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr>
                          <td colSpan={profile.role !== 'vendor' ? 8 : 7} style={{ padding: '0 14px 14px', background: '#F8FAFC', borderBottom: `1px solid ${C.border}` }}>
                            <SaleDetail sale={sale} profile={profile} ownerName={ownerName} currency={currency} onPaymentAdded={() => router.refresh()} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px',
                borderTop: `1px solid ${C.border}`,
                flexWrap: 'wrap', gap: 10,
              }}>
                <span style={{ fontSize: 12, color: C.muted, fontFamily: FONT }}>
                  Page {currentPage} sur {totalPages} · {totalCount} vente{totalCount !== 1 ? 's' : ''} au total
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn-ghost"
                    disabled={currentPage === 1}
                    onClick={() => goToPage(currentPage - 1)}
                    style={{
                      padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${C.border}`, cursor: currentPage === 1 ? 'default' : 'pointer',
                      background: currentPage === 1 ? C.bg : C.surface, color: currentPage === 1 ? C.muted : C.ink,
                      fontFamily: FONT,
                    }}>
                    ← Précédent
                  </button>
                  <button
                    className="btn-ghost"
                    disabled={currentPage === totalPages}
                    onClick={() => goToPage(currentPage + 1)}
                    style={{
                      padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${C.border}`, cursor: currentPage === totalPages ? 'default' : 'pointer',
                      background: currentPage === totalPages ? C.bg : C.surface, color: currentPage === totalPages ? C.muted : C.ink,
                      fontFamily: FONT,
                    }}>
                    Suivant →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Cancel modal ── */}
      {cancelId && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15,23,42,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20,
          backdropFilter: 'blur(3px)',
        }}>
          <div style={{
            background: C.surface, borderRadius: 14,
            width: '100%', maxWidth: 420,
            boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: C.redL,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke={C.red} strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, fontFamily: FONT }}>
                  Annuler la vente {cancelNum}
                </div>
                <div style={{ fontSize: 12, color: C.slate, fontFamily: FONT }}>Cette action est irréversible</div>
              </div>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: C.slate, fontFamily: FONT }}>
                La vente sera marquée comme annulée. Les réservations de stock seront libérées.
              </p>
              {cancelError && (
                <div style={{
                  marginBottom: 14, padding: '10px 12px',
                  background: C.redL, borderRadius: 8,
                  fontSize: 12, color: C.red, fontWeight: 600,
                  border: `1px solid #FECACA`, fontFamily: FONT,
                }}>
                  {cancelError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn-red"
                  onClick={handleCancelConfirm}
                  disabled={cancelling}
                  style={{
                    flex: 1, padding: '11px',
                    background: cancelling ? C.muted : C.red,
                    color: 'white', border: 'none', borderRadius: 8,
                    fontSize: 13, fontWeight: 600, cursor: cancelling ? 'not-allowed' : 'pointer',
                    fontFamily: FONT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {cancelling ? <><span className="spinner" />Annulation…</> : "Confirmer l'annulation"}
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => { setCancelId(null); setCancelError(null) }}
                  style={{
                    padding: '11px 18px', background: C.bg,
                    color: C.slate, border: `1px solid ${C.border}`,
                    borderRadius: 8, fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  Retour
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}

function IconPrint({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <rect x="2" y="5" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M4 5V2.5A.5.5 0 0 1 4.5 2h5a.5.5 0 0 1 .5.5V5" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="4.5" y="8" width="5" height="2.5" rx=".5" fill="currentColor"/>
      <circle cx="4" cy="7" r=".6" fill="currentColor"/>
    </svg>
  )
}

function escHtml(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function printSaleReceipt(sale: any, ownerName = 'Le Propriétaire', currency = 'FCFA') {
  const now = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const rows = (sale.sale_items ?? []).map((item: any) => {
    const isTile = !!item.tile_area_m2_snapshot && !!item.tiles_per_carton_snapshot
    const unitLbl = escHtml(item.products?.unit_label ?? (isTile ? 'm²' : 'unité'))
    let qtyCell: string
    let priceCell: string
    if (isTile) {
      const tileArea    = parseFloat(item.tile_area_m2_snapshot)
      const tpc         = parseInt(item.tiles_per_carton_snapshot)
      const m2          = item.quantity_tiles * tileArea
      const fullCartons = Math.floor(item.quantity_tiles / tpc)
      const loose       = item.quantity_tiles % tpc
      qtyCell   = `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(m2)} m² · ${fullCartons}${loose > 0 ? ` <span style="color:#D97706">+${loose}</span>` : ''} ctn`
      priceCell = `${new Intl.NumberFormat('fr-FR').format(item.unit_price_per_m2)} ${currency}/m²`
    } else {
      qtyCell   = `${new Intl.NumberFormat('fr-FR').format(item.quantity_tiles)} ${unitLbl}`
      priceCell = `${new Intl.NumberFormat('fr-FR').format(item.unit_price_per_m2)} ${currency}/${unitLbl}`
    }
    return `
      <tr>
        <td>${escHtml(item.products?.name)}</td>
        <td style="color:#64748B;font-size:11px">${escHtml(item.products?.reference_code)}</td>
        <td style="text-align:center">${qtyCell}</td>
        <td style="text-align:right">${priceCell}</td>
        <td style="text-align:right;font-weight:700">${new Intl.NumberFormat('fr-FR').format(Math.round(item.total_price))} ${currency}</td>
      </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=800"/>
  <title>Reçu de vente — ${escHtml(sale.sale_number)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0 }
    body { font-family: system-ui,-apple-system,'Segoe UI',sans-serif; color: #0F172A; padding: 32px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #0F172A; }
    .logo { font-size: 24px; font-weight: 800; letter-spacing: -0.03em; font-family: Georgia, serif; }
    .logo span { color: #2563EB; }
    .meta { font-size: 11px; color: #64748B; text-align: right; line-height: 1.8 }
    .sale-id { font-size: 22px; font-weight: 800; color: #0F172A; letter-spacing: -0.02em; margin-bottom: 4px }
    .info-block { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; display: flex; gap: 32px; }
    .info-col { flex: 1 }
    .info-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #94A3B8; margin-bottom: 3px; }
    .info-value { font-size: 13px; font-weight: 600; color: #0F172A; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94A3B8; padding: 0 10px 10px 0; border-bottom: 2px solid #0F172A; }
    td { padding: 10px 10px 10px 0; border-bottom: 1px solid #E2E8F0; vertical-align: middle; }
    .total-row { display: flex; justify-content: flex-end; margin-bottom: 28px; }
    .total-box { background: #0F172A; color: white; padding: 14px 24px; border-radius: 8px; text-align: right; }
    .total-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #94A3B8; margin-bottom: 4px; }
    .total-amount { font-size: 22px; font-weight: 900; letter-spacing: -0.02em; }
    .sig-section { margin-top: 32px; padding-top: 20px; border-top: 1px solid #E2E8F0; }
    .sig-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #94A3B8; margin-bottom: 16px; }
    .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
    .sig-name { font-size: 12px; font-weight: 600; color: #0F172A; margin-bottom: 4px; }
    .sig-role { font-size: 11px; color: #64748B; margin-bottom: 12px; }
    .sig-line { border-bottom: 1.5px solid #CBD5E1; height: 52px; margin-bottom: 6px; }
    .sig-sub { font-size: 10px; color: #94A3B8; }
    .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #94A3B8; padding-top: 16px; border-top: 1px solid #E2E8F0; }
    .back-btn { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 20px; padding: 8px 16px; background: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 6px; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer; font-family: system-ui,-apple-system,'Segoe UI',sans-serif; }
    @media print { @page { margin: 20mm; } .back-btn { display: none !important; } }
  </style>
</head>
<body>
  <button class="back-btn" onclick="window.close()">← Retour à l'application</button>
  <div class="header">
    <div>
      <div class="logo">UC<span>A</span></div>
      <div style="font-size:11px;color:#64748B;margin-top:2px">Reçu de vente officiel</div>
    </div>
    <div class="meta">
      <div>${now}</div>
      <div>${escHtml(sale.boutiques?.name)}</div>
    </div>
  </div>

  <div class="sale-id">${escHtml(sale.sale_number) || '—'}</div>
  <div style="font-size:12px;color:#64748B;margin-bottom:20px">
    ${new Date(sale.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
  </div>

  <div class="info-block">
    <div class="info-col">
      <div class="info-label">Client</div>
      <div class="info-value">${escHtml(sale.customer_name) || 'Client anonyme'}</div>
      ${sale.customer_phone ? `<div style="font-size:12px;color:#64748B;margin-top:2px">${escHtml(sale.customer_phone)}</div>` : ''}
      ${sale.customer_cni ? `<div style="font-size:11px;color:#94A3B8;margin-top:2px">CNI : ${escHtml(sale.customer_cni)}</div>` : ''}
    </div>
    <div class="info-col">
      <div class="info-label">Vendeur</div>
      <div class="info-value">${escHtml(sale.users?.full_name) || '—'}</div>
      <div style="font-size:12px;color:#64748B;margin-top:2px">${escHtml(sale.boutiques?.name)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Produit</th>
        <th>Référence</th>
        <th style="text-align:center">Quantité</th>
        <th style="text-align:right">Prix unitaire</th>
        <th style="text-align:right">Sous-total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  ${(() => {
    const total      = Math.round(sale.total_amount)
    const paid       = Math.max(0, parseFloat(sale.amount_paid ?? 0))
    const balance    = Math.max(0, total - paid)
    const payLabel   = paid >= total ? 'Payé' : paid > 0 ? 'Acompte versé' : 'Impayé'
    const payColor   = paid >= total ? '#059669' : paid > 0 ? '#D97706' : '#DC2626'
    return `
  <div class="total-row">
    <div class="total-box">
      <div class="total-label">Montant total</div>
      <div class="total-amount">${new Intl.NumberFormat('fr-FR').format(total)} ${currency}</div>
      ${paid > 0 ? `<div style="margin-top:8px;font-size:12px;color:#94A3B8">Encaissé : ${new Intl.NumberFormat('fr-FR').format(Math.round(paid))} ${currency}</div>` : ''}
      ${balance > 0 ? `<div style="font-size:12px;color:#FCA5A5;margin-top:2px">Reste à payer : ${new Intl.NumberFormat('fr-FR').format(balance)} ${currency}</div>` : ''}
    </div>
  </div>
  <div style="display:flex;justify-content:flex-end;margin-bottom:28px">
    <span style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:100px;background:${payColor}20;border:1px solid ${payColor};font-size:12px;font-weight:700;color:${payColor}">
      <span style="width:6px;height:6px;border-radius:50%;background:${payColor}"></span>
      ${payLabel}
    </span>
  </div>`
  })()}

  <div class="sig-section">
    <div class="sig-title">Signatures</div>
    <div class="sig-grid">
      <div>
        <div class="sig-name">${escHtml(sale.users?.full_name) || 'Le vendeur'}</div>
        <div class="sig-role">Vendeur — ${escHtml(sale.boutiques?.name)}</div>
        <div class="sig-line"></div>
        <div class="sig-sub">Signature du vendeur</div>
      </div>
      <div>
        <div class="sig-name">${escHtml(ownerName)}</div>
        <div class="sig-role">Propriétaire — UCA</div>
        <div class="sig-line"></div>
        <div class="sig-sub">Signature du propriétaire</div>
      </div>
    </div>
  </div>

  <div class="footer">Document officiel UCA · ${escHtml(sale.sale_number)}</div>
</body>
</html>`

  const w = window.open('', '_blank', 'width=800,height=900')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 400)
}

// ── Sale detail panel ─────────────────────────────────────────────────────────
function SaleDetail({ sale, profile, ownerName, currency, onPaymentAdded }: {
  sale: any; profile: any; ownerName: string; currency: string; onPaymentAdded: () => void
}) {
  const fmt = (n: number) => fmtCurrency(n, currency)
  const supabase   = useMemo(() => createClient(), [])
  const [payments, setPayments] = useState<any[] | null>(null)
  const [showAdd,  setShowAdd]  = useState(false)
  const [addAmt,   setAddAmt]   = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [adding,   setAdding]   = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const loadPayments = useCallback(async () => {
    const { data } = await supabase
      .from('sale_payments')
      .select('id, amount, notes, created_at, users!sale_payments_created_by_fkey(full_name)')
      .eq('sale_id', sale.id)
      .order('created_at', { ascending: true })
    setPayments(data ?? [])
  }, [sale.id, supabase])

  useEffect(() => { loadPayments() }, [loadPayments])

  const handleAdd = async () => {
    const amount = parseFloat(addAmt)
    if (!amount || amount <= 0) { setAddError('Montant invalide.'); return }
    setAdding(true); setAddError(null)
    const result = await addPayment(sale.id, amount, addNotes || null)
    setAdding(false)
    if (result.error) { setAddError(result.error); return }
    await loadPayments()
    setAddAmt(''); setAddNotes(''); setShowAdd(false)
    onPaymentAdded()
  }

  const canAdd = sale.status !== 'cancelled' &&
    sale.payment_status !== 'paid' &&
    (['owner', 'admin'].includes(profile.role) || sale.vendor_id === profile.id)

  return (
    <div style={{ background: C.bg, borderRadius: 8, padding: '14px 16px', border: `1px solid ${C.border}`, marginTop: 2 }}>

      {/* Articles */}
      <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, fontFamily: FONT }}>
        Détail des articles
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Produit', 'Référence', 'Quantité', 'Prix unitaire', 'Sous-total'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 12px 8px 0', borderBottom: `1px solid ${C.border}`, fontFamily: FONT }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(sale.sale_items ?? []).map((item: any) => {
              const isTile   = !!item.tile_area_m2_snapshot && !!item.tiles_per_carton_snapshot
              const unitLbl  = item.products?.unit_label ?? (isTile ? 'carreau' : 'unité')
              let qtyDisplay: React.ReactNode
              let priceDisplay: string
              if (isTile) {
                const tileArea    = parseFloat(item.tile_area_m2_snapshot)
                const tpc         = parseInt(item.tiles_per_carton_snapshot)
                const m2          = item.quantity_tiles * tileArea
                const fullCartons = Math.floor(item.quantity_tiles / tpc)
                const loose       = item.quantity_tiles % tpc
                qtyDisplay = (
                  <>
                    {fmtM2(m2)}
                    <span style={{ color: C.muted, fontSize: 11 }}>
                      {' '}· {fullCartons} ctn{loose > 0 && <span style={{ color: C.orange }}> +{loose}</span>}
                    </span>
                  </>
                )
                priceDisplay = `${fmtNum(item.unit_price_per_m2)} ${currency}/m²`
              } else {
                qtyDisplay   = `${fmtNum(item.quantity_tiles)} ${unitLbl}`
                priceDisplay = `${fmtNum(item.unit_price_per_m2)} ${currency}/${unitLbl}`
              }
              return (
                <tr key={item.id}>
                  <td style={{ padding: '8px 12px 8px 0', fontSize: 13, fontWeight: 600, color: C.ink, fontFamily: FONT }}>{item.products?.name ?? '—'}</td>
                  <td style={{ padding: '8px 12px 8px 0', fontSize: 11, color: C.muted, fontFamily: FONT }}>{item.products?.reference_code ?? '—'}</td>
                  <td style={{ padding: '8px 12px 8px 0', fontSize: 13, color: C.slate, fontFamily: FONT }}>{qtyDisplay}</td>
                  <td style={{ padding: '8px 12px 8px 0', fontSize: 13, color: C.slate, fontFamily: FONT }}>{priceDisplay}</td>
                  <td style={{ padding: '8px 0', fontSize: 13, fontWeight: 700, color: C.ink, fontFamily: FONT }}>{fmt(item.total_price)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Historique des paiements ── */}
      <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 14, paddingTop: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontFamily: FONT }}>
          Historique des paiements
        </div>

        {payments === null ? (
          <div style={{ fontSize: 12, color: C.muted, fontFamily: FONT }}>Chargement…</div>
        ) : payments.length === 0 ? (
          <div style={{ fontSize: 12, color: C.muted, fontFamily: FONT }}>Aucun paiement enregistré</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {payments.map((p: any, i: number) => (
              <div key={p.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '7px 10px', borderRadius: 6, flexWrap: 'wrap', gap: 6,
                background: i === payments.length - 1 ? C.greenL : C.surface,
                border: `1px solid ${i === payments.length - 1 ? C.green + '44' : C.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.green, fontFamily: FONT }}>+{fmt(p.amount)}</span>
                  {p.notes && <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>· {p.notes}</span>}
                </div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>
                  {new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {p.users?.full_name && ` · ${p.users.full_name}`}
                </div>
              </div>
            ))}
          </div>
        )}

        {canAdd && !showAdd && (
          <button
            className="btn-outline-navy"
            onClick={() => setShowAdd(true)}
            style={{ marginTop: 10, padding: '7px 14px', borderRadius: 7, border: `1.5px solid ${C.navy}`, background: 'transparent', color: C.navy, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Enregistrer un versement
          </button>
        )}

        {canAdd && showAdd && (
          <div style={{ marginTop: 10, padding: '12px 14px', background: C.surface, borderRadius: 8, border: `1.5px solid ${C.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 10, fontFamily: FONT }}>Nouveau versement</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                type="number" min="1" step="100"
                value={addAmt}
                onChange={e => setAddAmt(e.target.value)}
                placeholder={`Montant (${currency})`}
                style={{ flex: '1 1 140px', padding: '8px 10px', borderRadius: 6, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, outline: 'none', fontFamily: FONT, boxSizing: 'border-box' }}
              />
              <input
                type="text"
                value={addNotes}
                onChange={e => setAddNotes(e.target.value)}
                placeholder="Note (optionnel)"
                style={{ flex: '2 1 180px', padding: '8px 10px', borderRadius: 6, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, outline: 'none', fontFamily: FONT, boxSizing: 'border-box' }}
              />
            </div>
            {addError && <div style={{ fontSize: 12, color: C.red, marginTop: 6, fontFamily: FONT }}>{addError}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                className="btn-navy"
                onClick={handleAdd}
                disabled={adding}
                style={{ padding: '8px 16px', borderRadius: 6, background: adding ? C.muted : C.navy, color: 'white', border: 'none', fontSize: 12, fontWeight: 600, cursor: adding ? 'not-allowed' : 'pointer', fontFamily: FONT, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {adding ? <><span className="spinner" />Enregistrement…</> : 'Enregistrer'}
              </button>
              <button
                className="btn-ghost"
                onClick={() => { setShowAdd(false); setAddAmt(''); setAddNotes(''); setAddError(null) }}
                disabled={adding}
                style={{ padding: '8px 14px', borderRadius: 6, background: 'transparent', color: C.slate, border: `1px solid ${C.border}`, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Statut paiement ── */}
      {sale.payment_status && sale.status !== 'cancelled' && (() => {
        const pc      = PAYMENT_CONFIG[sale.payment_status]
        const paid    = parseFloat(sale.amount_paid ?? 0)
        const balance = Math.max(0, parseFloat(sale.total_amount) - paid)
        if (!pc) return null
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 10, padding: '8px 12px', borderRadius: 8, background: pc.bg, border: `1px solid ${pc.color}33` }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: pc.color, fontFamily: FONT }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: pc.color }} />{pc.label}
            </span>
            <span style={{ fontSize: 12, color: C.slate, fontFamily: FONT }}>
              Encaissé : <strong style={{ color: C.ink }}>{fmt(paid)}</strong>
              {balance > 0 && (<> &nbsp;·&nbsp; Reste : <strong style={{ color: pc.color }}>{fmt(balance)}</strong></>)}
            </span>
          </div>
        )
      })()}

      {/* ── Footer ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${C.border}`, paddingTop: 10, marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: C.slate, display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: FONT }}>
          {sale.customer_phone && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2.5c0-.28.22-.5.5-.5h2l.75 2L4 5.5s.5 1.5 2.5 2.5l1.5-1.25 2 .75V9.5c0 .28-.22.5-.5.5C4.07 10 2 4.93 2 2.5Z" stroke={C.muted} strokeWidth="1.1"/></svg>
              {sale.customer_phone}
            </span>
          )}
          {sale.customer_cni && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="2.5" width="10" height="7" rx="1.5" stroke={C.muted} strokeWidth="1.1"/><path d="M3.5 5.5h2M3.5 7.5h3.5" stroke={C.muted} strokeWidth="1" strokeLinecap="round"/><circle cx="8.5" cy="6" r="1.2" stroke={C.muted} strokeWidth="1"/></svg>
              CNI : {sale.customer_cni}
            </span>
          )}
          {sale.notes && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="1.5" width="9" height="9" rx="1.5" stroke={C.muted} strokeWidth="1.1"/><path d="M3.5 4h5M3.5 6h5M3.5 8h3" stroke={C.muted} strokeWidth="1" strokeLinecap="round"/></svg>
              {sale.notes}
            </span>
          )}
          {!sale.customer_phone && !sale.notes && <span style={{ color: C.muted }}>Aucune note</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => printSaleReceipt(sale, ownerName, currency)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'transparent', color: C.slate, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
            <IconPrint /> Imprimer le reçu
          </button>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, fontFamily: FONT }}>Total : {fmt(sale.total_amount)}</div>
        </div>
      </div>
    </div>
  )
}
