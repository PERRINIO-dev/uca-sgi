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

const C = {
  ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', surface: '#FFFFFF',
  navy: '#1B3A6B', navyDark: '#0C1A35', blue: '#2563EB', blueL: '#EFF6FF',
  green: '#059669', greenL: '#ECFDF5',
  orange: '#D97706', orangeL: '#FFFBEB',
  red: '#DC2626', redL: '#FEF2F2',
  gold: '#B45309', goldL: '#FFFBEB',
}
const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif"

const fmtCFA = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
const fmtNum = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(n)
const fmtM2  = (n: number) =>
  new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(n) + ' m²'

const ORDER_STATUS = {
  confirmed:  { label: 'Nouvelle',        bg: C.blueL,    color: C.blue,   dot: C.blue },
  preparing:  { label: 'En préparation',  bg: C.orangeL,  color: C.orange, dot: C.orange },
  ready:      { label: 'Prête',           bg: C.greenL,   color: C.green,  dot: C.green },
  delivered:  { label: 'Livrée',          bg: '#F0F0F0',  color: C.muted,  dot: C.muted },
  cancelled:  { label: 'Annulée',         bg: C.redL,     color: C.red,    dot: C.red },
}

const REQUEST_STATUS = {
  pending:  { label: 'En attente', bg: C.goldL,  color: C.gold },
  approved: { label: 'Approuvée', bg: C.greenL, color: C.green },
  rejected: { label: 'Rejetée',   bg: C.redL,   color: C.red },
}

type Tab = 'orders' | 'stock' | 'requests'

