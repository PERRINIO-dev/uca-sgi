'use client'

import React, { useState, useMemo } from 'react'
import { useRouter }        from 'next/navigation'
import { createClient }     from '@/lib/supabase/client'
import PageLayout           from '@/components/PageLayout'
import type { BadgeCounts } from '@/lib/supabase/badge-counts'
import { fmtCurrency }      from '@/lib/format'
import { downloadPOPdf }   from '@/lib/pdf/download'
import { C, F, R, SP, SH, TR } from '@/lib/design-system'
import {
  createSupplier, updateSupplier, toggleSupplierActive,
  createPurchaseOrder, markPOOrdered, cancelPO, receivePOItems,
  type Supplier, type PurchaseOrder, type POItem,
} from './actions'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const PO_STATUS: Record<string, { label: string; bg: string; color: string; bd: string }> = {
  draft:      { label: 'Brouillon',  bg: C.surfaceSub, color: C.muted,   bd: C.border   },
  ordered:    { label: 'Commandé',   bg: C.blueBg,     color: C.blue,    bd: C.blueBd   },
  partial:    { label: 'Partiel',    bg: C.goldBg,     color: C.gold,    bd: C.goldBd   },
  received:   { label: 'Reçu',       bg: C.greenBg,    color: C.green,   bd: C.greenBd  },
  cancelled:  { label: 'Annulé',     bg: C.redBg,      color: C.red,     bd: C.redBd    },
}

function StatusBadge({ status }: { status: string }) {
  const s = PO_STATUS[status] ?? PO_STATUS.draft
  return (
    <span style={{
      display: 'inline-block',
      background: s.bg, color: s.color, border: `1px solid ${s.bd}`,
      borderRadius: R.full, padding: `2px ${SP[2]}`,
      fontSize: F.xs, fontWeight: F.semibold,
    }}>
      {s.label}
    </span>
  )
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: R.xl,
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: `${SP[2]} ${SP[3]}`, borderRadius: R.md,
  border: `1.5px solid ${C.border}`, fontSize: F.sm,
  color: C.text, background: C.bg, fontFamily: F.body, outline: 'none',
}

const btnPrimary: React.CSSProperties = {
  background: C.amber, color: '#fff', border: 'none', borderRadius: R.md,
  padding: `${SP[2]} ${SP[4]}`, fontSize: F.sm, fontWeight: F.semibold,
  cursor: 'pointer', fontFamily: F.body,
}

const btnSecondary: React.CSSProperties = {
  background: 'transparent', color: C.muted,
  border: `1.5px solid ${C.border}`, borderRadius: R.md,
  padding: `${SP[2]} ${SP[4]}`, fontSize: F.sm, cursor: 'pointer', fontFamily: F.body,
}

const btnDanger: React.CSSProperties = {
  background: 'transparent', color: C.red,
  border: `1.5px solid ${C.redBd}`, borderRadius: R.md,
  padding: `${SP[2]} ${SP[4]}`, fontSize: F.sm, cursor: 'pointer', fontFamily: F.body,
}

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,6,0.50)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: SP[4] }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: C.surface, borderRadius: R.xl, padding: SP[6], width: '100%', maxWidth: 520, boxShadow: SH.xl, maxHeight: '90vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  )
}

// ── Supplier Form ──────────────────────────────────────────────────────────────

