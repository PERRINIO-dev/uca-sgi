'use client'

import React, { useState, useMemo, useTransition }  from 'react'
import { useRouter }          from 'next/navigation'
import { createClient }       from '@/lib/supabase/client'
import { createSale }         from '@/app/sales/actions'
import PageLayout             from '@/components/PageLayout'
import { useIsMobile }        from '@/hooks/useIsMobile'
import type { BadgeCounts }  from '@/lib/supabase/badge-counts'
import { fmtCurrency }        from '@/lib/format'
import { pluralize }          from '@/lib/pluralize'

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

const fmtNum = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
const fmtM2  = (n: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' m²'

type InputMode = 'm2' | 'cartons' | 'tiles' | 'cartons_tiles' | 'qty' | 'linear_pieces' | 'liter_containers'

interface CartItem {
  product:         any
  inputMode:       InputMode
  unitPricePerM2:  number
  quantityTiles:   number
  quantityM2:      number
  quantityCartons: number
  looseTiles:      number
  totalPrice:      number
}

function getTypeConfig(type: string) {
  switch (type) {
    case 'tile':     return { label: 'Carrelage', color: '#2563EB', bg: '#EFF6FF' }
    case 'unit':     return { label: 'Unités',    color: '#7C3AED', bg: '#F5F3FF' }
    case 'bag':      return { label: 'Sacs',      color: '#D97706', bg: '#FFFBEB' }
    case 'liter':    return { label: 'Liquides',  color: '#0891B2', bg: '#ECFEFF' }
    case 'linear_m': return { label: 'Mètres',   color: '#059669', bg: '#F0FDF4' }
    default:         return { label: 'Produit',   color: '#475569', bg: '#F8FAFC' }
  }
}

export default function VendorSaleForm({
  profile, currency, boutique, products, allBoutiques, isOwnerOrAdmin, badgeCounts, ownerName = 'Le Propriétaire', companyName = 'SGI',
}: {
  profile: any; currency: string; boutique: any; products: any[]
  allBoutiques: any[]; isOwnerOrAdmin: boolean
  badgeCounts?: BadgeCounts
  ownerName?: string
  companyName?: string
}) {
  const router   = useRouter()
  const supabase = createClient()
  const fmt      = (n: number) => fmtCurrency(n, currency)
  const isMobile = useIsMobile()
  const [navPending, startNavTransition] = useTransition()

  const [selectedBoutique, setBoutique]     = useState<any>(boutique)
  const [selectedProduct,  setProduct]      = useState<any>(products[0] ?? null)
  const [productSearch,    setProductSearch] = useState('')
  const [typeFilter,       setTypeFilter]   = useState<string>('all')
  const [inputMode,        setInputMode]    = useState<InputMode>('m2')
  const [inputM2,          setInputM2]      = useState('')
  const [inputTiles,       setInputTiles]   = useState('')
  const [inputCartons,     setCartons]      = useState('')
  const [inputLooseTiles,  setLoose]        = useState('')
  const [unitPrice,        setUnitPrice]    = useState('')
  const [cart,             setCart]         = useState<CartItem[]>([])
  const [customerName,     setName]         = useState('')
  const [customerPhone,    setPhone]        = useState('')
  const [customerPhone2,   setPhone2]       = useState('')
  const [customerCNI,      setCNI]          = useState('')
  const [notes,            setNotes]        = useState('')
  const [amountPaid,       setAmountPaid]   = useState('')
  const [loading,          setLoading]      = useState(false)
  const [error,            setError]        = useState<string | null>(null)
  const [successData,      setSuccess]      = useState<any>(null)
  const [step,             setStep]         = useState<'form' | 'success'>('form')
  const [formStep,         setFormStep]     = useState<1 | 2>(1)

  const [inputQty,        setInputQty]        = useState('')
  const [inputPieces,     setInputPieces]     = useState('')
  const [inputContainers, setInputContainers] = useState('')

  const resetInputs = () => {
    setInputM2(''); setInputTiles(''); setCartons(''); setLoose('')
    setInputQty(''); setInputPieces(''); setInputContainers('')
    setUnitPrice('')
  }

  const computed = useMemo(() => {
    if (!selectedProduct) return null
    const isTile = (selectedProduct.product_type ?? 'tile') === 'tile'
    const price  = parseFloat(unitPrice) || 0
    const availableTiles = parseInt(selectedProduct.available_tiles)

    if (isTile) {
      const tileArea = parseFloat(selectedProduct.tile_area_m2)
      const tpc      = parseInt(selectedProduct.tiles_per_carton)
      let tiles = 0
      if (inputMode === 'm2') {
        const val = parseFloat(inputM2)
        if (!val || val <= 0) return null
        tiles = Math.ceil(val / tileArea)
      } else if (inputMode === 'tiles') {
        const val = parseInt(inputTiles)
        if (!val || val <= 0) return null
        tiles = val
      } else if (inputMode === 'cartons') {
        const val = parseInt(inputCartons)
        if (!val || val <= 0) return null
        tiles = val * tpc
      } else if (inputMode === 'cartons_tiles') {
        const c = parseInt(inputCartons)    || 0
        const l = parseInt(inputLooseTiles) || 0
        if (c <= 0 && l <= 0) return null
        tiles = c * tpc + l
      }
      if (tiles <= 0) return null
      const m2             = parseFloat((tiles * tileArea).toFixed(4))
      const fullCartons    = Math.floor(tiles / tpc)
      const loose          = tiles % tpc
      const total          = m2 * price
      const floorPrice     = parseFloat(selectedProduct.floor_price_per_m2 ?? 0)
      const refPrice       = parseFloat(selectedProduct.reference_price_per_m2 ?? 0)
      const floorViolation = price > 0 && floorPrice > 0 && price < floorPrice
      const stockInsufficient = tiles > availableTiles
      return { isTile: true as const, tiles, m2, fullCartons, loose, price, total, floorPrice, refPrice, floorViolation, stockInsufficient, availableTiles }
    } else {
      let qty = 0
      if (inputMode === 'linear_pieces' && selectedProduct.piece_length_m) {
        qty = (parseInt(inputPieces) || 0) * parseFloat(selectedProduct.piece_length_m)
      } else if (inputMode === 'liter_containers' && selectedProduct.container_volume_l) {
        qty = (parseInt(inputContainers) || 0) * parseFloat(selectedProduct.container_volume_l)
      } else {
        qty = parseFloat(inputQty) || 0
      }
      if (qty <= 0) return null
      const floorPrice     = parseFloat(selectedProduct.floor_price_per_unit ?? 0)
      const refPrice       = parseFloat(selectedProduct.reference_price_per_unit ?? 0)
      const total          = qty * price
      const floorViolation = price > 0 && floorPrice > 0 && price < floorPrice
      const stockInsufficient = qty > availableTiles
      return { isTile: false as const, tiles: qty, m2: 0, fullCartons: 0, loose: 0, price, total, floorPrice, refPrice, floorViolation, stockInsufficient, availableTiles }
    }
  }, [selectedProduct, inputMode, inputM2, inputTiles, inputCartons, inputLooseTiles, inputQty, inputPieces, inputContainers, unitPrice])

  const cartTotal = cart.reduce((sum, i) => sum + i.totalPrice, 0)

  const escHtml = (s: string | null | undefined): string =>
    String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')

  const printReceipt = () => {
    const now = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const rows = cart.map(item => {
      const isItemTile = (item.product?.product_type ?? 'tile') === 'tile'
      const unitLbl    = escHtml(item.product?.unit_label ?? (isItemTile ? 'm²' : 'unité'))
      let qtyCell: string, priceCell: string
      if (isItemTile) {
        const m2 = item.quantityM2, full = item.quantityCartons, loose = item.looseTiles
        qtyCell   = `${new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(m2)} m² · ${full}${loose>0?` <span style="color:#D97706">+${loose}</span>`:''} ctn`
        priceCell = `${new Intl.NumberFormat('fr-FR').format(item.unitPricePerM2)} ${currency}/m²`
      } else {
        const pLbl = pluralize(unitLbl, item.quantityTiles)
        qtyCell   = `${new Intl.NumberFormat('fr-FR').format(item.quantityTiles)} ${pLbl}`
        priceCell = `${new Intl.NumberFormat('fr-FR').format(item.unitPricePerM2)} ${currency}/${unitLbl}`
      }
      return `<tr><td>${escHtml(item.product?.product_name??item.product?.name)}</td><td style="color:#64748B;font-size:11px">${escHtml(item.product?.reference_code)}</td><td style="text-align:center">${qtyCell}</td><td style="text-align:right">${priceCell}</td><td style="text-align:right;font-weight:700">${new Intl.NumberFormat('fr-FR').format(Math.round(item.totalPrice))} ${currency}</td></tr>`
    }).join('')

    const total=Math.round(successData?.serverTotal??cartTotal), paid=Math.max(0,parseFloat(amountPaid)||0), balance=Math.max(0,total-paid)
    const payLabel=paid>=total?'Payé':paid>0?'Acompte versé':'Impayé', payColor=paid>=total?'#059669':paid>0?'#D97706':'#DC2626'

    const html=`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><meta name="viewport" content="width=800"/><title>Reçu — ${escHtml(successData?.saleNumber)}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0F172A;padding:32px;font-size:13px}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #0F172A}.logo{font-size:24px;font-weight:800;letter-spacing:-0.03em}.meta{font-size:11px;color:#64748B;text-align:right;line-height:1.8}.sale-id{font-size:22px;font-weight:800;color:#0F172A;letter-spacing:-0.02em;margin-bottom:4px}.info-block{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:14px 18px;margin-bottom:20px;display:flex;gap:32px}.info-col{flex:1}.info-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#94A3B8;margin-bottom:3px}.info-value{font-size:13px;font-weight:600;color:#0F172A}table{width:100%;border-collapse:collapse;margin-bottom:20px}th{text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;padding:0 10px 10px 0;border-bottom:2px solid #0F172A}td{padding:10px 10px 10px 0;border-bottom:1px solid #E2E8F0;vertical-align:middle}.total-row{display:flex;justify-content:flex-end;margin-bottom:28px}.total-box{background:#0F172A;color:white;padding:14px 24px;border-radius:8px;text-align:right}.total-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#94A3B8;margin-bottom:4px}.total-amount{font-size:22px;font-weight:900;letter-spacing:-0.02em}.sig-section{margin-top:32px;padding-top:20px;border-top:1px solid #E2E8F0}.sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:16px}.sig-name{font-size:12px;font-weight:600;color:#0F172A;margin-bottom:4px}.sig-role{font-size:11px;color:#64748B;margin-bottom:12px}.sig-line{border-bottom:1.5px solid #CBD5E1;height:52px;margin-bottom:6px}.sig-sub{font-size:10px;color:#94A3B8}.footer{margin-top:24px;text-align:center;font-size:10px;color:#94A3B8;padding-top:16px;border-top:1px solid #E2E8F0}.back-btn{display:inline-flex;align-items:center;gap:6px;margin-bottom:20px;padding:8px 16px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:6px;font-size:12px;font-weight:600;color:#475569;cursor:pointer;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}@media print{@page{margin:20mm}.back-btn{display:none!important}}</style></head><body>
<button class="back-btn" onclick="window.close()">← Retour</button>
<div class="header"><div><div class="logo">${escHtml(companyName)}</div><div style="font-size:11px;color:#64748B;margin-top:2px">Reçu de vente officiel</div></div><div class="meta"><div>${now}</div><div>${escHtml(selectedBoutique?.name)}</div></div></div>
<div class="sale-id">${escHtml(successData?.saleNumber)||'—'}</div>
<div style="font-size:12px;color:#64748B;margin-bottom:20px">${new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
<div class="info-block"><div class="info-col"><div class="info-label">Client</div><div class="info-value">${escHtml(customerName)||'Client anonyme'}</div>${customerPhone?`<div style="font-size:12px;color:#64748B;margin-top:2px">${escHtml(customerPhone)}</div>`:''} ${customerCNI?`<div style="font-size:11px;color:#94A3B8;margin-top:2px">CNI : ${escHtml(customerCNI)}</div>`:''}</div><div class="info-col"><div class="info-label">Vendeur</div><div class="info-value">${escHtml(profile?.full_name)||'—'}</div><div style="font-size:12px;color:#64748B;margin-top:2px">${escHtml(selectedBoutique?.name)}</div></div></div>
<table><thead><tr><th>Produit</th><th>Référence</th><th style="text-align:center">Quantité</th><th style="text-align:right">Prix unit.</th><th style="text-align:right">Sous-total</th></tr></thead><tbody>${rows}</tbody></table>
<div class="total-row"><div class="total-box"><div class="total-label">Montant total</div><div class="total-amount">${new Intl.NumberFormat('fr-FR').format(total)} ${currency}</div>${paid>0?`<div style="margin-top:8px;font-size:12px;color:#94A3B8">Encaissé : ${new Intl.NumberFormat('fr-FR').format(Math.round(paid))} ${currency}</div>`:''} ${balance>0?`<div style="font-size:12px;color:#FCA5A5;margin-top:2px">Reste : ${new Intl.NumberFormat('fr-FR').format(balance)} ${currency}</div>`:''}</div></div>
<div style="display:flex;justify-content:flex-end;margin-bottom:28px"><span style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:100px;background:${payColor}20;border:1px solid ${payColor};font-size:12px;font-weight:700;color:${payColor}"><span style="width:6px;height:6px;border-radius:50%;background:${payColor}"></span>${payLabel}</span></div>
<div class="sig-section"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#94A3B8">Signatures</div><div class="sig-grid"><div><div class="sig-name">${escHtml(profile?.full_name)||'Le vendeur'}</div><div class="sig-role">Vendeur — ${escHtml(selectedBoutique?.name)}</div><div class="sig-line"></div><div class="sig-sub">Signature du vendeur</div></div><div><div class="sig-name">${escHtml(ownerName)}</div><div class="sig-role">Propriétaire — ${escHtml(companyName)}</div><div class="sig-line"></div><div class="sig-sub">Signature du propriétaire</div></div></div></div>
<div class="footer">${escHtml(companyName)} — Reçu généré le ${now} · Document officiel</div>
</body></html>`
    const w = window.open('','_blank','width=800,height=900')
    if (!w) return
    w.document.write(html); w.document.close(); w.focus()
    setTimeout(() => w.print(), 400)
  }

  const addToCart = () => {
    if (!computed || !selectedProduct) return
    if (computed.floorViolation || computed.stockInsufficient) return
    if (computed.price <= 0 || computed.tiles <= 0) return
    const existingIdx = cart.findIndex(i => i.product.product_id === selectedProduct.product_id && i.unitPricePerM2 === computed.price)
    const isTileProd  = computed.isTile
    const available   = parseInt(selectedProduct.available_tiles)
    if (existingIdx >= 0) {
      const existing = cart[existingIdx]
      const newQty   = existing.quantityTiles + computed.tiles
      if (newQty > available) {
        const unitBase = isTileProd ? 'carreau' : (selectedProduct.unit_label ?? 'unité')
        setError(`Stock insuffisant — vous avez déjà ${existing.quantityTiles} ${pluralize(unitBase, existing.quantityTiles)} dans le panier (${available} disponible${available>1?'s':''} au total).`)
        return
      }
      const updated = [...cart]
      if (isTileProd) {
        const tpc = parseInt(selectedProduct.tiles_per_carton)
        const newM2 = parseFloat((newQty * parseFloat(selectedProduct.tile_area_m2)).toFixed(4))
        updated[existingIdx] = { ...existing, quantityTiles: newQty, quantityM2: newM2, quantityCartons: Math.floor(newQty/tpc), looseTiles: newQty%tpc, totalPrice: newM2*computed.price }
      } else {
        updated[existingIdx] = { ...existing, quantityTiles: newQty, totalPrice: newQty*computed.price }
      }
      setCart(updated)
    } else {
      setCart(prev => [...prev, { product: selectedProduct, inputMode, unitPricePerM2: computed.price, quantityTiles: computed.tiles, quantityM2: computed.m2, quantityCartons: computed.fullCartons, looseTiles: computed.loose, totalPrice: computed.total }])
    }
    resetInputs(); setError(null)
  }

  const removeFromCart = (idx: number) => setCart(prev => prev.filter((_,i) => i !== idx))

  const handleConfirm = async () => {
    if (cart.length === 0) return
    if (!customerName.trim())  { setError('Le nom du client est obligatoire.');        return }
    if (!customerPhone.trim()) { setError('Le numéro de téléphone est obligatoire.');  return }
    if (!customerCNI.trim())   { setError('Le numéro CNI du client est obligatoire.'); return }
    setLoading(true); setError(null)
    const phone = customerPhone2.trim() ? `${customerPhone.trim()} / ${customerPhone2.trim()}` : customerPhone.trim()
    const result = await createSale({
      boutique_id: selectedBoutique?.id ?? boutique?.id,
      vendor_id: profile.id,
      customer_name: customerName.trim(),
      customer_phone: phone,
      customer_cni: customerCNI.trim(),
      total_amount: cartTotal,
      amount_paid: parseFloat(amountPaid) || 0,
      notes: notes || null,
      items: cart.map(item => {
        const isItemTile = (item.product.product_type ?? 'tile') === 'tile'
        return {
          product_id: item.product.product_id,
          quantity_tiles: item.quantityTiles,
          unit_price_per_m2: item.unitPricePerM2,
          total_price: item.totalPrice,
          floor_price_snapshot: isItemTile ? parseFloat(item.product.floor_price_per_m2??0) : parseFloat(item.product.floor_price_per_unit??0),
          reference_price_snapshot: isItemTile ? parseFloat(item.product.reference_price_per_m2??0) : parseFloat(item.product.reference_price_per_unit??0),
          purchase_price_snapshot: 0,
          tile_area_m2_snapshot: isItemTile ? parseFloat(item.product.tile_area_m2) : null,
          tiles_per_carton_snapshot: isItemTile ? parseInt(item.product.tiles_per_carton) : null,
        }
      }),
    })
    setLoading(false)
    if (result.error) { setError(result.error); return }
    setSuccess(result); setStep('success')
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login') }

  const inputStyle = (hasError = false): React.CSSProperties => ({
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: `1.5px solid ${hasError ? C.red : C.border}`,
    fontSize: 13, color: C.ink, outline: 'none',
    boxSizing: 'border-box', background: C.surface, fontFamily: FONT,
  })

  // ── Available product types for filter pills ──────────────────────────────
  const availableTypes = [...new Set(products.map(p => p.product_type ?? 'tile'))]

  // ── Filtered products ─────────────────────────────────────────────────────
  const filteredProducts = products.filter(p => {
    const q = productSearch.toLowerCase()
    const matchSearch = !q || p.product_name.toLowerCase().includes(q) || p.reference_code.toLowerCase().includes(q)
    const matchType   = typeFilter === 'all' || (p.product_type ?? 'tile') === typeFilter
    return matchSearch && matchType
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // SUCCESS
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === 'success') {
    const paid    = Math.max(0, parseFloat(amountPaid) || 0)
    const total   = successData?.serverTotal ?? cartTotal
    const balance = total - paid
    const isPaid  = paid >= total && paid > 0
    const isPartial = paid > 0 && !isPaid

    return (
      <PageLayout profile={profile} activeRoute="/sales" onLogout={handleLogout} badgeCounts={badgeCounts}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: isMobile ? '8px 0 40px' : '24px 0 60px' }}>

          {/* Card */}
          <div style={{ background: C.surface, borderRadius: 20, border: `1px solid ${C.border}`, boxShadow: '0 8px 40px rgba(0,0,0,0.08)', overflow: 'hidden' }}>

            {/* Green top stripe */}
            <div style={{ height: 4, background: 'linear-gradient(90deg, #059669, #34D399)' }} />

            <div style={{ padding: '36px 36px 28px', textAlign: 'center' }}>
              {/* Check circle */}
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: C.greenL, border: `4px solid #D1FAE5`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                  <path d="M6 15l7 7 11-13" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              <h2 style={{ fontSize: 24, fontWeight: 800, color: C.ink, margin: '0 0 6px', letterSpacing: '-0.03em', fontFamily: FONT }}>
                Vente enregistrée
              </h2>
              <p style={{ color: C.muted, fontSize: 14, margin: '0 0 24px', fontFamily: FONT }}>
                Commande transmise à l'entrepôt automatiquement
              </p>

              {/* Sale number */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 100, background: C.bg, border: `1px solid ${C.border}`, marginBottom: 24 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />
                <span style={{ fontSize: 18, fontWeight: 900, color: C.ink, letterSpacing: '0.02em', fontFamily: 'ui-monospace, monospace' }}>
                  {successData?.saleNumber}
                </span>
              </div>

              {/* Amount block */}
              <div style={{ padding: '20px', background: C.bg, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontFamily: FONT }}>
                  Montant total
                </div>
                <div style={{ fontSize: 34, fontWeight: 900, color: C.ink, letterSpacing: '-0.04em', fontFamily: FONT }}>
                  {fmt(total)}
                </div>
                {paid > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: C.slate, fontFamily: FONT }}>
                      Encaissé : <strong style={{ color: C.green }}>{fmt(paid)}</strong>
                    </span>
                    {balance > 0 && (
                      <span style={{ fontSize: 12, color: C.slate, fontFamily: FONT }}>
                        Reste : <strong style={{ color: C.orange }}>{fmt(balance)}</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Payment status pill */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 100, background: isPaid ? C.greenL : isPartial ? C.orangeL : C.redL, border: `1px solid ${isPaid ? '#6EE7B7' : isPartial ? '#FCD34D' : '#FECACA'}`, fontSize: 12, fontWeight: 700, color: isPaid ? C.green : isPartial ? C.orange : C.red, fontFamily: FONT }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: isPaid ? C.green : isPartial ? C.orange : C.red }} />
                {isPaid ? 'Soldé' : isPartial ? 'Acompte versé' : 'Impayé'}
              </div>
            </div>

            {/* Actions */}
            <div style={{ padding: '0 28px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn-meram" onClick={printReceipt}
                style={{ width: '100%', padding: '13px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: FONT }}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <rect x="1" y="5" width="13" height="8" rx="1.5" stroke="white" strokeWidth="1.3"/>
                  <path d="M4 5V3a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 .5.5v2" stroke="white" strokeWidth="1.3"/>
                  <path d="M4 10.5h7M4 8h4.5" stroke="white" strokeWidth="1.1" strokeLinecap="round"/>
                </svg>
                Imprimer le reçu
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setCart([]); setName(''); setPhone(''); setPhone2(''); setCNI(''); setNotes(''); setAmountPaid(''); resetInputs(); setStep('form'); setFormStep(1) }}
                  style={{ flex: 1, padding: '11px', borderRadius: 9, border: `1.5px solid ${C.blue}`, background: C.surface, color: C.blue, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                  Nouvelle vente
                </button>
                <button disabled={navPending}
                  onClick={() => startNavTransition(() => router.push('/sales'))}
                  style={{ flex: 1, padding: '11px', borderRadius: 9, border: `1.5px solid ${C.border}`, background: C.surface, color: navPending ? C.muted : C.slate, fontSize: 13, fontWeight: 600, cursor: navPending ? 'not-allowed' : 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  {navPending ? <><span className="spinner-blue" />Chargement…</> : 'Mes ventes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </PageLayout>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN FORM
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <PageLayout profile={profile} activeRoute="/sales" onLogout={handleLogout} badgeCounts={badgeCounts}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <button disabled={navPending}
          onClick={() => startNavTransition(() => router.push('/sales'))}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: navPending ? C.muted : C.slate, fontSize: 12, fontWeight: 600, cursor: navPending ? 'not-allowed' : 'pointer', padding: '0 0 12px', fontFamily: FONT }}>
          {navPending ? <><span className="spinner-blue" />Chargement…</> : (
            <><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>Retour aux ventes</>
          )}
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.ink, margin: '0 0 4px', letterSpacing: '-0.03em', fontFamily: FONT }}>
              Nouvelle vente
            </h1>
            <p style={{ fontSize: 13, color: C.muted, margin: 0, fontFamily: FONT }}>
              {selectedBoutique?.name} · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>

          {/* Step progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 100, padding: '4px 6px' }}>
            {([{ n: 1, label: 'Sélection' }, { n: 2, label: 'Client' }] as {n:1|2,label:string}[]).map(({ n, label }, idx) => (
              <React.Fragment key={n}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 100, background: formStep === n ? C.blue : 'transparent', transition: 'background 0.2s ease' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: formStep === n ? 'rgba(255,255,255,0.2)' : formStep > n ? C.green : C.border, color: formStep >= n ? '#fff' : C.muted, fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                    {formStep > n ? <svg width="9" height="8" viewBox="0 0 9 8" fill="none"><path d="M1 4l2.5 2.5L8 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> : n}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: formStep === n ? '#fff' : C.muted, fontFamily: FONT }}>
                    {label}
                  </span>
                </div>
                {idx < 1 && <div style={{ width: 6, height: 1, background: C.border, margin: '0 2px' }} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════ STEP 1 ═══════════════════════════════ */}
      {formStep === 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.8fr 1.5fr 280px', gap: 16, alignItems: 'start' }}>

          {/* ── COL 1: Product catalogue ── */}
          <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            {/* Search + header */}
            <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${C.border}`, background: C.bg }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontFamily: FONT }}>
                Catalogue produits
              </div>
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <circle cx="7" cy="7" r="5" stroke={C.muted} strokeWidth="1.5"/>
                  <path d="M11 11l3 3" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Rechercher…"
                  style={{ width: '100%', paddingLeft: 30, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, outline: 'none', boxSizing: 'border-box', background: C.surface, fontFamily: FONT }} />
              </div>
              {/* Type filter pills */}
              {availableTypes.length > 1 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => setTypeFilter('all')}
                    style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${typeFilter==='all' ? C.blue : C.border}`, background: typeFilter==='all' ? C.blueL : 'transparent', color: typeFilter==='all' ? C.blue : C.muted, fontFamily: FONT }}>
                    Tous
                  </button>
                  {availableTypes.map(t => {
                    const cfg = getTypeConfig(t)
                    const active = typeFilter === t
                    return (
                      <button key={t} onClick={() => setTypeFilter(t)}
                        style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${active ? cfg.color : C.border}`, background: active ? cfg.bg : 'transparent', color: active ? cfg.color : C.muted, fontFamily: FONT }}>
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Product list */}
            <div style={{ maxHeight: isMobile ? 280 : 420, overflowY: 'auto', padding: '8px' }}>
              {filteredProducts.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: C.muted, fontSize: 13, fontFamily: FONT }}>
                  Aucun produit trouvé
                </div>
              ) : filteredProducts.map(prod => {
                const isSelected  = selectedProduct?.product_id === prod.product_id
                const prodType    = prod.product_type ?? 'tile'
                const prodIsTile  = prodType === 'tile'
                const availCount  = parseInt(prod.available_tiles)
                const cfg         = getTypeConfig(prodType)
                const availDisplay = prodIsTile
                  ? fmtM2(availCount * parseFloat(prod.tile_area_m2))
                  : `${fmtNum(availCount)} ${prod.unit_label ?? 'u.'}`
                const isLow      = prodIsTile ? availCount * parseFloat(prod.tile_area_m2) < 10 : availCount < 5
                const isCritical = prodIsTile ? availCount * parseFloat(prod.tile_area_m2) < 3  : availCount < 2
                const stockColor = isCritical ? C.red : isLow ? C.orange : C.green
                const subtitle   = prodIsTile
                  ? `${prod.reference_code} · ${prod.tiles_per_carton} car./ctn`
                  : `${prod.reference_code}${prod.unit_label ? ' · ' + prod.unit_label : ''}`

                return (
                  <button key={prod.product_id}
                    onClick={() => { setProduct(prod); setInputMode(prodIsTile ? 'm2' : 'qty'); resetInputs(); setError(null) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9, cursor: 'pointer', textAlign: 'left', width: '100%', background: isSelected ? C.blueL : 'transparent', border: `1.5px solid ${isSelected ? C.blue : 'transparent'}`, fontFamily: FONT, marginBottom: 2 }}>
                    {/* Type icon badge */}
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: isSelected ? cfg.bg : C.bg, border: `1px solid ${isSelected ? cfg.color + '40' : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                      <TypeIcon type={prodType} color={isSelected ? cfg.color : C.muted} size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? C.blue : C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: FONT }}>
                        {prod.product_name}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 1, fontFamily: FONT }}>
                        {subtitle}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: stockColor, fontFamily: FONT }}>
                        {availDisplay}
                      </div>
                      {(isLow || isCritical) && (
                        <div style={{ fontSize: 9, fontWeight: 600, color: stockColor, textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: FONT }}>
                          {isCritical ? 'Critique' : 'Faible'}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── COL 2: Product configuration ── */}
          <div>
            {!selectedProduct ? (
              <div style={{ background: C.surface, borderRadius: 14, border: `1.5px dashed ${C.border}`, padding: '48px 24px', textAlign: 'center', color: C.muted }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ margin: '0 auto 12px', display: 'block' }}>
                  <rect x="4" y="4" width="10" height="10" rx="2" fill={C.border}/>
                  <rect x="18" y="4" width="10" height="10" rx="2" fill={C.border}/>
                  <rect x="4" y="18" width="10" height="10" rx="2" fill={C.border}/>
                  <rect x="18" y="18" width="10" height="10" rx="2" fill={C.border}/>
                </svg>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.slate, fontFamily: FONT }}>Sélectionnez un produit</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4, fontFamily: FONT }}>dans la liste à gauche</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Selected product header */}
                {(() => {
                  const prodType = selectedProduct.product_type ?? 'tile'
                  const cfg      = getTypeConfig(prodType)
                  return (
                    <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <TypeIcon type={prodType} color={cfg.color} size={17} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {selectedProduct.product_name}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT, marginTop: 1 }}>
                          {selectedProduct.reference_code} · <span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Quantity section */}
                <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, fontFamily: FONT }}>
                    Quantité
                  </div>

                  {(selectedProduct.product_type ?? 'tile') === 'tile' ? (
                    <>
                      {/* Mode tabs */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
                        {([['m2', 'm²'], ['cartons_tiles', 'Cartons + pièces']] as [InputMode, string][]).map(([mode, label]) => (
                          <button key={mode} onClick={() => { setInputMode(mode); resetInputs() }}
                            style={{ padding: '9px 4px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: inputMode===mode ? C.blue : C.bg, color: inputMode===mode ? '#fff' : C.muted, border: `1.5px solid ${inputMode===mode ? C.blue : C.border}`, fontFamily: FONT }}>
                            {label}
                          </button>
                        ))}
                      </div>

                      {inputMode === 'm2' && (
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>Surface en m²</label>
                          <input type="number" min="0" step="0.01" value={inputM2} onChange={e => setInputM2(e.target.value)} placeholder="ex : 12.5" style={inputStyle(computed?.stockInsufficient ?? false)} />
                        </div>
                      )}

                      {inputMode === 'cartons_tiles' && (
                        <div style={{ display: 'flex', gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>Cartons</label>
                            <input type="number" min="0" step="1" value={inputCartons} onChange={e => setCartons(e.target.value)} placeholder="ex : 3" style={inputStyle(computed?.stockInsufficient ?? false)} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>Pièces en plus</label>
                            <input type="number" min="0" max={String(parseInt(selectedProduct.tiles_per_carton)-1)} step="1" value={inputLooseTiles} onChange={e => setLoose(e.target.value)} placeholder={`0 – ${parseInt(selectedProduct.tiles_per_carton)-1}`} style={inputStyle()} />
                          </div>
                        </div>
                      )}

                      {/* Tile equivalences */}
                      {computed && (
                        <div style={{ marginTop: 12, padding: 12, background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontFamily: FONT }}>Équivalences</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                            {([
                              ['Surface', fmtM2(computed.m2), inputMode==='m2'],
                              ['Cartons', `${computed.fullCartons}${computed.loose?` +${computed.loose}`:''} `, inputMode==='cartons'||inputMode==='cartons_tiles'],
                              ['Carreaux', fmtNum(computed.tiles), inputMode==='tiles'],
                            ] as [string, string, boolean][]).map(([lbl, val, active]) => (
                              <div key={lbl} style={{ textAlign: 'center', padding: '8px 4px', background: active ? C.blueL : C.surface, borderRadius: 7, border: `1px solid ${active ? C.blue : C.border}` }}>
                                <div style={{ fontSize: 10, color: C.muted, fontFamily: FONT }}>{lbl}</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: active ? C.blue : C.ink, fontFamily: FONT }}>{val}</div>
                              </div>
                            ))}
                          </div>
                          {computed.loose > 0 && inputMode !== 'cartons_tiles' && (
                            <div style={{ marginTop: 8, padding: '6px 10px', background: C.orangeL, borderRadius: 6, fontSize: 11, color: C.orange, fontFamily: FONT }}>
                              Carton incomplet — {computed.loose} pièce{computed.loose>1?'s':''} ouvertes
                            </div>
                          )}
                          {computed.stockInsufficient && (
                            <div style={{ marginTop: 8, padding: '8px 10px', background: C.redL, borderRadius: 6, fontSize: 12, fontWeight: 600, color: C.red, fontFamily: FONT }}>
                              Stock insuffisant — dispo : {fmtM2(parseInt(selectedProduct.available_tiles)*parseFloat(selectedProduct.tile_area_m2))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (() => {
                    const prodType     = selectedProduct.product_type ?? 'unit'
                    const unitLbl      = selectedProduct.unit_label    ?? 'unité'
                    const pkgLbl       = selectedProduct.package_label ?? (prodType==='liter'?'bidon':'barre')
                    const hasPieceConv = prodType==='linear_m' && selectedProduct.piece_length_m
                    const hasContConv  = prodType==='liter'    && selectedProduct.container_volume_l
                    const hasBagWeight = prodType==='bag'      && selectedProduct.bag_weight_kg

                    return (
                      <>
                        {(hasPieceConv || hasContConv) && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
                            {([
                              ['qty', `En ${unitLbl}`],
                              [hasPieceConv ? 'linear_pieces' : 'liter_containers', `En ${pkgLbl}`],
                            ] as [InputMode, string][]).map(([mode, label]) => (
                              <button key={mode} onClick={() => { setInputMode(mode); resetInputs() }}
                                style={{ padding: '9px 4px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: inputMode===mode ? C.blue : C.bg, color: inputMode===mode ? '#fff' : C.muted, border: `1.5px solid ${inputMode===mode ? C.blue : C.border}`, fontFamily: FONT }}>
                                {label}
                              </button>
                            ))}
                          </div>
                        )}

                        {inputMode === 'linear_pieces' ? (
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>Nombre de {pkgLbl}s</label>
                            <input type="number" min="1" step="1" value={inputPieces} onChange={e => setInputPieces(e.target.value)} placeholder={`ex : 3 ${pkgLbl}s`} style={inputStyle(computed?.stockInsufficient??false)} />
                          </div>
                        ) : inputMode === 'liter_containers' ? (
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>Nombre de {pkgLbl}s</label>
                            <input type="number" min="1" step="1" value={inputContainers} onChange={e => setInputContainers(e.target.value)} placeholder={`ex : 2 ${pkgLbl}s`} style={inputStyle(computed?.stockInsufficient??false)} />
                          </div>
                        ) : (
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>Quantité ({unitLbl})</label>
                            <input type="number" min="1" step="1" value={inputQty} onChange={e => setInputQty(e.target.value)} placeholder="ex : 5" style={inputStyle(computed?.stockInsufficient??false)} />
                          </div>
                        )}

                        {computed && (
                          <div style={{ marginTop: 12, padding: 12, background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
                            {(inputMode==='linear_pieces'||inputMode==='liter_containers') ? (
                              <>
                                <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontFamily: FONT }}>Équivalences</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                  <div style={{ textAlign: 'center', padding: '8px 6px', background: C.surface, borderRadius: 7, border: `1px solid ${C.border}` }}>
                                    <div style={{ fontSize: 10, color: C.muted, fontFamily: FONT }}>{pkgLbl}</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: C.blue, fontFamily: FONT }}>{inputMode==='linear_pieces'?(parseInt(inputPieces)||0):(parseInt(inputContainers)||0)}</div>
                                  </div>
                                  <div style={{ textAlign: 'center', padding: '8px 6px', background: C.blueL, borderRadius: 7, border: `1px solid ${C.blue}33` }}>
                                    <div style={{ fontSize: 10, color: C.muted, fontFamily: FONT }}>{unitLbl}</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: C.blue, fontFamily: FONT }}>{new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(computed.tiles)}</div>
                                  </div>
                                </div>
                                <div style={{ marginTop: 8, fontSize: 11, color: C.muted, fontFamily: FONT, textAlign: 'center' }}>Disponible : {fmtNum(computed.availableTiles)} {unitLbl}</div>
                              </>
                            ) : (
                              <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: 13, color: C.slate, fontFamily: FONT }}>{new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(computed.tiles)} {unitLbl}</span>
                                  <span style={{ fontSize: 12, color: C.muted, fontFamily: FONT }}>Dispo : {fmtNum(computed.availableTiles)}</span>
                                </div>
                                {hasPieceConv && computed.tiles > 0 && (() => {
                                  const pl=parseFloat(selectedProduct.piece_length_m), fp=Math.floor(computed.tiles/pl), rm=Math.round((computed.tiles%pl)*100)/100
                                  return <div style={{ marginTop: 8, padding: '6px 10px', background: C.blueL, borderRadius: 6, fontSize: 12, color: C.blue, fontFamily: FONT }}>= {fp} {pkgLbl}{fp!==1?'s':''}{rm>0?` + ${rm} m`:' complets'}</div>
                                })()}
                                {hasBagWeight && computed.tiles > 0 && (
                                  <div style={{ marginTop: 8, padding: '6px 10px', background: C.blueL, borderRadius: 6, fontSize: 12, color: C.blue, fontFamily: FONT }}>= {fmtNum(Math.round(computed.tiles*parseFloat(selectedProduct.bag_weight_kg)))} kg total</div>
                                )}
                                {hasContConv && computed.tiles > 0 && (() => {
                                  const vol=parseFloat(selectedProduct.container_volume_l), fc=Math.floor(computed.tiles/vol), rl=Math.round((computed.tiles%vol)*10)/10
                                  return <div style={{ marginTop: 8, padding: '6px 10px', background: C.blueL, borderRadius: 6, fontSize: 12, color: C.blue, fontFamily: FONT }}>= {fc} {pkgLbl}{fc!==1?'s':''}{rl>0?` + ${rl} L`:' complets'}</div>
                                })()}
                              </>
                            )}
                            {computed.stockInsufficient && (
                              <div style={{ marginTop: 8, padding: '8px 10px', background: C.redL, borderRadius: 6, fontSize: 12, fontWeight: 600, color: C.red, fontFamily: FONT }}>
                                Stock insuffisant — disponible : {fmtNum(computed.availableTiles)} {unitLbl}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>

                {/* Price section — shows only when quantity is valid */}
                {computed && computed.tiles > 0 && (
                  <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, fontFamily: FONT }}>
                      Prix négocié
                    </div>
                    {(() => {
                      const isTileProd = (selectedProduct.product_type ?? 'tile') === 'tile'
                      const unitLbl    = selectedProduct.unit_label ?? (isTileProd ? 'm²' : 'unité')
                      const priceSuffix = isTileProd ? `${currency}/m²` : `${currency}/${unitLbl}`
                      return (
                        <>
                          {/* Floor / ref price reference row */}
                          {(computed.floorPrice > 0 || computed.refPrice > 0) && (
                            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                              {computed.floorPrice > 0 && (
                                <div style={{ flex: 1, padding: '10px 12px', background: C.redL, borderRadius: 8, border: `1px solid ${C.red}30` }}>
                                  <div style={{ fontSize: 9, fontWeight: 700, color: C.red, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: FONT }}>Plancher min.</div>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: C.red, fontFamily: FONT }}>{fmtNum(computed.floorPrice)} <span style={{ fontSize: 10, fontWeight: 600 }}>{priceSuffix}</span></div>
                                </div>
                              )}
                              {computed.refPrice > 0 && (
                                <div style={{ flex: 1, padding: '10px 12px', background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                                  <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: FONT }}>Référence</div>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: C.slate, fontFamily: FONT }}>{fmtNum(computed.refPrice)} <span style={{ fontSize: 10, fontWeight: 600 }}>{priceSuffix}</span></div>
                                </div>
                              )}
                            </div>
                          )}

                          <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>
                              Prix par {isTileProd ? 'm²' : unitLbl} ({currency})
                            </label>
                            <input type="number" min="0" value={unitPrice} onChange={e => setUnitPrice(e.target.value)}
                              placeholder={computed.floorPrice > 0 ? `min. ${fmtNum(computed.floorPrice)}` : 'ex : 5 000'}
                              style={inputStyle(computed.floorViolation)} />
                          </div>

                          {computed.floorViolation && (
                            <div style={{ padding: '10px 12px', background: C.redL, borderRadius: 8, border: `1px solid ${C.red}`, fontSize: 12, fontWeight: 600, color: C.red, marginBottom: 12, fontFamily: FONT }}>
                              Prix inférieur au plancher — vente bloquée
                            </div>
                          )}

                          {error && (
                            <div style={{ padding: '10px 12px', background: C.redL, borderRadius: 8, border: `1px solid ${C.red}`, fontSize: 12, fontWeight: 600, color: C.red, marginBottom: 12, fontFamily: FONT }}>
                              {error}
                            </div>
                          )}

                          <button className="btn-meram"
                            onClick={addToCart}
                            disabled={computed.floorViolation || computed.stockInsufficient || computed.price <= 0 || computed.tiles <= 0}
                            style={{ width: '100%', padding: '13px', borderRadius: 10, border: 'none', cursor: computed.floorViolation||computed.stockInsufficient||computed.price<=0 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: computed.floorViolation||computed.stockInsufficient||computed.price<=0 ? 0.5 : 1 }}>
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                              <circle cx="6" cy="13" r="1.2" fill="white"/><circle cx="12" cy="13" r="1.2" fill="white"/>
                              <path d="M1 1h2l2 8h7l1.5-5H5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Ajouter au panier{computed.price > 0 ? ` · ${fmt(computed.total)}` : ''}
                          </button>
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── COL 3: Cart ── */}
          <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Boutique selector */}
            {isOwnerOrAdmin && allBoutiques.length > 0 && (
              <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: '12px 14px' }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8, fontFamily: FONT }}>Boutique</label>
                <select value={selectedBoutique?.id??''} onChange={e => setBoutique(allBoutiques.find(b=>b.id===e.target.value)??null)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, background: C.surface, fontFamily: FONT, outline: 'none' }}>
                  {allBoutiques.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}

            {/* Cart panel */}
            <div style={{ background: C.navyDark, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
              {/* Cart header */}
              <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="6" cy="13" r="1.2" fill="rgba(255,255,255,0.6)"/><circle cx="12" cy="13" r="1.2" fill="rgba(255,255,255,0.6)"/>
                    <path d="M1 1h2l2 8h7l1.5-5H5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: FONT }}>Panier</span>
                </div>
                {cart.length > 0 && (
                  <div style={{ background: C.blue, color: '#fff', fontSize: 10, fontWeight: 800, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {cart.length}
                  </div>
                )}
              </div>

              {/* Cart items */}
              <div style={{ maxHeight: 280, overflowY: 'auto', padding: '8px' }}>
                {cart.length === 0 ? (
                  <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', fontFamily: FONT }}>Aucun produit ajouté</div>
                  </div>
                ) : cart.map((item, idx) => {
                  const isItemTile = (item.product?.product_type ?? 'tile') === 'tile'
                  const unitLbl    = item.product?.unit_label ?? 'unité'
                  return (
                    <div key={idx} style={{ padding: '10px 10px', borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: FONT, flex: 1, marginRight: 8, lineHeight: 1.3 }}>{item.product.product_name}</span>
                        <button onClick={() => removeFromCart(idx)}
                          style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </button>
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 5, fontFamily: FONT }}>
                        {isItemTile
                          ? `${fmtM2(item.quantityM2)} · ${item.quantityCartons} ctn${item.looseTiles>0?` +${item.looseTiles}`:''} · ${fmtNum(item.unitPricePerM2)} ${currency}/m²`
                          : `${fmtNum(item.quantityTiles)} ${pluralize(unitLbl, item.quantityTiles)} · ${fmtNum(item.unitPricePerM2)} ${currency}/${unitLbl}`
                        }
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: FONT }}>{fmt(item.totalPrice)}</div>
                    </div>
                  )
                })}
              </div>

              {/* Cart total */}
              {cart.length > 0 && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: FONT }}>Total</span>
                  <span style={{ color: '#fff', fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', fontFamily: FONT }}>{fmt(cartTotal)}</span>
                </div>
              )}
            </div>

            {/* Continue button */}
            <button className="btn-meram"
              onClick={() => { setError(null); setFormStep(2) }}
              disabled={cart.length === 0}
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: cart.length===0?'not-allowed':'pointer', fontSize: 14, fontWeight: 700, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: cart.length===0 ? 0.45 : 1 }}>
              Continuer — Infos client
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8M7 3l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════ STEP 2 ═══════════════════════════════ */}
      {formStep === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: 16, alignItems: 'start' }}>

          {/* ── Left: Client + Payment ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Back */}
            <button onClick={() => { setError(null); setFormStep(1) }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: FONT, alignSelf: 'flex-start' }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M11 7H3M7 3L3 7l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Retour au panier
            </button>

            {/* Client info */}
            <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, fontFamily: FONT }}>
                Informations client
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>Nom du client <span style={{ color: C.red }}>*</span></label>
                  <input type="text" value={customerName} onChange={e => setName(e.target.value)} placeholder="ex : Michel Abanda" style={inputStyle(!customerName.trim() && !!error)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>N° CNI <span style={{ color: C.red }}>*</span></label>
                  <input type="text" value={customerCNI} onChange={e => setCNI(e.target.value)} placeholder="ex : 1 23 04 5678 912 34" style={inputStyle(!customerCNI.trim() && !!error)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>Téléphone principal <span style={{ color: C.red }}>*</span></label>
                  <input type="tel" value={customerPhone} onChange={e => setPhone(e.target.value)} placeholder="ex : 6 99 11 22 33" style={inputStyle(!customerPhone.trim() && !!error)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>Téléphone secondaire <span style={{ fontSize: 11, fontWeight: 400, color: C.muted }}>(optionnel)</span></label>
                  <input type="tel" value={customerPhone2} onChange={e => setPhone2(e.target.value)} placeholder="ex : 6 88 44 55 66" style={inputStyle()} />
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>Notes <span style={{ fontSize: 11, fontWeight: 400, color: C.muted }}>(optionnel)</span></label>
                <textarea value={notes} rows={2} onChange={e => setNotes(e.target.value)} placeholder="Instructions de livraison, observations…" style={{ ...inputStyle(), resize: 'vertical' }} />
              </div>
            </div>

            {/* Payment */}
            <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, fontFamily: FONT }}>
                Paiement
              </div>

              {/* Quick-select */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button type="button" onClick={() => setAmountPaid(String(cartTotal))}
                  style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1.5px solid ${parseFloat(amountPaid)>=cartTotal&&amountPaid ? C.green : C.border}`, background: parseFloat(amountPaid)>=cartTotal&&amountPaid ? C.greenL : C.bg, color: parseFloat(amountPaid)>=cartTotal&&amountPaid ? C.green : C.slate, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                  Paiement complet
                </button>
                <button type="button" onClick={() => setAmountPaid('')}
                  style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1.5px solid ${amountPaid==='' ? C.blue : C.border}`, background: amountPaid==='' ? C.blueL : C.bg, color: amountPaid==='' ? C.blue : C.slate, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
                  Acompte / Partiel
                </button>
              </div>

              <input type="number" min="0" step="100" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} placeholder={`Montant encaissé (max ${fmt(cartTotal)})`} style={inputStyle()} />

              {/* Balance summary */}
              {(() => {
                const paid    = Math.max(0, parseFloat(amountPaid) || 0)
                const balance = cartTotal - paid
                const isOver  = paid > cartTotal
                if (paid === 0) return null
                return (
                  <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 9, background: isOver ? C.redL : balance===0 ? C.greenL : C.orangeL, border: `1px solid ${isOver ? C.red : balance===0 ? C.green : C.orange}`, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 13, color: C.slate, fontFamily: FONT }}>Encaissé : <strong>{fmt(paid)}</strong></span>
                    {isOver ? (
                      <span style={{ fontSize: 13, color: C.red, fontWeight: 700, fontFamily: FONT }}>Montant supérieur au total</span>
                    ) : balance === 0 ? (
                      <span style={{ fontSize: 13, color: C.green, fontWeight: 700, fontFamily: FONT }}>Soldé</span>
                    ) : (
                      <span style={{ fontSize: 13, color: C.orange, fontWeight: 700, fontFamily: FONT }}>Reste : {fmt(balance)}</span>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>

          {/* ── Right: Order summary + confirm ── */}
          <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Cart summary (read-only) */}
            <div style={{ background: C.navyDark, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
              <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: FONT }}>Récapitulatif</span>
              </div>
              <div style={{ padding: '8px', maxHeight: 260, overflowY: 'auto' }}>
                {cart.map((item, idx) => {
                  const isItemTile = (item.product?.product_type ?? 'tile') === 'tile'
                  const unitLbl    = item.product?.unit_label ?? 'unité'
                  return (
                    <div key={idx} style={{ padding: '10px', borderRadius: 8, marginBottom: 5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontFamily: FONT, flex: 1 }}>{item.product.product_name}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', fontFamily: FONT, flexShrink: 0 }}>{fmt(item.totalPrice)}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2, fontFamily: FONT }}>
                        {isItemTile ? `${fmtM2(item.quantityM2)} · ${fmtNum(item.unitPricePerM2)} ${currency}/m²` : `${fmtNum(item.quantityTiles)} ${pluralize(unitLbl, item.quantityTiles)} · ${fmtNum(item.unitPricePerM2)} ${currency}/${unitLbl}`}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: FONT }}>Total</span>
                <span style={{ color: '#fff', fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', fontFamily: FONT }}>{fmt(cartTotal)}</span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: '12px 14px', background: C.redL, borderRadius: 10, border: `1px solid ${C.red}`, fontSize: 13, fontWeight: 600, color: C.red, fontFamily: FONT }}>
                {error}
              </div>
            )}

            {/* Confirm */}
            <button className="btn-meram" onClick={handleConfirm} disabled={loading}
              style={{ width: '100%', padding: '16px', borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 800, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.7 : 1 }}>
              {loading ? (
                <><span className="spinner" />Enregistrement…</>
              ) : (
                <><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>Confirmer · {fmt(cartTotal)}</>
              )}
            </button>
          </div>
        </div>
      )}

    </PageLayout>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function TypeIcon({ type, color, size = 15 }: { type: string; color: string; size?: number }) {
  switch (type) {
    case 'tile':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="5.5" height="5.5" rx="1.2" fill={color}/>
          <rect x="9.5" y="1" width="5.5" height="5.5" rx="1.2" fill={color}/>
          <rect x="1" y="9.5" width="5.5" height="5.5" rx="1.2" fill={color}/>
          <rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1.2" fill={color}/>
        </svg>
      )
    case 'bag':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <path d="M3 6h10l-1.5 8H4.5L3 6z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
          <path d="M5.5 6C5.5 3.5 6.5 2 8 2s2.5 1.5 2.5 4" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      )
    case 'liter':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <path d="M8 2L4 8a4 4 0 1 0 8 0L8 2z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
          <path d="M5.5 10a2.5 2.5 0 0 0 2.5 2.5" stroke={color} strokeWidth="1.1" strokeLinecap="round" opacity="0.6"/>
        </svg>
      )
    case 'linear_m':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <rect x="1" y="5.5" width="14" height="5" rx="1.5" stroke={color} strokeWidth="1.4"/>
          <path d="M4 5.5v2M7 5.5v3M10 5.5v2M13 5.5v2" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      )
    default: // unit
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <path d="M8 1.5L14 5v6L8 14.5 2 11V5L8 1.5z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/>
          <path d="M2 5l6 3.5 6-3.5M8 1.5v13" stroke={color} strokeWidth="1.2" strokeLinejoin="round"/>
        </svg>
      )
  }
}
