'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter }                    from 'next/navigation'
import { createClient }                 from '@/lib/supabase/client'
import { updateOrderStatus, submitStockRequest } from './actions'
import PageLayout         from '@/components/PageLayout'
import type { BadgeCounts } from '@/lib/supabase/badge-counts'
import {
  LOW_STOCK_CARTONS, CRITICAL_STOCK_CARTONS,
  LOW_STOCK_UNITS,   CRITICAL_STOCK_UNITS,
} from '@/lib/constants'
import { fmtCurrency } from '@/lib/format'
import { pluralize }   from '@/lib/pluralize'

import { C, F, R, SP, SH, TR, Z } from '@/lib/design-system'

const fmtNum = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(n)
const fmtM2  = (n: number) =>
  new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(n) + ' m²'

const ORDER_STATUS = {
  confirmed:  { label: 'Nouvelle',        bg: C.blueBg,    color: C.blue,   dot: C.blue,   bd: C.blueBd   },
  preparing:  { label: 'En préparation',  bg: C.orangeBg,  color: C.orange, dot: C.orange, bd: C.orangeBd },
  ready:      { label: 'Prête',           bg: C.greenBg,   color: C.green,  dot: C.green,  bd: C.greenBd  },
  delivered:  { label: 'Livrée',          bg: C.surfaceEl, color: C.dim,    dot: C.dim,    bd: C.border   },
  cancelled:  { label: 'Annulée',         bg: C.redBg,     color: C.red,    dot: C.red,    bd: C.redBd    },
}

const REQUEST_STATUS = {
  pending:  { label: 'En attente', bg: C.goldBg,  color: C.gold,  bd: C.goldBd  },
  approved: { label: 'Approuvée', bg: C.greenBg, color: C.green, bd: C.greenBd },
  rejected: { label: 'Rejetée',   bg: C.redBg,   color: C.red,   bd: C.redBd   },
}

type Tab = 'orders' | 'stock' | 'requests'