function SupplierForm({
  initial, onSubmit, onCancel, loading, error,
}: {
  initial?: Partial<Supplier>
  onSubmit: (data: any) => void
  onCancel: () => void
  loading:  boolean
  error:    string | null
}) {
  const [name,        setName]        = useState(initial?.name         ?? '')
  const [contactName, setContactName] = useState(initial?.contact_name ?? '')
  const [phone,       setPhone]       = useState(initial?.phone        ?? '')
  const [email,       setEmail]       = useState(initial?.email        ?? '')
  const [address,     setAddress]     = useState(initial?.address      ?? '')
  const [notes,       setNotes]       = useState(initial?.notes        ?? '')

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ name, contact_name: contactName, phone, email, address, notes }) }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SP[3], marginBottom: SP[3] }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: F.xs, fontWeight: F.semibold, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: SP[1] }}>
            Nom du fournisseur *
          </label>
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="ex. SOGEA Matériaux" autoFocus />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: F.xs, fontWeight: F.semibold, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: SP[1] }}>Contact</label>
          <input value={contactName} onChange={e => setContactName(e.target.value)} style={inputStyle} placeholder="Nom du représentant" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: F.xs, fontWeight: F.semibold, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: SP[1] }}>Téléphone</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="+237 6XX XXX XXX" inputMode="tel" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: F.xs, fontWeight: F.semibold, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: SP[1] }}>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="contact@fournisseur.com" type="email" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: F.xs, fontWeight: F.semibold, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: SP[1] }}>Adresse</label>
          <input value={address} onChange={e => setAddress(e.target.value)} style={inputStyle} placeholder="Ville, quartier…" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'block', fontSize: F.xs, fontWeight: F.semibold, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: SP[1] }}>Notes internes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', minHeight: 52 }} placeholder="Conditions de paiement, délais habituels…" />
        </div>
      </div>
      {error && <div style={{ marginBottom: SP[3], padding: `${SP[2]} ${SP[3]}`, background: C.redBg, color: C.red, border: `1px solid ${C.redBd}`, borderRadius: R.md, fontSize: F.sm }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SP[2] }}>
        <button type="button" onClick={onCancel} style={btnSecondary}>Annuler</button>
        <button type="submit" disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Enregistrement…' : (initial?.id ? 'Mettre à jour' : 'Créer le fournisseur')}
        </button>
      </div>
    </form>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SuppliersClient({
  profile, currency, companyName, badgeCounts,
  initialSuppliers, initialOrders, products,
}: {
  profile:           any
  currency:          string
  companyName:       string
  badgeCounts?:      BadgeCounts
  initialSuppliers:  Supplier[]
  initialOrders:     PurchaseOrder[]
  products:          { id: string; name: string; reference_code: string; unit_label: string; product_type: string }[]
}) {
  const router   = useRouter()
  const supabase = createClient()
  const fmt      = (n: number) => fmtCurrency(n, currency)

  // ── State ──────────────────────────────────────────────────────────────────
  const [tab,       setTab]      = useState<'suppliers' | 'orders'>('suppliers')
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers)
  const [orders,    setOrders]    = useState<PurchaseOrder[]>(initialOrders)
  const [search,    setSearch]    = useState('')

  // Supplier modals
  const [showNewSupplier,  setShowNewSupplier]  = useState(false)
  const [editSupplier,     setEditSupplier]     = useState<Supplier | null>(null)
  const [supplierLoading,  setSupplierLoading]  = useState(false)
  const [supplierError,    setSupplierError]    = useState<string | null>(null)

  // PO create modal
  const [showNewPO,   setShowNewPO]   = useState(false)
  const [poSuppId,    setPoSuppId]    = useState('')
  const [poItems,     setPoItems]     = useState<{ product_id: string; qty: string; price: string }[]>([{ product_id: '', qty: '', price: '' }])
  const [poDate,      setPoDate]      = useState('')
  const [poNotes,     setPoNotes]     = useState('')
  const [poLoading,   setPoLoading]   = useState(false)
  const [poError,     setPoError]     = useState<string | null>(null)

  // PO detail panel
  const [detailOrder, setDetailOrder] = useState<PurchaseOrder | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError,   setActionError]   = useState<string | null>(null)
  const [pdfLoading,    setPdfLoading]    = useState<string | null>(null)
  const [pdfError,      setPdfError]      = useState<string | null>(null)

  // Reception modal
  const [showReceive,   setShowReceive]  = useState(false)
  const [receiveQtys,   setReceiveQtys]  = useState<Record<string, string>>({})
  const [receiveLoading, setReceiveLoading] = useState(false)
  const [receiveError,   setReceiveError]  = useState<string | null>(null)

  const handleLogout = async () => {
    await supabase.auth.signOut(); router.push('/login')
  }

  const activeSuppliers = useMemo(
    () => suppliers.filter(s => s.is_active),
    [suppliers],
  )

  // ── Refresh helpers ─────────────────────────────────────────────────────────
  const refreshSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('id, name, contact_name, phone, email, address, notes, is_active, created_at').order('name')
    if (data) setSuppliers(data as Supplier[])
  }

  const refreshOrders = async () => {
    const { data } = await supabase
      .from('purchase_orders')
      .select(`id, order_number, supplier_id, status, expected_date, notes, total_amount, created_at, received_at, suppliers(name), purchase_order_items(id, product_id, qty_ordered, unit_price, qty_received, products(name, reference_code, unit_label, product_type))`)
      .order('created_at', { ascending: false })
      .limit(200)
    if (data) {
      setOrders(data as unknown as PurchaseOrder[])
      // Also refresh detail if open
      if (detailOrder) {
        const refreshed = (data as unknown as PurchaseOrder[]).find(o => o.id === detailOrder.id)
        setDetailOrder(refreshed ?? null)
      }
    }
  }

  // ── Supplier CRUD ───────────────────────────────────────────────────────────
  const handleCreateSupplier = async (data: any) => {
    setSupplierLoading(true); setSupplierError(null)
    const { error } = await createSupplier(data)
    setSupplierLoading(false)
    if (error) { setSupplierError(error); return }
    setShowNewSupplier(false)
    await refreshSuppliers()
  }

  const handleUpdateSupplier = async (data: any) => {
    if (!editSupplier) return
    setSupplierLoading(true); setSupplierError(null)
    const { error } = await updateSupplier(editSupplier.id, data)
    setSupplierLoading(false)
    if (error) { setSupplierError(error); return }
    setEditSupplier(null)
    await refreshSuppliers()
  }

  const handleToggleSupplier = async (s: Supplier) => {
    await toggleSupplierActive(s.id, !s.is_active)
    await refreshSuppliers()
  }

  // ── PO creation ─────────────────────────────────────────────────────────────
  const openNewPO = () => {
    setPoSuppId(activeSuppliers[0]?.id ?? '')
    setPoItems([{ product_id: '', qty: '', price: '' }])
    setPoDate(''); setPoNotes(''); setPoError(null); setShowNewPO(true)
  }

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault(); setPoError(null)
    const items = poItems
      .filter(i => i.product_id && i.qty)
      .map(i => ({
        product_id: i.product_id,
        qty_ordered: parseFloat(i.qty.replace(',', '.')),
        unit_price:  parseFloat(i.price.replace(',', '.') || '0'),
      }))
    if (items.length === 0) { setPoError('Ajoutez au moins un article.'); return }

    setPoLoading(true)
    const { error, order_number } = await createPurchaseOrder({
      supplier_id:   poSuppId,
      items,
      expected_date: poDate || null,
      notes:         poNotes,
    })
    setPoLoading(false)
    if (error) { setPoError(error); return }
    setShowNewPO(false)
    await refreshOrders()
  }

  // ── PO actions ──────────────────────────────────────────────────────────────
  const handleMarkOrdered = async (orderId: string) => {
    setActionLoading(true); setActionError(null)
    const { error } = await markPOOrdered(orderId)
    setActionLoading(false)
    if (error) { setActionError(error); return }
    await refreshOrders()
  }

  const handleCancelPO = async (orderId: string) => {
    setActionLoading(true); setActionError(null)
    const { error } = await cancelPO(orderId)
    setActionLoading(false)
    if (error) { setActionError(error); return }
    await refreshOrders()
  }

  const openReceive = (order: PurchaseOrder) => {
    const init: Record<string, string> = {}
    ;(order.purchase_order_items ?? []).forEach(i => {
      const remaining = i.qty_ordered - i.qty_received
      if (remaining > 0) init[i.id] = ''
    })
    setReceiveQtys(init)
    setReceiveError(null)
    setShowReceive(true)
  }

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detailOrder) return
    setReceiveError(null)
    const receipts = Object.entries(receiveQtys)
      .map(([item_id, v]) => ({ item_id, qty: parseFloat(v.replace(',', '.') || '0') }))
      .filter(r => r.qty > 0)

    if (receipts.length === 0) { setReceiveError('Renseignez au moins une quantité.'); return }

    setReceiveLoading(true)
    const { error } = await receivePOItems(detailOrder.id, receipts)
    setReceiveLoading(false)
    if (error) { setReceiveError(error); return }
    setShowReceive(false)
    await refreshOrders()
  }

  // ── Filtered lists ──────────────────────────────────────────────────────────
  const filteredSuppliers = useMemo(() => {
    const q = search.toLowerCase()
    return suppliers.filter(s =>
      !q || s.name.toLowerCase().includes(q) ||
      (s.contact_name ?? '').toLowerCase().includes(q) ||
      (s.phone ?? '').includes(q)
    )
  }, [suppliers, search])

  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase()
    return orders.filter(o =>
      !q || o.order_number.toLowerCase().includes(q) ||
      ((o.suppliers as any)?.name ?? '').toLowerCase().includes(q)
    )
  }, [orders, search])

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: `${SP[2]} ${SP[4]}`, borderRadius: R.md,
    background:  active ? C.amberGlow : 'transparent',
    color:       active ? C.amber : C.muted,
    fontWeight:  active ? F.semibold : 400,
    fontSize:    F.sm, border: 'none', cursor: 'pointer',
    transition:  TR.fast, fontFamily: F.body,
  })

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PageLayout profile={profile} activeRoute="/suppliers" onLogout={handleLogout} badgeCounts={badgeCounts}>
      <div className="fade-in-up" style={{ padding: `${SP[8]} ${SP[6]}`, maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: SP[3], marginBottom: SP[6] }}>
          <div>
            <h1 style={{ fontSize: F['2xl'], fontWeight: F.bold, fontFamily: F.display, color: C.ink, margin: 0 }}>
              Fournisseurs
            </h1>
            <div style={{ fontSize: F.sm, color: C.muted, marginTop: SP[1] }}>
              {suppliers.length} fournisseur{suppliers.length !== 1 ? 's' : ''} · {orders.filter(o => ['ordered','partial'].includes(o.status)).length} commande{orders.filter(o => ['ordered','partial'].includes(o.status)).length !== 1 ? 's' : ''} en cours
            </div>
          </div>
          <div style={{ display: 'flex', gap: SP[2] }}>
            {tab === 'suppliers' && (
              <button onClick={() => { setSupplierError(null); setShowNewSupplier(true) }} style={btnPrimary}>
                + Nouveau fournisseur
              </button>
            )}
            {tab === 'orders' && activeSuppliers.length > 0 && (
              <button onClick={openNewPO} style={btnPrimary}>
                + Nouvelle commande
              </button>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: SP[3], marginBottom: SP[5], flexWrap: 'wrap' }}>
          <input
            type="search"
            placeholder={tab === 'suppliers' ? 'Chercher un fournisseur…' : 'Chercher une commande…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, maxWidth: 280, width: 'auto' }}
          />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: SP[1], background: C.surfaceSub, borderRadius: R.lg, padding: SP[1] }}>
            <button onClick={() => { setTab('suppliers'); setSearch('') }} style={tabStyle(tab === 'suppliers')}>
              Fournisseurs ({suppliers.length})
            </button>
            <button onClick={() => { setTab('orders'); setSearch('') }} style={tabStyle(tab === 'orders')}>
              Commandes ({orders.length})
            </button>
          </div>
        </div>

        {/* ════════════════════════════════ SUPPLIERS TAB ═══════════════════ */}
        {tab === 'suppliers' && (
          <div style={cardStyle}>
            {filteredSuppliers.length === 0 ? (
              <div style={{ padding: SP[10], textAlign: 'center', color: C.dim, fontSize: F.sm }}>
                {search ? 'Aucun résultat.' : 'Aucun fournisseur enregistré.'}
              </div>
            ) : (
              filteredSuppliers.map((s, i) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: SP[4],
                    padding: `${SP[4]} ${SP[5]}`,
                    borderBottom: i < filteredSuppliers.length - 1 ? `1px solid ${C.borderSub}` : 'none',
                    opacity: s.is_active ? 1 : 0.55,
                  }}
                >
                  {/* Icon */}
                  <div style={{ width: 36, height: 36, borderRadius: R.md, background: C.amberGlow, border: `1px solid rgba(160,83,26,0.18)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                      <rect x="2" y="7" width="16" height="11" rx="1.5" stroke={C.amber} strokeWidth="1.4"/>
                      <path d="M6 7V5.5a4 4 0 018 0V7" stroke={C.amber} strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: SP[2] }}>
                      <span style={{ fontWeight: F.semibold, color: C.ink, fontSize: F.sm }}>{s.name}</span>
                      {!s.is_active && (
                        <span style={{ fontSize: F.xs, color: C.muted, border: `1px solid ${C.border}`, borderRadius: R.full, padding: `1px ${SP[2]}` }}>Inactif</span>
                      )}
                    </div>
                    <div style={{ fontSize: F.xs, color: C.muted, marginTop: 2 }}>
                      {[s.contact_name, s.phone, s.email].filter(Boolean).join(' · ') || 'Aucun contact renseigné'}
                    </div>
                    {s.address && <div style={{ fontSize: F.xs, color: C.dim }}>{s.address}</div>}
                  </div>
                  {/* Orders count */}
                  <div style={{ fontSize: F.xs, color: C.muted, flexShrink: 0, textAlign: 'right' }}>
                    {orders.filter(o => o.supplier_id === s.id).length} commande{orders.filter(o => o.supplier_id === s.id).length !== 1 ? 's' : ''}
                  </div>
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: SP[2], flexShrink: 0 }}>
                    <button
                      onClick={() => { setSupplierError(null); setEditSupplier(s) }}
                      style={{ ...btnSecondary, padding: `${SP[1]} ${SP[3]}`, fontSize: F.xs }}
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleToggleSupplier(s)}
                      style={{ ...btnSecondary, padding: `${SP[1]} ${SP[3]}`, fontSize: F.xs }}
                    >
                      {s.is_active ? 'Désactiver' : 'Activer'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ════════════════════════════════ ORDERS TAB ══════════════════════ */}
        {tab === 'orders' && (
          <div>
            {filteredOrders.length === 0 ? (
              <div style={{ ...cardStyle, padding: SP[10], textAlign: 'center', color: C.dim, fontSize: F.sm }}>
                {search ? 'Aucun résultat.' : 'Aucun bon de commande enregistré.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: SP[3] }}>
                {filteredOrders.map(o => {
                  const items = o.purchase_order_items ?? []
                  const isReceivable = ['ordered', 'partial'].includes(o.status)
                  const isCancellable = ['draft', 'ordered'].includes(o.status)
                  return (
                    <div
                      key={o.id}
                      style={{ ...cardStyle, overflow: 'hidden', cursor: 'pointer' }}
                      onClick={() => { setActionError(null); setDetailOrder(detailOrder?.id === o.id ? null : o) }}
                    >
                      {/* Header row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: SP[3], padding: `${SP[4]} ${SP[5]}` }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: SP[2] }}>
                            <span style={{ fontFamily: F.mono, fontSize: F.sm, fontWeight: F.semibold, color: C.ink }}>{o.order_number}</span>
                            <StatusBadge status={o.status} />
                          </div>
                          <div style={{ fontSize: F.xs, color: C.muted, marginTop: 2 }}>
                            {(o.suppliers as any)?.name ?? '—'} · {fmtDate(o.created_at)}
                            {o.expected_date ? ` · Livraison prévue : ${fmtDate(o.expected_date)}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontFamily: F.mono, fontWeight: F.bold, color: C.ink, fontSize: F.sm }}>
                            {fmt(o.total_amount)}
                          </div>
                          <div style={{ fontSize: F.xs, color: C.muted }}>{items.length} article{items.length !== 1 ? 's' : ''}</div>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, transition: TR.fast, transform: detailOrder?.id === o.id ? 'rotate(180deg)' : 'none' }}>
                          <path d="M2 5l5 5 5-5" stroke={C.muted} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>

                      {/* Expanded detail */}
                      {detailOrder?.id === o.id && (
                        <div
                          style={{ borderTop: `1px solid ${C.borderSub}` }}
                          onClick={e => e.stopPropagation()}
                        >
                          {/* Items table */}
                          <div style={{ padding: `${SP[3]} ${SP[5]}` }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  {['Produit', 'Commandé', 'Reçu', 'Prix unit.', 'Total'].map(h => (
                                    <th key={h} style={{ textAlign: 'left', fontSize: F.xs, color: C.muted, fontWeight: F.semibold, padding: `${SP[1]} ${SP[2]}`, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item, idx) => {
                                  const p = item.products as any
                                  const remaining = item.qty_ordered - item.qty_received
                                  return (
                                    <tr key={item.id} style={{ background: idx % 2 === 0 ? 'transparent' : C.surfaceSub }}>
                                      <td style={{ padding: `${SP[2]} ${SP[2]}`, fontSize: F.sm, color: C.ink }}>
                                        {p?.name ?? '—'}
                                        <span style={{ marginLeft: SP[2], color: C.muted, fontSize: F.xs }}>{p?.reference_code}</span>
                                      </td>
                                      <td style={{ padding: `${SP[2]} ${SP[2]}`, fontFamily: F.mono, fontSize: F.sm, color: C.text }}>
                                        {item.qty_ordered} {p?.unit_label ?? ''}
                                      </td>
                                      <td style={{ padding: `${SP[2]} ${SP[2]}`, fontFamily: F.mono, fontSize: F.sm }}>
                                        <span style={{ color: item.qty_received >= item.qty_ordered ? C.green : item.qty_received > 0 ? C.gold : C.muted }}>
                                          {item.qty_received}
                                        </span>
                                        {remaining > 0 && (
                                          <span style={{ color: C.dim, fontSize: F.xs }}> / reste {remaining}</span>
                                        )}
                                      </td>
                                      <td style={{ padding: `${SP[2]} ${SP[2]}`, fontFamily: F.mono, fontSize: F.sm, color: C.muted }}>
                                        {item.unit_price > 0 ? new Intl.NumberFormat('fr-FR').format(item.unit_price) : '—'}
                                      </td>
                                      <td style={{ padding: `${SP[2]} ${SP[2]}`, fontFamily: F.mono, fontSize: F.sm, color: C.text }}>
                                        {item.unit_price > 0 ? new Intl.NumberFormat('fr-FR').format(item.qty_ordered * item.unit_price) : '—'}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Notes */}
                          {o.notes && (
                            <div style={{ padding: `0 ${SP[5]} ${SP[3]}`, fontSize: F.sm, color: C.muted, fontStyle: 'italic' }}>
                              {o.notes}
                            </div>
                          )}

                          {/* Action buttons */}
                          <div style={{ padding: `${SP[3]} ${SP[5]}`, borderTop: `1px solid ${C.borderSub}`, display: 'flex', gap: SP[2], flexWrap: 'wrap', alignItems: 'center' }}>
                              {/* PDF always available */}
                              <button
                                onClick={async () => {
                                  setPdfError(null); setPdfLoading(o.id)
                                  try { await downloadPOPdf(o.id, o.order_number) }
                                  catch (e: any) { setPdfError(e?.message ?? 'Erreur PDF') }
                                  finally { setPdfLoading(null) }
                                }}
                                disabled={pdfLoading === o.id}
                                style={{
                                  ...btnSecondary, fontSize: F.xs,
                                  display: 'flex', alignItems: 'center', gap: SP[1],
                                  opacity: pdfLoading === o.id ? 0.6 : 1,
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                  <path d="M3 13h10M8 2v8M5 7l3 3 3-3" stroke={C.muted} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                {pdfLoading === o.id ? 'PDF…' : 'BC PDF'}
                              </button>
                              {pdfError && detailOrder?.id === o.id && (
                                <span style={{ fontSize: F.xs, color: C.red }}>{pdfError}</span>
                              )}
                              {o.status === 'draft' && (
                                <button
                                  onClick={() => handleMarkOrdered(o.id)}
                                  disabled={actionLoading}
                                  style={{ ...btnPrimary, fontSize: F.xs, opacity: actionLoading ? 0.6 : 1 }}
                                >
                                  Marquer comme envoyé
                                </button>
                              )}
                              {isReceivable && (
                                <button
                                  onClick={() => openReceive(o)}
                                  style={{ ...btnPrimary, fontSize: F.xs }}
                                >
                                  Enregistrer une réception
                                </button>
                              )}
                              {isCancellable && (
                                <button
                                  onClick={() => handleCancelPO(o.id)}
                                  disabled={actionLoading}
                                  style={{ ...btnDanger, fontSize: F.xs, opacity: actionLoading ? 0.6 : 1 }}
                                >
                                  Annuler
                                </button>
                              )}
                              {actionError && (
                                <span style={{ fontSize: F.xs, color: C.red }}>{actionError}</span>
                              )}
                            </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════ NEW SUPPLIER MODAL ══════════════════════════════ */}
      {showNewSupplier && (
        <ModalOverlay onClose={() => setShowNewSupplier(false)}>
          <h2 style={{ margin: `0 0 ${SP[5]}`, fontSize: F.lg, fontWeight: F.bold, color: C.ink, fontFamily: F.display }}>
            Nouveau fournisseur
          </h2>
          <SupplierForm
            onSubmit={handleCreateSupplier}
            onCancel={() => setShowNewSupplier(false)}
            loading={supplierLoading}
            error={supplierError}
          />
        </ModalOverlay>
      )}

      {/* ══════════════════ EDIT SUPPLIER MODAL ═════════════════════════════ */}
      {editSupplier && (
        <ModalOverlay onClose={() => setEditSupplier(null)}>
          <h2 style={{ margin: `0 0 ${SP[5]}`, fontSize: F.lg, fontWeight: F.bold, color: C.ink, fontFamily: F.display }}>
            Modifier {editSupplier.name}
          </h2>
          <SupplierForm
            initial={editSupplier}
            onSubmit={handleUpdateSupplier}
            onCancel={() => setEditSupplier(null)}
            loading={supplierLoading}
            error={supplierError}
          />
        </ModalOverlay>
      )}

      {/* ══════════════════ NEW PO MODAL ════════════════════════════════════ */}
      {showNewPO && (
        <ModalOverlay onClose={() => setShowNewPO(false)}>
          <h2 style={{ margin: `0 0 ${SP[5]}`, fontSize: F.lg, fontWeight: F.bold, color: C.ink, fontFamily: F.display }}>
            Nouvelle commande fournisseur
          </h2>
          <form onSubmit={handleCreatePO}>
            <div style={{ marginBottom: SP[3] }}>
              <label style={{ display: 'block', fontSize: F.xs, fontWeight: F.semibold, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: SP[1] }}>
                Fournisseur *
              </label>
              <select value={poSuppId} onChange={e => setPoSuppId(e.target.value)} style={inputStyle}>
                <option value="">— Choisir —</option>
                {activeSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: SP[3] }}>
              <label style={{ display: 'block', fontSize: F.xs, fontWeight: F.semibold, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: SP[2] }}>
                Articles *
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: SP[2] }}>
                {poItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 32px', gap: SP[2], alignItems: 'center' }}>
                    <select
                      value={item.product_id}
                      onChange={e => setPoItems(prev => prev.map((p, i) => i === idx ? { ...p, product_id: e.target.value } : p))}
                      style={{ ...inputStyle, fontSize: F.xs }}
                    >
                      <option value="">— Produit —</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.reference_code})</option>)}
                    </select>
                    <input
                      type="text" inputMode="decimal"
                      placeholder="Qté"
                      value={item.qty}
                      onChange={e => setPoItems(prev => prev.map((p, i) => i === idx ? { ...p, qty: e.target.value } : p))}
                      style={{ ...inputStyle, fontSize: F.xs, textAlign: 'right' }}
                    />
                    <input
                      type="text" inputMode="decimal"
                      placeholder="Prix unit."
                      value={item.price}
                      onChange={e => setPoItems(prev => prev.map((p, i) => i === idx ? { ...p, price: e.target.value } : p))}
                      style={{ ...inputStyle, fontSize: F.xs, textAlign: 'right' }}
                    />
                    <button
                      type="button"
                      onClick={() => setPoItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)}
                      style={{ width: 28, height: 28, borderRadius: R.md, border: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer', color: C.muted, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPoItems(prev => [...prev, { product_id: '', qty: '', price: '' }])}
                style={{ marginTop: SP[2], fontSize: F.xs, color: C.amber, background: 'none', border: 'none', cursor: 'pointer', fontFamily: F.body, padding: 0 }}
              >
                + Ajouter un article
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SP[3], marginBottom: SP[3] }}>
              <div>
                <label style={{ display: 'block', fontSize: F.xs, fontWeight: F.semibold, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: SP[1] }}>
                  Livraison prévue
                </label>
                <input type="date" value={poDate} onChange={e => setPoDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: F.xs, fontWeight: F.semibold, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: SP[1] }}>
                  Notes
                </label>
                <input value={poNotes} onChange={e => setPoNotes(e.target.value)} style={inputStyle} placeholder="Conditions, références…" />
              </div>
            </div>

            {/* Total preview */}
            {poItems.some(i => i.qty && i.price) && (
              <div style={{ background: C.amberGlow, border: `1px solid rgba(160,83,26,0.18)`, borderRadius: R.md, padding: `${SP[2]} ${SP[3]}`, marginBottom: SP[3], display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: F.sm, color: C.muted }}>Total estimé</span>
                <span style={{ fontFamily: F.mono, fontWeight: F.bold, color: C.amber, fontSize: F.sm }}>
                  {fmt(Math.round(poItems.reduce((s, i) => {
                    const q = parseFloat(i.qty.replace(',', '.') || '0')
                    const p = parseFloat(i.price.replace(',', '.') || '0')
                    return s + (Number.isFinite(q) && Number.isFinite(p) ? q * p : 0)
                  }, 0)))}
                </span>
              </div>
            )}

            {poError && (
              <div style={{ marginBottom: SP[3], padding: `${SP[2]} ${SP[3]}`, background: C.redBg, color: C.red, border: `1px solid ${C.redBd}`, borderRadius: R.md, fontSize: F.sm }}>{poError}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SP[2] }}>
              <button type="button" onClick={() => setShowNewPO(false)} style={btnSecondary}>Annuler</button>
              <button type="submit" disabled={poLoading} style={{ ...btnPrimary, opacity: poLoading ? 0.6 : 1 }}>
                {poLoading ? 'Création…' : 'Créer le bon de commande'}
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}

      {/* ══════════════════ RECEIVE MODAL ═══════════════════════════════════ */}
      {showReceive && detailOrder && (
        <ModalOverlay onClose={() => setShowReceive(false)}>
          <h2 style={{ margin: `0 0 ${SP[2]}`, fontSize: F.lg, fontWeight: F.bold, color: C.ink, fontFamily: F.display }}>
            Réception — {detailOrder.order_number}
          </h2>
          <p style={{ margin: `0 0 ${SP[5]}`, fontSize: F.sm, color: C.muted }}>
            Saisissez les quantités reçues pour chaque article.
          </p>
          <form onSubmit={handleReceive}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: SP[3], marginBottom: SP[4] }}>
              {(detailOrder.purchase_order_items ?? []).map(item => {
                const p = item.products as any
                const remaining = item.qty_ordered - item.qty_received
                if (remaining <= 0) return null
                return (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: SP[3], alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: F.sm, fontWeight: F.medium, color: C.ink }}>{p?.name ?? '—'}</div>
                      <div style={{ fontSize: F.xs, color: C.muted }}>
                        Commandé : {item.qty_ordered} · Déjà reçu : {item.qty_received} · Restant : {remaining} {p?.unit_label ?? ''}
                      </div>
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder={String(remaining)}
                      value={receiveQtys[item.id] ?? ''}
                      onChange={e => setReceiveQtys(prev => ({ ...prev, [item.id]: e.target.value }))}
                      style={{ ...inputStyle, width: 90, textAlign: 'right', fontFamily: F.mono }}
                    />
                  </div>
                )
              })}
            </div>
            {receiveError && (
              <div style={{ marginBottom: SP[3], padding: `${SP[2]} ${SP[3]}`, background: C.redBg, color: C.red, border: `1px solid ${C.redBd}`, borderRadius: R.md, fontSize: F.sm }}>{receiveError}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SP[2] }}>
              <button type="button" onClick={() => setShowReceive(false)} style={btnSecondary}>Annuler</button>
              <button type="submit" disabled={receiveLoading} style={{ ...btnPrimary, opacity: receiveLoading ? 0.6 : 1 }}>
                {receiveLoading ? 'Enregistrement…' : 'Confirmer la réception'}
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}
    </PageLayout>
  )
}
