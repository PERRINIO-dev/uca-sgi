'use client'

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { createClient }   from '@/lib/supabase/client'
import { updateOrderStatus, submitStockRequest } from './actions'
import PageLayout         from '@/components/PageLayout'
import type { BadgeCounts } from '@/lib/supabase/badge-counts'

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
  const supabase = createClient()

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
  const [reqJustif,         setReqJustif]         = useState('')
  const [reqLoading,        setReqLoading]        = useState(false)
  const [reqError,          setReqError]          = useState<string | null>(null)
  const [reqSuccess,        setReqSuccess]        = useState(false)
  const [stockSearch,       setStockSearch]       = useState('')

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

  // ── Print preparation sheet ────────────────────────────────────────────
  const printPreparationSheet = (order: any) => {
    const sale = order.sales
    const items = sale?.sale_items ?? []
    const now = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

    const rows = items.map((item: any) => {
      const tileArea    = parseFloat(item.tile_area_m2_snapshot)
      const tpc         = parseInt(item.tiles_per_carton_snapshot)
      const m2          = item.quantity_tiles * tileArea
      const fullCartons = Math.floor(item.quantity_tiles / tpc)
      const loose       = item.quantity_tiles % tpc
      return `
        <tr>
          <td>${item.products?.name ?? '—'}</td>
          <td style="color:#64748B;font-size:11px">${item.products?.reference_code ?? '—'}</td>
          <td style="text-align:center;font-weight:700">${fullCartons}${loose > 0 ? ` <span style="color:#D97706">+${loose}</span>` : ''}</td>
          <td style="text-align:center">${new Intl.NumberFormat('fr-FR').format(item.quantity_tiles)}</td>
          <td style="text-align:right">${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(m2)} m²</td>
          <td style="text-align:center">
            <span style="display:inline-block;width:18px;height:18px;border:2px solid #94A3B8;border-radius:3px">&nbsp;</span>
          </td>
        </tr>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Fiche de préparation — ${order.order_number}</title>
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
    th { text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94A3B8; padding: 0 10px 10px 0; border-bottom: 2px solid #0F172A; }
    td { padding: 12px 10px 12px 0; border-bottom: 1px solid #E2E8F0; vertical-align: middle; }
    .footer { display: flex; gap: 24px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #E2E8F0; }
    .sig-block { flex: 1; }
    .sig-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94A3B8; margin-bottom: 8px; }
    .sig-line { border-bottom: 1px solid #CBD5E1; height: 40px; margin-bottom: 6px; }
    .sig-sub { font-size: 11px; color: #94A3B8; }
    .notes-block { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px; padding: 10px 14px; margin-bottom: 20px; font-size: 12px; color: #92400E; }
    @media print { @page { margin: 20mm; } }
  </style>
</head>
<body>
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

  <div class="order-id">${order.order_number}</div>
  <div style="font-size:12px;color:#64748B;margin-bottom:20px">
    Vente ${sale?.sale_number ?? '—'} · ${new Date(order.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
  </div>

  <div class="client-block">
    <div class="label">Client</div>
    <div class="value">${sale?.customer_name ?? 'Client anonyme'}</div>
    <div class="sub">
      ${sale?.customer_phone ? sale.customer_phone + ' · ' : ''}
      ${sale?.boutiques?.name ?? ''} · Vendeur : ${sale?.users?.full_name ?? '—'}
    </div>
  </div>

  ${sale?.notes ? `<div class="notes-block"><strong>Note vendeur :</strong> ${sale.notes}</div>` : ''}

  <table>
    <thead>
      <tr>
        <th>Produit</th>
        <th>Référence</th>
        <th style="text-align:center">Cartons</th>
        <th style="text-align:center">Carreaux</th>
        <th style="text-align:right">Surface</th>
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

    const prod      = products.find(p => p.id === reqProduct)
    const tpc       = prod ? parseInt(prod.tiles_per_carton) : 1
    const cartons   = parseInt(reqCartons)  || 0
    const loose     = parseInt(reqLoose)    || 0
    const deltaTiles = (cartons * tpc) + loose

    if (deltaTiles === 0) {
      setReqError('La quantité doit être supérieure à zéro.')
      setReqLoading(false)
      return
    }

    const stockRow  = stockLevels.find(s => s.product_id === reqProduct)
    const stockBefore = stockRow ? parseInt(stockRow.total_tiles) : 0
    const finalDelta  = reqType === 'correction'
      ? (reqCorrectionSign === 'negative' ? -Math.abs(deltaTiles) : Math.abs(deltaTiles))
      : deltaTiles

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
    setReqCartons(''); setReqLoose(''); setReqJustif('')
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
                  <div style={{ display: 'flex', alignItems: 'center',
                    gap: 14, padding: '16px 20px',
                    cursor: 'pointer',
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
                      alignItems: 'center', flexShrink: 0 }}
                      onClick={e => e.stopPropagation()}>
                      {order.status === 'confirmed' && (
                        <button
                          onClick={() => handleOrderAction(
                            order.id, 'preparing'
                          )}
                          disabled={loadingOrder === order.id}
                          style={{
                            padding: '9px 16px', background: C.orange,
                            color: C.surface, border: 'none', borderRadius: 7,
                            fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', fontFamily: FONT,
                            opacity: loadingOrder === order.id ? 0.6 : 1,
                          }}>
                          {loadingOrder === order.id
                            ? '…' : '▶ Commencer'}
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button
                          onClick={() => handleOrderAction(
                            order.id, 'ready'
                          )}
                          disabled={loadingOrder === order.id}
                          style={{
                            padding: '9px 16px', background: C.green,
                            color: C.surface, border: 'none', borderRadius: 7,
                            fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', fontFamily: FONT,
                            opacity: loadingOrder === order.id ? 0.6 : 1,
                          }}>
                          {loadingOrder === order.id
                            ? '…' : '✓ Marquer prête'}
                        </button>
                      )}
                      {order.status === 'ready' && (
                        <button
                          onClick={() => handleOrderAction(
                            order.id, 'delivered'
                          )}
                          disabled={loadingOrder === order.id}
                          style={{
                            padding: '9px 16px', background: C.navy,
                            color: C.surface, border: 'none', borderRadius: 7,
                            fontSize: 12, fontWeight: 700,
                            cursor: 'pointer', fontFamily: FONT,
                            opacity: loadingOrder === order.id ? 0.6 : 1,
                          }}>
                          {loadingOrder === order.id
                            ? '…' : 'Confirmer livraison'}
                        </button>
                      )}
                      {/* Print prep sheet */}
                      <button
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
                      <span style={{ color: C.muted, fontSize: 16,
                        paddingLeft: 4 }}>
                        {isOpen ? '▲' : '▼'}
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
                            {['Produit', 'Référence', 'Quantité',
                              'Cartons', 'Surface'].map(h => (
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
                            const tileArea = parseFloat(
                              item.tile_area_m2_snapshot
                            )
                            const tpc = parseInt(
                              item.tiles_per_carton_snapshot
                            )
                            const m2 = item.quantity_tiles * tileArea
                            const fullCartons = Math.floor(
                              item.quantity_tiles / tpc
                            )
                            const loose = item.quantity_tiles % tpc
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
                                  {fmtNum(item.quantity_tiles)} car.
                                </td>
                                <td style={{ padding: '10px 12px 10px 0',
                                  fontSize: 13, fontWeight: 700,
                                  color: C.ink, fontFamily: FONT }}>
                                  {fullCartons} carton
                                  {fullCartons !== 1 ? 's' : ''}
                                  {loose > 0 && (
                                    <span style={{ color: C.orange,
                                      fontSize: 11 }}>
                                      {' '}+ {loose}
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '10px 12px 10px 0',
                                  fontSize: 13, color: C.ink, fontFamily: FONT }}>
                                  {fmtM2(m2)}
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
                            <span style={{ color: C.muted, fontSize: 14 }}>
                              {isOpen ? '▲' : '▼'}
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
                                  {['Produit', 'Référence', 'Carreaux',
                                    'Cartons', 'Surface'].map(h => (
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
                                  const tileArea = parseFloat(item.tile_area_m2_snapshot)
                                  const tpc      = parseInt(item.tiles_per_carton_snapshot)
                                  const m2          = item.quantity_tiles * tileArea
                                  const fullCartons = Math.floor(item.quantity_tiles / tpc)
                                  const loose       = item.quantity_tiles % tpc
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
                                        {fmtNum(item.quantity_tiles)}
                                      </td>
                                      <td style={{ padding: '8px 12px 8px 0',
                                        fontSize: 13, fontWeight: 700, color: C.ink,
                                        fontFamily: FONT }}>
                                        {fullCartons}
                                        {loose > 0 && (
                                          <span style={{ color: C.orange, fontSize: 11 }}>
                                            {' '}+ {loose}
                                          </span>
                                        )}
                                      </td>
                                      <td style={{ padding: '8px 0',
                                        fontSize: 13, color: C.ink, fontFamily: FONT }}>
                                        {fmtM2(m2)}
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
              const availM2   = parseFloat(item.available_m2)
              const totalM2   = parseFloat(item.total_m2)
              const available = parseInt(item.available_tiles)
              const isLow     = available < 50
              const isCritical = available < 20

              const stockColor = isCritical ? C.red : isLow ? C.orange : C.green
              const pct = totalM2 > 0 ? Math.min(100, (availM2 / totalM2) * 100) : 0

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
                        {fmtM2(availM2)} disponible
                      </span>
                      <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>
                        {fmtNum(available)} carreaux
                      </span>
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
                    {[
                      ['Cartons complets', String(item.available_full_cartons)],
                      ['Carreaux libres',  fmtNum(item.loose_tiles)],
                      ['Réservés',         fmtNum(item.reserved_tiles) + ' car.'],
                      ['Total m²',         fmtM2(totalM2)],
                      ['Mis à jour',
                        new Date(item.last_updated_at)
                          .toLocaleDateString('fr-FR', {
                            day: '2-digit', month: 'short'
                          })],
                    ].map(([lbl, val]) => (
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

                {/* Quantity in cartons + loose tiles */}
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
                    {reqType === 'correction' && (
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
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <input type="number" min="0"
                        value={reqCartons}
                        onChange={e => setReqCartons(e.target.value)}
                        placeholder="Cartons"
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
                  {/* Preview total tiles */}
                  {(reqCartons || reqLoose) && (() => {
                    const prod = products.find(p => p.id === reqProduct)
                    const tpc  = prod ? parseInt(prod.tiles_per_carton) : 1
                    const c    = parseInt(reqCartons)  || 0
                    const l    = parseInt(reqLoose)    || 0
                    const total = (c * tpc) + l
                    const m2    = total * parseFloat(prod?.tile_area_m2 ?? '0')
                    return total > 0 ? (
                      <div style={{ marginTop: 6, fontSize: 12,
                        color: C.blue, fontWeight: 600, fontFamily: FONT }}>
                        = {fmtNum(total)} carreaux · {fmtM2(m2)}
                      </div>
                    ) : null
                  })()}
                </div>

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

                <button onClick={handleStockRequest}
                  disabled={
                    reqLoading ||
                    !reqProduct ||
                    reqJustif.trim().length < 10 ||
                    (parseInt(reqCartons) || 0) +
                    (parseInt(reqLoose)   || 0) <= 0
                  }
                  style={{
                    padding: '13px', borderRadius: 8, border: 'none',
                    cursor: 'pointer', fontFamily: FONT,
                    background:
                      reqJustif.trim().length < 10 ||
                      (parseInt(reqCartons) || 0) +
                      (parseInt(reqLoose)   || 0) <= 0
                        ? C.muted : C.navy,
                    color: C.surface, fontSize: 13, fontWeight: 700,
                  }}>
                  {reqLoading
                    ? 'Envoi…'
                    : 'Soumettre pour approbation'}
                </button>
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
                <button onClick={handleConfirmDelivery}
                  disabled={!!loadingOrder}
                  style={{ flex: 1, padding: '12px',
                    background: C.navy, color: C.surface,
                    border: 'none', borderRadius: 8, fontSize: 13,
                    fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                    opacity: loadingOrder ? 0.6 : 1 }}>
                  {loadingOrder ? '…' : '✓ Confirmer la livraison'}
                </button>
                <button
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