export default function WarehouseClient({
  profile, currency, companyName = 'SGI', orders, deliveredOrders,
  stockLevels, products, myRequests, badgeCounts,
}: {
  profile:         any
  currency:        string
  companyName?:    string
  orders:          any[]
  deliveredOrders: any[]
  stockLevels:     any[]
  products:        any[]
  myRequests:      any[]
  badgeCounts?:    BadgeCounts
}) {
  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const fmt = (n: number) => fmtCurrency(n, currency)

  // ── Real-time: refresh when orders, sales, or stock_requests change ─────────
  useEffect(() => {
    const channel = supabase
      .channel('warehouse-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },        () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' },         () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_requests' }, () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [activeTab,     setTab]       = useState<Tab>('orders')
  const [expandedOrder, setExpanded]  = useState<string | null>(null)
  const [loadingOrder,  setLoadingOrd] = useState<string | null>(null)
  const [confirmDelivery, setConfirm] = useState<string | null>(null)

  // Stock request form state
  const [reqProduct,        setReqProduct]        = useState('')
  const [reqProductSearch,  setReqProductSearch]  = useState('')
  const [reqProductOpen,    setReqProductOpen]    = useState(false)
  const [reqType,           setReqType]           = useState<'stock_in' | 'correction'>('stock_in')
  const [reqCorrectionSign, setReqCorrectionSign] = useState<'negative' | 'positive'>('negative')
  const [reqCartons,        setReqCartons]        = useState('')
  const [reqLoose,          setReqLoose]          = useState('')
  const [reqQty,            setReqQty]            = useState('')   // non-tile quantity
  const [reqJustif,         setReqJustif]         = useState('')
  const [reqLoading,        setReqLoading]        = useState(false)
  const [reqError,          setReqError]          = useState<string | null>(null)
  const [reqSuccess,        setReqSuccess]        = useState(false)
  const [stockSearch,       setStockSearch]       = useState('')

  // Product lookup map (id → product row) for type-aware display
  const productMap = useMemo(
    () => new Map(products.map((p: any) => [p.id, p])),
    [products]
  )

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Order status update ────────────────────────────────────────────────
  const handleOrderAction = async (
    orderId: string,
    newStatus: 'preparing' | 'ready' | 'delivered'
  ) => {
    if (newStatus === 'delivered') {
      setConfirm(orderId)
      return
    }
    setLoadingOrd(orderId)
    await updateOrderStatus(orderId, newStatus)
    setLoadingOrd(null)
    router.refresh()
  }

  const handleConfirmDelivery = async () => {
    if (!confirmDelivery) return
    setLoadingOrd(confirmDelivery)
    await updateOrderStatus(confirmDelivery, 'delivered')
    setConfirm(null)
    setLoadingOrd(null)
    router.refresh()
  }

  // ── HTML escaping helper (prevents XSS in printed windows) ───────────────
  const escHtml = (s: string | null | undefined): string =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

  // ── Print preparation sheet ────────────────────────────────────────────
  const printPreparationSheet = (order: any) => {
    const sale = order.sales
    const items = sale?.sale_items ?? []
    const now = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

    const rows = items.map((item: any) => {
      const isTile  = !!item.tile_area_m2_snapshot && !!item.tiles_per_carton_snapshot
      const unitLbl = escHtml(item.products?.unit_label ?? (isTile ? 'carreau' : 'unité'))
      let qtyText: string
      let detailText: string
      if (isTile) {
        const tileArea    = parseFloat(item.tile_area_m2_snapshot)
        const tpc         = parseInt(item.tiles_per_carton_snapshot)
        const m2          = item.quantity_tiles * tileArea
        const fullCartons = Math.floor(item.quantity_tiles / tpc)
        const loose       = item.quantity_tiles % tpc
        const loosePart   = loose > 0 ? ` <span style="color:#D97706;font-weight:700">+ ${loose} car.</span>` : ''
        qtyText    = `<strong>${fullCartons}</strong> carton${fullCartons !== 1 ? 's' : ''}${loosePart}`
        detailText = `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(m2)} m² · ${new Intl.NumberFormat('fr-FR').format(item.quantity_tiles)} carreaux`
      } else {
        qtyText    = `<strong>${new Intl.NumberFormat('fr-FR').format(item.quantity_tiles)}</strong> ${pluralize(unitLbl, item.quantity_tiles)}`
        detailText = '—'
      }
      return `
        <tr>
          <td>
            <div style="font-weight:600">${escHtml(item.products?.name)}</div>
            <div style="font-size:11px;color:#64748B;margin-top:2px">${escHtml(item.products?.reference_code)}</div>
          </td>
          <td style="text-align:center;font-size:14px">${qtyText}</td>
          <td style="color:#64748B;font-size:12px">${detailText}</td>
          <td style="text-align:center">
            <span style="display:inline-block;width:20px;height:20px;border:2px solid #94A3B8;border-radius:4px">&nbsp;</span>
          </td>
        </tr>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=800"/>
  <title>Fiche de préparation — ${escHtml(order.order_number)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0 }
    body { font-family: system-ui,-apple-system,'Segoe UI',sans-serif; color: #0F172A; padding: 32px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #0F172A; }
    .logo { font-size: 22px; font-weight: 800; letter-spacing: -0.03em; color: #0F172A; font-family: Georgia, serif; }
    .logo span { color: #2563EB; }
    .meta { font-size: 11px; color: #64748B; text-align: right; line-height: 1.8 }
    .order-id { font-size: 26px; font-weight: 800; color: #0F172A; letter-spacing: -0.02em; margin-bottom: 4px }
    .client-block { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; }
    .client-block .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #94A3B8; margin-bottom: 4px; }
    .client-block .value { font-size: 14px; font-weight: 700; color: #0F172A; }
    .client-block .sub { font-size: 12px; color: #475569; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94A3B8; padding: 10px 16px 10px 0; border-bottom: 2px solid #0F172A; }
    th:nth-child(2) { text-align: center; }
    th:last-child { text-align: center; width: 60px; }
    td { padding: 14px 16px 14px 0; border-bottom: 1px solid #E2E8F0; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    .footer { display: flex; gap: 24px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #E2E8F0; }
    .sig-block { flex: 1; }
    .sig-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94A3B8; margin-bottom: 8px; }
    .sig-line { border-bottom: 1px solid #CBD5E1; height: 40px; margin-bottom: 6px; }
    .sig-sub { font-size: 11px; color: #94A3B8; }
    .notes-block { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px; padding: 10px 14px; margin-bottom: 20px; font-size: 12px; color: #92400E; }
    .back-btn { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 20px; padding: 8px 16px; background: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 6px; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer; font-family: system-ui,-apple-system,'Segoe UI',sans-serif; }
    @media print { @page { margin: 20mm; } .back-btn { display: none !important; } }
  </style>
</head>
<body>
  <button class="back-btn" onclick="window.close()">← Retour à l'application</button>
  <div class="header">
    <div>
      <div class="logo">${escHtml(companyName)}</div>
      <div style="font-size:11px;color:#64748B;margin-top:2px">Fiche de préparation de commande</div>
    </div>
    <div class="meta">
      <div>Imprimée le ${now}</div>
      <div>Entrepôt Central</div>
    </div>
  </div>

  <div class="order-id">${escHtml(order.order_number)}</div>
  <div style="font-size:12px;color:#64748B;margin-bottom:20px">
    Vente ${escHtml(sale?.sale_number) || '—'} · ${new Date(order.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
  </div>

  <div class="client-block">
    <div class="label">Client</div>
    <div class="value">${escHtml(sale?.customer_name) || 'Client anonyme'}</div>
    <div class="sub">
      ${sale?.customer_phone ? escHtml(sale.customer_phone) + ' · ' : ''}
      ${escHtml(sale?.boutiques?.name)} · Vendeur : ${escHtml(sale?.users?.full_name) || '—'}
    </div>
  </div>

  ${sale?.notes ? `<div class="notes-block"><strong>Note vendeur :</strong> ${escHtml(sale.notes)}</div>` : ''}

  <table>
    <thead>
      <tr>
        <th>Produit</th>
        <th style="text-align:center">Quantité à prélever</th>
        <th>Détail</th>
        <th style="text-align:center">Prélevé</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">
    <div class="sig-block" style="max-width:260px">
      <div class="sig-label">Préparé par</div>
      <div class="sig-line"></div>
      <div class="sig-sub">Nom &amp; signature</div>
    </div>
  </div>
</body>
</html>`

    const w = window.open('', '_blank', 'width=800,height=900')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 400)
  }

  // ── Stock request submit ───────────────────────────────────────────────
  const handleStockRequest = async () => {
    if (!reqProduct || !reqJustif || reqJustif.trim().length < 10) return
    setReqLoading(true)
    setReqError(null)

    const prod    = productMap.get(reqProduct)
    const isTile  = !prod || prod.product_type === 'tile'

    let delta: number
    if (isTile) {
      const tpc     = prod ? parseInt(prod.tiles_per_carton) : 1
      const cartons = parseInt(reqCartons) || 0
      const loose   = parseInt(reqLoose)   || 0
      delta = (cartons * tpc) + loose
    } else {
      delta = parseInt(reqQty) || 0
    }

    if (delta === 0) {
      setReqError('La quantité doit être supérieure à zéro.')
      setReqLoading(false)
      return
    }

    const stockRow   = stockLevels.find((s: any) => s.product_id === reqProduct)
    const stockBefore = stockRow ? parseInt(stockRow.total_tiles) : 0
    const finalDelta  = reqType === 'correction'
      ? (reqCorrectionSign === 'negative' ? -Math.abs(delta) : Math.abs(delta))
      : delta

    const result = await submitStockRequest({
      productId:          reqProduct,
      requestType:        reqType,
      quantityTilesDelta: finalDelta,
      justification:      reqJustif.trim(),
      stockBeforeTiles:   stockBefore,
    })

    setReqLoading(false)
    if (result.error) { setReqError(result.error); return }

    setReqSuccess(true)
    setReqProduct(''); setReqProductSearch('')
    setReqCartons(''); setReqLoose(''); setReqQty(''); setReqJustif('')
    setTimeout(() => setReqSuccess(false), 4000)
    router.refresh()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: `1.5px solid ${C.border}`, fontSize: 13,
    color: C.ink, outline: 'none',
    boxSizing: 'border-box',
    background: C.surface, fontFamily: F.body,
  }

  const TAB_LABELS: Record<Tab, string> = {
    orders: 'Commandes',
    stock: 'Stock',
    requests: 'Demandes',
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <PageLayout profile={profile} activeRoute="/warehouse" onLogout={handleLogout} badgeCounts={badgeCounts}>

        {/* Header */}
        <div className="fade-in-up page-header" style={{ marginBottom: SP[6] }}>
          <div>
            <p className="page-kicker">Logistique</p>
            <h1 className="page-title">Entrepôt</h1>
            <p className="page-subtitle">
              {orders.length} commande{orders.length !== 1 ? 's' : ''} active{orders.length !== 1 ? 's' : ''} en cours
            </p>
          </div>
        </div>

        {/* Tabs — pill/segment control */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 24,
          background: C.bg, padding: 4, borderRadius: 100,
          width: 'fit-content', border: `1px solid ${C.border}` }}>
          {([
            ['orders',   'Commandes',  orders.length],
            ['stock',    'Stock',       null],
            ['requests', 'Demandes',   myRequests.filter(
              r => r.status === 'pending').length],
          ] as [Tab, string, number | null][]).map(([id, label, count]) => (
            <button key={id} onClick={() => setTab(id)}
              className="seg-btn"
              style={{
                padding: '8px 20px', borderRadius: 100,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: activeTab === id ? C.surface : 'transparent',
                color: activeTab === id ? C.ink : C.muted,
                border: 'none', display: 'flex',
                alignItems: 'center', gap: 6,
                fontFamily: F.body,
                boxShadow: activeTab === id ? '0 1px 4px rgba(60,30,10,0.10)' : 'none',
              }}>
              {label}
              {count !== null && count > 0 && (
                <span style={{
                  background: activeTab === id ? C.amber : C.border,
                  color: activeTab === id ? '#FAF5EE' : C.muted,
                  fontSize: 10, fontWeight: 700,
                  padding: '1px 6px', borderRadius: 100,
                }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── ORDERS TAB ── */}
        {activeTab === 'orders' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {orders.length === 0 && (
              <div style={{ background: C.surface, borderRadius: 14,
                border: `1px solid ${C.border}`,
                boxShadow: '0 1px 4px rgba(60,30,10,0.04)',
                padding: '52px 32px', textAlign: 'center' }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: C.greenBg, border: `1.5px solid #A7F3D0`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4 10-10" stroke={C.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 6, fontFamily: F.body }}>
                  Tout est à jour
                </div>
                <div style={{ fontSize: 13, color: C.muted, fontFamily: F.body }}>
                  Aucune commande active en attente de traitement.
                </div>
              </div>
            )}

            {orders.map((order: any) => {
              const sale    = order.sales
              const cfg     = ORDER_STATUS[
                order.status as keyof typeof ORDER_STATUS
              ] ?? ORDER_STATUS.confirmed
              const isOpen  = expandedOrder === order.id

              return (
                <div key={order.id} style={{
                  background: C.surface, borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  overflow: 'hidden',
                }}>
                  {/* Order header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start',
                    gap: 14, padding: '16px 20px',
                    cursor: 'pointer', flexWrap: 'wrap',
                    borderLeft: `4px solid ${cfg.dot}` }}
                    onClick={() => setExpanded(
                      isOpen ? null : order.id
                    )}>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                        <span className="tag-mono" style={{
                          display: 'inline-block',
                          background: cfg.bg, color: cfg.color,
                          border: `1px solid ${cfg.dot}44`,
                          borderRadius: 6, padding: '3px 10px',
                          fontSize: 12.5, fontWeight: 800, fontFamily: F.body,
                        }}>
                          {order.order_number}
                        </span>
                        {/* Status pill with dot */}
                        <span style={{ display: 'inline-flex', alignItems: 'center',
                          gap: 5, fontSize: 11, fontWeight: 600,
                          padding: '3px 10px', borderRadius: 100,
                          background: C.bg, color: C.muted,
                          border: `1px solid ${C.border}`,
                          fontFamily: F.body }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%',
                            background: cfg.dot, flexShrink: 0 }} />
                          {cfg.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 13.5, color: C.ink, fontFamily: F.body, marginBottom: 3 }}>
                        <strong>{sale?.customer_name ?? 'Client anonyme'}</strong>
                        {sale?.customer_phone && <span style={{ color: C.muted, fontWeight: 400 }}> · {sale.customer_phone}</span>}
                        {' '}
                        <span style={{ color: C.muted, fontWeight: 400 }}>— {sale?.boutiques?.name}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: C.muted, fontFamily: F.body, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.2"/><path d="M5.5 3v3l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                        {new Date(order.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        {' · '}{sale?.users?.full_name}
                      </div>
                    </div>

                    {/* Action button */}
                    <div style={{ display: 'flex', gap: 8,
                      alignItems: 'center', flexWrap: 'wrap' }}
                      onClick={e => e.stopPropagation()}>
                      {order.status === 'confirmed' && (
                        <button
                          className="btn-orange"
                          onClick={() => handleOrderAction(order.id, 'preparing')}
                          disabled={loadingOrder === order.id}
                          style={{
                            padding: '9px 16px', background: C.orange,
                            color: C.surface, border: 'none', borderRadius: 7,
                            fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', fontFamily: F.body,
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                          }}>
                          {loadingOrder === order.id ? (
                            <><span className="spinner" />En cours…</>
                          ) : (
                            <><svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 1.5l6 3.5-6 3.5V1.5z"/></svg>Commencer</>
                          )}
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button
                          className="btn-green"
                          onClick={() => handleOrderAction(order.id, 'ready')}
                          disabled={loadingOrder === order.id}
                          style={{
                            padding: '9px 16px', background: C.green,
                            color: C.surface, border: 'none', borderRadius: 7,
                            fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', fontFamily: F.body,
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                          }}>
                          {loadingOrder === order.id ? (
                            <><span className="spinner" />En cours…</>
                          ) : (
                            <><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>Marquer prête</>
                          )}
                        </button>
                      )}
                      {order.status === 'ready' && (
                        <button
                          className="btn-amber"
                          onClick={() => handleOrderAction(order.id, 'delivered')}
                          disabled={loadingOrder === order.id}
                          style={{
                            padding: '9px 16px', borderRadius: R.md,
                            fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', fontFamily: F.body,
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            opacity: loadingOrder === order.id ? 0.7 : 1,
                          }}>
                          {loadingOrder === order.id ? (
                            <><span className="spinner" />En cours…</>
                          ) : 'Confirmer livraison'}
                        </button>
                      )}
                      {/* Print prep sheet */}
                      <button
                        className="btn-icon"
                        onClick={() => printPreparationSheet(order)}
                        title="Imprimer la fiche de préparation"
                        style={{
                          padding: '9px 11px', background: 'transparent',
                          color: C.muted, border: `1px solid ${C.border}`,
                          borderRadius: 7, fontSize: 12,
                          cursor: 'pointer', fontFamily: F.body,
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <rect x="1" y="4" width="11" height="7" rx="1.5" stroke={C.muted} strokeWidth="1.2"/>
                          <path d="M3.5 4V2.5A.5.5 0 0 1 4 2h5a.5.5 0 0 1 .5.5V4" stroke={C.muted} strokeWidth="1.2"/>
                          <path d="M3.5 9.5h6M3.5 7.5h4" stroke={C.muted} strokeWidth="1" strokeLinecap="round"/>
                        </svg>
                        Imprimer
                      </button>
                      <span style={{ color: C.muted, paddingLeft: 4, display: 'flex' }}>
                        {isOpen
                          ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 9l4-4 4 4" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        }
                      </span>
                    </div>
                  </div>

                  {/* Order detail — expanded */}
                  {isOpen && sale?.sale_items && (
                    <div style={{ borderTop: `1px solid ${C.border}`,
                      padding: '16px 20px',
                      background: C.bg, overflowX: 'auto' }}>
                      <div style={{ fontSize: 11, fontWeight: 600,
                        color: C.muted, textTransform: 'uppercase',
                        letterSpacing: '0.06em', marginBottom: 12,
                        fontFamily: F.body }}>
                        Détail de la commande
                      </div>
                      <table style={{ width: '100%',
                        borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            {['Produit', 'Référence', 'Quantité', 'Détail'].map(h => (
                              <th key={h} style={{ textAlign: 'left',
                                fontSize: 11, fontWeight: 600,
                                color: C.muted, textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                padding: '0 12px 8px 0',
                                borderBottom: `2px solid ${C.border}`,
                                fontFamily: F.body }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sale.sale_items.map((item: any) => {
                            const isTile = !!item.tile_area_m2_snapshot && !!item.tiles_per_carton_snapshot
                            const unitLbl = item.products?.unit_label ?? (isTile ? 'carreau' : 'unité')
                            let detail: React.ReactNode
                            if (isTile) {
                              const tpc = parseInt(item.tiles_per_carton_snapshot)
                              const tileArea = parseFloat(item.tile_area_m2_snapshot)
                              const m2 = item.quantity_tiles * tileArea
                              const fullCartons = Math.floor(item.quantity_tiles / tpc)
                              const loose = item.quantity_tiles % tpc
                              detail = (
                                <>
                                  {fullCartons} carton{fullCartons !== 1 ? 's' : ''}
                                  {loose > 0 && <span style={{ color: C.orange, fontSize: 11 }}> + {loose}</span>}
                                  {' · '}{fmtM2(m2)}
                                </>
                              )
                            } else {
                              detail = `${fmtNum(item.quantity_tiles)} ${pluralize(unitLbl, item.quantity_tiles)}`
                            }
                            return (
                              <tr key={item.id}>
                                <td style={{ padding: '10px 12px 10px 0',
                                  fontSize: 13, fontWeight: 600,
                                  color: C.ink, fontFamily: F.body }}>
                                  {item.products?.name}
                                </td>
                                <td style={{ padding: '10px 12px 10px 0',
                                  fontSize: 11, color: C.muted, fontFamily: F.body }}>
                                  {item.products?.reference_code}
                                </td>
                                <td style={{ padding: '10px 12px 10px 0',
                                  fontSize: 13, color: C.ink, fontFamily: F.body }}>
                                  {fmtNum(item.quantity_tiles)} {isTile ? 'car.' : pluralize(unitLbl, item.quantity_tiles)}
                                </td>
                                <td style={{ padding: '10px 12px 10px 0',
                                  fontSize: 13, fontWeight: 700,
                                  color: C.ink, fontFamily: F.body }}>
                                  {detail}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {sale.notes && (
                        <div style={{ marginTop: 12, padding: '10px 12px',
                          background: C.goldBg, borderRadius: 7,
                          fontSize: 12, color: C.gold,
                          border: `1px solid #e5d080`, fontFamily: F.body }}>
                          Note vendeur : {sale.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Recent delivered */}
            {deliveredOrders.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600,
                  color: C.muted, textTransform: 'uppercase',
                  letterSpacing: '0.08em', marginBottom: 10, fontFamily: F.body }}>
                  Récemment livrées
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {deliveredOrders.map((o: any) => {
                    const isOpen = expandedOrder === o.id
                    return (
                      <div key={o.id} style={{ background: C.surface,
                        borderRadius: 8, border: `1px solid ${C.border}`,
                        overflow: 'hidden', opacity: 0.85 }}>
                        <div
                          onClick={() => setExpanded(isOpen ? null : o.id)}
                          style={{ padding: '12px 16px', display: 'flex',
                            justifyContent: 'space-between', alignItems: 'center',
                            borderLeft: `4px solid ${C.muted}`, cursor: 'pointer' }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 700,
                              color: C.ink, fontFamily: F.body }}>
                              {o.order_number}
                            </span>
                            <span style={{ fontSize: 12, color: C.muted,
                              marginLeft: 10, fontFamily: F.body }}>
                              {o.sales?.customer_name ?? 'Client anonyme'} ·{' '}
                              {o.sales?.boutiques?.name}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center',
                              gap: 5, fontSize: 11, fontWeight: 600,
                              padding: '3px 10px', borderRadius: 100,
                              background: C.surfaceEl, color: C.muted,
                              border: `1px solid ${C.border}`, fontFamily: F.body }}>
                              <span style={{ width: 5, height: 5, borderRadius: '50%',
                                background: C.muted, flexShrink: 0 }} />
                              Livrée
                            </span>
                            <span style={{ color: C.muted, display: 'flex' }}>
                              {isOpen
                                ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 9l4-4 4 4" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              }
                            </span>
                          </div>
                        </div>

                        {isOpen && o.sales?.sale_items && (
                          <div style={{ borderTop: `1px solid ${C.border}`,
                            padding: '14px 16px', background: C.bg, overflowX: 'auto' }}>
                            <div style={{ fontSize: 11, fontWeight: 600,
                              color: C.muted, textTransform: 'uppercase',
                              letterSpacing: '0.06em', marginBottom: 10, fontFamily: F.body }}>
                              Détail livré
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  {['Produit', 'Référence', 'Quantité', 'Détail'].map(h => (
                                    <th key={h} style={{ textAlign: 'left',
                                      fontSize: 11, fontWeight: 600,
                                      color: C.muted, textTransform: 'uppercase',
                                      letterSpacing: '0.05em',
                                      padding: '0 12px 8px 0',
                                      borderBottom: `2px solid ${C.border}`,
                                      fontFamily: F.body }}>
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {o.sales.sale_items.map((item: any) => {
                                  const isTile = !!item.tile_area_m2_snapshot && !!item.tiles_per_carton_snapshot
                                  const unitLbl = item.products?.unit_label ?? (isTile ? 'carreau' : 'unité')
                                  let detail: React.ReactNode
                                  if (isTile) {
                                    const tpc = parseInt(item.tiles_per_carton_snapshot)
                                    const tileArea = parseFloat(item.tile_area_m2_snapshot)
                                    const m2 = item.quantity_tiles * tileArea
                                    const fullCartons = Math.floor(item.quantity_tiles / tpc)
                                    const loose = item.quantity_tiles % tpc
                                    detail = (
                                      <>
                                        {fullCartons} carton{fullCartons !== 1 ? 's' : ''}
                                        {loose > 0 && <span style={{ color: C.orange, fontSize: 11 }}> + {loose}</span>}
                                        {' · '}{fmtM2(m2)}
                                      </>
                                    )
                                  } else {
                                    detail = `${fmtNum(item.quantity_tiles)} ${pluralize(unitLbl, item.quantity_tiles)}`
                                  }
                                  return (
                                    <tr key={item.id}>
                                      <td style={{ padding: '8px 12px 8px 0',
                                        fontSize: 13, fontWeight: 600, color: C.ink,
                                        fontFamily: F.body }}>
                                        {item.products?.name}
                                      </td>
                                      <td style={{ padding: '8px 12px 8px 0',
                                        fontSize: 11, color: C.muted, fontFamily: F.body }}>
                                        {item.products?.reference_code}
                                      </td>
                                      <td style={{ padding: '8px 12px 8px 0',
                                        fontSize: 13, color: C.ink, fontFamily: F.body }}>
                                        {fmtNum(item.quantity_tiles)} {isTile ? 'car.' : pluralize(unitLbl, item.quantity_tiles)}
                                      </td>
                                      <td style={{ padding: '8px 0',
                                        fontSize: 13, fontWeight: 700, color: C.ink,
                                        fontFamily: F.body }}>
                                        {detail}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STOCK TAB ── */}
        {activeTab === 'stock' && (
          <>
          <input
            value={stockSearch}
            onChange={e => setStockSearch(e.target.value)}
            placeholder="Rechercher un produit…"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8,
              border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink,
              outline: 'none', boxSizing: 'border-box',
              background: C.surface, fontFamily: F.body, marginBottom: 16,
            }}
          />
          <div style={{ display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {stockLevels
              .filter((item: any) => !stockSearch ||
                item.product_name.toLowerCase().includes(stockSearch.toLowerCase()) ||
                item.reference_code.toLowerCase().includes(stockSearch.toLowerCase())
              )
              .map((item: any) => {
              const prod       = productMap.get(item.product_id)
              const isTile     = !prod || prod.product_type === 'tile'
              const unitLabel  = prod?.unit_label ?? (isTile ? 'm²' : 'unité')

              const availM2    = parseFloat(item.available_m2)
              // stock_view has no total_m2 column — compute from total_tiles × tile_area_m2
              const totalM2    = parseFloat(item.tile_area_m2) * parseInt(item.total_tiles)
              const available  = parseInt(item.available_tiles)
              const reserved   = parseInt(item.reserved_tiles)

              const isLow      = isTile
                ? parseInt(item.available_full_cartons) < LOW_STOCK_CARTONS
                : available < LOW_STOCK_UNITS
              const isCritical = isTile
                ? parseInt(item.available_full_cartons) < CRITICAL_STOCK_CARTONS
                : available < CRITICAL_STOCK_UNITS

              const stockColor = isCritical ? C.red : isLow ? C.orange : C.green
              const pct = isTile
                ? (totalM2 > 0 ? Math.min(100, (availM2 / totalM2) * 100) : 0)
                : (parseInt(item.total_tiles) > 0
                  ? Math.min(100, (available / parseInt(item.total_tiles)) * 100)
                  : 0)

              return (
                <div key={item.product_id} style={{
                  background: C.surface, borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  padding: '20px 22px',
                  borderLeft: `4px solid ${stockColor}`,
                }}>
                  <div style={{ display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700,
                        color: C.ink, fontFamily: F.body }}>
                        {item.product_name}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted,
                        marginTop: 2, fontFamily: F.body }}>
                        {item.reference_code}
                      </div>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center',
                      gap: 5, fontSize: 11, fontWeight: 600,
                      padding: '4px 10px', height: 'fit-content',
                      borderRadius: 100,
                      background: isCritical ? C.redBg : isLow ? C.orangeBg : C.greenBg,
                      color: stockColor, fontFamily: F.body }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%',
                        background: stockColor, flexShrink: 0 }} />
                      {isCritical ? 'Critique' : isLow ? 'Stock bas' : 'OK'}
                    </span>
                  </div>

                  {/* Visual bar */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between',
                      marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700,
                        color: stockColor, fontFamily: F.body }}>
                        {isTile
                          ? `${fmtM2(availM2)} disponible`
                          : prod?.product_type === 'bag' && prod?.bag_weight_kg
                          ? `${fmtNum(available)} sac${available !== 1 ? 's' : ''} · ${fmtNum(Math.round(available * parseFloat(prod.bag_weight_kg)))} kg`
                          : `${fmtNum(available)} ${pluralize(unitLabel, available)} disponible${available !== 1 ? 's' : ''}`}
                      </span>
                      {isTile && (
                        <span style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>
                          {fmtNum(available)} carreaux
                        </span>
                      )}
                      {!isTile && prod?.product_type === 'unit' && prod?.pieces_per_package && available > 0 && (
                        <span style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>
                          {Math.floor(available / parseInt(prod.pieces_per_package))} {prod.package_label ?? 'lot'}s
                        </span>
                      )}
                    </div>
                    <div style={{ height: 6, background: C.bg,
                      borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3,
                        width: `${pct}%`, background: stockColor,
                        transition: 'width 0.4s ease' }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {(isTile
                      ? [
                          ['Cartons complets', String(item.available_full_cartons)],
                          ['Carreaux libres',  fmtNum(item.loose_tiles)],
                          ['Réservés',         fmtNum(reserved) + ' car.'],
                          ['Total m²',         fmtM2(totalM2)],
                        ]
                      : prod?.product_type === 'bag' && prod?.bag_weight_kg
                      ? [
                          ['Disponible', fmtNum(available) + ' sac' + (available !== 1 ? 's' : '')],
                          ['Poids dispo', fmtNum(Math.round(available * parseFloat(prod.bag_weight_kg))) + ' kg'],
                          ['Réservé',    fmtNum(reserved) + ' sac' + (reserved !== 1 ? 's' : '')],
                          ['Total sacs',  fmtNum(parseInt(item.total_tiles)) + ' sacs'],
                        ]
                      : [
                          ['Disponible', fmtNum(available) + ' ' + pluralize(unitLabel, available)],
                          ['Réservé',    fmtNum(reserved)  + ' ' + pluralize(unitLabel, reserved)],
                          ['Total',      fmtNum(parseInt(item.total_tiles)) + ' ' + pluralize(unitLabel, parseInt(item.total_tiles))],
                        ]
                    ).map(([lbl, val]) => (
                      <div key={lbl} style={{ textAlign: 'center',
                        padding: '8px 4px', background: C.bg,
                        borderRadius: 6 }}>
                        <div style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>
                          {lbl}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700,
                          color: C.ink, marginTop: 2, fontFamily: F.body }}>
                          {val}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          </>
        )}

        {/* ── REQUESTS TAB ── */}
        {activeTab === 'requests' && (
          <div style={{ display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>

            {/* Request form */}
            <div style={{ background: C.surface, borderRadius: R.xl,
              border: `1px solid ${C.border}`,
              overflow: 'hidden' }}>
              <div style={{ height: 3, background: `linear-gradient(90deg, ${C.amberActive}, ${C.amber})` }} />
              <div style={{ padding: `${SP[4]} ${SP[5]}`,
                borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: F.md, fontWeight: F.bold,
                  color: C.ink, fontFamily: F.display }}>
                  Nouvelle demande
                </div>
                <p style={{ margin: `${SP[1]} 0 0`, fontSize: F.xs, color: C.muted, fontFamily: F.body }}>
                  Entrée de stock ou correction d'inventaire
                </p>
              </div>
              <div style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', flexDirection: 'column',
                gap: 14 }}>

                {/* Type */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600,
                    color: C.ink, display: 'block', marginBottom: 6, fontFamily: F.body }}>
                    Type de demande
                  </label>
                  <div style={{ display: 'flex', gap: 2,
                    background: C.bg, padding: 3, borderRadius: 100 }}>
                    {([
                      ['stock_in',   'Entrée de stock'],
                      ['correction', 'Correction'],
                    ] as ['stock_in' | 'correction', string][])
                    .map(([t, l]) => (
                      <button key={t}
                        onClick={() => setReqType(t)}
                        style={{
                          flex: 1, padding: '8px', borderRadius: 100,
                          fontSize: 12, fontWeight: 700,
                          cursor: 'pointer', fontFamily: F.body,
                          background: reqType === t ? C.amber : 'transparent',
                          color: reqType === t ? '#FAF5EE' : C.muted,
                          border: 'none',
                        }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600,
                    color: C.ink, display: 'block', marginBottom: 6, fontFamily: F.body }}>
                    Produit concerné
                  </label>
                  {/* Searchable product combobox */}
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Rechercher un produit…"
                      value={reqProductSearch}
                      onFocus={() => setReqProductOpen(true)}
                      onBlur={() => setTimeout(() => setReqProductOpen(false), 150)}
                      onChange={e => {
                        setReqProductSearch(e.target.value)
                        setReqProductOpen(true)
                        if (!e.target.value) setReqProduct('')
                      }}
                      style={{ ...inputStyle, paddingRight: 28 }}
                    />
                    {reqProduct && !reqProductOpen && (
                      <button
                        onClick={() => { setReqProduct(''); setReqProductSearch(''); setReqError(null); setReqSuccess(false); setReqCartons(''); setReqLoose(''); setReqQty('') }}
                        style={{ position: 'absolute', right: 8, top: '50%',
                          transform: 'translateY(-50%)', background: 'none',
                          border: 'none', cursor: 'pointer', color: C.muted,
                          padding: 2, lineHeight: 1 }}>
                        ✕
                      </button>
                    )}
                    {reqProductOpen && (() => {
                      const q = reqProductSearch.toLowerCase().trim()
                      const filtered = products.filter(p =>
                        !q ||
                        p.name.toLowerCase().includes(q) ||
                        p.reference_code.toLowerCase().includes(q)
                      )
                      return (
                        <div style={{ position: 'absolute', zIndex: 50, top: '100%',
                          left: 0, right: 0, marginTop: 2,
                          background: C.surface, border: `1px solid ${C.border}`,
                          borderRadius: 8, boxShadow: '0 4px 16px rgba(60,30,10,0.12)',
                          maxHeight: 220, overflowY: 'auto' }}>
                          {filtered.length === 0 ? (
                            <div style={{ padding: '10px 14px', fontSize: 12,
                              color: C.muted, fontFamily: F.body }}>
                              Aucun résultat
                            </div>
                          ) : filtered.map(p => (
                            <div key={p.id}
                              onMouseDown={() => {
                                setReqProduct(p.id)
                                setReqProductSearch(`${p.name} (${p.reference_code})`)
                                setReqProductOpen(false)
                                setReqError(null)
                                setReqSuccess(false)
                                setReqCartons(''); setReqLoose(''); setReqQty('')
                              }}
                              style={{ padding: '9px 14px', cursor: 'pointer',
                                fontSize: 13, fontFamily: F.body,
                                background: reqProduct === p.id ? C.amberGlow : 'transparent',
                                color: reqProduct === p.id ? C.amber : C.ink,
                                borderBottom: `1px solid ${C.border}` }}>
                              <span style={{ fontWeight: 600 }}>{p.name}</span>
                              <span style={{ fontSize: 11, color: C.muted, marginLeft: 6 }}>
                                {p.reference_code}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Quantity — adapts to product type */}
                {(() => {
                  const selProd  = productMap.get(reqProduct)
                  const isTile   = !selProd || selProd.product_type === 'tile'
                  const unitLbl  = selProd?.unit_label ?? (isTile ? 'carreaux' : 'unités')
                  const pkgLbl   = selProd?.package_label ?? (isTile ? 'carton' : 'lot')

                  const correctionToggle = reqType === 'correction' ? (
                    <div style={{ display: 'flex', gap: 2,
                      background: C.bg, padding: 2, borderRadius: 6 }}>
                      {([['negative', '− Déduction'], ['positive', '+ Ajout']] as const).map(([sign, lbl]) => (
                        <button key={sign}
                          onClick={() => setReqCorrectionSign(sign)}
                          style={{
                            padding: '4px 10px', borderRadius: 5, border: 'none',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            fontFamily: F.body,
                            background: reqCorrectionSign === sign
                              ? (sign === 'negative' ? C.red : C.green)
                              : 'transparent',
                            color: reqCorrectionSign === sign ? '#fff' : C.muted,
                            transition: 'background 0.15s, color 0.15s',
                          }}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  ) : null

                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', marginBottom: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 600,
                          color: C.ink, fontFamily: F.body }}>
                          Quantité{' '}
                          {reqType === 'correction'
                            ? reqCorrectionSign === 'negative'
                              ? '(à déduire du stock)'
                              : '(à ajouter au stock)'
                            : '(à ajouter au stock)'}
                        </label>
                        {correctionToggle}
                      </div>

                      {isTile ? (
                        <>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              <input type="number" min="0"
                                value={reqCartons}
                                onChange={e => setReqCartons(e.target.value)}
                                placeholder={pkgLbl.charAt(0).toUpperCase() + pkgLbl.slice(1) + 's'}
                                style={inputStyle} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <input type="number" min="0"
                                value={reqLoose}
                                onChange={e => setReqLoose(e.target.value)}
                                placeholder="Carreaux en plus"
                                style={inputStyle} />
                            </div>
                          </div>
                          {(reqCartons || reqLoose) && (() => {
                            const tpc   = selProd ? parseInt(selProd.tiles_per_carton) : 1
                            const c     = parseInt(reqCartons) || 0
                            const l     = parseInt(reqLoose)   || 0
                            const total = (c * tpc) + l
                            const m2    = total * parseFloat(selProd?.tile_area_m2 ?? '0')
                            return total > 0 ? (
                              <div style={{ marginTop: 6, fontSize: 12,
                                color: C.amber, fontWeight: 600, fontFamily: F.body }}>
                                = {fmtNum(total)} carreaux · {fmtM2(m2)}
                              </div>
                            ) : null
                          })()}
                        </>
                      ) : (
                        <>
                          <input type="number" min="0"
                            value={reqQty}
                            onChange={e => setReqQty(e.target.value)}
                            placeholder={`Quantité (${unitLbl})`}
                            style={inputStyle} />
                          {reqQty && parseInt(reqQty) > 0 && (
                            <div style={{ marginTop: 6, fontSize: 12,
                              color: C.amber, fontWeight: 600, fontFamily: F.body }}>
                              = {fmtNum(parseInt(reqQty))} {pluralize(unitLbl, parseInt(reqQty))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })()}

                {/* Justification */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600,
                    color: C.ink, display: 'block', marginBottom: 6, fontFamily: F.body }}>
                    Justification{' '}
                    <span style={{ color: C.muted, fontWeight: 400 }}>
                      (min. 10 caractères)
                    </span>
                  </label>
                  <textarea value={reqJustif} rows={3}
                    onChange={e => setReqJustif(e.target.value)}
                    placeholder="Décrivez la raison de cette demande…"
                    style={{ ...inputStyle, resize: 'vertical' }} />
                  {reqJustif.length > 0 && reqJustif.length < 10 && (
                    <div style={{ fontSize: 11, color: C.red,
                      marginTop: 4, fontFamily: F.body }}>
                      {reqJustif.length}/10 caractères minimum
                    </div>
                  )}
                </div>

                {reqError && (
                  <div style={{ padding: '10px 12px', background: C.redBg,
                    borderRadius: 8, fontSize: 12,
                    fontWeight: 600, color: C.red, fontFamily: F.body }}>
                    {reqError}
                  </div>
                )}

                {reqSuccess && (
                  <div style={{ padding: '10px 12px', background: C.greenBg,
                    borderRadius: 8, fontSize: 12,
                    fontWeight: 600, color: C.green, fontFamily: F.body }}>
                    Demande soumise — en attente d'approbation
                  </div>
                )}

                {(() => {
                  const selProd = productMap.get(reqProduct)
                  const isTile  = !selProd || selProd.product_type === 'tile'
                  const hasQty  = isTile
                    ? (parseInt(reqCartons) || 0) + (parseInt(reqLoose) || 0) > 0
                    : (parseInt(reqQty) || 0) > 0
                  const disabled = reqLoading || !reqProduct || reqJustif.trim().length < 10 || !hasQty
                  return (
                <button
                  className="btn-amber"
                  onClick={handleStockRequest}
                  disabled={disabled}
                  style={{
                    width: '100%', height: 44, borderRadius: R.md, border: 'none',
                    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: F.body,
                    fontSize: F.sm, fontWeight: F.bold,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: disabled ? 0.45 : 1,
                  }}>
                  {reqLoading
                    ? <><span className="spinner" />Envoi…</>
                    : 'Soumettre pour approbation'}
                </button>
                  )
                })()}
              </div>
              </div>
            </div>

            {/* My requests history */}
            <div style={{ display: 'flex', flexDirection: 'column',
              gap: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600,
                color: C.muted, textTransform: 'uppercase',
                letterSpacing: '0.08em', marginBottom: 4, fontFamily: F.body }}>
                Mes demandes récentes
              </div>
              {myRequests.length === 0 ? (
                <div style={{ background: C.surface, borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  padding: '32px', textAlign: 'center',
                  color: C.muted, fontSize: 13, fontFamily: F.body }}>
                  Aucune demande soumise
                </div>
              ) : myRequests.map((req: any) => {
                const cfg = REQUEST_STATUS[
                  req.status as keyof typeof REQUEST_STATUS
                ]
                const isNeg   = req.quantity_tiles_delta < 0
                const isTileReq = !req.products?.product_type || req.products.product_type === 'tile'
                const unitLblReq = isTileReq ? 'carreau' : (req.products?.unit_label ?? 'unité')
                return (
                  <div key={req.id} style={{
                    background: C.surface, borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    padding: '14px 16px',
                  }}>
                    <div style={{ display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start', marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 700,
                        color: C.ink, fontFamily: F.body }}>
                        {req.products?.name}
                      </div>
                      <span style={{ display: 'inline-flex', alignItems: 'center',
                        gap: 5, fontSize: 11, fontWeight: 600,
                        padding: '3px 10px', borderRadius: 100,
                        background: cfg.bg, color: cfg.color,
                        flexShrink: 0, marginLeft: 8, fontFamily: F.body }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%',
                          background: cfg.color, flexShrink: 0 }} />
                        {cfg.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 10,
                      alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>
                        {req.request_type === 'stock_in'
                          ? 'Entrée' : 'Correction'}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700,
                        color: isNeg ? C.red : C.green, fontFamily: F.body }}>
                        {isNeg ? '' : '+'}
                        {fmtNum(Math.abs(req.quantity_tiles_delta))} {pluralize(unitLblReq, Math.abs(req.quantity_tiles_delta))}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted,
                      fontStyle: 'italic', marginBottom: 4, fontFamily: F.body }}>
                      "{req.justification}"
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>
                      {new Date(req.created_at).toLocaleDateString(
                        'fr-FR', { day: '2-digit', month: 'short',
                          hour: '2-digit', minute: '2-digit' }
                      )}
                    </div>
                    {req.status === 'rejected' && req.review_comment && (
                      <div style={{ marginTop: 6, padding: '6px 10px',
                        background: C.redBg, borderRadius: 6,
                        fontSize: 11, color: C.red, fontFamily: F.body }}>
                        Motif : {req.review_comment}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

      {/* Delivery confirmation modal */}
      {confirmDelivery && (
        <div style={{ position: 'fixed', inset: 0,
          background: 'rgba(26,15,6,0.50)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: Z.modal, padding: SP[5] }}>
          <div style={{ background: C.surfaceEl, borderRadius: R.xl,
            width: '100%', maxWidth: 420, overflow: 'hidden',
            border: `1px solid ${C.border}`, boxShadow: SH.xl }}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${C.amberActive}, ${C.amber})` }} />
            <div style={{ padding: `${SP[4]} ${SP[5]}`,
              borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: SP[3] }}>
              <div style={{ width: 32, height: 32, borderRadius: R.md,
                background: C.amberGlow, display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                  <path d="M1.5 6l3 3 6-6" stroke={C.amber} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: F.md, fontWeight: F.bold,
                  color: C.ink, fontFamily: F.display }}>
                  Confirmer la livraison
                </h3>
                <div style={{ fontSize: F.sm, color: C.muted, fontFamily: F.body }}>
                  Cette action est irréversible
                </div>
              </div>
            </div>
            <div style={{ padding: `${SP[5]} ${SP[6]}` }}>
              <p style={{ margin: `0 0 ${SP[5]}`, fontSize: F.sm,
                color: C.muted, fontFamily: F.body }}>
                Le stock sera définitivement déduit et la vente marquée comme livrée.
              </p>
              <div style={{ display: 'flex', gap: SP[2] }}>
                <button
                  className="btn-amber"
                  onClick={handleConfirmDelivery}
                  disabled={!!loadingOrder}
                  style={{ flex: 1, height: 44,
                    borderRadius: R.md, border: 'none', fontSize: F.sm,
                    fontWeight: F.bold, cursor: 'pointer', fontFamily: F.body,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: SP[2],
                    opacity: !!loadingOrder ? 0.7 : 1,
                  }}>
                  {loadingOrder ? (
                    <><span className="spinner" />En cours…</>
                  ) : (
                    <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 6l3 3 6-6" stroke="#FAF5EE" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>Confirmer la livraison</>
                  )}
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => setConfirm(null)}
                  style={{ borderRadius: R.md, fontSize: F.sm, fontWeight: F.medium,
                    cursor: 'pointer', fontFamily: F.body }}>
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
