'use client'

import React, { useState, useMemo } from 'react'
import { useRouter }   from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PageLayout       from '@/components/PageLayout'
import type { BadgeCounts } from '@/lib/supabase/badge-counts'
import { fmtCurrency }  from '@/lib/format'
import { C, F, R, SP, SH } from '@/lib/design-system'
import { createReturn, validateReturn, cancelReturn } from './actions'

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtNum = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS: Record<string, { label: string; bg: string; color: string; bd: string }> = {
  pending:   { label: 'En attente',  bg: C.goldBg,    color: C.gold,   bd: C.goldBd   },
  validated: { label: 'Validé',      bg: C.greenBg,   color: C.green,  bd: C.greenBd  },
  cancelled: { label: 'Annulé',      bg: C.surfaceEl, color: C.dim,    bd: C.border   },
}

const RESOLUTION: Record<string, { label: string; bg: string; color: string }> = {
  refund:      { label: 'Remboursement', bg: C.blueBg,   color: C.blue   },
  credit_note: { label: 'Bon d\'avoir',  bg: C.purpleBg, color: C.purple },
}

// ── Local item state for create modal ─────────────────────────────────────────

interface DraftItem {
  saleItemId:  string
  productId:   string
  productName: string
  productType: string
  unitLabel:   string
  qtyInput:    string            // raw text input
  maxQty:      number            // max returnable
  unitPrice:   number            // price per m² (tile) or per unit (non-tile)
  tileAreaM2:  number | null
  tilePerCarton: number | null
  originalQty: number
}

