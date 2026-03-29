'use client'

import React, { useState, useMemo, useTransition }  from 'react'
import { useRouter }          from 'next/navigation'
import { createClient }       from '@/lib/supabase/client'
import { createSale }         from '@/app/sales/actions'
import PageLayout             from '@/components/PageLayout'
import type { BadgeCounts }  from '@/lib/supabase/badge-counts'

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
const fmtM2 = (n: number) =>
  new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n) + ' m²'

type InputMode = 'm2' | 'cartons' | 'tiles' | 'cartons_tiles' | 'qty'

interface CartItem {
  product:         any
  inputMode:       InputMode
  // unitPricePerM2 stores price/m² for tiles, price/unit for non-tile
  unitPricePerM2:  number
  // quantityTiles stores tile count for tiles, unit count for non-tile
  quantityTiles:   number
  quantityM2:      number   // 0 for non-tile
  quantityCartons: number   // 0 for non-tile
  looseTiles:      number   // 0 for non-tile
  totalPrice:      number
}

export default function VendorSaleForm({
  profile, boutique, products, allBoutiques, isOwnerOrAdmin, badgeCounts, ownerName = 'Le Propriétaire',
}: {
  profile: any; boutique: any; products: any[]
  allBoutiques: any[]; isOwnerOrAdmin: boolean
  badgeCounts?: BadgeCounts
  ownerName?: string
}) {
  const router   = useRouter()
  const supabase = createClient()
  const [navPending, startNavTransition] = useTransition()

  const [selectedBoutique, setBoutique]     = useState<any>(boutique)
  const [selectedProduct,  setProduct]      = useState<any>(products[0] ?? null)
  const [productSearch,    setProductSearch] = useState('')
  const [inputMode,        setInputMode] = useState<InputMode>('m2')
  const [inputM2,          setInputM2]   = useState('')
  const [inputTiles,       setInputTiles] = useState('')
  const [inputCartons,     setCartons]   = useState('')
  const [inputLooseTiles,  setLoose]     = useState('')
  const [unitPrice,        setUnitPrice] = useState('')
  const [cart,             setCart]      = useState<CartItem[]>([])
  const [customerName,     setName]      = useState('')
  const [customerPhone,    setPhone]     = useState('')
  const [customerPhone2,   setPhone2]    = useState('')
  const [customerCNI,      setCNI]       = useState('')
  const [notes,            setNotes]     = useState('')
  const [amountPaid,       setAmountPaid] = useState('')
  const [loading,          setLoading]   = useState(false)
  const [error,            setError]     = useState<string | null>(null)
  const [successData,      setSuccess]   = useState<any>(null)
  const [step,             setStep]      = useState<'form' | 'success'>('form')
  const [formStep,         setFormStep]  = useState<1 | 2>(1)

  const [inputQty, setInputQty] = useState('')   // non-tile quantity

  const resetInputs = () => {
    setInputM2(''); setInputTiles(''); setCartons(''); setLoose('')
    setInputQty(''); setUnitPrice('')
  }

  // ── Computed values — branches on product type ────────────────────────────
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

      return {
        isTile: true as const, tiles, m2, fullCartons, loose, price, total,
        floorPrice, refPrice, floorViolation, stockInsufficient, availableTiles,
      }
    } else {
      // Non-tile: single quantity input
      const qty = parseInt(inputQty) || 0
      if (qty <= 0) return null

      const floorPrice     = parseFloat(selectedProduct.floor_price_per_unit ?? 0)
      const refPrice       = parseFloat(selectedProduct.reference_price_per_unit ?? 0)
      const total          = qty * price
      const floorViolation = price > 0 && floorPrice > 0 && price < floorPrice
      const stockInsufficient = qty > availableTiles

      return {
        isTile: false as const, tiles: qty, m2: 0, fullCartons: 0, loose: 0,
        price, total, floorPrice, refPrice, floorViolation, stockInsufficient, availableTiles,
      }
    }
  }, [selectedProduct, inputMode, inputM2, inputTiles, inputCartons, inputLooseTiles, inputQty, unitPrice])

  const cartTotal = cart.reduce((sum, i) => sum + i.totalPrice, 0)

  // ── HTML escaping helper (prevents XSS in printed windows) ───────────────
  const escHtml = (s: string | null | undefined): string =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

  // ── Print receipt ─────────────────────────────────────────────────────────
  const printReceipt = () => {
    const now = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
    const rows = cart.map(item => {
      const isItemTile = (item.product?.product_type ?? 'tile') === 'tile'
      const unitLbl    = escHtml(item.product?.unit_label ?? (isItemTile ? 'm²' : 'unité'))
      let qtyCell: string
      let priceCell: string
      if (isItemTile) {
        const m2   = item.quantityM2
        const full = item.quantityCartons
        const loose = item.looseTiles
        qtyCell   = `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(m2)} m² · ${full}${loose > 0 ? ` <span style="color:#D97706">+${loose}</span>` : ''} ctn`
        priceCell = `${new Intl.NumberFormat('fr-FR').format(item.unitPricePerM2)} FCFA/m²`
      } else {
        qtyCell   = `${new Intl.NumberFormat('fr-FR').format(item.quantityTiles)} ${unitLbl}`
        priceCell = `${new Intl.NumberFormat('fr-FR').format(item.unitPricePerM2)} FCFA/${unitLbl}`
      }
      return `
        <tr>
          <td>${escHtml(item.product?.product_name ?? item.product?.name)}</td>
          <td style="color:#64748B;font-size:11px">${escHtml(item.product?.reference_code)}</td>
          <td style="text-align:center">${qtyCell}</td>
          <td style="text-align:right">${priceCell}</td>
          <td style="text-align:right;font-weight:700">${new Intl.NumberFormat('fr-FR').format(Math.round(item.totalPrice))} FCFA</td>
        </tr>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=800"/>
  <title>Reçu de vente — ${escHtml(successData?.saleNumber)}</title>
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
    .sig-block { }
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
      <div>${escHtml(selectedBoutique?.name)}</div>
    </div>
  </div>

  <div class="sale-id">${escHtml(successData?.saleNumber) || '—'}</div>
  <div style="font-size:12px;color:#64748B;margin-bottom:20px">
    ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
  </div>

  <div class="info-block">
    <div class="info-col">
      <div class="info-label">Client</div>
      <div class="info-value">${escHtml(customerName) || 'Client anonyme'}</div>
      ${customerPhone ? `<div style="font-size:12px;color:#64748B;margin-top:2px">${escHtml(customerPhone)}</div>` : ''}
      ${customerCNI ? `<div style="font-size:11px;color:#94A3B8;margin-top:2px">CNI : ${escHtml(customerCNI)}</div>` : ''}
    </div>
    <div class="info-col">
      <div class="info-label">Vendeur</div>
      <div class="info-value">${escHtml(profile?.full_name) || '—'}</div>
      <div style="font-size:12px;color:#64748B;margin-top:2px">${escHtml(selectedBoutique?.name)}</div>
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
      const total   = Math.round(successData?.serverTotal ?? cartTotal)
      const paid    = Math.max(0, parseFloat(amountPaid) || 0)
      const balance = Math.max(0, total - paid)
      const payLabel = paid >= total ? 'Payé' : paid > 0 ? 'Acompte versé' : 'Impayé'
      const payColor = paid >= total ? '#059669' : paid > 0 ? '#D97706' : '#DC2626'
      return `
  <div class="total-row">
    <div class="total-box">
      <div class="total-label">Montant total</div>
      <div class="total-amount">${new Intl.NumberFormat('fr-FR').format(total)} FCFA</div>
      ${paid > 0 ? `<div style="margin-top:8px;font-size:12px;color:#94A3B8">Encaissé : ${new Intl.NumberFormat('fr-FR').format(Math.round(paid))} FCFA</div>` : ''}
      ${balance > 0 ? `<div style="font-size:12px;color:#FCA5A5;margin-top:2px">Reste : ${new Intl.NumberFormat('fr-FR').format(balance)} FCFA</div>` : ''}
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
      <div class="sig-block">
        <div class="sig-name">${escHtml(profile?.full_name) || 'Le vendeur'}</div>
        <div class="sig-role">Vendeur — ${escHtml(selectedBoutique?.name)}</div>
        <div class="sig-line"></div>
        <div class="sig-sub">Signature du vendeur</div>
      </div>
      <div class="sig-block">
        <div class="sig-name">${escHtml(ownerName)}</div>
        <div class="sig-role">Propriétaire — UCA</div>
        <div class="sig-line"></div>
        <div class="sig-sub">Signature du propriétaire</div>
      </div>
    </div>
  </div>

  <div class="footer">
    UCA — Reçu généré le ${now} · Document officiel
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

  // ── Add to cart — merges if same product + same price ────────────────────
  const addToCart = () => {
    if (!computed || !selectedProduct) return
    if (computed.floorViolation || computed.stockInsufficient) return
    if (computed.price <= 0 || computed.tiles <= 0) return

    const existingIdx = cart.findIndex(
      item =>
        item.product.product_id === selectedProduct.product_id &&
        item.unitPricePerM2     === computed.price
    )

    const isTileProd = computed.isTile
    const available  = parseInt(selectedProduct.available_tiles)

    if (existingIdx >= 0) {
      const existing = cart[existingIdx]
      const newQty   = existing.quantityTiles + computed.tiles

      if (newQty > available) {
        const unit = isTileProd ? 'carreau' : (selectedProduct.unit_label ?? 'unité')
        const unitPlural = isTileProd ? 'carreaux' : (selectedProduct.unit_label ?? 'unités')
        setError(
          `Stock insuffisant — vous avez déjà ${existing.quantityTiles} ${existing.quantityTiles > 1 ? unitPlural : unit} dans le panier ` +
          `pour ce produit (${available} disponible${available > 1 ? 's' : ''} au total).`
        )
        return
      }

      const updated = [...cart]
      if (isTileProd) {
        const tpc   = parseInt(selectedProduct.tiles_per_carton)
        const newM2 = parseFloat((newQty * parseFloat(selectedProduct.tile_area_m2)).toFixed(4))
        updated[existingIdx] = {
          ...existing,
          quantityTiles:   newQty,
          quantityM2:      newM2,
          quantityCartons: Math.floor(newQty / tpc),
          looseTiles:      newQty % tpc,
          totalPrice:      newM2 * computed.price,
        }
      } else {
        updated[existingIdx] = {
          ...existing,
          quantityTiles: newQty,
          totalPrice:    newQty * computed.price,
        }
      }
      setCart(updated)
    } else {
      setCart(prev => [...prev, {
        product:         selectedProduct,
        inputMode,
        unitPricePerM2:  computed.price,
        quantityTiles:   computed.tiles,
        quantityM2:      computed.m2,
        quantityCartons: computed.fullCartons,
        looseTiles:      computed.loose,
        totalPrice:      computed.total,
      }])
    }

    resetInputs()
    setError(null)
  }

  const removeFromCart = (idx: number) =>
    setCart(prev => prev.filter((_, i) => i !== idx))

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (cart.length === 0) return
    if (!customerName.trim())  { setError('Le nom du client est obligatoire.');        return }
    if (!customerPhone.trim()) { setError('Le numéro de téléphone est obligatoire.');  return }
    if (!customerCNI.trim())   { setError('Le numéro CNI du client est obligatoire.'); return }

    setLoading(true)
    setError(null)

    const phone = customerPhone2.trim()
      ? `${customerPhone.trim()} / ${customerPhone2.trim()}`
      : customerPhone.trim()

    const result = await createSale({
      boutique_id:    selectedBoutique?.id ?? boutique?.id,
      vendor_id:      profile.id,
      customer_name:  customerName.trim(),
      customer_phone: phone,
      customer_cni:   customerCNI.trim(),
      total_amount:   cartTotal,
      amount_paid:    parseFloat(amountPaid) || 0,
      notes:          notes || null,
      items: cart.map(item => {
        const isItemTile = (item.product.product_type ?? 'tile') === 'tile'
        return {
          product_id:                item.product.product_id,
          quantity_tiles:            item.quantityTiles,
          unit_price_per_m2:         item.unitPricePerM2,
          total_price:               item.totalPrice,
          floor_price_snapshot:      isItemTile
            ? parseFloat(item.product.floor_price_per_m2 ?? 0)
            : parseFloat(item.product.floor_price_per_unit ?? 0),
          reference_price_snapshot:  isItemTile
            ? parseFloat(item.product.reference_price_per_m2 ?? 0)
            : parseFloat(item.product.reference_price_per_unit ?? 0),
          purchase_price_snapshot:   0,  // overwritten server-side from DB
          tile_area_m2_snapshot:     isItemTile ? parseFloat(item.product.tile_area_m2) : null,
          tiles_per_carton_snapshot: isItemTile ? parseInt(item.product.tiles_per_carton) : null,
        }
      }),
    })

    setLoading(false)
    if (result.error) { setError(result.error); return }
    setSuccess(result)
    setStep('success')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const inputStyle = (hasError = false): React.CSSProperties => ({
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: `1.5px solid ${hasError ? C.red : C.border}`,
    fontSize: 13, color: C.ink, outline: 'none',
    boxSizing: 'border-box', background: C.surface,
    fontFamily: FONT,
  })

  // ── SUCCESS ───────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <PageLayout profile={profile} activeRoute="/sales" onLogout={handleLogout} badgeCounts={badgeCounts}>
        <div style={{ display: 'flex', flex: 1,
          alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div style={{ background: C.surface, borderRadius: 16, padding: 48,
            maxWidth: 480, width: '100%', textAlign: 'center',
            border: `1px solid ${C.border}`,
            boxShadow: '0 8px 40px rgba(0,0,0,0.08)' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%',
              background: C.greenL, display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M6 14l6 6 10-12" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: C.ink,
              margin: '0 0 8px', letterSpacing: '-0.02em', fontFamily: FONT }}>
              Vente confirmée
            </h2>
            <div style={{ fontSize: 28, fontWeight: 900, color: C.navy,
              margin: '16px 0', letterSpacing: '-0.02em', fontFamily: FONT }}>
              {successData?.saleNumber}
            </div>
            <p style={{ color: C.muted, fontSize: 14, margin: '0 0 4px', fontFamily: FONT }}>
              Montant total
            </p>
            <p style={{ fontSize: 22, fontWeight: 700, color: C.green,
              margin: '0 0 24px', fontFamily: FONT }}>
              {fmtCFA(successData?.serverTotal ?? cartTotal)}
            </p>
            <div style={{ padding: '14px', background: C.blueL,
              borderRadius: 8, fontSize: 13, color: C.blue, marginBottom: 28,
              fontFamily: FONT }}>
              La commande a été transmise à l'entrepôt automatiquement.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn-navy"
                onClick={printReceipt}
                style={{ width: '100%', padding: '13px', background: C.navy,
                  color: C.surface, border: 'none', borderRadius: 8,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <rect x="1" y="5" width="13" height="8" rx="1.5" stroke="white" strokeWidth="1.3"/>
                  <path d="M4 5V3a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 .5.5v2" stroke="white" strokeWidth="1.3"/>
                  <path d="M4 10.5h7M4 8h4.5" stroke="white" strokeWidth="1.1" strokeLinecap="round"/>
                </svg>
                Imprimer le reçu
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn-outline-navy"
                  onClick={() => {
                    setCart([]); setName(''); setPhone(''); setPhone2('')
                    setCNI(''); setNotes(''); setAmountPaid(''); resetInputs()
                    setStep('form'); setFormStep(1)
                  }}
                  style={{ flex: 1, padding: '11px', background: C.surface,
                    color: C.navy, border: `1.5px solid ${C.navy}`,
                    borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    fontFamily: FONT }}>
                  Nouvelle vente
                </button>
                <button
                  className="btn-ghost"
                  disabled={navPending}
                  onClick={() => startNavTransition(() => router.push('/sales'))}
                  style={{ flex: 1, padding: '11px', background: C.surface,
                    color: navPending ? C.muted : C.slate,
                    border: `1.5px solid ${C.border}`,
                    borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: navPending ? 'not-allowed' : 'pointer',
                    fontFamily: FONT, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 7,
                  }}>
                  {navPending
                    ? <><span className="spinner-dark" />Chargement…</>
                    : 'Mes ventes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </PageLayout>
    )
  }

  // ── MAIN FORM ─────────────────────────────────────────────────────────────
  return (
    <PageLayout profile={profile} activeRoute="/sales" onLogout={handleLogout} badgeCounts={badgeCounts}>

        {/* Back nav */}
        <button
          className="btn-ghost"
          disabled={navPending}
          onClick={() => startNavTransition(() => router.push('/sales'))}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: C.surface, border: `1.5px solid ${C.border}`,
            borderRadius: 8,
            cursor: navPending ? 'not-allowed' : 'pointer',
            fontFamily: FONT, fontSize: 13, fontWeight: 600,
            color: navPending ? C.muted : C.navy,
            padding: '8px 14px', marginBottom: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            transition: 'color 0.15s',
          }}>
          {navPending ? (
            <><span className="spinner-dark" />Chargement…</>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Retour aux ventes
            </>
          )}
        </button>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.ink,
            margin: '0 0 4px', letterSpacing: '-0.02em', fontFamily: FONT }}>
            Nouvelle vente
          </h1>
          <p style={{ fontSize: 13, color: C.slate, margin: 0, fontFamily: FONT }}>
            Boutique {selectedBoutique?.name} ·{' '}
            {new Date().toLocaleDateString('fr-FR', {
              weekday: 'long', day: 'numeric', month: 'long'
            })}
          </p>
        </div>

        {/* ── Step indicator ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          {([
            [1, 'Sélection & panier'],
            [2, 'Client & confirmation'],
          ] as [number, string][]).map(([n, label]) => (
            <React.Fragment key={n}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: formStep === n ? C.navy : formStep > n ? C.green : C.border,
                  color: formStep >= n ? '#fff' : C.muted,
                  fontSize: 12, fontWeight: 700,
                }}>
                  {formStep > n
                    ? <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : n
                  }
                </div>
                <span style={{
                  fontSize: 12, fontWeight: formStep === n ? 700 : 400,
                  color: formStep === n ? C.ink : C.muted, fontFamily: FONT,
                }}>
                  {label}
                </span>
              </div>
              {n < 2 && <div style={{ flex: 1, height: 1, background: formStep > n ? C.green : C.border, maxWidth: 40 }} />}
            </React.Fragment>
          ))}
        </div>

        <div style={{ display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>

          {/* ── LEFT — step 1 only ── */}
          {formStep === 1 && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Product selector */}
            <Card>
              <SectionLabel>1. Sélection du produit</SectionLabel>
              {products.length === 0 ? (
                <p style={{ color: C.muted, fontSize: 13, fontFamily: FONT }}>
                  Aucun produit en stock disponible.
                </p>
              ) : (
              <>
              <input
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Rechercher un produit…"
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  border: `1.5px solid ${C.border}`, fontSize: 13,
                  color: C.ink, outline: 'none', boxSizing: 'border-box',
                  background: C.surface, fontFamily: FONT, marginBottom: 10,
                }}
              />
              <div style={{ maxHeight: 260, overflowY: 'auto',
                display: 'flex', flexDirection: 'column', gap: 6 }}>
                {products
                  .filter(p => !productSearch ||
                    p.product_name.toLowerCase().includes(productSearch.toLowerCase()) ||
                    p.reference_code.toLowerCase().includes(productSearch.toLowerCase())
                  )
                  .map(prod => {
                  const isSelected  = selectedProduct?.product_id === prod.product_id
                  const prodIsTile  = (prod.product_type ?? 'tile') === 'tile'
                  const availCount  = parseInt(prod.available_tiles)
                  const availDisplay = prodIsTile
                    ? fmtM2(availCount * parseFloat(prod.tile_area_m2))
                    : `${fmtNum(availCount)} ${prod.unit_label ?? 'unités'}`
                  const isLow = prodIsTile ? availCount < 50 : availCount < 10
                  const subtitle = prodIsTile
                    ? `${prod.reference_code} · ${prod.tiles_per_carton} car./carton`
                    : `${prod.reference_code} · ${prod.unit_label ?? ''}`
                  return (
                    <button key={prod.product_id}
                      onClick={() => {
                        setProduct(prod)
                        setInputMode(prodIsTile ? 'm2' : 'qty')
                        resetInputs()
                      }}
                      style={{
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: 8,
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        flexShrink: 0,
                        background: isSelected ? C.blueL : C.surface,
                        border: `1.5px solid ${isSelected ? C.blue : C.border}`,
                        fontFamily: FONT,
                      }}>
                      <div style={{ minWidth: 0, marginRight: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.ink,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {prod.product_name}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                          {subtitle}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 11, color: C.muted }}>Dispo.</div>
                        <div style={{ fontSize: 13, fontWeight: 900,
                          color: isLow ? C.red : C.green }}>
                          {availDisplay}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              </>
              )}
            </Card>

            {/* Quantity */}
            {selectedProduct && (
              <Card>
                <SectionLabel>2. Quantité</SectionLabel>

                {(selectedProduct.product_type ?? 'tile') === 'tile' ? (
                  <>
                    {/* Mode tabs — tile only */}
                    <div style={{ display: 'grid',
                      gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
                      {([
                        ['m2',           'm²'],
                        ['cartons_tiles','Cartons + carreaux'],
                      ] as [InputMode, string][]).map(([mode, label]) => (
                        <button key={mode}
                          onClick={() => { setInputMode(mode); resetInputs() }}
                          style={{
                            padding: '10px 4px', borderRadius: 7,
                            fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            background: inputMode === mode ? C.navy : C.surface,
                            color: inputMode === mode ? C.surface : C.muted,
                            border: `1.5px solid ${inputMode === mode ? C.navy : C.border}`,
                            fontFamily: FONT,
                          }}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {inputMode === 'm2' && (
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600,
                          color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>
                          Quantité en m²
                        </label>
                        <input type="number" min="0" step="0.01"
                          value={inputM2}
                          onChange={e => setInputM2(e.target.value)}
                          placeholder="ex : 12.5"
                          style={inputStyle(computed?.stockInsufficient ?? false)} />
                      </div>
                    )}

                    {inputMode === 'cartons_tiles' && (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 600,
                            color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>
                            Cartons complets
                          </label>
                          <input type="number" min="0" step="1"
                            value={inputCartons}
                            onChange={e => setCartons(e.target.value)}
                            placeholder="ex : 3"
                            style={inputStyle(computed?.stockInsufficient ?? false)} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, fontWeight: 600,
                            color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>
                            Carreaux en plus
                          </label>
                          <input type="number" min="0"
                            max={String(parseInt(selectedProduct.tiles_per_carton) - 1)}
                            step="1"
                            value={inputLooseTiles}
                            onChange={e => setLoose(e.target.value)}
                            placeholder={`0 – ${parseInt(selectedProduct.tiles_per_carton) - 1}`}
                            style={inputStyle()} />
                        </div>
                      </div>
                    )}

                    {/* Equivalences — tile */}
                    {computed && (
                      <div style={{ marginTop: 14, padding: 12, background: C.bg,
                        borderRadius: 8, border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: C.muted,
                          textTransform: 'uppercase', letterSpacing: '0.06em',
                          marginBottom: 10, fontFamily: FONT }}>
                          Équivalences
                        </div>
                        <div style={{ display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                          {([
                            ['Surface',  fmtM2(computed.m2),     inputMode === 'm2'],
                            ['Cartons',  computed.fullCartons + (computed.loose ? ` + ${computed.loose} car.` : ''),
                                         inputMode === 'cartons' || inputMode === 'cartons_tiles'],
                            ['Carreaux', fmtNum(computed.tiles), inputMode === 'tiles'],
                          ] as [string, string, boolean][]).map(([lbl, val, active]) => (
                            <div key={lbl} style={{ textAlign: 'center',
                              padding: '8px 6px',
                              background: active ? C.blueL : C.surface,
                              borderRadius: 6,
                              border: `1px solid ${active ? C.blue : C.border}` }}>
                              <div style={{ fontSize: 10, color: C.muted, fontFamily: FONT }}>{lbl}</div>
                              <div style={{ fontSize: 14, fontWeight: 700,
                                color: active ? C.blue : C.ink, fontFamily: FONT }}>{val}</div>
                            </div>
                          ))}
                        </div>
                        {computed.loose > 0 && inputMode !== 'cartons_tiles' && (
                          <div style={{ marginTop: 8, padding: '6px 10px',
                            background: C.orangeL, borderRadius: 6,
                            fontSize: 11, color: C.orange, fontFamily: FONT }}>
                            Carton incomplet — {computed.loose} carreau
                            {computed.loose > 1 ? 'x' : ''} issus d'un carton ouvert
                          </div>
                        )}
                        {computed.stockInsufficient && (
                          <div style={{ marginTop: 8, padding: '8px 10px',
                            background: C.redL, borderRadius: 6,
                            fontSize: 12, fontWeight: 600, color: C.red, fontFamily: FONT }}>
                            Stock insuffisant — disponible :{' '}
                            {fmtM2(parseInt(selectedProduct.available_tiles)
                              * parseFloat(selectedProduct.tile_area_m2))}{' '}
                            ({fmtNum(computed.availableTiles)} carreaux)
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  /* Non-tile: single quantity input */
                  <>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600,
                        color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>
                        Quantité ({selectedProduct.unit_label ?? 'unités'})
                      </label>
                      <input type="number" min="1" step="1"
                        value={inputQty}
                        onChange={e => setInputQty(e.target.value)}
                        placeholder="ex : 5"
                        style={inputStyle(computed?.stockInsufficient ?? false)} />
                    </div>
                    {computed && (
                      <div style={{ marginTop: 12, padding: 12, background: C.bg,
                        borderRadius: 8, border: `1px solid ${C.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center' }}>
                          <span style={{ fontSize: 13, color: C.slate, fontFamily: FONT }}>
                            {fmtNum(computed.tiles)} {selectedProduct.unit_label ?? 'unités'}
                          </span>
                          <span style={{ fontSize: 13, color: C.muted, fontFamily: FONT }}>
                            Dispo : {fmtNum(computed.availableTiles)} {selectedProduct.unit_label ?? 'unités'}
                          </span>
                        </div>
                        {computed.stockInsufficient && (
                          <div style={{ marginTop: 8, padding: '8px 10px',
                            background: C.redL, borderRadius: 6,
                            fontSize: 12, fontWeight: 600, color: C.red, fontFamily: FONT }}>
                            Stock insuffisant — disponible : {fmtNum(computed.availableTiles)} {selectedProduct.unit_label ?? 'unités'}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </Card>
            )}

            {/* Price */}
            {selectedProduct && computed && computed.tiles > 0 && (
              <Card>
                <SectionLabel>3. Prix négocié</SectionLabel>
                {(() => {
                  const isTileProd = (selectedProduct.product_type ?? 'tile') === 'tile'
                  const unitLbl    = selectedProduct.unit_label ?? (isTileProd ? 'm²' : 'unité')
                  const priceLabel = isTileProd ? 'Prix par m² (FCFA)' : `Prix par ${unitLbl} (FCFA)`
                  const priceSuffix = isTileProd ? 'FCFA/m²' : `FCFA/${unitLbl}`
                  return (
                    <>
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 12, fontWeight: 600,
                          color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>
                          {priceLabel}
                        </label>
                        <input type="number" min="0"
                          value={unitPrice}
                          onChange={e => setUnitPrice(e.target.value)}
                          placeholder={computed.floorPrice > 0 ? `min. ${fmtNum(computed.floorPrice)}` : 'ex : 5000'}
                          style={inputStyle(computed.floorViolation)} />
                      </div>
                      {(computed.floorPrice > 0 || computed.refPrice > 0) && (
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                          {computed.floorPrice > 0 && (
                            <div style={{ flex: 1, padding: '9px 10px', background: C.redL,
                              borderRadius: 7, border: `1px solid ${C.red}33` }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: C.red,
                                textTransform: 'uppercase', fontFamily: FONT }}>Plancher</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: C.red, fontFamily: FONT }}>
                                {fmtNum(computed.floorPrice)} {priceSuffix}
                              </div>
                            </div>
                          )}
                          {computed.refPrice > 0 && (
                            <div style={{ flex: 1, padding: '9px 10px', background: C.bg,
                              borderRadius: 7, border: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: C.muted,
                                textTransform: 'uppercase', fontFamily: FONT }}>Référence</div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: C.muted, fontFamily: FONT }}>
                                {fmtNum(computed.refPrice)} {priceSuffix}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {computed.floorViolation && (
                        <div style={{ padding: '10px 12px', background: C.redL,
                          borderRadius: 8, border: `1px solid ${C.red}`,
                          fontSize: 12, fontWeight: 600, color: C.red, marginBottom: 12,
                          fontFamily: FONT }}>
                          Prix inférieur au plancher — vente bloquée
                        </div>
                      )}
                      <button
                        className="btn-primary"
                        onClick={addToCart}
                        disabled={
                          computed.floorViolation ||
                          computed.stockInsufficient ||
                          computed.price <= 0 || computed.tiles <= 0
                        }
                        style={{
                          width: '100%', padding: '12px', borderRadius: 8,
                          border: 'none', cursor: 'pointer',
                          background: computed.floorViolation ||
                            computed.stockInsufficient || computed.price <= 0
                            ? C.muted : C.blue,
                          color: C.surface, fontSize: 13, fontWeight: 700,
                          fontFamily: FONT,
                        }}>
                        + Ajouter au panier ·{' '}
                        {computed.price > 0 ? fmtCFA(computed.total) : '—'}
                      </button>
                    </>
                  )
                })()}
              </Card>
            )}
          </div>}

          {/* ── RIGHT ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Boutique selector */}
            {isOwnerOrAdmin && allBoutiques.length > 0 && (
              <Card>
                <SectionLabel>Boutique</SectionLabel>
                <select
                  value={selectedBoutique?.id ?? ''}
                  onChange={e => {
                    const found = allBoutiques.find(b => b.id === e.target.value)
                    setBoutique(found ?? null)
                  }}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: `1.5px solid ${C.border}`, fontSize: 13,
                    color: C.ink, background: C.surface,
                    fontFamily: FONT,
                  }}>
                  {allBoutiques.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </Card>
            )}

            {/* Cart */}
            <Card style={{ background: C.navy }}>
              <SectionLabel light>Panier</SectionLabel>
              {cart.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center',
                  color: 'rgba(255,255,255,0.35)', fontSize: 13, fontFamily: FONT }}>
                  Aucun produit ajouté
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column',
                    gap: 8, marginBottom: 16 }}>
                    {cart.map((item, idx) => (
                      <div key={idx} style={{ padding: 12,
                        background: 'rgba(255,255,255,0.07)', borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.12)' }}>
                        <div style={{ display: 'flex',
                          justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 700,
                            color: C.surface, fontFamily: FONT }}>
                            {item.product.product_name}
                          </span>
                          <button onClick={() => removeFromCart(idx)}
                            style={{ background: 'none', border: 'none',
                              color: 'rgba(255,255,255,0.4)',
                              cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>
                            ×
                          </button>
                        </div>
                        <div style={{ fontSize: 11,
                          color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontFamily: FONT }}>
                          {(item.product.product_type ?? 'tile') === 'tile' ? (
                            <>
                              {fmtM2(item.quantityM2)} ·{' '}
                              {item.quantityCartons} carton{item.quantityCartons !== 1 ? 's' : ''}
                              {item.looseTiles > 0 ? ` + ${item.looseTiles} car.` : ''} ·{' '}
                              {fmtNum(item.unitPricePerM2)} FCFA/m²
                            </>
                          ) : (
                            <>
                              {fmtNum(item.quantityTiles)} {item.product.unit_label ?? 'unités'} ·{' '}
                              {fmtNum(item.unitPricePerM2)} FCFA/{item.product.unit_label ?? 'unité'}
                            </>
                          )}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700,
                          color: C.surface, fontFamily: FONT }}>
                          {fmtCFA(item.totalPrice)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)',
                    paddingTop: 12, display: 'flex',
                    justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: FONT }}>
                      Total
                    </span>
                    <span style={{ color: C.surface, fontSize: 24, fontWeight: 900,
                      letterSpacing: '-0.02em', fontFamily: FONT }}>
                      {fmtCFA(cartTotal)}
                    </span>
                  </div>
                </>
              )}
            </Card>

            {/* Step 1: Continuer button */}
            {formStep === 1 && (
              <button
                className="btn-navy"
                onClick={() => { setError(null); setFormStep(2) }}
                disabled={cart.length === 0}
                style={{
                  width: '100%', padding: '15px', borderRadius: 10,
                  border: 'none',
                  cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                  background: cart.length === 0 ? C.muted : C.navy,
                  color: C.surface, fontSize: 14, fontWeight: 700,
                  fontFamily: FONT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                Continuer — Infos client
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M7 3l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}

            {/* Step 2: Client info + confirm */}
            {formStep === 2 && (
              <>
                <Card>
                  <SectionLabel>2. Informations client</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Nom — required */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600,
                        color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>
                        Nom du client <span style={{ color: C.red }}>*</span>
                      </label>
                      <input type="text" value={customerName}
                        onChange={e => setName(e.target.value)}
                        placeholder="ex : Michel Abanda"
                        style={inputStyle(!customerName.trim() && !!error)} />
                    </div>

                    {/* CNI — required */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600,
                        color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>
                        N° CNI (Carte Nationale d'Identité) <span style={{ color: C.red }}>*</span>
                      </label>
                      <input type="text" value={customerCNI}
                        onChange={e => setCNI(e.target.value)}
                        placeholder="ex : 1 23 04 5678 912 34"
                        style={inputStyle(!customerCNI.trim() && !!error)} />
                    </div>

                    {/* Téléphone principal — required */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600,
                        color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>
                        Téléphone principal <span style={{ color: C.red }}>*</span>
                      </label>
                      <input type="tel" value={customerPhone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="ex : 6 99 11 22 33"
                        style={inputStyle(!customerPhone.trim() && !!error)} />
                    </div>

                    {/* Téléphone secondaire — optional */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600,
                        color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>
                        Téléphone secondaire{' '}
                        <span style={{ fontWeight: 400, color: C.muted }}>(optionnel)</span>
                      </label>
                      <input type="tel" value={customerPhone2}
                        onChange={e => setPhone2(e.target.value)}
                        placeholder="ex : 6 88 44 55 66"
                        style={inputStyle()} />
                    </div>

                    {/* Notes — optional */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600,
                        color: C.ink, display: 'block', marginBottom: 6, fontFamily: FONT }}>
                        Notes{' '}
                        <span style={{ fontWeight: 400, color: C.muted }}>(optionnel)</span>
                      </label>
                      <textarea value={notes} rows={2}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Instructions de livraison, observations…"
                        style={{ ...inputStyle(), resize: 'vertical' }} />
                    </div>

                    {/* ── Paiement ── */}
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.ink,
                        marginBottom: 10, fontFamily: FONT }}>
                        Paiement
                      </div>

                      {/* Quick-select buttons */}
                      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                        <button type="button"
                          onClick={() => setAmountPaid(String(cartTotal))}
                          style={{
                            padding: '6px 14px', borderRadius: 6, border: `1.5px solid ${C.green}`,
                            background: parseFloat(amountPaid) >= cartTotal ? C.green : 'transparent',
                            color: parseFloat(amountPaid) >= cartTotal ? C.surface : C.green,
                            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                          }}>
                          Paiement complet
                        </button>
                        <button type="button"
                          onClick={() => setAmountPaid('')}
                          style={{
                            padding: '6px 14px', borderRadius: 6, border: `1.5px solid ${C.border}`,
                            background: amountPaid === '' ? C.bg : 'transparent',
                            color: C.slate,
                            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                          }}>
                          Acompte / Partiel
                        </button>
                      </div>

                      <input
                        type="number" min="0" step="100"
                        value={amountPaid}
                        onChange={e => setAmountPaid(e.target.value)}
                        placeholder={`Montant encaissé (max ${fmtCFA(cartTotal)})`}
                        style={inputStyle()}
                      />

                      {/* Balance summary */}
                      {(() => {
                        const paid    = Math.max(0, parseFloat(amountPaid) || 0)
                        const balance = cartTotal - paid
                        const isOver  = paid > cartTotal
                        if (paid === 0) return null
                        return (
                          <div style={{
                            marginTop: 10, padding: '10px 14px', borderRadius: 8,
                            background: isOver ? C.redL : balance === 0 ? C.greenL : C.orangeL,
                            border: `1px solid ${isOver ? C.red : balance === 0 ? C.green : C.orange}`,
                            display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
                          }}>
                            <span style={{ fontSize: 12, color: C.slate, fontFamily: FONT }}>
                              Encaissé : <strong>{fmtCFA(paid)}</strong>
                            </span>
                            {isOver ? (
                              <span style={{ fontSize: 12, color: C.red, fontWeight: 700, fontFamily: FONT }}>
                                Montant supérieur au total
                              </span>
                            ) : balance === 0 ? (
                              <span style={{ fontSize: 12, color: C.green, fontWeight: 700, fontFamily: FONT }}>
                                Soldé
                              </span>
                            ) : (
                              <span style={{ fontSize: 12, color: C.orange, fontWeight: 700, fontFamily: FONT }}>
                                Reste : {fmtCFA(balance)}
                              </span>
                            )}
                          </div>
                        )
                      })()}
                    </div>

                  </div>
                </Card>

                {error && (
                  <div style={{ padding: '12px 14px', background: C.redL,
                    borderRadius: 8, border: `1px solid ${C.red}`,
                    fontSize: 13, fontWeight: 600, color: C.red, fontFamily: FONT }}>
                    {error}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    className="btn-green"
                    onClick={handleConfirm}
                    disabled={loading}
                    style={{
                      width: '100%', padding: '16px', borderRadius: 10,
                      border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                      background: loading ? C.muted : C.green,
                      color: C.surface, fontSize: 15, fontWeight: 700,
                      fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                    {loading
                      ? <><span className="spinner" />Enregistrement…</>
                      : `Confirmer la vente · ${fmtCFA(cartTotal)}`}
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => { setError(null); setFormStep(1) }}
                    disabled={loading}
                    style={{
                      width: '100%', padding: '11px', borderRadius: 9,
                      border: `1.5px solid ${C.border}`, cursor: 'pointer',
                      background: C.surface, color: C.slate,
                      fontSize: 13, fontWeight: 600, fontFamily: FONT,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    }}>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                      <path d="M11 7H3M7 3L3 7l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Retour au panier
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
    </PageLayout>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Card({ children, style = {} }: {
  children: React.ReactNode; style?: React.CSSProperties
}) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 12,
      border: '1px solid #E2E8F0', padding: '20px 22px', ...style }}>
      {children}
    </div>
  )
}

function SectionLabel({ children, light = false }: {
  children: React.ReactNode; light?: boolean
}) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600,
      textTransform: 'uppercase' as const, letterSpacing: '0.08em',
      marginBottom: 14,
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      color: light ? 'rgba(255,255,255,0.5)' : '#94A3B8' }}>
      {children}
    </div>
  )
}