export default function WarehouseClient({
  profile, orders, deliveredOrders,
  stockLevels, products, myRequests, badgeCounts,
}: {
  profile:         any
  orders:          any[]
  deliveredOrders: any[]
  stockLevels:     any[]
  products:        any[]
  myRequests:      any[]
  badgeCounts?:    BadgeCounts
}) {
  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // ── Real-time: refresh when sales or stock_requests change ────────────────
  useEffect(() => {
    const channel = supabase
      .channel('warehouse-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => router.refresh())
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
  }

  const handleConfirmDelivery = async () => {
    if (!confirmDelivery) return
    setLoadingOrd(confirmDelivery)
    await updateOrderStatus(confirmDelivery, 'delivered')
    setConfirm(null)
    setLoadingOrd(null)
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
        qtyText    = `<strong>${new Intl.NumberFormat('fr-FR').format(item.quantity_tiles)}</strong> ${unitLbl}`
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
      <div class="logo">UC<span>A</span></div>
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
    setReqCartons(''); setReqLoose(''); setReqQty(''); setReqJustif('')
    setTimeout(() => setReqSuccess(false), 4000)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: `1.5px solid ${C.border}`, fontSize: 13,
    color: C.ink, outline: 'none',
    boxSizing: 'border-box',
    background: C.surface, fontFamily: FONT,
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
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.ink,
            margin: '0 0 4px', letterSpacing: '-0.02em', fontFamily: FONT }}>
            Entrepôt
          </h1>
          <p style={{ fontSize: 13, color: C.slate, margin: 0, fontFamily: FONT }}>
            {TAB_LABELS[activeTab]} ·{' '}
            {orders.length} commande{orders.length !== 1 ? 's' : ''} active
            {orders.length !== 1 ? 's' : ''} · Entrepôt Central
          </p>
        </div>

        {/* Tabs — pill/segment control */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 24,
          background: C.bg, padding: 4, borderRadius: 100,
          width: 'fit-content' }}>
          {([
            ['orders',   'Commandes',  orders.length],
            ['stock',    'Stock',       null],
            ['requests', 'Demandes',   myRequests.filter(
              r => r.status === 'pending').length],
          ] as [Tab, string, number | null][]).map(([id, label, count]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{
                padding: '8px 18px', borderRadius: 100,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: activeTab === id ? C.navy : 'transparent',
                color: activeTab === id ? C.surface : C.slate,
                border: 'none', display: 'flex',
                alignItems: 'center', gap: 6,
                fontFamily: FONT,
                transition: 'all 0.15s ease',
              }}>
              {label}
              {count !== null && count > 0 && (
                <span style={{
                  background: activeTab === id
                    ? 'rgba(255,255,255,0.25)' : C.blue,
                  color: C.surface, fontSize: 10, fontWeight: 700,
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
              <div style={{ background: C.surface, borderRadius: 12,
                border: `1px solid ${C.border}`,
                padding: '48px', textAlign: 'center',
                color: C.muted, fontSize: 14, fontFamily: FONT }}>
                Aucune commande en attente
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
                      <div style={{ display: 'flex', gap: 10,
                        alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700,
                          color: C.ink, fontFamily: FONT }}>
                          {order.order_number}
                        </span>
                        {/* Status pill with dot */}
                        <span style={{ display: 'inline-flex', alignItems: 'center',
                          gap: 5, fontSize: 11, fontWeight: 600,
                          padding: '3px 10px', borderRadius: 100,
                          background: cfg.bg, color: cfg.color, fontFamily: FONT }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%',
                            background: cfg.dot, flexShrink: 0 }} />
                          {cfg.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: C.ink, fontFamily: FONT }}>
                        <strong>{sale?.customer_name ?? 'Client anonyme'}</strong>
                        {sale?.customer_phone &&
                          ` · ${sale.customer_phone}`}
                        {' — '}{sale?.boutiques?.name}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted,
                        marginTop: 2, fontFamily: FONT }}>
                        {sale?.users?.full_name} ·{' '}
                        {new Date(order.created_at).toLocaleDateString(
                          'fr-FR', { day: '2-digit', month: 'short',
                            hour: '2-digit', minute: '2-digit' }
                        )}
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
                            cursor: 'pointer', fontFamily: FONT,
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
                            cursor: 'pointer', fontFamily: FONT,
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
                          className="btn-navy"
                          onClick={() => handleOrderAction(order.id, 'delivered')}
                          disabled={loadingOrder === order.id}
                          style={{
                            padding: '9px 16px', background: C.navy,
                            color: C.surface, border: 'none', borderRadius: 7,
                            fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', fontFamily: FONT,
                            display: 'inline-flex', alignItems: 'center', gap: 6,
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
                          color: C.slate, border: `1px solid ${C.border}`,
                          borderRadius: 7, fontSize: 12,
                          cursor: 'pointer', fontFamily: FONT,
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <rect x="1" y="4" width="11" height="7" rx="1.5" stroke={C.slate} strokeWidth="1.2"/>
                          <path d="M3.5 4V2.5A.5.5 0 0 1 4 2h5a.5.5 0 0 1 .5.5V4" stroke={C.slate} strokeWidth="1.2"/>
                          <path d="M3.5 9.5h6M3.5 7.5h4" stroke={C.slate} strokeWidth="1" strokeLinecap="round"/>
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
                        fontFamily: FONT }}>
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
                                fontFamily: FONT }}>
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
                              detail = `${fmtNum(item.quantity_tiles)} ${unitLbl}`
                            }
                            return (
                              <tr key={item.id}>
                                <td style={{ padding: '10px 12px 10px 0',
                                  fontSize: 13, fontWeight: 600,
                                  color: C.ink, fontFamily: FONT }}>
                                  {item.products?.name}
                                </td>
                                <td style={{ padding: '10px 12px 10px 0',
                                  fontSize: 11, color: C.muted, fontFamily: FONT }}>
                                  {item.products?.reference_code}
                                </td>
                                <td style={{ padding: '10px 12px 10px 0',
                                  fontSize: 13, color: C.ink, fontFamily: FONT }}>
                                  {fmtNum(item.quantity_tiles)} {isTile ? 'car.' : unitLbl}
                                </td>
                                <td style={{ padding: '10px 12px 10px 0',
                                  fontSize: 13, fontWeight: 700,
                                  color: C.ink, fontFamily: FONT }}>
                                  {detail}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {sale.notes && (
                        <div style={{ marginTop: 12, padding: '10px 12px',
                          background: C.goldL, borderRadius: 7,
                          fontSize: 12, color: C.gold,
                          border: `1px solid #e5d080`, fontFamily: FONT }}>
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
                  letterSpacing: '0.08em', marginBottom: 10, fontFamily: FONT }}>
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
                              color: C.ink, fontFamily: FONT }}>
                              {o.order_number}
                            </span>
                            <span style={{ fontSize: 12, color: C.muted,
                              marginLeft: 10, fontFamily: FONT }}>
                              {o.sales?.customer_name ?? 'Client anonyme'} ·{' '}
                              {o.sales?.boutiques?.name}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center',
                              gap: 5, fontSize: 11, fontWeight: 600,
                              padding: '3px 10px', borderRadius: 100,
                              background: '#F0F0F0', color: C.muted, fontFamily: FONT }}>
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
                              letterSpacing: '0.06em', marginBottom: 10, fontFamily: FONT }}>
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
                                      fontFamily: FONT }}>
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
                                    detail = `${fmtNum(item.quantity_tiles)} ${unitLbl}`
                                  }
                                  return (
                                    <tr key={item.id}>
                                      <td style={{ padding: '8px 12px 8px 0',
                                        fontSize: 13, fontWeight: 600, color: C.ink,
                                        fontFamily: FONT }}>
                                        {item.products?.name}
                                      </td>
                                      <td style={{ padding: '8px 12px 8px 0',
                                        fontSize: 11, color: C.muted, fontFamily: FONT }}>
                                        {item.products?.reference_code}
                                      </td>
                                      <td style={{ padding: '8px 12px 8px 0',
                                        fontSize: 13, color: C.ink, fontFamily: FONT }}>
                                        {fmtNum(item.quantity_tiles)} {isTile ? 'car.' : unitLbl}
                                      </td>
                                      <td style={{ padding: '8px 0',
                                        fontSize: 13, fontWeight: 700, color: C.ink,
                                        fontFamily: FONT }}>
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
              background: C.surface, fontFamily: FONT, marginBottom: 16,
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
                        color: C.ink, fontFamily: FONT }}>
                        {item.product_name}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted,
                        marginTop: 2, fontFamily: FONT }}>
                        {item.reference_code}
                      </div>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center',
                      gap: 5, fontSize: 11, fontWeight: 600,
                      padding: '4px 10px', height: 'fit-content',
                      borderRadius: 100,
                      background: isCritical ? C.redL : isLow ? C.orangeL : C.greenL,
                      color: stockColor, fontFamily: FONT }}>
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
                        color: stockColor, fontFamily: FONT }}>
                        {isTile
                          ? `${fmtM2(availM2)} disponible`
                          : `${fmtNum(available)} ${unitLabel} disponible${available !== 1 ? 's' : ''}`}
                      </span>
                      {isTile && (
                        <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>
                          {fmtNum(available)} carreaux
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
                      : [
                          ['Disponible', fmtNum(available) + ' ' + unitLabel],
                          ['Réservé',    fmtNum(reserved)  + ' ' + unitLabel],
                          ['Total',      fmtNum(parseInt(item.total_tiles)) + ' ' + unitLabel],
                        ]
                    ).map(([lbl, val]) => (
                      <div key={lbl} style={{ textAlign: 'center',
                        padding: '8px 4px', background: C.bg,
                        borderRadius: 6 }}>
                        <div style={{ fontSize: 10, color: C.muted, fontFamily: FONT }}>
                          {lbl}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700,
                          color: C.ink, marginTop: 2, fontFamily: FONT }}>
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
            <div style={{ background: C.surface, borderRadius: 12,
              border: `1px solid ${C.border}`,
              overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px',
                borderBottom: `1px solid ${C.border}`,
                background: C.navy }}>
                <div style={{ fontSize: 14, fontWeight: 700,
                  color: C.surface, fontFamily: FONT }}>
                  Nouvelle demande
                </div>
              </div>
              <div style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', flexDirection: 'column',
                gap: 14 }}>

                {/* Type */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600,
                    color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>
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
                          cursor: 'pointer', fontFamily: FONT,
                          background: reqType === t ? C.navy : 'transparent',
                          color: reqType === t ? C.surface : C.slate,
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
                    color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>
                    Produit concerné
                  </label>
                  <select value={reqProduct}
                    onChange={e => setReqProduct(e.target.value)}
                    style={inputStyle}>
                    <option value="">— Choisir un produit —</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.reference_code})
                      </option>
                    ))}
                  </select>
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
                            fontFamily: FONT,
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
                          color: C.ink, fontFamily: FONT }}>
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
                                color: C.blue, fontWeight: 600, fontFamily: FONT }}>
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
                              color: C.blue, fontWeight: 600, fontFamily: FONT }}>
                              = {fmtNum(parseInt(reqQty))} {unitLbl}
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
                    color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>
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
                      marginTop: 4, fontFamily: FONT }}>
                      {reqJustif.length}/10 caractères minimum
                    </div>
                  )}
                </div>

                {reqError && (
                  <div style={{ padding: '10px 12px', background: C.redL,
                    borderRadius: 8, fontSize: 12,
                    fontWeight: 600, color: C.red, fontFamily: FONT }}>
                    {reqError}
                  </div>
                )}

                {reqSuccess && (
                  <div style={{ padding: '10px 12px', background: C.greenL,
                    borderRadius: 8, fontSize: 12,
                    fontWeight: 600, color: C.green, fontFamily: FONT }}>
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
                  className="btn-navy"
                  onClick={handleStockRequest}
                  disabled={disabled}
                  style={{
                    padding: '13px', borderRadius: 8, border: 'none',
                    cursor: 'pointer', fontFamily: FONT,
                    background: disabled ? C.muted : C.navy,
                    color: C.surface, fontSize: 13, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
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
                letterSpacing: '0.08em', marginBottom: 4, fontFamily: FONT }}>
                Mes demandes récentes
              </div>
              {myRequests.length === 0 ? (
                <div style={{ background: C.surface, borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  padding: '32px', textAlign: 'center',
                  color: C.muted, fontSize: 13, fontFamily: FONT }}>
                  Aucune demande soumise
                </div>
              ) : myRequests.map((req: any) => {
                const cfg = REQUEST_STATUS[
                  req.status as keyof typeof REQUEST_STATUS
                ]
                const isNeg = req.quantity_tiles_delta < 0
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
                        color: C.ink, fontFamily: FONT }}>
                        {req.products?.name}
                      </div>
                      <span style={{ display: 'inline-flex', alignItems: 'center',
                        gap: 5, fontSize: 11, fontWeight: 600,
                        padding: '3px 10px', borderRadius: 100,
                        background: cfg.bg, color: cfg.color,
                        flexShrink: 0, marginLeft: 8, fontFamily: FONT }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%',
                          background: cfg.color, flexShrink: 0 }} />
                        {cfg.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 10,
                      alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>
                        {req.request_type === 'stock_in'
                          ? 'Entrée' : 'Correction'}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700,
                        color: isNeg ? C.red : C.green, fontFamily: FONT }}>
                        {isNeg ? '' : '+'}
                        {fmtNum(req.quantity_tiles_delta)} carreaux
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted,
                      fontStyle: 'italic', marginBottom: 4, fontFamily: FONT }}>
                      "{req.justification}"
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>
                      {new Date(req.created_at).toLocaleDateString(
                        'fr-FR', { day: '2-digit', month: 'short',
                          hour: '2-digit', minute: '2-digit' }
                      )}
                    </div>
                    {req.status === 'rejected' && req.review_comment && (
                      <div style={{ marginTop: 6, padding: '6px 10px',
                        background: C.redL, borderRadius: 6,
                        fontSize: 11, color: C.red, fontFamily: FONT }}>
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
          background: 'rgba(15,23,42,0.55)',
          backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: C.surface, borderRadius: 14,
            width: 420, overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '18px 24px',
              borderBottom: `1px solid ${C.border}`,
              background: C.navy }}>
              <h3 style={{ margin: 0, fontSize: 16,
                fontWeight: 700, color: C.surface, fontFamily: FONT }}>
                Confirmer la livraison
              </h3>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ margin: '0 0 20px', fontSize: 13,
                color: C.slate, fontFamily: FONT }}>
                Cette action est irréversible. Le stock sera définitivement
                déduit et la vente marquée comme livrée.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn-navy"
                  onClick={handleConfirmDelivery}
                  disabled={!!loadingOrder}
                  style={{ flex: 1, padding: '12px',
                    background: C.navy, color: C.surface,
                    border: 'none', borderRadius: 8, fontSize: 13,
                    fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  {loadingOrder ? (
                    <><span className="spinner" />En cours…</>
                  ) : (
                    <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 6l3 3 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>Confirmer la livraison</>
                  )}
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => setConfirm(null)}
                  style={{ padding: '12px 16px', background: C.surface,
                    color: C.slate,
                    border: `1.5px solid ${C.border}`,
                    borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: FONT }}>
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
