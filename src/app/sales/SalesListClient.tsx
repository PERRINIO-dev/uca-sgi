'use client'

import React, { useState, useMemo, useEffect, useRef, useTransition, useCallback } from 'react'
import { useRouter }    from 'next/navigation'
import useSWR, { useSWRConfig } from 'swr'
import { createClient } from '@/lib/supabase/client'
import PageLayout       from '@/components/PageLayout'
import { cancelSale, addPayment, createScheduleItem, deleteScheduleItem } from './actions'
import type { BadgeCounts } from '@/lib/supabase/badge-counts'
import { fmtCurrency }         from '@/lib/format'
import { pluralize }           from '@/lib/pluralize'
import { downloadInvoicePdf }  from '@/lib/pdf/download'
import { C, F, R, SP, SH, TR, Z } from '@/lib/design-system'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtNum = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(n)
const fmtM2 = (n: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' m²'

const PAYMENT_CONFIG: Record<string, { label: string; bg: string; color: string; bd: string }> = {
  paid:    { label: 'Payé',    bg: C.greenBg,  color: C.green,  bd: C.greenBd  },
  partial: { label: 'Acompte', bg: C.orangeBg, color: C.orange, bd: C.orangeBd },
  unpaid:  { label: 'Impayé',  bg: C.redBg,    color: C.red,    bd: C.redBd    },
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  draft:     { label: 'Brouillon',      bg: C.surfaceEl, color: C.dim,    dot: C.dim    },
  confirmed: { label: 'Confirmée',      bg: C.blueBg,    color: C.blue,   dot: C.blue   },
  preparing: { label: 'En préparation', bg: C.orangeBg,  color: C.orange, dot: C.orange },
  ready:     { label: 'Prête',          bg: C.greenBg,   color: C.green,  dot: C.green  },
  delivered: { label: 'Livrée',         bg: C.surfaceEl, color: C.dim,    dot: C.dim    },
  cancelled: { label: 'Annulée',        bg: C.redBg,     color: C.red,    dot: C.red    },
}

const TH_STYLE: React.CSSProperties = {
  padding: `${SP[3]} ${SP[4]}`, textAlign: 'left',
  fontSize: 11, fontWeight: F.bold, color: C.dim,
  textTransform: 'uppercase', letterSpacing: F.lsWider,
  borderBottom: `1.5px solid ${C.border}`,
  whiteSpace: 'nowrap', fontFamily: F.body,
  background: C.surfaceSub,
}
const TD_STYLE: React.CSSProperties = {
  padding: `${SP[4]} ${SP[4]}`, fontSize: 13, color: C.text,
  borderBottom: `1px solid ${C.borderSub}`,
  verticalAlign: 'middle', fontFamily: F.body,
}

function IconChevronDown({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M2 4l4 4 4-4" stroke={C.dim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconChevronUp({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M2 8l4-4 4 4" stroke={C.amber} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconCart({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <circle cx="20" cy="20" r="20" fill={C.surfaceEl}/>
      <path d="M11 13h2.5l3.5 10h9l2-6H16" stroke={C.dim} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="17" cy="26.5" r="1.5" fill={C.dim}/>
      <circle cx="24" cy="26.5" r="1.5" fill={C.dim}/>
    </svg>
  )
}
function IconSearch({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke={C.dim} strokeWidth="1.4"/>
      <path d="M10 10l2.5 2.5" stroke={C.dim} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}
function IconFilter({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none">
      <path d="M1.5 3h10M3 6.5h7M5 10h3" stroke={C.muted} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}
function IconX({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 11 11" fill="none">
      <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke={C.muted} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
// ── URL builder (pure function, no hooks) ─────────────────────────────────────
function buildUrl(page: number, f: {
  search: string; status: string; payment: string
  dateFrom: string; dateTo: string; boutiqueId: string
}) {
  const p = new URLSearchParams()
  if (f.search)    p.set('search',     f.search)
  if (f.status)    p.set('status',     f.status)
  if (f.payment)   p.set('payment',    f.payment)
  if (f.dateFrom)  p.set('dateFrom',   f.dateFrom)
  if (f.dateTo)    p.set('dateTo',     f.dateTo)
  if (f.boutiqueId) p.set('boutique_id', f.boutiqueId)
  p.set('page', String(page))
  return `/sales?${p.toString()}`
}

export default function SalesListClient({
  profile,
  currency,
  sales,
  badgeCounts,
  errorCode,
  hasBoutiques = true,
  ownerName = 'Le Propriétaire',
  companyName = 'SGI',
  currentPage = 1,
  totalPages = 1,
  totalCount = 0,
  boutiquesList = [],
  activeSearch = '',
  activeStatus = '',
  activePayment = '',
  activeDateFrom = '',
  activeDateTo = '',
  activeBoutiqueId = '',
}: {
  profile:          any
  currency:         string
  sales:            any[]
  badgeCounts?:     BadgeCounts
  errorCode?:       string
  hasBoutiques?:    boolean
  ownerName?:       string
  companyName?:     string
  currentPage?:     number
  totalPages?:      number
  totalCount?:      number
  boutiquesList?:   { id: string; name: string }[]
  activeSearch?:    string
  activeStatus?:    string
  activePayment?:   string
  activeDateFrom?:  string
  activeDateTo?:    string
  activeBoutiqueId?: string
}) {
  const router        = useRouter()
  const supabase      = useMemo(() => createClient(), [])
  const { mutate }    = useSWRConfig()
  const [navPending,       startNavTransition]       = useTransition()
  const [firstSalePending, startFirstSaleTransition] = useTransition()

  // ── SWR cache key — includes all active filters so each combo is cached ───
  const swrKey = useMemo(() => {
    const params = new URLSearchParams()
    if (currentPage > 1)   params.set('page', String(currentPage))
    if (activeSearch)       params.set('search', activeSearch)
    if (activeStatus)       params.set('status', activeStatus)
    if (activePayment)      params.set('payment', activePayment)
    if (activeDateFrom)     params.set('dateFrom', activeDateFrom)
    if (activeDateTo)       params.set('dateTo', activeDateTo)
    if (activeBoutiqueId)   params.set('boutique_id', activeBoutiqueId)
    const qs = params.toString()
    return `/api/sales${qs ? '?' + qs : ''}`
  }, [currentPage, activeSearch, activeStatus, activePayment, activeDateFrom, activeDateTo, activeBoutiqueId])

  const { data } = useSWR(swrKey, fetcher, {
    fallbackData: {
      sales, currency, badgeCounts, hasBoutiques, ownerName,
      companyName, currentPage, totalPages, totalCount,
      boutiquesList,
    },
    revalidateOnFocus: false,
    dedupingInterval:  30_000,
  })

  const d   = data as any
  const fmt = (n: number) => fmtCurrency(n, d.currency ?? currency)

  // ── Prefetch new-sale page so the click feels instant ─────────────────────
  useEffect(() => { router.prefetch('/sales/new') }, [router])

  // ── Real-time: revalidate SWR cache when sales change ─────────────────────
  useEffect(() => {
    const refresh = () => { mutate(swrKey); router.refresh() }
    const channel = supabase
      .channel('sales-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swrKey])

  const [noBoutiqueWarning, setNoBoutiqueWarning] = useState(false)

  const [expanded,    setExpanded]   = useState<string | null>(null)
  const [cancelId,    setCancelId]   = useState<string | null>(null)
  const [cancelNum,   setCancelNum]  = useState('')
  const [cancelling,  setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  // ── Filters — initialized from server-applied values ─────────────────────
  const [search,        setSearch]       = useState(activeSearch)
  const [statusFilter,  setStatusFilter] = useState(activeStatus)
  const [paymentFilter, setPaymentFilter] = useState(activePayment)
  const [dateFrom,      setDateFrom]     = useState(activeDateFrom)
  const [dateTo,        setDateTo]       = useState(activeDateTo)
  const [boutiqueId,    setBoutiqueId]   = useState(activeBoutiqueId)

  // Sync filter local state when server props change (back/forward navigation)
  // propSync prevents the sync from re-triggering a router.push()
  const propSync      = useRef(false)
  const isFirstRender = useRef(true)
  useEffect(() => {
    propSync.current = true
    setSearch(activeSearch)
    setStatusFilter(activeStatus)
    setPaymentFilter(activePayment)
    setDateFrom(activeDateFrom)
    setDateTo(activeDateTo)
    setBoutiqueId(activeBoutiqueId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSearch, activeStatus, activePayment, activeDateFrom, activeDateTo, activeBoutiqueId])

  // Debounced text search → navigate to page 1 with new search param
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (propSync.current)      { propSync.current = false; return }
    const f = { search, status: statusFilter, payment: paymentFilter, dateFrom, dateTo, boutiqueId }
    const t = setTimeout(() => {
      startNavTransition(() => router.push(buildUrl(1, f)))
    }, 400)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const handleStatusChange = (val: string) => {
    setStatusFilter(val)
    const f = { search, status: val, payment: paymentFilter, dateFrom, dateTo, boutiqueId }
    startNavTransition(() => router.push(buildUrl(1, f)))
  }
  const handlePaymentChange = (val: string) => {
    setPaymentFilter(val)
    const f = { search, status: statusFilter, payment: val, dateFrom, dateTo, boutiqueId }
    startNavTransition(() => router.push(buildUrl(1, f)))
  }
  const handleDateFromChange = (val: string) => {
    setDateFrom(val)
    const f = { search, status: statusFilter, payment: paymentFilter, dateFrom: val, dateTo, boutiqueId }
    startNavTransition(() => router.push(buildUrl(1, f)))
  }
  const handleDateToChange = (val: string) => {
    setDateTo(val)
    const f = { search, status: statusFilter, payment: paymentFilter, dateFrom, dateTo: val, boutiqueId }
    startNavTransition(() => router.push(buildUrl(1, f)))
  }
  const handleBoutiqueChange = (val: string) => {
    setBoutiqueId(val)
    const f = { search, status: statusFilter, payment: paymentFilter, dateFrom, dateTo, boutiqueId: val }
    startNavTransition(() => router.push(buildUrl(1, f)))
  }

  const hasFilters = !!(search || statusFilter || paymentFilter || dateFrom || dateTo || boutiqueId)
  const clearFilters = () => {
    setSearch(''); setStatusFilter(''); setPaymentFilter('')
    setDateFrom(''); setDateTo(''); setBoutiqueId('')
    startNavTransition(() => router.push('/sales?page=1'))
  }

  // ── Server-side page navigation (preserves active filters) ────────────────
  const goToPage = (p: number) => {
    const f = { search, status: statusFilter, payment: paymentFilter, dateFrom, dateTo, boutiqueId }
    startNavTransition(() => router.push(buildUrl(p, f)))
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
    // Invalidate SWR cache so the list immediately reflects the cancelled status
    mutate(swrKey)
    router.refresh()
  }

  return (
    <PageLayout profile={profile} activeRoute="/sales" onLogout={handleLogout} badgeCounts={d.badgeCounts}>

      {/* ── Navigation loading bar ── */}
      {navPending && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: Z.toast,
          background: `linear-gradient(90deg, ${C.amber} 0%, ${C.amberHov} 60%, ${C.amber} 100%)`,
          backgroundSize: '200% 100%',
          animation: 'loadbar 1.2s linear infinite',
        }} />
      )}
      <style>{`
        @keyframes loadbar {
          0%   { background-position: 100% 0 }
          100% { background-position: -100% 0 }
        }
      `}</style>

      {/* ── No-boutique error banner ── */}
      {(errorCode === 'no_boutique' || noBoutiqueWarning) && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: SP[3],
          padding: `${SP[3]} ${SP[4]}`, marginBottom: SP[5],
          background: C.orangeBg, border: `1px solid ${C.orangeBd}`, borderRadius: R.lg,
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M9 1.5L16.5 15H1.5L9 1.5Z" stroke={C.orange} strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M9 7v4" stroke={C.orange} strokeWidth="1.6" strokeLinecap="round"/>
            <circle cx="9" cy="13" r="0.9" fill={C.orange}/>
          </svg>
          <div>
            <div style={{ fontSize: F.sm, fontWeight: F.bold, color: C.orange, marginBottom: 3, fontFamily: F.body }}>
              Aucune boutique disponible
            </div>
            <div style={{ fontSize: F.sm, color: C.orange, lineHeight: F.lhNormal, fontFamily: F.body }}>
              Vous devez créer au moins une boutique avant de pouvoir enregistrer une vente.
              Rendez-vous dans la section <strong>Utilisateurs</strong> pour ajouter une boutique.
            </div>
          </div>
        </div>
      )}

      {/* ── Page header ── */}
      <div className="fade-in-up page-header">
        <div>
          <p className="page-kicker">Gestion commerciale</p>
          <h1 className="page-title">Ventes</h1>
          <p className="page-subtitle">
            {d.totalCount === 0 && !hasFilters
              ? 'Aucune vente enregistrée'
              : hasFilters
              ? `${d.totalCount} résultat${d.totalCount !== 1 ? 's' : ''}`
              : `${d.totalCount} vente${d.totalCount !== 1 ? 's' : ''} · cliquer une ligne pour le détail`}
          </p>
        </div>
        {['owner', 'admin', 'vendor'].includes(profile.role) && (
          <button
            className="btn-amber"
            disabled={firstSalePending}
            onClick={() => {
              if (!d.hasBoutiques && ['owner', 'admin'].includes(profile.role)) {
                setNoBoutiqueWarning(true)
                window.scrollTo({ top: 0, behavior: 'smooth' })
                return
              }
              startFirstSaleTransition(() => router.push('/sales/new'))
            }}
            style={{
              border: 'none', borderRadius: R.md, height: 40,
              padding: `0 ${SP[4]}`,
              fontSize: F.sm, fontWeight: F.bold,
              cursor: firstSalePending ? 'not-allowed' : 'pointer',
              fontFamily: F.body,
              display: 'flex', alignItems: 'center', gap: SP[2],
              opacity: firstSalePending ? 0.7 : 1,
            }}
          >
            {firstSalePending ? (
              <><span className="spinner" />Chargement…</>
            ) : (
              <><svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="#FAF5EE" strokeWidth="2" strokeLinecap="round"/></svg>Nouvelle vente</>
            )}
          </button>
        )}
      </div>

      {/* ── Filter bar ── */}
      {(d.sales.length > 0 || hasFilters) && (
        <div style={{
          background: C.surface, borderRadius: R.lg,
          border: `1px solid ${C.border}`, boxShadow: SH.xs,
          padding: `${SP[3]} ${SP[3]}`, marginBottom: SP[3],
          display: 'flex', flexWrap: 'wrap', gap: SP[2], alignItems: 'center',
        }}>
          <IconFilter />
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 140 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <IconSearch />
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="N°, client ou téléphone…"
              style={{
                width: '100%', paddingLeft: 30, paddingRight: 8,
                height: 36, border: `1px solid ${C.border}`,
                borderRadius: R.md, fontSize: F.sm, fontFamily: F.body,
                color: C.text, background: C.bg, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          {/* Status */}
          <select
            value={statusFilter}
            onChange={e => handleStatusChange(e.target.value)}
            disabled={navPending}
            style={{
              height: 32, paddingLeft: 8, paddingRight: 24,
              border: `1px solid ${C.border}`, borderRadius: R.sm,
              fontSize: F.sm, fontFamily: F.body, color: statusFilter ? C.text : C.dim,
              background: C.bg, cursor: navPending ? 'not-allowed' : 'pointer', outline: 'none', flex: '0 0 auto',
              opacity: navPending ? 0.5 : 1,
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
            onChange={e => handlePaymentChange(e.target.value)}
            disabled={navPending}
            style={{
              height: 32, paddingLeft: 8, paddingRight: 24,
              border: `1px solid ${paymentFilter === 'unpaid' || paymentFilter === 'partial' ? C.orangeBd : C.border}`,
              borderRadius: R.sm,
              fontSize: F.sm, fontFamily: F.body, color: paymentFilter ? C.text : C.dim,
              background: paymentFilter === 'unpaid' || paymentFilter === 'partial' ? C.orangeBg : C.bg,
              cursor: navPending ? 'not-allowed' : 'pointer', outline: 'none', flex: '0 0 auto',
              opacity: navPending ? 0.5 : 1,
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
            onChange={e => handleDateFromChange(e.target.value)}
            disabled={navPending}
            style={{
              height: 32, padding: '0 8px',
              border: `1px solid ${C.border}`, borderRadius: R.sm,
              fontSize: F.sm, fontFamily: F.body, color: dateFrom ? C.text : C.dim,
              background: C.bg, outline: 'none', flex: '0 0 auto',
              colorScheme: 'light', opacity: navPending ? 0.5 : 1,
            }}
          />
          <span style={{ fontSize: F.xs, color: C.dim, flexShrink: 0 }}>→</span>
          {/* Date to */}
          <input
            type="date"
            value={dateTo}
            onChange={e => handleDateToChange(e.target.value)}
            disabled={navPending}
            style={{
              height: 32, padding: '0 8px',
              border: `1px solid ${C.border}`, borderRadius: R.sm,
              fontSize: F.sm, fontFamily: F.body, color: dateTo ? C.text : C.dim,
              background: C.bg, outline: 'none', flex: '0 0 auto',
              colorScheme: 'light', opacity: navPending ? 0.5 : 1,
            }}
          />
          {/* Boutique (only for admin/owner who can see all boutiques) */}
          {['owner', 'admin'].includes(profile.role) && d.boutiquesList.length > 1 && (
            <select
              value={boutiqueId}
              onChange={e => handleBoutiqueChange(e.target.value)}
              disabled={navPending}
              style={{
                height: 32, paddingLeft: 8, paddingRight: 24,
                border: `1px solid ${C.border}`, borderRadius: R.sm,
                fontSize: F.sm, fontFamily: F.body, color: boutiqueId ? C.text : C.dim,
                background: C.bg, cursor: navPending ? 'not-allowed' : 'pointer', outline: 'none', flex: '0 0 auto',
                opacity: navPending ? 0.5 : 1,
              }}
            >
              <option value="">Toutes les boutiques</option>
              {d.boutiquesList.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {/* Clear */}
          {hasFilters && (
            <button
              className="btn-ghost"
              onClick={clearFilters}
              style={{
                display: 'flex', alignItems: 'center', gap: SP[1],
                height: 32, padding: `0 ${SP[2]}`,
                borderRadius: R.sm, fontSize: F.xs, fontWeight: F.semibold,
                cursor: 'pointer', fontFamily: F.body,
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
        background: C.surface, borderRadius: R.xl,
        border: `1px solid ${C.border}`, boxShadow: SH.sm,
        overflow: 'hidden',
      }}>
        {d.sales.length === 0 && hasFilters ? (
          <div style={{ padding: `${SP[14]} ${SP[6]}`, textAlign: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ marginBottom: SP[3] }}>
              <circle cx="20" cy="20" r="19" stroke={C.border} strokeWidth="2"/>
              <path d="M13 20h14M20 13v14" stroke={C.dim} strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <div style={{ fontSize: F.lg, fontWeight: F.bold, color: C.ink, marginBottom: SP[1], fontFamily: F.display }}>
              Aucun résultat
            </div>
            <p style={{ fontSize: F.base, color: C.muted, margin: `0 0 ${SP[5]}`, fontFamily: F.body }}>
              Aucune vente ne correspond aux filtres sélectionnés.
            </p>
            <button className="btn-ghost" onClick={clearFilters} style={{ borderRadius: R.md, fontSize: F.sm, fontWeight: F.semibold, cursor: 'pointer', fontFamily: F.body }}>
              Effacer les filtres
            </button>
          </div>
        ) : d.sales.length === 0 ? (
          <div style={{ padding: `${SP[16]} ${SP[6]}`, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: SP[4] }}>
              <IconCart size={56} />
            </div>
            <div style={{ fontSize: F.lg, fontWeight: F.bold, color: C.ink, marginBottom: SP[1], fontFamily: F.display }}>
              Aucune vente pour le moment
            </div>
            <p style={{ fontSize: F.base, color: C.muted, margin: `0 0 ${SP[5]}`, fontFamily: F.body }}>
              Les ventes apparaîtront ici une fois créées.
            </p>
            {['owner', 'admin', 'vendor'].includes(profile.role) && (
              <button
                className="btn-amber"
                disabled={firstSalePending}
                onClick={() => {
                  if (!d.hasBoutiques && ['owner', 'admin'].includes(profile.role)) {
                    setNoBoutiqueWarning(true)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                    return
                  }
                  startFirstSaleTransition(() => router.push('/sales/new'))
                }}
                style={{
                  border: 'none', borderRadius: R.md, fontSize: F.sm, fontWeight: F.bold,
                  cursor: firstSalePending ? 'not-allowed' : 'pointer',
                  fontFamily: F.body, display: 'inline-flex', alignItems: 'center', gap: SP[2],
                  opacity: firstSalePending ? 0.7 : 1,
                }}
              >
                {firstSalePending ? <><span className="spinner" />Chargement…</> : 'Créer la première vente'}
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', opacity: navPending ? 0.55 : 1, transition: `opacity ${TR.fast}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['N° Vente', 'Date', 'Client', 'Boutique', ...(profile.role !== 'vendor' ? ['Vendeur'] : []), 'Montant', 'Statut', ''].map(h => (
                    <th key={h} style={TH_STYLE}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.sales.map((sale: any) => {
                  const cfg    = STATUS_CONFIG[sale.status] ?? STATUS_CONFIG.draft
                  const isOpen = expanded === sale.id
                  return (
                    <React.Fragment key={sale.id}>
                      <tr
                        className="trow-click"
                        onClick={() => setExpanded(isOpen ? null : sale.id)}
                        style={{ background: isOpen ? C.surfaceSub : C.surface }}
                      >
                        <td style={TD_STYLE}>
                          <span style={{
                            display: 'inline-block',
                            background: C.amberGlow,
                            color: C.amber,
                            border: `1px solid rgba(160,83,26,0.28)`,
                            borderRadius: R.sm,
                            padding: `${SP[0.5]} ${SP[2]}`,
                            fontSize: F.xs, fontWeight: F.bold,
                            fontFamily: F.mono,
                          }}>
                            {sale.sale_number}
                          </span>
                        </td>
                        <td style={{ ...TD_STYLE, color: C.muted, fontSize: F.sm }}>
                          {new Date(sale.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit', month: 'short',
                          })}
                          <br />
                          <span style={{ color: C.dim, fontSize: F.xs }}>
                            {new Date(sale.created_at).toLocaleTimeString('fr-FR', {
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </td>
                        <td style={TD_STYLE}>{sale.customer_name || <span style={{ color: C.dim }}>—</span>}</td>
                        <td style={{ ...TD_STYLE, fontSize: F.sm, color: C.muted }}>{sale.boutiques?.name ?? '—'}</td>
                        {profile.role !== 'vendor' && (
                          <td style={{ ...TD_STYLE, fontSize: F.sm, color: C.muted }}>{sale.users?.full_name ?? '—'}</td>
                        )}
                        <td style={{ ...TD_STYLE, fontSize: F.md, fontWeight: F.semibold, fontFamily: F.body, color: C.ink }}>
                          {fmt(sale.total_amount)}
                        </td>
                        <td style={TD_STYLE}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: SP[1] }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: SP[1],
                              fontSize: F.xs, fontWeight: F.semibold,
                              padding: `${SP[1]} ${SP[2]}`, borderRadius: R.full,
                              background: cfg.bg, color: cfg.color,
                              fontFamily: F.body,
                            }}>
                              <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                              {cfg.label}
                            </span>
                            {sale.payment_status && sale.status !== 'cancelled' && (() => {
                              const pc = PAYMENT_CONFIG[sale.payment_status]
                              if (!pc) return null
                              return (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: SP[1],
                                  fontSize: F.xs, fontWeight: F.bold,
                                  padding: `${SP[0.5]} ${SP[2]}`, borderRadius: R.full,
                                  background: pc.bg, color: pc.color,
                                  border: `1px solid ${pc.bd}`,
                                  fontFamily: F.body,
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
                                marginRight: SP[2], padding: `${SP[1]} ${SP[2]}`,
                                borderRadius: R.sm,
                                fontSize: F.xs, fontWeight: F.semibold, cursor: 'pointer',
                                fontFamily: F.body,
                              }}
                            >
                              Annuler
                            </button>
                          )}
                          <span
                            onClick={(e) => { e.stopPropagation(); setExpanded(isOpen ? null : sale.id) }}
                            style={{ cursor: 'pointer', padding: `${SP[0.5]} ${SP[1]}`, display: 'inline-flex' }}
                          >
                            {isOpen ? <IconChevronUp /> : <IconChevronDown />}
                          </span>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr>
                          <td colSpan={profile.role !== 'vendor' ? 8 : 7} style={{ padding: `0 ${SP[3]} ${SP[3]}`, background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                            <SaleDetail sale={sale} profile={profile} ownerName={d.ownerName} companyName={d.companyName} currency={d.currency} onPaymentAdded={() => { mutate(swrKey); router.refresh() }} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
            {/* ── Pagination ── */}
            {d.totalPages > 1 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: `${SP[3]} ${SP[4]}`,
                borderTop: `1px solid ${C.border}`,
                flexWrap: 'wrap', gap: SP[2],
              }}>
                <span style={{ fontSize: F.sm, color: C.dim, fontFamily: F.body }}>
                  Page {currentPage} sur {d.totalPages} · {d.totalCount} vente{d.totalCount !== 1 ? 's' : ''} au total
                </span>
                <div style={{ display: 'flex', gap: SP[1.5] }}>
                  <button
                    className="btn-ghost"
                    disabled={currentPage === 1}
                    onClick={() => goToPage(currentPage - 1)}
                    style={{
                      borderRadius: R.md, fontSize: F.sm, fontWeight: F.semibold,
                      cursor: currentPage === 1 ? 'default' : 'pointer',
                      fontFamily: F.body, display: 'flex', alignItems: 'center', gap: SP[1.5],
                      opacity: currentPage === 1 ? 0.4 : 1,
                    }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8 2L3 6.5 8 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Précédent
                  </button>
                  <button
                    className="btn-ghost"
                    disabled={currentPage === d.totalPages}
                    onClick={() => goToPage(currentPage + 1)}
                    style={{
                      borderRadius: R.md, fontSize: F.sm, fontWeight: F.semibold,
                      cursor: currentPage === d.totalPages ? 'default' : 'pointer',
                      fontFamily: F.body, display: 'flex', alignItems: 'center', gap: SP[1.5],
                      opacity: currentPage === d.totalPages ? 0.4 : 1,
                    }}>
                    Suivant
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M5 2l5 4.5L5 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
          background: 'rgba(26,15,6,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: Z.modal, padding: SP[5],
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: C.surfaceEl, borderRadius: R.xl,
            border: `1px solid ${C.border}`,
            width: '100%', maxWidth: 420,
            boxShadow: SH.xl,
            overflow: 'hidden',
          }}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${C.red}, #EF4444)` }} />
            <div style={{
              padding: `${SP[4]} ${SP[5]}`,
              borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: SP[3],
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: R.md,
                background: C.redBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke={C.red} strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: F.md, fontWeight: F.bold, color: C.ink, fontFamily: F.body }}>
                  Annuler la vente {cancelNum}
                </div>
                <div style={{ fontSize: F.sm, color: C.muted, fontFamily: F.body }}>Cette action est irréversible</div>
              </div>
            </div>
            <div style={{ padding: `${SP[5]} ${SP[6]}` }}>
              <p style={{ margin: `0 0 ${SP[4]}`, fontSize: F.sm, color: C.muted, fontFamily: F.body }}>
                La vente sera marquée comme annulée. Les réservations de stock seront libérées.
              </p>
              {cancelError && (
                <div style={{
                  marginBottom: SP[3], padding: `${SP[2]} ${SP[3]}`,
                  background: C.redBg, borderRadius: R.md,
                  fontSize: F.sm, color: C.red, fontWeight: F.semibold,
                  border: `1px solid ${C.redBd}`, fontFamily: F.body,
                }}>
                  {cancelError}
                </div>
              )}
              <div style={{ display: 'flex', gap: SP[2] }}>
                <button
                  className="btn-red"
                  onClick={handleCancelConfirm}
                  disabled={cancelling}
                  style={{
                    flex: 1, borderRadius: R.md,
                    fontSize: F.sm, fontWeight: F.semibold,
                    cursor: cancelling ? 'not-allowed' : 'pointer',
                    fontFamily: F.body, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: SP[2],
                    opacity: cancelling ? 0.7 : 1,
                  }}
                >
                  {cancelling ? <><span className="spinner" />Annulation…</> : "Confirmer l'annulation"}
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => { setCancelId(null); setCancelError(null) }}
                  style={{
                    borderRadius: R.md, fontSize: F.sm, fontWeight: F.medium,
                    cursor: 'pointer', fontFamily: F.body,
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

function IconPdf({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M2 2.5A.5.5 0 0 1 2.5 2H9l3 3v6.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-9Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M9 2v3h3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M4.5 7.5h1a.75.75 0 0 1 0 1.5H4.5V7.5Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <path d="M7 7.5h.75a1 1 0 0 1 0 2H7V7.5Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <path d="M9.5 7.5v2M9.5 8.5H10.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
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

function printSaleReceipt(sale: any, ownerName = 'Le Propriétaire', currency = 'FCFA', companyName = 'SGI') {
  const now = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const rows = (sale.sale_items ?? []).map((item: any) => {
    const isTile = item.products?.product_type === 'tile'
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
      const pLbl = pluralize(unitLbl, item.quantity_tiles)
      qtyCell   = `${new Intl.NumberFormat('fr-FR').format(item.quantity_tiles)} ${pLbl}`
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
      <div class="logo">${escHtml(companyName)}</div>
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
      ${balance > 0 ? `<div style="font-size:12px;color:#991B1B;margin-top:2px">Reste à payer : ${new Intl.NumberFormat('fr-FR').format(balance)} ${currency}</div>` : ''}
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
        <div class="sig-role">Propriétaire — ${escHtml(companyName)}</div>
        <div class="sig-line"></div>
        <div class="sig-sub">Signature du propriétaire</div>
      </div>
    </div>
  </div>

  <div class="footer">Document officiel ${escHtml(companyName)} · ${escHtml(sale.sale_number)}</div>
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
function SaleDetail({ sale, profile, ownerName, companyName, currency, onPaymentAdded }: {
  sale: any; profile: any; ownerName: string; companyName: string; currency: string; onPaymentAdded: () => void
}) {
  const fmt = (n: number) => fmtCurrency(n, currency)
  const supabase   = useMemo(() => createClient(), [])
  const [payments,   setPayments]  = useState<any[] | null>(null)
  const [showAdd,    setShowAdd]   = useState(false)
  const [addAmt,     setAddAmt]    = useState('')
  const [addNotes,   setAddNotes]  = useState('')
  const [addMethod,  setAddMethod] = useState('especes')
  const [adding,     setAdding]    = useState(false)
  const [addError,   setAddError]  = useState<string | null>(null)
  const [pdfLoading, setPdfLoad]   = useState(false)
  const [pdfError,   setPdfError]  = useState<string | null>(null)

  // ── Schedule state ──────────────────────────────────────────────────────────
  const [schedule,      setSchedule]     = useState<any[] | null>(null)
  const [showSchForm,   setShowSchForm]  = useState(false)
  const [schDate,       setSchDate]      = useState('')
  const [schAmount,     setSchAmount]    = useState('')
  const [schLabel,      setSchLabel]     = useState('')
  const [schAdding,     setSchAdding]    = useState(false)
  const [schError,      setSchError]     = useState<string | null>(null)
  const [scheduleItemId, setScheduleItemId] = useState<string | null>(null)

  const loadSchedule = useCallback(async () => {
    const { data } = await supabase
      .from('sale_payment_schedules')
      .select('id, due_date, amount, label, is_paid, paid_at')
      .eq('sale_id', sale.id)
      .order('due_date', { ascending: true })
    setSchedule(data ?? [])
  }, [sale.id, supabase])

  const loadPayments = useCallback(async () => {
    const { data } = await supabase
      .from('sale_payments')
      .select('id, amount, notes, payment_method, created_at, users!sale_payments_created_by_fkey(full_name)')
      .eq('sale_id', sale.id)
      .order('created_at', { ascending: true })
    setPayments(data ?? [])
  }, [sale.id, supabase])

  useEffect(() => { loadPayments(); loadSchedule() }, [loadPayments, loadSchedule])

  const handleAdd = async () => {
    const amount = parseFloat(addAmt)
    if (!amount || amount <= 0) { setAddError('Montant invalide.'); return }
    setAdding(true); setAddError(null)
    const result = await addPayment(sale.id, amount, addNotes || null, addMethod, scheduleItemId ?? undefined)
    setAdding(false)
    if (result.error) { setAddError(result.error); return }
    await loadPayments()
    await loadSchedule()
    setAddAmt(''); setAddNotes(''); setAddMethod('especes'); setShowAdd(false); setScheduleItemId(null)
    onPaymentAdded()
  }

  const handlePdf = async () => {
    setPdfLoad(true); setPdfError(null)
    try {
      await downloadInvoicePdf(sale.id, sale.sale_number)
    } catch (e) {
      setPdfError((e as Error).message)
    } finally {
      setPdfLoad(false)
    }
  }

  const canAdd = sale.status !== 'cancelled' &&
    sale.status !== 'draft' &&
    sale.payment_status !== 'paid' &&
    (['owner', 'admin'].includes(profile.role) || sale.vendor_id === profile.id)

  return (
    <div style={{
      background: C.surfaceEl, borderRadius: R.lg,
      border: `1px solid ${C.border}`, marginTop: SP[1],
      overflow: 'hidden', boxShadow: SH.sm,
    }}>

      {/* Articles */}
      <div style={{ padding: `${SP[3]} ${SP[4]} 0`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: F.xs, fontWeight: F.bold, color: C.dim, textTransform: 'uppercase', letterSpacing: F.lsWider, marginBottom: SP[3], fontFamily: F.body }}>
          Détail des articles
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Produit', 'Référence', 'Quantité', 'Prix unitaire', 'Sous-total'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: F.xs, fontWeight: F.bold, color: C.dim, textTransform: 'uppercase', letterSpacing: F.lsWide, padding: `0 ${SP[3]} ${SP[2]} 0`, borderBottom: `1px solid ${C.border}`, fontFamily: F.body }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(sale.sale_items ?? []).map((item: any) => {
                const isTile   = item.products?.product_type === 'tile'
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
                      <span style={{ color: C.dim, fontSize: F.xs }}>
                        {' '}· {fullCartons} ctn{loose > 0 && <span style={{ color: C.orange }}> +{loose}</span>}
                      </span>
                    </>
                  )
                  priceDisplay = `${fmtNum(item.unit_price_per_m2)} ${currency}/m²`
                } else {
                  qtyDisplay   = `${fmtNum(item.quantity_tiles)} ${pluralize(unitLbl, item.quantity_tiles)}`
                  priceDisplay = `${fmtNum(item.unit_price_per_m2)} ${currency}/${unitLbl}`
                }
                return (
                  <tr key={item.id}>
                    <td style={{ padding: `${SP[2]} ${SP[3]} ${SP[2]} 0`, fontSize: F.sm, fontWeight: F.semibold, color: C.ink, fontFamily: F.body }}>{item.products?.name ?? '—'}</td>
                    <td style={{ padding: `${SP[2]} ${SP[3]} ${SP[2]} 0`, fontSize: F.xs, color: C.dim, fontFamily: F.mono }}>{item.products?.reference_code ?? '—'}</td>
                    <td style={{ padding: `${SP[2]} ${SP[3]} ${SP[2]} 0`, fontSize: F.sm, color: C.muted, fontFamily: F.body }}>{qtyDisplay}</td>
                    <td style={{ padding: `${SP[2]} ${SP[3]} ${SP[2]} 0`, fontSize: F.sm, color: C.muted, fontFamily: F.body }}>{priceDisplay}</td>
                    <td style={{ padding: `${SP[2]} 0`, fontSize: F.sm, fontWeight: F.bold, color: C.ink, fontFamily: F.body }}>{fmt(item.total_price)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Historique des paiements ── */}
      <div style={{ padding: `${SP[3]} ${SP[4]}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: F.xs, fontWeight: F.bold, color: C.dim, textTransform: 'uppercase', letterSpacing: F.lsWider, marginBottom: SP[2], fontFamily: F.body }}>
          Historique des paiements
        </div>

        {payments === null ? (
          <div style={{ fontSize: F.sm, color: C.dim, fontFamily: F.body }}>Chargement…</div>
        ) : payments.length === 0 ? (
          <div style={{ fontSize: F.sm, color: C.dim, fontFamily: F.body }}>Aucun paiement enregistré</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SP[1] }}>
            {payments.map((p: any, i: number) => (
              <div key={p.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: `${SP[1.5]} ${SP[2]}`, borderRadius: R.sm, flexWrap: 'wrap', gap: SP[1.5],
                background: i === payments.length - 1 ? C.greenBg : C.surfaceEl,
                border: `1px solid ${i === payments.length - 1 ? C.greenBd : C.borderSub}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: SP[2], flexWrap: 'wrap' }}>
                  <span style={{ fontSize: F.sm, fontWeight: F.bold, color: C.green, fontFamily: F.body }}>+{fmt(p.amount)}</span>
                  {(() => {
                    const METHOD_LABELS: Record<string, string> = {
                      especes: 'Espèces', mobile_money: 'Mobile Money',
                      virement: 'Virement', cheque: 'Chèque', autre: 'Autre',
                    }
                    const METHOD_COLORS: Record<string, { bg: string; color: string; bd: string }> = {
                      especes:      { bg: C.greenBg,  color: C.green,  bd: C.greenBd },
                      mobile_money: { bg: C.blueBg,   color: C.blue,   bd: C.blueBd  },
                      virement:     { bg: C.purpleBg, color: C.purple, bd: C.purpleBd },
                      cheque:       { bg: C.goldBg,   color: C.gold,   bd: C.goldBd  },
                      autre:        { bg: C.surfaceSub, color: C.muted, bd: C.border },
                    }
                    const m = p.payment_method ?? 'especes'
                    const mc = METHOD_COLORS[m] ?? METHOD_COLORS.autre
                    return (
                      <span style={{
                        fontSize: F.xs, fontWeight: F.semibold, fontFamily: F.body,
                        padding: `1px ${SP[1.5]}`, borderRadius: R.full,
                        background: mc.bg, color: mc.color, border: `1px solid ${mc.bd}`,
                        letterSpacing: F.lsWide,
                      }}>{METHOD_LABELS[m] ?? m}</span>
                    )
                  })()}
                  {p.notes && <span style={{ fontSize: F.xs, color: C.dim, fontFamily: F.body }}>· {p.notes}</span>}
                </div>
                <div style={{ fontSize: F.xs, color: C.dim, fontFamily: F.body }}>
                  {new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {p.users?.full_name && ` · ${p.users.full_name}`}
                </div>
              </div>
            ))}
          </div>
        )}

        {canAdd && !showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            style={{
              marginTop: SP[2], padding: `${SP[1.5]} ${SP[3]}`,
              borderRadius: R.sm, border: `1.5px solid ${C.amber}`,
              background: 'transparent', color: C.amber,
              fontSize: F.sm, fontWeight: F.semibold, cursor: 'pointer',
              fontFamily: F.body, display: 'inline-flex', alignItems: 'center', gap: SP[1.5],
              transition: `background ${TR.fast}`,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = C.amberGlow)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Enregistrer un versement
          </button>
        )}

        {canAdd && showAdd && (
          <div style={{ marginTop: SP[2], padding: `${SP[3]} ${SP[3]}`, background: C.bg, borderRadius: R.md, border: `1.5px solid ${C.border}` }}>
            <div style={{ fontSize: F.sm, fontWeight: F.bold, color: C.ink, marginBottom: SP[2], fontFamily: F.body }}>Nouveau versement</div>

            {/* Link to unpaid schedule item */}
            {schedule && schedule.filter(s => !s.is_paid).length > 0 && (
              <div style={{ marginBottom: SP[2] }}>
                <div style={{ fontSize: F.xs, color: C.muted, fontFamily: F.body, marginBottom: SP[1] }}>Lier à une échéance (optionnel)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: SP[1] }}>
                  {schedule.filter(s => !s.is_paid).map(s => {
                    const active = scheduleItemId === s.id
                    return (
                      <button key={s.id} type="button"
                        onClick={() => {
                          if (active) { setScheduleItemId(null); setAddAmt('') }
                          else { setScheduleItemId(s.id); setAddAmt(String(s.amount)) }
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: SP[2],
                          padding: `${SP[1.5]} ${SP[2]}`, borderRadius: R.sm, textAlign: 'left',
                          border: `1.5px solid ${active ? C.amber : C.border}`,
                          background: active ? C.amberGlow : C.surfaceEl,
                          cursor: 'pointer', fontFamily: F.body,
                        }}>
                        <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${active ? C.amber : C.border}`, background: active ? C.amber : 'transparent', flexShrink: 0 }} />
                        <span style={{ fontSize: F.xs, color: C.muted, fontFamily: F.body }}>
                          {new Date(s.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          {s.label && ` · ${s.label}`}
                        </span>
                        <span style={{ marginLeft: 'auto', fontSize: F.xs, fontWeight: F.bold, color: active ? C.amber : C.ink, fontFamily: F.body }}>
                          {fmt(s.amount)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Payment method pills */}
            <div style={{ display: 'flex', gap: SP[1.5], marginBottom: SP[2], flexWrap: 'wrap' }}>
              {([
                { key: 'especes', label: 'Espèces' },
                { key: 'mobile_money', label: 'Mobile Money' },
                { key: 'virement', label: 'Virement' },
                { key: 'cheque', label: 'Chèque' },
              ] as const).map(m => {
                const active = addMethod === m.key
                return (
                  <button key={m.key} type="button"
                    onClick={() => setAddMethod(m.key)}
                    style={{
                      padding: `${SP[0.5]} ${SP[2]}`, borderRadius: R.full,
                      border: `1.5px solid ${active ? C.amber : C.border}`,
                      background: active ? C.amberGlow : 'transparent',
                      color: active ? C.amber : C.muted,
                      fontSize: F.xs, fontWeight: active ? F.bold : F.medium,
                      cursor: 'pointer', fontFamily: F.body,
                      transition: `all ${TR.fast}`,
                    }}
                  >{m.label}</button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: SP[2], flexWrap: 'wrap' }}>
              <input
                type="number" min="1" step="100"
                max={Math.max(0, Number(sale.total_amount) - Number(sale.amount_paid ?? 0))}
                value={addAmt}
                onChange={e => setAddAmt(e.target.value)}
                placeholder={`Montant (${currency})`}
                style={{ flex: '1 1 140px', padding: `${SP[2]} ${SP[2]}`, borderRadius: R.sm, border: `1.5px solid ${C.border}`, fontSize: F.sm, color: C.text, background: C.surfaceEl, outline: 'none', fontFamily: F.body, boxSizing: 'border-box' }}
              />
              <input
                type="text"
                value={addNotes}
                onChange={e => setAddNotes(e.target.value)}
                placeholder="Note (optionnel)"
                style={{ flex: '2 1 180px', padding: `${SP[2]} ${SP[2]}`, borderRadius: R.sm, border: `1.5px solid ${C.border}`, fontSize: F.sm, color: C.text, background: C.surfaceEl, outline: 'none', fontFamily: F.body, boxSizing: 'border-box' }}
              />
            </div>
            {addError && <div style={{ fontSize: F.sm, color: C.red, marginTop: SP[1.5], fontFamily: F.body }}>{addError}</div>}
            <div style={{ display: 'flex', gap: SP[2], marginTop: SP[2] }}>
              <button
                className="btn-amber"
                onClick={handleAdd}
                disabled={adding}
                style={{ borderRadius: R.sm, border: 'none', fontSize: F.sm, fontWeight: F.semibold, cursor: adding ? 'not-allowed' : 'pointer', fontFamily: F.body, display: 'inline-flex', alignItems: 'center', gap: SP[1.5], opacity: adding ? 0.7 : 1 }}>
                {adding ? <><span className="spinner" />Enregistrement…</> : 'Enregistrer'}
              </button>
              <button
                className="btn-ghost"
                onClick={() => { setShowAdd(false); setAddAmt(''); setAddNotes(''); setAddMethod('especes'); setAddError(null); setScheduleItemId(null) }}
                disabled={adding}
                style={{ borderRadius: R.sm, fontSize: F.sm, fontWeight: F.semibold, cursor: 'pointer', fontFamily: F.body }}>
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Échéancier ── */}
      {sale.status !== 'cancelled' && sale.status !== 'draft' && (() => {
        const canManage = ['owner', 'admin'].includes(profile.role)
        const today = new Date(); today.setHours(0,0,0,0)

        const handleAddScheduleItem = async () => {
          if (!schDate) { setSchError('Date requise.'); return }
          const amt = parseFloat(schAmount)
          if (!amt || amt <= 0) { setSchError('Montant invalide.'); return }
          setSchAdding(true); setSchError(null)
          const result = await createScheduleItem({ saleId: sale.id, dueDate: schDate, amount: amt, label: schLabel })
          setSchAdding(false)
          if (result?.error) { setSchError(result.error); return }
          await loadSchedule()
          setSchDate(''); setSchAmount(''); setSchLabel(''); setShowSchForm(false)
        }

        const handleDeleteScheduleItem = async (itemId: string) => {
          const result = await deleteScheduleItem(itemId)
          if (!result?.error) await loadSchedule()
        }

        return (
          <div style={{ padding: `${SP[3]} ${SP[4]}`, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SP[2] }}>
              <div style={{ fontSize: F.xs, fontWeight: F.bold, color: C.dim, textTransform: 'uppercase', letterSpacing: F.lsWider, fontFamily: F.body }}>
                Échéancier
              </div>
              {canManage && !showSchForm && (
                <button type="button"
                  onClick={() => setShowSchForm(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: SP[1], padding: `2px ${SP[2]}`, borderRadius: R.full, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: F.xs, fontWeight: F.semibold, cursor: 'pointer', fontFamily: F.body }}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  Ajouter
                </button>
              )}
            </div>

            {schedule === null ? (
              <div style={{ fontSize: F.sm, color: C.dim, fontFamily: F.body }}>Chargement…</div>
            ) : schedule.length === 0 && !showSchForm ? (
              <div style={{ fontSize: F.sm, color: C.dim, fontFamily: F.body }}>Aucune échéance planifiée</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: SP[1] }}>
                {schedule.map(s => {
                  const dueDate = new Date(s.due_date)
                  dueDate.setHours(0,0,0,0)
                  const isOverdue  = !s.is_paid && dueDate < today
                  const isUpcoming = !s.is_paid && dueDate >= today
                  const badgeBg    = s.is_paid ? C.greenBg  : isOverdue ? C.redBg    : C.goldBg
                  const badgeBd    = s.is_paid ? C.greenBd  : isOverdue ? C.redBd    : C.goldBd
                  const badgeColor = s.is_paid ? C.green    : isOverdue ? C.red      : C.gold
                  const badgeLabel = s.is_paid ? 'Encaissé' : isOverdue ? 'En retard' : 'À venir'

                  return (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', gap: SP[2], flexWrap: 'wrap',
                      padding: `${SP[1.5]} ${SP[2]}`, borderRadius: R.sm,
                      background: s.is_paid ? C.surfaceSub : isOverdue ? C.redBg : C.surfaceEl,
                      border: `1px solid ${s.is_paid ? C.borderSub : isOverdue ? C.redBd : C.border}`,
                    }}>
                      <span style={{ fontSize: F.xs, color: C.muted, fontFamily: F.mono, flexShrink: 0 }}>
                        {new Date(s.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span style={{ fontSize: F.sm, fontWeight: F.bold, color: s.is_paid ? C.muted : C.ink, fontFamily: F.body, flexShrink: 0, textDecoration: s.is_paid ? 'line-through' : 'none' }}>
                        {fmt(s.amount)}
                      </span>
                      {s.label && <span style={{ fontSize: F.xs, color: C.dim, fontFamily: F.body }}>{s.label}</span>}
                      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: SP[1], padding: `1px ${SP[1.5]}`, borderRadius: R.full, background: badgeBg, border: `1px solid ${badgeBd}`, fontSize: F.xs, fontWeight: F.bold, color: badgeColor, fontFamily: F.body, flexShrink: 0 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: badgeColor }} />
                        {badgeLabel}
                      </span>
                      {canManage && !s.is_paid && (
                        <button type="button"
                          onClick={() => handleDeleteScheduleItem(s.id)}
                          title="Supprimer cette échéance"
                          style={{ display: 'inline-flex', alignItems: 'center', padding: '2px', borderRadius: R.xs, border: 'none', background: 'transparent', color: C.dim, cursor: 'pointer', flexShrink: 0 }}>
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {canManage && showSchForm && (
              <div style={{ marginTop: SP[2], padding: `${SP[2]} ${SP[3]}`, background: C.bg, borderRadius: R.md, border: `1.5px solid ${C.border}` }}>
                <div style={{ display: 'flex', gap: SP[2], flexWrap: 'wrap', marginBottom: SP[1.5] }}>
                  <input type="date" value={schDate} onChange={e => setSchDate(e.target.value)}
                    style={{ flex: '1 1 130px', padding: `${SP[1.5]} ${SP[2]}`, borderRadius: R.sm, border: `1.5px solid ${C.border}`, fontSize: F.sm, color: C.text, background: C.surfaceEl, outline: 'none', fontFamily: F.body, boxSizing: 'border-box' }} />
                  <input type="number" min="1" step="100" value={schAmount} onChange={e => setSchAmount(e.target.value)}
                    placeholder={`Montant (${currency})`}
                    style={{ flex: '1 1 130px', padding: `${SP[1.5]} ${SP[2]}`, borderRadius: R.sm, border: `1.5px solid ${C.border}`, fontSize: F.sm, color: C.text, background: C.surfaceEl, outline: 'none', fontFamily: F.body, boxSizing: 'border-box' }} />
                  <input type="text" value={schLabel} onChange={e => setSchLabel(e.target.value)}
                    placeholder="Libellé (optionnel)"
                    style={{ flex: '2 1 160px', padding: `${SP[1.5]} ${SP[2]}`, borderRadius: R.sm, border: `1.5px solid ${C.border}`, fontSize: F.sm, color: C.text, background: C.surfaceEl, outline: 'none', fontFamily: F.body, boxSizing: 'border-box' }} />
                </div>
                {schError && <div style={{ fontSize: F.sm, color: C.red, marginBottom: SP[1.5], fontFamily: F.body }}>{schError}</div>}
                <div style={{ display: 'flex', gap: SP[2] }}>
                  <button className="btn-amber" onClick={handleAddScheduleItem} disabled={schAdding}
                    style={{ borderRadius: R.sm, border: 'none', fontSize: F.sm, fontWeight: F.semibold, cursor: schAdding ? 'not-allowed' : 'pointer', fontFamily: F.body, display: 'inline-flex', alignItems: 'center', gap: SP[1.5], opacity: schAdding ? 0.7 : 1 }}>
                    {schAdding ? <><span className="spinner" />Ajout…</> : 'Ajouter'}
                  </button>
                  <button className="btn-ghost" onClick={() => { setShowSchForm(false); setSchDate(''); setSchAmount(''); setSchLabel(''); setSchError(null) }} disabled={schAdding}
                    style={{ borderRadius: R.sm, fontSize: F.sm, fontWeight: F.semibold, cursor: 'pointer', fontFamily: F.body }}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Statut paiement ── */}
      {sale.payment_status && sale.status !== 'cancelled' && (() => {
        const pc      = PAYMENT_CONFIG[sale.payment_status]
        const paid    = parseFloat(sale.amount_paid ?? 0)
        const balance = Math.max(0, parseFloat(sale.total_amount) - paid)
        if (!pc) return null
        return (
          <div style={{ padding: `${SP[2]} ${SP[4]}`, borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: SP[2], padding: `${SP[2]} ${SP[3]}`, borderRadius: R.md, background: pc.bg, border: `1px solid ${pc.bd}` }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: SP[1.5], fontSize: F.xs, fontWeight: F.bold, color: pc.color, fontFamily: F.body }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: pc.color }} />{pc.label}
              </span>
              <span style={{ fontSize: F.sm, color: C.muted, fontFamily: F.body }}>
                Encaissé : <strong style={{ color: C.text }}>{fmt(paid)}</strong>
                {balance > 0 && (<> &nbsp;·&nbsp; Reste : <strong style={{ color: pc.color }}>{fmt(balance)}</strong></>)}
              </span>
            </div>
          </div>
        )
      })()}

      {/* ── Footer ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${SP[3]} ${SP[4]}`, flexWrap: 'wrap', gap: SP[2] }}>
        <div style={{ fontSize: F.sm, color: C.muted, display: 'flex', gap: SP[4], flexWrap: 'wrap', fontFamily: F.body }}>
          {sale.customer_phone && (
            <span style={{ display: 'flex', alignItems: 'center', gap: SP[1] }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2.5c0-.28.22-.5.5-.5h2l.75 2L4 5.5s.5 1.5 2.5 2.5l1.5-1.25 2 .75V9.5c0 .28-.22.5-.5.5C4.07 10 2 4.93 2 2.5Z" stroke={C.dim} strokeWidth="1.1"/></svg>
              {sale.customer_phone}
            </span>
          )}
          {sale.customer_cni && (
            <span style={{ display: 'flex', alignItems: 'center', gap: SP[1] }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="2.5" width="10" height="7" rx="1.5" stroke={C.dim} strokeWidth="1.1"/><path d="M3.5 5.5h2M3.5 7.5h3.5" stroke={C.dim} strokeWidth="1" strokeLinecap="round"/><circle cx="8.5" cy="6" r="1.2" stroke={C.dim} strokeWidth="1"/></svg>
              CNI : {sale.customer_cni}
            </span>
          )}
          {sale.notes && (
            <span style={{ display: 'flex', alignItems: 'center', gap: SP[1] }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="1.5" width="9" height="9" rx="1.5" stroke={C.dim} strokeWidth="1.1"/><path d="M3.5 4h5M3.5 6h5M3.5 8h3" stroke={C.dim} strokeWidth="1" strokeLinecap="round"/></svg>
              {sale.notes}
            </span>
          )}
          {!sale.customer_phone && !sale.notes && <span style={{ color: C.dim }}>Aucune note</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: SP[2], flexWrap: 'wrap' }}>
          <button
            onClick={() => printSaleReceipt(sale, ownerName, currency, companyName)}
            style={{ display: 'flex', alignItems: 'center', gap: SP[1.5], padding: `${SP[1.5]} ${SP[3]}`, background: 'transparent', color: C.muted, border: `1px solid ${C.border}`, borderRadius: R.sm, fontSize: F.xs, fontWeight: F.semibold, cursor: 'pointer', fontFamily: F.body }}>
            <IconPrint /> Imprimer
          </button>
          <button
            onClick={handlePdf}
            disabled={pdfLoading}
            title="Télécharger ou partager le PDF"
            style={{ display: 'flex', alignItems: 'center', gap: SP[1.5], padding: `${SP[1.5]} ${SP[3]}`, background: pdfLoading ? C.surfaceSub : C.amberGlow, color: pdfLoading ? C.muted : C.amber, border: `1px solid ${pdfLoading ? C.border : C.amber}`, borderRadius: R.sm, fontSize: F.xs, fontWeight: F.semibold, cursor: pdfLoading ? 'not-allowed' : 'pointer', fontFamily: F.body, opacity: pdfLoading ? 0.7 : 1, transition: 'all 0.14s' }}>
            {pdfLoading
              ? <><span className="spinner" style={{ width: 10, height: 10 }} />PDF…</>
              : <><IconPdf /> PDF</>}
          </button>
          {pdfError && (
            <span style={{ fontSize: F.xs, color: C.red, fontFamily: F.body }}>{pdfError}</span>
          )}
          <div style={{ fontSize: F.lg, fontWeight: F.xbold, color: C.ink, fontFamily: F.display, letterSpacing: F.lsTighter }}>{fmt(sale.total_amount)}</div>
        </div>
      </div>
    </div>
  )
}