function computeTotal(item: DraftItem): number {
  const qty = parseFloat(item.qtyInput) || 0
  if (qty <= 0) return 0
  if (item.tileAreaM2) return Math.round(item.unitPrice * qty * item.tileAreaM2)
  return Math.round(item.unitPrice * qty)
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReturnsClient({
  profile, currency, companyName = 'SGI',
  returns, deliveredSales, returnedQtyMap, badgeCounts,
}: {
  profile:         any
  currency:        string
  companyName?:    string
  returns:         any[]
  deliveredSales:  any[]
  returnedQtyMap:  Record<string, number>
  badgeCounts?:    BadgeCounts
}) {
  const router   = useRouter()
  const supabase = createClient()
  const fmt = (n: number) => fmtCurrency(n, currency)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Filters ──────────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState('all')
  const [search,       setSearch]       = useState('')

  const filtered = useMemo(() => returns.filter((r: any) => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      if (!r.return_number.toLowerCase().includes(q) &&
          !(r.sales?.sale_number ?? '').toLowerCase().includes(q) &&
          !(r.sales?.customer_name ?? '').toLowerCase().includes(q)) return false
    }
    return true
  }), [returns, filterStatus, search])

  // ── Expanded card ─────────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState<string | null>(null)

  // ── Action state ──────────────────────────────────────────────────────────
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError,   setActionError]   = useState<string | null>(null)

  const handleValidate = async (id: string) => {
    setActionLoading(id)
    setActionError(null)
    const res = await validateReturn(id)
    setActionLoading(null)
    if (res.error) { setActionError(res.error); return }
    router.refresh()
  }

  const handleCancel = async (id: string) => {
    setActionLoading(id)
    setActionError(null)
    const res = await cancelReturn(id)
    setActionLoading(null)
    if (res.error) { setActionError(res.error); return }
    router.refresh()
  }

  // ── Create modal ──────────────────────────────────────────────────────────
  const [showCreate,      setShowCreate]     = useState(false)
  const [saleSearch,      setSaleSearch]     = useState('')
  const [selectedSaleId,  setSelectedSaleId] = useState<string | null>(null)
  const [draftItems,      setDraftItems]     = useState<DraftItem[]>([])
  const [resolution,      setResolution]     = useState<'refund' | 'credit_note'>('credit_note')
  const [notes,           setNotes]          = useState('')
  const [createLoading,   setCreateLoading]  = useState(false)
  const [createError,     setCreateError]    = useState<string | null>(null)
  const [createSuccess,   setCreateSuccess]  = useState<string | null>(null)

  const filteredSales = useMemo(() => {
    if (!saleSearch.trim()) return deliveredSales.slice(0, 40)
    const q = saleSearch.toLowerCase()
    return deliveredSales
      .filter((s: any) =>
        s.sale_number.toLowerCase().includes(q) ||
        (s.customer_name ?? '').toLowerCase().includes(q)
      )
      .slice(0, 40)
  }, [deliveredSales, saleSearch])

  const selectedSale = useMemo(
    () => selectedSaleId ? deliveredSales.find((s: any) => s.id === selectedSaleId) : null,
    [deliveredSales, selectedSaleId]
  )

  const selectSale = (sale: any) => {
    setSelectedSaleId(sale.id)
    const items: DraftItem[] = (sale.sale_items ?? []).map((item: any) => {
      const alreadyReturned = returnedQtyMap[item.id] ?? 0
      const maxQty = Math.max(0, item.quantity_tiles - alreadyReturned)
      const isTile = item.products?.product_type === 'tile'
      return {
        saleItemId:   item.id,
        productId:    item.products?.id ?? '',
        productName:  item.products?.name ?? '—',
        productType:  item.products?.product_type ?? 'tile',
        unitLabel:    item.products?.unit_label ?? (isTile ? 'carreau' : 'unité'),
        qtyInput:     '',
        maxQty,
        unitPrice:    Number(item.unit_price_per_m2 ?? 0),
        tileAreaM2:   isTile ? (parseFloat(item.tile_area_m2_snapshot) || null) : null,
        tilePerCarton: isTile ? (parseInt(item.tiles_per_carton_snapshot) || null) : null,
        originalQty:  Number(item.quantity_tiles),
      }
    }).filter((i: DraftItem) => i.maxQty > 0)
    setDraftItems(items)
  }

  const updateQty = (saleItemId: string, val: string) => {
    setDraftItems(prev => prev.map(i =>
      i.saleItemId === saleItemId ? { ...i, qtyInput: val } : i
    ))
  }

  const totalReturnAmount = useMemo(
    () => draftItems.reduce((s, i) => s + computeTotal(i), 0),
    [draftItems]
  )

  const activeItems = useMemo(
    () => draftItems.filter(i => (parseFloat(i.qtyInput) || 0) > 0),
    [draftItems]
  )

  const resetCreate = () => {
    setSaleSearch('')
    setSelectedSaleId(null)
    setDraftItems([])
    setResolution('credit_note')
    setNotes('')
    setCreateError(null)
    setCreateSuccess(null)
    setShowCreate(false)
  }

  const handleCreate = async () => {
    setCreateError(null)
    if (!selectedSaleId) { setCreateError('Sélectionnez une vente.'); return }
    if (!activeItems.length) { setCreateError('Entrez au moins une quantité à retourner.'); return }

    for (const item of activeItems) {
      const qty = parseFloat(item.qtyInput)
      if (isNaN(qty) || qty <= 0) { setCreateError('Quantité invalide.'); return }
      if (qty > item.maxQty) {
        setCreateError(`Quantité trop élevée pour « ${item.productName} » (max : ${fmtNum(item.maxQty)}).`)
        return
      }
    }

    setCreateLoading(true)
    const res = await createReturn({
      saleId:     selectedSaleId,
      resolution,
      notes,
      items: activeItems.map(i => {
        const qty = parseFloat(i.qtyInput)
        return {
          saleItemId:  i.saleItemId,
          productId:   i.productId,
          qtyReturned: qty,
          unitPrice:   i.unitPrice,
          tileAreaM2:  i.tileAreaM2,
          totalPrice:  computeTotal(i),
        }
      }),
    })
    setCreateLoading(false)

    if (res.error) { setCreateError(res.error); return }
    setCreateSuccess(res.returnNumber ?? 'Retour créé.')
    setTimeout(() => {
      resetCreate()
      router.refresh()
    }, 1800)
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    padding: `${SP[2]} ${SP[3]}`, borderRadius: R.md,
    border: `1.5px solid ${C.border}`, fontSize: F.sm,
    color: C.text, outline: 'none', background: C.bg,
    fontFamily: F.body, width: '100%', boxSizing: 'border-box' as const,
  }

  // ── KPI summary ───────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const active = returns.filter(r => r.status !== 'cancelled')
    const pending   = active.filter(r => r.status === 'pending').length
    const validated = active.filter(r => r.status === 'validated').length
    const totalRefunds = active
      .filter(r => r.status === 'validated' && r.resolution === 'refund')
      .reduce((s: number, r: any) => s + Number(r.total_amount), 0)
    const totalAvoirs = active
      .filter(r => r.status === 'validated' && r.resolution === 'credit_note')
      .reduce((s: number, r: any) => s + Number(r.total_amount), 0)
    return { pending, validated, totalRefunds, totalAvoirs }
  }, [returns])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <PageLayout profile={profile} activeRoute="/returns" onLogout={handleLogout} badgeCounts={badgeCounts}>

      {/* ── Header ── */}
      <div className="fade-in-up page-header">
        <div>
          <p className="page-kicker">Gestion commerciale</p>
          <h1 className="page-title">Retours clients</h1>
          <p className="page-subtitle">
            {returns.filter(r => r.status !== 'cancelled').length} retour{returns.filter(r => r.status !== 'cancelled').length !== 1 ? 's' : ''} actif{returns.filter(r => r.status !== 'cancelled').length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn-amber"
          onClick={() => setShowCreate(true)}
          style={{ height: 40, padding: `0 ${SP[4]}`, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v11M1 6.5h11" stroke="#FAF5EE" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Nouveau retour
        </button>
      </div>

      {/* ── KPI bar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 24 }}>
        {[
          ['En attente',    String(kpis.pending),          C.gold,   kpis.pending > 0 ? C.goldBg  : C.surface],
          ['Validés',       String(kpis.validated),        C.green,  C.surface],
          ['Remboursements',fmt(kpis.totalRefunds),        C.blue,   C.surface],
          ['Bons d\'avoir', fmt(kpis.totalAvoirs),         C.purple, C.surface],
        ].map(([label, value, color, bg]) => (
          <div key={label} style={{
            background: bg, borderRadius: 10,
            border: `1px solid ${C.border}`, padding: '14px 16px',
            borderLeft: `3px solid ${color}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted,
              textTransform: 'uppercase', letterSpacing: '0.07em',
              marginBottom: 4, fontFamily: F.body }}>
              {label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color, fontFamily: F.body }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {([['all', 'Tous'], ['pending', 'En attente'], ['validated', 'Validés'], ['cancelled', 'Annulés']] as [string, string][])
          .map(([val, label]) => (
            <button key={val} onClick={() => setFilterStatus(val)}
              style={{ padding: '7px 14px', borderRadius: 100, fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: F.body,
                background: filterStatus === val ? C.amber : C.bg,
                color:      filterStatus === val ? '#FAF5EE' : C.muted,
                border: `1.5px solid ${filterStatus === val ? C.amber : C.border}` }}>
              {label}
            </button>
          ))}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="N° retour, N° vente, client…"
          style={{ ...inputStyle, maxWidth: 240 }} />
      </div>

      {/* ── Global action error ── */}
      {actionError && (
        <div style={{ background: C.redBg, border: `1px solid ${C.redBd}`, borderRadius: 8,
          padding: '10px 14px', color: C.red, fontSize: 13, fontFamily: F.body,
          marginBottom: 16 }}>
          {actionError}
          <button onClick={() => setActionError(null)}
            style={{ marginLeft: 12, background: 'none', border: 'none',
              color: C.red, cursor: 'pointer', fontSize: 13 }}>✕</button>
        </div>
      )}

      {/* ── Returns list ── */}
      {filtered.length === 0 ? (
        <div style={{ background: C.surface, borderRadius: 12,
          border: `1px solid ${C.border}`, padding: 48,
          textAlign: 'center', color: C.muted, fontSize: 14, fontFamily: F.body }}>
          Aucun retour{filterStatus !== 'all' ? ' dans ce statut' : ''}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((r: any) => {
            const st  = STATUS[r.status]   ?? STATUS.pending
            const res = RESOLUTION[r.resolution] ?? RESOLUTION.credit_note
            const isOpen = expanded === r.id
            const isPending = r.status === 'pending'
            const canAct = ['owner', 'manager'].includes(profile.role)

            return (
              <div key={r.id} style={{
                background: C.surface, borderRadius: 12,
                border: `1px solid ${C.border}`,
                borderLeft: `4px solid ${st.color}`,
                overflow: 'hidden',
              }}>
                {/* Card header */}
                <div
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  style={{ padding: '16px 20px', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.ink, fontFamily: F.body }}>
                        {r.return_number}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600,
                        padding: '2px 9px', borderRadius: 100,
                        background: st.bg, color: st.color, border: `1px solid ${st.bd}`,
                        fontFamily: F.body }}>
                        {st.label}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600,
                        padding: '2px 9px', borderRadius: 100,
                        background: res.bg, color: res.color, fontFamily: F.body }}>
                        {res.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, fontFamily: F.body }}>
                      Vente {r.sales?.sale_number ?? '—'} · {r.sales?.customer_name ?? 'Client inconnu'}
                    </div>
                    <div style={{ fontSize: 11, color: C.dim, fontFamily: F.body, marginTop: 2 }}>
                      Créé le {fmtDate(r.created_at)}
                      {r.validated_at && ` · Validé le ${fmtDate(r.validated_at)}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: C.ink, fontFamily: F.body }}>
                        {fmt(Number(r.total_amount))}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>
                        {(r.sale_return_items ?? []).length} article{(r.sale_return_items ?? []).length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      {isOpen
                        ? <path d="M2 8l4-4 4 4" stroke={C.amber} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        : <path d="M2 4l4 4 4-4" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      }
                    </svg>
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: '16px 20px' }}>
                    {/* Items table */}
                    <div style={{ overflowX: 'auto', marginBottom: 14 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: F.body }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                            {['Produit', 'Référence', 'Qté retournée', 'Montant'].map(h => (
                              <th key={h} style={{ textAlign: 'left', padding: '6px 10px 10px',
                                fontSize: 11, fontWeight: 700, color: C.muted,
                                textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(r.sale_return_items ?? []).map((item: any, i: number) => {
                            const isTile = item.products?.product_type === 'tile'
                            const m2 = isTile && item.tile_area_m2
                              ? (Number(item.qty_returned) * Number(item.tile_area_m2)).toFixed(2) + ' m²'
                              : null
                            return (
                              <tr key={item.id} style={{ borderBottom: i < (r.sale_return_items.length - 1) ? `1px solid ${C.borderSub}` : 'none' }}>
                                <td style={{ padding: '8px 10px', fontWeight: 600, color: C.ink }}>
                                  {item.products?.name ?? '—'}
                                </td>
                                <td style={{ padding: '8px 10px', color: C.muted, fontSize: 11 }}>
                                  {item.products?.reference_code ?? '—'}
                                </td>
                                <td style={{ padding: '8px 10px', color: C.text }}>
                                  {fmtNum(Number(item.qty_returned))} {item.products?.unit_label ?? (isTile ? 'car.' : 'unité')}
                                  {m2 && <span style={{ color: C.muted, fontSize: 11 }}> · {m2}</span>}
                                </td>
                                <td style={{ padding: '8px 10px', fontWeight: 700, color: C.ink, textAlign: 'right' }}>
                                  {fmt(Number(item.total_price))}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {r.notes && (
                      <div style={{ background: C.bg, borderRadius: 8, padding: '10px 12px',
                        fontSize: 12, color: C.muted, fontFamily: F.body, marginBottom: 14 }}>
                        <strong style={{ color: C.text }}>Notes : </strong>{r.notes}
                      </div>
                    )}

                    {/* Action buttons — owner/admin on pending returns */}
                    {isPending && canAct && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          disabled={actionLoading === r.id}
                          onClick={() => handleValidate(r.id)}
                          style={{ padding: '8px 18px', borderRadius: R.md, fontSize: 13, fontWeight: 700,
                            cursor: 'pointer', fontFamily: F.body,
                            background: C.green, color: '#fff', border: 'none',
                            opacity: actionLoading === r.id ? 0.6 : 1 }}>
                          {actionLoading === r.id ? 'Validation…' : 'Valider — restaurer le stock'}
                        </button>
                        <button
                          disabled={actionLoading === r.id}
                          onClick={() => handleCancel(r.id)}
                          style={{ padding: '8px 18px', borderRadius: R.md, fontSize: 13, fontWeight: 700,
                            cursor: 'pointer', fontFamily: F.body,
                            background: C.redBg, color: C.red,
                            border: `1.5px solid ${C.redBd}`,
                            opacity: actionLoading === r.id ? 0.6 : 1 }}>
                          Annuler
                        </button>
                      </div>
                    )}

                    {r.status === 'validated' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
                        color: C.green, fontFamily: F.body }}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                          <circle cx="7" cy="7" r="6" stroke={C.green} strokeWidth="1.5"/>
                          <path d="M4 7l2 2 4-4" stroke={C.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Stock restauré · Validé le {fmtDate(r.validated_at)}
                        {r.users__sale_returns_validated_by_fkey?.full_name &&
                          ` par ${r.users__sale_returns_validated_by_fkey.full_name}`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create return modal ── */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(26,15,6,0.50)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          padding: '32px 16px', overflowY: 'auto',
        }}>
          <div style={{
            background: C.surfaceEl, borderRadius: 16,
            width: '100%', maxWidth: 680,
            boxShadow: SH.xl,
            marginBottom: 32,
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: C.ink,
                fontFamily: F.body, margin: 0 }}>
                Nouveau retour client
              </h2>
              <button onClick={resetCreate}
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  color: C.muted, fontSize: 20, lineHeight: 1, padding: 4 }}>
                ✕
              </button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Sale search */}
              {!selectedSaleId ? (
                <>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: C.muted,
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                      display: 'block', marginBottom: 8, fontFamily: F.body }}>
                      Rechercher la vente livrée
                    </label>
                    <input
                      autoFocus
                      value={saleSearch}
                      onChange={e => setSaleSearch(e.target.value)}
                      placeholder="N° vente ou nom du client…"
                      style={{ ...inputStyle }} />
                  </div>

                  {filteredSales.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center',
                      color: C.muted, fontSize: 13, fontFamily: F.body }}>
                      {saleSearch ? 'Aucune vente livrée correspondante.' : 'Tapez pour rechercher…'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
                      {filteredSales.map((s: any) => (
                        <button key={s.id} onClick={() => selectSale(s)}
                          style={{ textAlign: 'left', background: C.surface,
                            border: `1.5px solid ${C.border}`, borderRadius: 10,
                            padding: '12px 16px', cursor: 'pointer', fontFamily: F.body,
                            transition: 'border-color 0.15s' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{s.sale_number}</span>
                              <span style={{ fontSize: 12, color: C.muted, marginLeft: 10 }}>
                                {s.customer_name ?? 'Client non renseigné'}
                              </span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>
                              {fmt(Number(s.total_amount))}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
                            {fmtDate(s.created_at)} · {(s.sale_items ?? []).length} article{(s.sale_items ?? []).length !== 1 ? 's' : ''}
                            {s.boutiques?.name ? ` · ${s.boutiques.name}` : ''}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Selected sale info */}
                  <div style={{ background: C.bg, borderRadius: 10,
                    border: `1px solid ${C.border}`, padding: '12px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, fontFamily: F.body }}>
                        {selectedSale?.sale_number}
                      </span>
                      <span style={{ fontSize: 12, color: C.muted, marginLeft: 10, fontFamily: F.body }}>
                        {selectedSale?.customer_name ?? '—'}
                      </span>
                    </div>
                    <button onClick={() => { setSelectedSaleId(null); setDraftItems([]) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 12, color: C.amber, fontFamily: F.body }}>
                      Changer
                    </button>
                  </div>

                  {/* Items */}
                  {draftItems.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center',
                      background: C.orangeBg, borderRadius: 10,
                      border: `1px solid ${C.orangeBd}`,
                      color: C.orange, fontSize: 13, fontFamily: F.body }}>
                      Tous les articles de cette vente ont déjà été retournés.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: C.muted,
                        textTransform: 'uppercase', letterSpacing: '0.07em',
                        fontFamily: F.body }}>
                        Articles à retourner
                      </label>
                      {draftItems.map(item => {
                        const qty    = parseFloat(item.qtyInput) || 0
                        const total  = computeTotal(item)
                        const isTile = !!item.tileAreaM2
                        const overMax = qty > item.maxQty
                        const m2hint  = isTile && qty > 0 && item.tileAreaM2
                          ? (qty * item.tileAreaM2).toFixed(2) + ' m²'
                          : null
                        const cartonHint = isTile && item.tilePerCarton && qty > 0
                          ? `${Math.floor(qty / item.tilePerCarton)} ctn` +
                            (qty % item.tilePerCarton > 0 ? ` + ${qty % item.tilePerCarton}` : '')
                          : null

                        return (
                          <div key={item.saleItemId} style={{
                            background: C.surface, borderRadius: 10,
                            border: `1px solid ${overMax ? C.redBd : C.border}`,
                            padding: '12px 14px',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between',
                              alignItems: 'flex-start', marginBottom: 10 }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700,
                                  color: C.ink, fontFamily: F.body }}>
                                  {item.productName}
                                </div>
                                <div style={{ fontSize: 11, color: C.muted, fontFamily: F.body, marginTop: 2 }}>
                                  Vendu : {fmtNum(item.originalQty)} {item.unitLabel}
                                  {returnedQtyMap[item.saleItemId]
                                    ? ` · Déjà retourné : ${fmtNum(returnedQtyMap[item.saleItemId])}`
                                    : ''}
                                  {' '}· Max retournable : <strong style={{ color: C.text }}>{fmtNum(item.maxQty)}</strong>
                                </div>
                              </div>
                              {total > 0 && (
                                <span style={{ fontSize: 13, fontWeight: 700,
                                  color: C.amber, fontFamily: F.body }}>
                                  {fmt(total)}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <input type="number" min="0" max={item.maxQty} step="1"
                                value={item.qtyInput}
                                onChange={e => updateQty(item.saleItemId, e.target.value)}
                                placeholder={`0 – ${fmtNum(item.maxQty)}`}
                                style={{ ...inputStyle, width: 130,
                                  borderColor: overMax ? C.red : C.border }} />
                              <span style={{ fontSize: 12, color: C.muted, fontFamily: F.body }}>
                                {item.unitLabel}
                              </span>
                              {(m2hint || cartonHint) && (
                                <span style={{ fontSize: 11, color: C.dim, fontFamily: F.body }}>
                                  {[cartonHint, m2hint].filter(Boolean).join(' · ')}
                                </span>
                              )}
                            </div>
                            {overMax && (
                              <div style={{ fontSize: 11, color: C.red, marginTop: 6, fontFamily: F.body }}>
                                Dépasse le maximum retournable ({fmtNum(item.maxQty)}).
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Resolution selector */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: C.muted,
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                      display: 'block', marginBottom: 8, fontFamily: F.body }}>
                      Mode de règlement du crédit
                    </label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {([
                        ['credit_note', 'Bon d\'avoir', C.purple, C.purpleBg],
                        ['refund',      'Remboursement espèces', C.blue, C.blueBg],
                      ] as [string, string, string, string][]).map(([val, label, color, bg]) => (
                        <button key={val} onClick={() => setResolution(val as any)}
                          style={{ flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                            fontFamily: F.body, fontSize: 13, fontWeight: 600,
                            background: resolution === val ? bg : C.bg,
                            color:      resolution === val ? color : C.muted,
                            border: `2px solid ${resolution === val ? color : C.border}` }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: C.dim, marginTop: 6, fontFamily: F.body }}>
                      {resolution === 'credit_note'
                        ? 'Le client reçoit un bon d\'avoir à valoir sur une prochaine commande.'
                        : 'Le client est remboursé en espèces au moment de la validation.'}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: C.muted,
                      textTransform: 'uppercase', letterSpacing: '0.07em',
                      display: 'block', marginBottom: 6, fontFamily: F.body }}>
                      Notes (motif, état des articles…)
                    </label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)}
                      rows={2} placeholder="Ex : Carrelage cassé lors du transport, client restitue 2 cartons."
                      style={{ ...inputStyle, resize: 'vertical' }} />
                  </div>

                  {/* Total */}
                  {totalReturnAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end',
                      alignItems: 'center', gap: 14,
                      background: C.amberGlow, borderRadius: 10,
                      border: `1px solid ${C.amber}`, padding: '12px 16px' }}>
                      <span style={{ fontSize: 13, color: C.muted, fontFamily: F.body }}>
                        Total à {resolution === 'refund' ? 'rembourser' : 'créditer'}
                      </span>
                      <span style={{ fontSize: 22, fontWeight: 900, color: C.amber, fontFamily: F.body }}>
                        {fmt(totalReturnAmount)}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Feedback */}
              {createError && (
                <div style={{ background: C.redBg, borderRadius: 8,
                  border: `1px solid ${C.redBd}`,
                  padding: '10px 14px', color: C.red, fontSize: 13, fontFamily: F.body }}>
                  {createError}
                </div>
              )}
              {createSuccess && (
                <div style={{ background: C.greenBg, borderRadius: 8,
                  border: `1px solid ${C.greenBd}`,
                  padding: '10px 14px', color: C.green, fontSize: 13,
                  fontFamily: F.body, fontWeight: 600 }}>
                  Retour {createSuccess} créé. En attente de validation.
                </div>
              )}

              {/* Footer buttons */}
              {!createSuccess && selectedSaleId && draftItems.length > 0 && (
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end',
                  paddingTop: 4, borderTop: `1px solid ${C.border}` }}>
                  <button onClick={resetCreate}
                    style={{ padding: '9px 20px', borderRadius: R.md, fontSize: 13,
                      fontWeight: 600, cursor: 'pointer', fontFamily: F.body,
                      background: C.bg, color: C.muted,
                      border: `1.5px solid ${C.border}` }}>
                    Annuler
                  </button>
                  <button onClick={handleCreate}
                    disabled={createLoading || activeItems.length === 0}
                    style={{ padding: '9px 24px', borderRadius: R.md, fontSize: 13,
                      fontWeight: 700, cursor: 'pointer', fontFamily: F.body,
                      background: C.amber, color: '#FAF5EE', border: 'none',
                      opacity: (createLoading || activeItems.length === 0) ? 0.6 : 1 }}>
                    {createLoading ? 'Création…' : 'Créer le retour'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </PageLayout>
  )
}
