'use client'

import React, { useState, useMemo, useTransition, useEffect, useRef }  from 'react'
import { useRouter }          from 'next/navigation'
import { createClient }       from '@/lib/supabase/client'
import { createSale }         from '@/app/sales/actions'
import { createQuote }        from '@/app/quotes/actions'
import { searchCustomers, createCustomer } from '@/app/customers/actions'
import { downloadInvoicePdf }             from '@/lib/pdf/download'
import PageLayout             from '@/components/PageLayout'
import { useIsMobile }        from '@/hooks/useIsMobile'
import type { BadgeCounts }  from '@/lib/supabase/badge-counts'
import { fmtCurrency }        from '@/lib/format'
import { pluralize }          from '@/lib/pluralize'

import { C, F, R, SP, SH, TR, Z } from '@/lib/design-system'

const fmtNum = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
const fmtM2  = (n: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' m²'

type InputMode = 'm2' | 'cartons' | 'tiles' | 'cartons_tiles' | 'qty' | 'linear_pieces' | 'liter_containers' | 'bag_weight' | 'unit_packages'

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
    case 'tile':     return { label: 'Carrelage', color: '#A0531A', bg: 'rgba(160,83,26,0.10)' }
    case 'unit':     return { label: 'Unités',    color: '#7C3AED', bg: '#F5F3FF' }
    case 'bag':      return { label: 'Sacs',      color: '#D97706', bg: '#FFFBEB' }
    case 'liter':    return { label: 'Liquides',  color: '#0891B2', bg: '#ECFEFF' }
    case 'linear_m': return { label: 'Mètres',   color: '#059669', bg: '#F0FDF4' }
    default:         return { label: 'Produit',   color: '#44403C', bg: '#F5F2ED' }
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
  const [paymentMethod,    setPaymentMethod] = useState<string>('especes')
  const [loading,          setLoading]      = useState(false)
  const [quoteLoading,     setQuoteLoading] = useState(false)
  const [error,            setError]        = useState<string | null>(null)
  const [successData,      setSuccess]      = useState<any>(null)
  const [step,             setStep]         = useState<'form' | 'success' | 'quote-success'>('form')
  const [formStep,         setFormStep]     = useState<1 | 2>(1)
  const [cartSheetOpen,    setCartSheet]    = useState(false)
  const [pdfLoading,       setPdfLoad]      = useState(false)
  const [pdfError,         setPdfError]     = useState<string | null>(null)
  const [customerId,       setCustomerId]   = useState<string | null>(null)
  const [suggestions,      setSuggestions]  = useState<any[]>([])
  const [showSuggestions,  setShowSugg]     = useState(false)
  const [saveAsCustomer,   setSaveAsCustomer] = useState(true)

  const [inputQty,        setInputQty]        = useState('')
  const [inputPieces,     setInputPieces]     = useState('')
  const [inputContainers, setInputContainers] = useState('')
  const [inputWeight,     setInputWeight]     = useState('')  // bag_weight: total kg
  const [inputPackages,   setInputPackages]   = useState('')  // unit_packages: nb of lots

  // Scroll to top whenever the form step changes — fires after React renders the new step
  const topRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' })
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [formStep])

  // Debounced customer autocomplete — fires when customerName changes and no
  // customer is already linked (customerId set).
  useEffect(() => {
    if (customerId) return
    const trimmed = customerName.trim()
    if (trimmed.length < 2) { setSuggestions([]); setShowSugg(false); return }
    const t = setTimeout(async () => {
      const { data } = await searchCustomers(trimmed)
      if (data.length > 0) { setSuggestions(data); setShowSugg(true) }
      else setShowSugg(false)
    }, 300)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerName, customerId])

  const resetInputs = () => {
    setInputM2(''); setInputTiles(''); setCartons(''); setLoose('')
    setInputQty(''); setInputPieces(''); setInputContainers('')
    setInputWeight(''); setInputPackages('')
    setUnitPrice('')
  }

  const computed = useMemo(() => {
    if (!selectedProduct) return null
    const isTile = (selectedProduct.product_type ?? 'tile') === 'tile'
    const price  = parseFloat(unitPrice) || 0
    const availableTiles = parseInt(selectedProduct.available_qty)

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
      const total          = Math.round(m2 * price)
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
      } else if (inputMode === 'bag_weight' && selectedProduct.bag_weight_kg) {
        const kg = parseFloat(inputWeight) || 0
        if (kg <= 0) return null
        // Always round up — a half-bag is a full bag
        qty = Math.ceil(kg / parseFloat(selectedProduct.bag_weight_kg))
      } else if (inputMode === 'unit_packages' && selectedProduct.pieces_per_package) {
        qty = (parseInt(inputPackages) || 0) * parseInt(selectedProduct.pieces_per_package)
      } else {
        qty = parseFloat(inputQty) || 0
      }
      if (qty <= 0) return null
      const floorPrice     = parseFloat(selectedProduct.floor_price_per_unit ?? 0)
      const refPrice       = parseFloat(selectedProduct.reference_price_per_unit ?? 0)
      const total          = Math.round(qty * price)
      const floorViolation = price > 0 && floorPrice > 0 && price < floorPrice
      const stockInsufficient = qty > availableTiles
      return { isTile: false as const, tiles: qty, m2: 0, fullCartons: 0, loose: 0, price, total, floorPrice, refPrice, floorViolation, stockInsufficient, availableTiles }
    }
  }, [selectedProduct, inputMode, inputM2, inputTiles, inputCartons, inputLooseTiles, inputQty, inputPieces, inputContainers, inputWeight, inputPackages, unitPrice])

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
        const itemTypePrint = item.product?.product_type ?? 'unit'
        const bagKgPrint    = itemTypePrint === 'bag' && item.product?.bag_weight_kg
          ? Math.round(item.quantityTiles * parseFloat(item.product.bag_weight_kg)) : null
        const pkgCntPrint   = itemTypePrint === 'unit' && item.product?.pieces_per_package && item.quantityTiles > 0
          ? Math.floor(item.quantityTiles / parseInt(item.product.pieces_per_package)) : null
        const pLbl = pluralize(unitLbl, item.quantityTiles)
        if (bagKgPrint) {
          qtyCell = `${new Intl.NumberFormat('fr-FR').format(item.quantityTiles)} sac${item.quantityTiles>1?'s':''} <span style="color:#64748B;font-size:11px">(${new Intl.NumberFormat('fr-FR').format(bagKgPrint)} kg)</span>`
        } else if (pkgCntPrint && pkgCntPrint > 0) {
          const pkgLblPrint = escHtml(item.product?.package_label ?? 'lot')
          qtyCell = `${new Intl.NumberFormat('fr-FR').format(item.quantityTiles)} ${pLbl} <span style="color:#64748B;font-size:11px">(${pkgCntPrint} ${pkgLblPrint}${pkgCntPrint>1?'s':''})</span>`
        } else {
          qtyCell = `${new Intl.NumberFormat('fr-FR').format(item.quantityTiles)} ${pLbl}`
        }
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
<div class="total-row"><div class="total-box"><div class="total-label">Montant total</div><div class="total-amount">${new Intl.NumberFormat('fr-FR').format(total)} ${currency}</div>${paid>0?`<div style="margin-top:8px;font-size:12px;color:#94A3B8">Encaissé : ${new Intl.NumberFormat('fr-FR').format(Math.round(paid))} ${currency}</div>`:''} ${balance>0?`<div style="font-size:12px;color:#991B1B;margin-top:2px">Reste : ${new Intl.NumberFormat('fr-FR').format(balance)} ${currency}</div>`:''}</div></div>
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
    const available   = parseInt(selectedProduct.available_qty)
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
        updated[existingIdx] = { ...existing, quantityTiles: newQty, quantityM2: newM2, quantityCartons: Math.floor(newQty/tpc), looseTiles: newQty%tpc, totalPrice: Math.round(newM2*computed.price) }
      } else {
        updated[existingIdx] = { ...existing, quantityTiles: newQty, totalPrice: Math.round(newQty*computed.price) }
      }
      setCart(updated)
    } else {
      setCart(prev => [...prev, { product: selectedProduct, inputMode, unitPricePerM2: computed.price, quantityTiles: computed.tiles, quantityM2: computed.m2, quantityCartons: computed.fullCartons, looseTiles: computed.loose, totalPrice: computed.total }])
    }
    resetInputs(); setError(null)
  }

  const removeFromCart = (idx: number) => setCart(prev => prev.filter((_,i) => i !== idx))

  const selectCustomer = (c: any) => {
    setName(c.full_name)
    setPhone(c.phone  ?? '')
    setPhone2(c.phone2 ?? '')
    setCNI(c.cni     ?? '')
    setCustomerId(c.id)
    setSuggestions([])
    setShowSugg(false)
  }

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
      customer_id: customerId,
      customer_name: customerName.trim(),
      customer_phone: phone,
      customer_cni: customerCNI.trim(),
      total_amount: cartTotal,
      amount_paid: parseFloat(amountPaid) || 0,
      payment_method: paymentMethod,
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
    if (saveAsCustomer && !customerId && customerName.trim()) {
      createCustomer({ full_name: customerName.trim(), phone: customerPhone.trim() || null, phone2: customerPhone2.trim() || null, cni: customerCNI.trim() || null, notes: null }).catch(() => {})
    }
    setSuccess(result); setStep('success')
  }

  const handleSaveQuote = async () => {
    if (cart.length === 0) return
    if (!customerName.trim()) { setError('Le nom du client est obligatoire pour enregistrer un devis.'); return }
    setQuoteLoading(true); setError(null)
    const result = await createQuote({
      boutique_id:    selectedBoutique?.id ?? boutique?.id,
      vendor_id:      profile.id,
      customer_id:    customerId,
      customer_name:  customerName.trim(),
      customer_phone: customerPhone.trim() || null,
      customer_cni:   customerCNI.trim() || null,
      total_amount:   cartTotal,
      notes:          notes || null,
      items: cart.map(item => {
        const isItemTile = (item.product.product_type ?? 'tile') === 'tile'
        return {
          product_id:               item.product.product_id,
          quantity_tiles:           item.quantityTiles,
          unit_price_per_m2:        item.unitPricePerM2,
          total_price:              item.totalPrice,
          floor_price_snapshot:     isItemTile ? parseFloat(item.product.floor_price_per_m2??0) : parseFloat(item.product.floor_price_per_unit??0),
          reference_price_snapshot: isItemTile ? parseFloat(item.product.reference_price_per_m2??0) : parseFloat(item.product.reference_price_per_unit??0),
          purchase_price_snapshot:  0,
          tile_area_m2_snapshot:    isItemTile ? parseFloat(item.product.tile_area_m2) : null,
          tiles_per_carton_snapshot:isItemTile ? parseInt(item.product.tiles_per_carton) : null,
        }
      }),
    })
    setQuoteLoading(false)
    if (result.error) { setError(result.error); return }
    if (saveAsCustomer && !customerId && customerName.trim()) {
      createCustomer({ full_name: customerName.trim(), phone: customerPhone.trim() || null, phone2: customerPhone2.trim() || null, cni: customerCNI.trim() || null, notes: null }).catch(() => {})
    }
    setSuccess(result); setStep('quote-success')
  }

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login') }

  const inputStyle = (hasError = false): React.CSSProperties => ({
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: `1.5px solid ${hasError ? C.red : C.border}`,
    fontSize: 13, color: C.ink, outline: 'none',
    boxSizing: 'border-box', background: C.surface, fontFamily: F.body,
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
          <div style={{ background: C.surface, borderRadius: 20, border: `1px solid ${C.border}`, boxShadow: '0 8px 40px rgba(60,30,10,0.08)', overflow: 'hidden' }}>

            {/* Green top stripe */}
            <div style={{ height: 4, background: 'linear-gradient(90deg, #059669, #34D399)' }} />

            <div style={{ padding: '36px 36px 28px', textAlign: 'center' }}>
              {/* Check circle */}
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: C.greenBg, border: `4px solid #D1FAE5`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                  <path d="M6 15l7 7 11-13" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              <h2 style={{ fontSize: 24, fontWeight: 800, color: C.ink, margin: '0 0 6px', letterSpacing: '-0.03em', fontFamily: F.display }}>
                Vente enregistrée
              </h2>
              <p style={{ color: C.muted, fontSize: 14, margin: '0 0 24px', fontFamily: F.body }}>
                Commande transmise à l'entrepôt automatiquement
              </p>

              {/* Sale number */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 100, background: C.bg, border: `1px solid ${C.border}`, marginBottom: 24 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />
                <span style={{ fontSize: 18, fontWeight: 900, color: C.ink, letterSpacing: '0.02em', fontFamily: F.mono }}>
                  {successData?.saleNumber}
                </span>
              </div>

              {/* Amount block */}
              <div style={{ padding: '20px', background: C.bg, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontFamily: F.body }}>
                  Montant total
                </div>
                <div style={{ fontSize: 34, fontWeight: 900, color: C.ink, letterSpacing: '-0.04em', fontFamily: F.display }}>
                  {fmt(total)}
                </div>
                {paid > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: C.muted, fontFamily: F.body }}>
                      Encaissé : <strong style={{ color: C.green }}>{fmt(paid)}</strong>
                    </span>
                    {balance > 0 && (
                      <span style={{ fontSize: 12, color: C.muted, fontFamily: F.body }}>
                        Reste : <strong style={{ color: C.orange }}>{fmt(balance)}</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Payment status pill */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 100, background: isPaid ? C.greenBg : isPartial ? C.orangeBg : C.redBg, border: `1px solid ${isPaid ? '#6EE7B7' : isPartial ? '#FCD34D' : '#FECACA'}`, fontSize: 12, fontWeight: 700, color: isPaid ? C.green : isPartial ? C.orange : C.red, fontFamily: F.body }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: isPaid ? C.green : isPartial ? C.orange : C.red }} />
                {isPaid ? 'Soldé' : isPartial ? 'Acompte versé' : 'Impayé'}
              </div>
            </div>

            {/* Actions */}
            <div style={{ padding: '0 28px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Print + PDF row */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={printReceipt}
                  style={{ flex: 1, padding: '11px', border: `1.5px solid ${C.border}`, borderRadius: R.md, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: F.body, background: C.surface, color: C.muted }}>
                  <svg width="13" height="13" viewBox="0 0 15 15" fill="none">
                    <rect x="1" y="5" width="13" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M4 5V3a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 .5.5v2" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M4 10.5h7M4 8h4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                  </svg>
                  Imprimer
                </button>
                <button
                  onClick={async () => {
                    setPdfLoad(true); setPdfError(null)
                    try { await downloadInvoicePdf(successData.saleId, successData.saleNumber) }
                    catch (e) { setPdfError((e as Error).message) }
                    finally { setPdfLoad(false) }
                  }}
                  disabled={pdfLoading}
                  style={{ flex: 1, padding: '11px', border: `1.5px solid ${pdfLoading ? C.border : C.amber}`, borderRadius: R.md, fontSize: 12, fontWeight: 700, cursor: pdfLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: F.body, background: pdfLoading ? C.surfaceSub : C.amberGlow, color: pdfLoading ? C.muted : C.amber, opacity: pdfLoading ? 0.7 : 1 }}>
                  {pdfLoading
                    ? <><span className="spinner" style={{ width: 11, height: 11 }} />PDF…</>
                    : <>
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                          <path d="M2 2.5A.5.5 0 0 1 2.5 2H9l3 3v6.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-9Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                          <path d="M9 2v3h3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                          <path d="M4.5 7.5h1a.75.75 0 0 1 0 1.5H4.5V7.5Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                          <path d="M7 7.5h.75a1 1 0 0 1 0 2H7V7.5Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                          <path d="M9.5 7.5v2M9.5 8.5H10.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                        </svg>
                        PDF
                      </>}
                </button>
              </div>
              {pdfError && (
                <p style={{ margin: 0, fontSize: 11, color: C.red, fontFamily: F.body, textAlign: 'center' }}>{pdfError}</p>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setCart([]); setName(''); setPhone(''); setPhone2(''); setCNI(''); setNotes(''); setAmountPaid(''); setCustomerId(null); setSuggestions([]); setSaveAsCustomer(true); resetInputs(); setStep('form'); setFormStep(1) }}
                  style={{ flex: 1, padding: '11px', borderRadius: R.md, border: `1.5px solid ${C.amber}`, background: C.amberGlow, color: C.amber, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: F.body }}>
                  Nouvelle vente
                </button>
                <button disabled={navPending}
                  onClick={() => startNavTransition(() => router.push('/sales'))}
                  style={{ flex: 1, padding: '11px', borderRadius: R.md, border: `1.5px solid ${C.border}`, background: C.surface, color: navPending ? C.muted : C.muted, fontSize: 13, fontWeight: 600, cursor: navPending ? 'not-allowed' : 'pointer', fontFamily: F.body, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  {navPending ? <><span className="spinner" />Chargement…</> : 'Mes ventes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </PageLayout>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUOTE SAVED
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === 'quote-success') {
    return (
      <PageLayout profile={profile} activeRoute="/sales" onLogout={handleLogout} badgeCounts={badgeCounts}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: isMobile ? '8px 0 40px' : '24px 0 60px' }}>
          <div style={{ background: C.surface, borderRadius: 20, border: `1px solid ${C.border}`, boxShadow: '0 8px 40px rgba(60,30,10,0.08)', overflow: 'hidden' }}>
            <div style={{ height: 4, background: 'linear-gradient(90deg,#B45309,#F59E0B)' }} />
            <div style={{ padding: '36px 36px 28px', textAlign: 'center' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: C.goldBg, border: '4px solid #FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M6 4h14l4 4v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" stroke="#B45309" strokeWidth="1.8" strokeLinejoin="round"/>
                  <path d="M20 4v5h4" stroke="#B45309" strokeWidth="1.8" strokeLinejoin="round"/>
                  <path d="M9 13h10M9 17h10M9 21h6" stroke="#B45309" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: C.ink, margin: '0 0 6px', letterSpacing: '-0.03em', fontFamily: F.display }}>
                Devis enregistré
              </h2>
              <p style={{ color: C.muted, fontSize: 14, margin: '0 0 24px', fontFamily: F.body }}>
                Le devis peut être confirmé en vente depuis la liste des devis.
              </p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 100, background: C.goldBg, border: `1px solid ${C.gold}50`, marginBottom: 24 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.gold }} />
                <span style={{ fontSize: 18, fontWeight: 900, color: C.gold, letterSpacing: '0.02em', fontFamily: F.mono }}>
                  {successData?.quoteNumber}
                </span>
              </div>
              <div style={{ padding: '16px', background: C.bg, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontFamily: F.body }}>Montant estimatif</div>
                <div style={{ fontSize: 34, fontWeight: 900, color: C.ink, letterSpacing: '-0.04em', fontFamily: F.display }}>{fmt(successData?.serverTotal ?? cartTotal)}</div>
              </div>
            </div>
            <div style={{ padding: '0 28px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* PDF download for quote */}
              <button
                onClick={async () => {
                  setPdfLoad(true); setPdfError(null)
                  try { await downloadInvoicePdf(successData.quoteId, successData.quoteNumber) }
                  catch (e) { setPdfError((e as Error).message) }
                  finally { setPdfLoad(false) }
                }}
                disabled={pdfLoading}
                style={{ width: '100%', padding: '11px', border: `1.5px solid ${pdfLoading ? C.border : C.gold}`, borderRadius: R.md, fontSize: 12, fontWeight: 700, cursor: pdfLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: F.body, background: pdfLoading ? C.surfaceSub : C.goldBg, color: pdfLoading ? C.muted : C.gold, opacity: pdfLoading ? 0.7 : 1 }}>
                {pdfLoading
                  ? <><span className="spinner" style={{ width: 11, height: 11 }} />Génération du PDF…</>
                  : <>
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                        <path d="M2 2.5A.5.5 0 0 1 2.5 2H9l3 3v6.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-9Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                        <path d="M9 2v3h3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                        <path d="M4.5 7.5h1a.75.75 0 0 1 0 1.5H4.5V7.5Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                        <path d="M7 7.5h.75a1 1 0 0 1 0 2H7V7.5Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                        <path d="M9.5 7.5v2M9.5 8.5H10.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                      </svg>
                      Télécharger le devis PDF
                    </>}
              </button>
              {pdfError && (
                <p style={{ margin: 0, fontSize: 11, color: C.red, fontFamily: F.body, textAlign: 'center' }}>{pdfError}</p>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setCart([]); setName(''); setPhone(''); setPhone2(''); setCNI(''); setNotes(''); setAmountPaid(''); setCustomerId(null); setSuggestions([]); setSaveAsCustomer(true); resetInputs(); setStep('form'); setFormStep(1) }}
                  style={{ flex: 1, padding: '11px', borderRadius: R.md, border: `1.5px solid ${C.amber}`, background: C.amberGlow, color: C.amber, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: F.body }}>
                  Nouvelle vente
                </button>
                <button disabled={navPending}
                  onClick={() => startNavTransition(() => router.push('/quotes'))}
                  style={{ flex: 1, padding: '11px', borderRadius: R.md, border: `1.5px solid ${C.border}`, background: C.surface, color: navPending ? C.muted : C.muted, fontSize: 13, fontWeight: 600, cursor: navPending ? 'not-allowed' : 'pointer', fontFamily: F.body, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  {navPending ? <><span className="spinner" />Chargement…</> : 'Mes devis'}
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
      <div ref={topRef} style={{ marginBottom: 20 }}>
        <button disabled={navPending}
          onClick={() => startNavTransition(() => router.push('/sales'))}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.full, color: navPending ? C.dim : C.muted, fontSize: 13, fontWeight: 600, cursor: navPending ? 'not-allowed' : 'pointer', padding: '7px 14px 7px 10px', marginBottom: 16, fontFamily: F.body }}>
          {navPending ? <><span className="spinner" />Chargement…</> : (
            <><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>Retour aux ventes</>
          )}
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.ink, margin: '0 0 4px', letterSpacing: '-0.03em', fontFamily: F.display }}>
              Nouvelle vente
            </h1>
            <p style={{ fontSize: 13, color: C.muted, margin: 0, fontFamily: F.body }}>
              {selectedBoutique?.name} · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>

          {/* Step progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 100, padding: '4px 6px' }}>
            {([{ n: 1, label: isMobile ? 'Produits' : 'Sélection' }, { n: 2, label: isMobile ? 'Finalisation' : 'Client & finalisation' }] as {n:1|2,label:string}[]).map(({ n, label }, idx) => (
              <React.Fragment key={n}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 100, background: formStep === n ? C.amber : 'transparent', transition: 'background 0.2s ease' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: formStep === n ? 'rgba(255,255,255,0.2)' : formStep > n ? C.green : C.border, color: formStep >= n ? '#FAF5EE' : C.muted, fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                    {formStep > n ? <svg width="9" height="8" viewBox="0 0 9 8" fill="none"><path d="M1 4l2.5 2.5L8 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> : n}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: formStep === n ? '#FAF5EE' : C.muted, fontFamily: F.body }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.8fr 1.5fr 280px', gap: 16, alignItems: 'start', paddingBottom: isMobile && cart.length > 0 ? 80 : 0 }}>

          {/* ── COL 1: Product catalogue ── */}
          <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(60,30,10,0.05)' }}>
            {/* Search + header */}
            <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${C.border}`, background: C.bg }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontFamily: F.body }}>
                Catalogue produits
              </div>
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <circle cx="7" cy="7" r="5" stroke={C.muted} strokeWidth="1.5"/>
                  <path d="M11 11l3 3" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Rechercher…"
                  style={{ width: '100%', paddingLeft: 30, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, outline: 'none', boxSizing: 'border-box', background: C.surface, fontFamily: F.body }} />
              </div>
              {/* Type filter pills */}
              {availableTypes.length > 1 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => setTypeFilter('all')}
                    style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${typeFilter==='all' ? C.amber : C.border}`, background: typeFilter==='all' ? C.amberGlow : 'transparent', color: typeFilter==='all' ? C.amber : C.muted, fontFamily: F.body }}>
                    Tous
                  </button>
                  {availableTypes.map(t => {
                    const cfg = getTypeConfig(t)
                    const active = typeFilter === t
                    return (
                      <button key={t} onClick={() => setTypeFilter(t)}
                        style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${active ? cfg.color : C.border}`, background: active ? cfg.bg : 'transparent', color: active ? cfg.color : C.muted, fontFamily: F.body }}>
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
                <div style={{ padding: '32px 16px', textAlign: 'center', color: C.muted, fontSize: 13, fontFamily: F.body }}>
                  Aucun produit trouvé
                </div>
              ) : filteredProducts.map(prod => {
                const isSelected  = selectedProduct?.product_id === prod.product_id
                const prodType    = prod.product_type ?? 'tile'
                const prodIsTile  = prodType === 'tile'
                const availCount  = parseInt(prod.available_qty)
                const cfg         = getTypeConfig(prodType)
                const availDisplay = prodIsTile
                  ? fmtM2(availCount * parseFloat(prod.tile_area_m2))
                  : prodType === 'bag' && prod.bag_weight_kg
                    ? `${fmtNum(availCount)} sacs (${fmtNum(Math.round(availCount * parseFloat(prod.bag_weight_kg)))} kg)`
                    : prodType === 'unit' && prod.pieces_per_package
                    ? `${fmtNum(availCount)} ${prod.unit_label ?? 'u.'} (${Math.floor(availCount / parseInt(prod.pieces_per_package))} ${prod.package_label ?? 'lots'})`
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
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9, cursor: 'pointer', textAlign: 'left', width: '100%', background: isSelected ? C.amberGlow : 'transparent', border: `1.5px solid ${isSelected ? C.amber : 'transparent'}`, fontFamily: F.body, marginBottom: 2 }}>
                    {/* Type icon badge */}
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: isSelected ? cfg.bg : C.bg, border: `1px solid ${isSelected ? cfg.color + '40' : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                      <TypeIcon type={prodType} color={isSelected ? cfg.color : C.muted} size={14} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? C.amber : C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: F.body }}>
                        {prod.product_name}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 1, fontFamily: F.body }}>
                        {subtitle}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: stockColor, fontFamily: F.body }}>
                        {availDisplay}
                      </div>
                      {(isLow || isCritical) && (
                        <div style={{ fontSize: 9, fontWeight: 600, color: stockColor, textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: F.body }}>
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
                <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, fontFamily: F.body }}>Sélectionnez un produit</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4, fontFamily: F.body }}>dans la liste à gauche</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Selected product header */}
                {(() => {
                  const prodType = selectedProduct.product_type ?? 'tile'
                  const cfg      = getTypeConfig(prodType)
                  return (
                    <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 4px rgba(60,30,10,0.05)' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <TypeIcon type={prodType} color={cfg.color} size={17} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, fontFamily: F.body, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {selectedProduct.product_name}
                        </div>
                        <div style={{ fontSize: 11, color: C.muted, fontFamily: F.body, marginTop: 1 }}>
                          {selectedProduct.reference_code} · <span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Quantity section */}
                <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '16px', boxShadow: '0 1px 4px rgba(60,30,10,0.05)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, fontFamily: F.body }}>
                    Quantité
                  </div>

                  {(selectedProduct.product_type ?? 'tile') === 'tile' ? (
                    <>
                      {/* Mode tabs */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
                        {([['m2', 'm²'], ['cartons_tiles', 'Cartons + pièces']] as [InputMode, string][]).map(([mode, label]) => (
                          <button key={mode} onClick={() => { setInputMode(mode); resetInputs() }}
                            style={{ padding: '9px 4px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: inputMode===mode ? C.amber : C.bg, color: inputMode===mode ? '#FAF5EE' : C.muted, border: `1.5px solid ${inputMode===mode ? C.amber : C.border}`, fontFamily: F.body }}>
                            {label}
                          </button>
                        ))}
                      </div>

                      {inputMode === 'm2' && (
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: F.body }}>Surface en m²</label>
                          <input type="number" min="0" step="0.01" value={inputM2} onChange={e => setInputM2(e.target.value)} placeholder="ex : 12.5" style={inputStyle(computed?.stockInsufficient ?? false)} />
                        </div>
                      )}

                      {inputMode === 'cartons_tiles' && (
                        <div style={{ display: 'flex', gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: F.body }}>Cartons</label>
                            <input type="number" min="0" step="1" value={inputCartons} onChange={e => setCartons(e.target.value)} placeholder="ex : 3" style={inputStyle(computed?.stockInsufficient ?? false)} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: F.body }}>Pièces en plus</label>
                            <input type="number" min="0" max={String(parseInt(selectedProduct.tiles_per_carton)-1)} step="1" value={inputLooseTiles} onChange={e => setLoose(e.target.value)} placeholder={`0 – ${parseInt(selectedProduct.tiles_per_carton)-1}`} style={inputStyle()} />
                          </div>
                        </div>
                      )}

                      {/* Tile equivalences */}
                      {computed && (
                        <div style={{ marginTop: 12, padding: 12, background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontFamily: F.body }}>Équivalences</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                            {([
                              ['Surface', fmtM2(computed.m2), inputMode==='m2'],
                              ['Cartons', `${computed.fullCartons}${computed.loose?` +${computed.loose}`:''} `, inputMode==='cartons'||inputMode==='cartons_tiles'],
                              ['Carreaux', fmtNum(computed.tiles), inputMode==='tiles'],
                            ] as [string, string, boolean][]).map(([lbl, val, active]) => (
                              <div key={lbl} style={{ textAlign: 'center', padding: '8px 4px', background: active ? C.amberGlow : C.surface, borderRadius: 7, border: `1px solid ${active ? C.amber : C.border}` }}>
                                <div style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>{lbl}</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: active ? C.amber : C.ink, fontFamily: F.body }}>{val}</div>
                              </div>
                            ))}
                          </div>
                          {computed.loose > 0 && inputMode !== 'cartons_tiles' && (
                            <div style={{ marginTop: 8, padding: '6px 10px', background: C.orangeBg, borderRadius: 6, fontSize: 11, color: C.orange, fontFamily: F.body }}>
                              Carton incomplet — {computed.loose} pièce{computed.loose>1?'s':''} ouvertes
                            </div>
                          )}
                          {computed.stockInsufficient && (
                            <div style={{ marginTop: 8, padding: '8px 10px', background: C.redBg, borderRadius: 6, fontSize: 12, fontWeight: 600, color: C.red, fontFamily: F.body }}>
                              Stock insuffisant — dispo : {fmtM2(parseInt(selectedProduct.available_qty)*parseFloat(selectedProduct.tile_area_m2))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (() => {
                    const prodType     = selectedProduct.product_type ?? 'unit'
                    const unitLbl      = selectedProduct.unit_label    ?? 'unité'
                    const pkgLbl       = selectedProduct.package_label ?? (prodType==='liter'?'bidon':prodType==='bag'?'palette':'barre')
                    const hasPieceConv = prodType === 'linear_m' && selectedProduct.piece_length_m
                    const hasContConv  = prodType === 'liter'    && selectedProduct.container_volume_l
                    const hasBagWeight = prodType === 'bag'      && selectedProduct.bag_weight_kg
                    const hasUnitPkg   = prodType === 'unit'     && selectedProduct.pieces_per_package
                    const showModeTabs = hasPieceConv || hasContConv || hasBagWeight || hasUnitPkg

                    // Build mode tab pairs for each type
                    const modeTabs: [InputMode, string][] = hasPieceConv
                      ? [['qty', `En ${unitLbl}`], ['linear_pieces', `En ${pkgLbl}`]]
                      : hasContConv
                      ? [['qty', `En ${unitLbl}`], ['liter_containers', `En ${pkgLbl}`]]
                      : hasBagWeight
                      ? [['qty', 'En sacs'], ['bag_weight', 'En kg']]
                      : hasUnitPkg
                      ? [['qty', `En ${unitLbl}`], ['unit_packages', `En ${pkgLbl}`]]
                      : []

                    return (
                      <>
                        {showModeTabs && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
                            {modeTabs.map(([mode, label]) => (
                              <button key={mode} onClick={() => { setInputMode(mode); resetInputs() }}
                                style={{ padding: '9px 4px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: inputMode===mode ? C.amber : C.bg, color: inputMode===mode ? '#FAF5EE' : C.muted, border: `1.5px solid ${inputMode===mode ? C.amber : C.border}`, fontFamily: F.body }}>
                                {label}
                              </button>
                            ))}
                          </div>
                        )}

                        {inputMode === 'linear_pieces' ? (
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: F.body }}>Nombre de {pkgLbl}s</label>
                            <input type="number" min="1" step="1" value={inputPieces} onChange={e => setInputPieces(e.target.value)} placeholder={`ex : 3 ${pkgLbl}s`} style={inputStyle(computed?.stockInsufficient??false)} />
                          </div>
                        ) : inputMode === 'liter_containers' ? (
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: F.body }}>Nombre de {pkgLbl}s</label>
                            <input type="number" min="1" step="1" value={inputContainers} onChange={e => setInputContainers(e.target.value)} placeholder={`ex : 2 ${pkgLbl}s`} style={inputStyle(computed?.stockInsufficient??false)} />
                          </div>
                        ) : inputMode === 'bag_weight' ? (
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: F.body }}>
                              Poids total commandé (kg)
                            </label>
                            <input type="number" min="0.1" step="0.1" value={inputWeight} onChange={e => setInputWeight(e.target.value)}
                              placeholder={`ex : 350 kg`} style={inputStyle(computed?.stockInsufficient??false)} />
                          </div>
                        ) : inputMode === 'unit_packages' ? (
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: F.body }}>
                              Nombre de {pkgLbl}s ({selectedProduct.pieces_per_package} {unitLbl}/{pkgLbl})
                            </label>
                            <input type="number" min="1" step="1" value={inputPackages} onChange={e => setInputPackages(e.target.value)}
                              placeholder={`ex : 2 ${pkgLbl}s`} style={inputStyle(computed?.stockInsufficient??false)} />
                          </div>
                        ) : (
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: F.body }}>Quantité ({unitLbl})</label>
                            <input type="number" min="1" step="1" value={inputQty} onChange={e => setInputQty(e.target.value)} placeholder="ex : 5" style={inputStyle(computed?.stockInsufficient??false)} />
                          </div>
                        )}

                        {computed && (
                          <div style={{ marginTop: 12, padding: 12, background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
                            {(inputMode==='linear_pieces'||inputMode==='liter_containers') ? (
                              <>
                                <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontFamily: F.body }}>Équivalences</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                  <div style={{ textAlign: 'center', padding: '8px 6px', background: C.surface, borderRadius: 7, border: `1px solid ${C.border}` }}>
                                    <div style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>{pkgLbl}</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, fontFamily: F.body }}>{inputMode==='linear_pieces'?(parseInt(inputPieces)||0):(parseInt(inputContainers)||0)}</div>
                                  </div>
                                  <div style={{ textAlign: 'center', padding: '8px 6px', background: C.amberGlow, borderRadius: 7, border: `1px solid ${C.amber}33` }}>
                                    <div style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>{unitLbl}</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, fontFamily: F.body }}>{new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(computed.tiles)}</div>
                                  </div>
                                </div>
                                <div style={{ marginTop: 8, fontSize: 11, color: C.muted, fontFamily: F.body, textAlign: 'center' }}>Disponible : {fmtNum(computed.availableTiles)} {unitLbl}</div>
                              </>
                            ) : inputMode === 'bag_weight' ? (
                              <>
                                <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontFamily: F.body }}>Équivalences</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                  <div style={{ textAlign: 'center', padding: '8px 6px', background: C.surface, borderRadius: 7, border: `1px solid ${C.border}` }}>
                                    <div style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>Poids demandé</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, fontFamily: F.body }}>{parseFloat(inputWeight)||0} kg</div>
                                  </div>
                                  <div style={{ textAlign: 'center', padding: '8px 6px', background: C.orangeBg, borderRadius: 7, border: `1px solid ${C.orange}33` }}>
                                    <div style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>Sacs à livrer</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: C.orange, fontFamily: F.body }}>{computed.tiles} sac{computed.tiles > 1 ? 's' : ''}</div>
                                  </div>
                                </div>
                                {hasBagWeight && (
                                  <div style={{ marginTop: 8, padding: '6px 10px', background: C.amberGlow, borderRadius: 6, fontSize: 11, color: C.amber, fontFamily: F.body, textAlign: 'center' }}>
                                    {computed.tiles} sac{computed.tiles>1?'s':''} × {selectedProduct.bag_weight_kg} kg = {fmtNum(Math.round(computed.tiles * parseFloat(selectedProduct.bag_weight_kg)))} kg livré
                                    {computed.tiles * parseFloat(selectedProduct.bag_weight_kg) > parseFloat(inputWeight) && (
                                      <span style={{ color: C.orange }}> (arrondi au sac supérieur)</span>
                                    )}
                                  </div>
                                )}
                                <div style={{ marginTop: 8, fontSize: 11, color: C.muted, fontFamily: F.body, textAlign: 'center' }}>Disponible : {fmtNum(computed.availableTiles)} sacs</div>
                              </>
                            ) : inputMode === 'unit_packages' ? (
                              <>
                                <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontFamily: F.body }}>Équivalences</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                  <div style={{ textAlign: 'center', padding: '8px 6px', background: C.surface, borderRadius: 7, border: `1px solid ${C.border}` }}>
                                    <div style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>{pkgLbl}</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, fontFamily: F.body }}>{parseInt(inputPackages)||0}</div>
                                  </div>
                                  <div style={{ textAlign: 'center', padding: '8px 6px', background: C.amberGlow, borderRadius: 7, border: `1px solid ${C.amber}33` }}>
                                    <div style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>{unitLbl}</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, fontFamily: F.body }}>{computed.tiles}</div>
                                  </div>
                                </div>
                                <div style={{ marginTop: 8, fontSize: 11, color: C.muted, fontFamily: F.body, textAlign: 'center' }}>Disponible : {fmtNum(computed.availableTiles)} {unitLbl}</div>
                              </>
                            ) : (
                              <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: 13, color: C.muted, fontFamily: F.body }}>{new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(computed.tiles)} {unitLbl}</span>
                                  <span style={{ fontSize: 12, color: C.muted, fontFamily: F.body }}>Dispo : {fmtNum(computed.availableTiles)}</span>
                                </div>
                                {hasPieceConv && computed.tiles > 0 && (() => {
                                  const pl=parseFloat(selectedProduct.piece_length_m), fp=Math.floor(computed.tiles/pl), rm=Math.round((computed.tiles%pl)*100)/100
                                  return <div style={{ marginTop: 8, padding: '6px 10px', background: C.amberGlow, borderRadius: 6, fontSize: 12, color: C.amber, fontFamily: F.body }}>= {fp} {pkgLbl}{fp!==1?'s':''}{rm>0?` + ${rm} m`:' complets'}</div>
                                })()}
                                {hasBagWeight && computed.tiles > 0 && (
                                  <div style={{ marginTop: 8, padding: '6px 10px', background: C.amberGlow, borderRadius: 6, fontSize: 12, color: C.amber, fontFamily: F.body }}>= {fmtNum(Math.round(computed.tiles*parseFloat(selectedProduct.bag_weight_kg)))} kg total</div>
                                )}
                                {hasContConv && computed.tiles > 0 && (() => {
                                  const vol=parseFloat(selectedProduct.container_volume_l), fc=Math.floor(computed.tiles/vol), rl=Math.round((computed.tiles%vol)*10)/10
                                  return <div style={{ marginTop: 8, padding: '6px 10px', background: C.amberGlow, borderRadius: 6, fontSize: 12, color: C.amber, fontFamily: F.body }}>= {fc} {pkgLbl}{fc!==1?'s':''}{rl>0?` + ${rl} L`:' complets'}</div>
                                })()}
                                {hasUnitPkg && computed.tiles > 0 && (
                                  <div style={{ marginTop: 8, padding: '6px 10px', background: C.amberGlow, borderRadius: 6, fontSize: 12, color: C.amber, fontFamily: F.body }}>= {Math.floor(computed.tiles/parseInt(selectedProduct.pieces_per_package))} {pkgLbl}{computed.tiles%parseInt(selectedProduct.pieces_per_package)>0?` + ${computed.tiles%parseInt(selectedProduct.pieces_per_package)} ${unitLbl}`:' complet(s)'}</div>
                                )}
                              </>
                            )}
                            {computed.stockInsufficient && (
                              <div style={{ marginTop: 8, padding: '8px 10px', background: C.redBg, borderRadius: 6, fontSize: 12, fontWeight: 600, color: C.red, fontFamily: F.body }}>
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
                  <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '16px', boxShadow: '0 1px 4px rgba(60,30,10,0.05)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, fontFamily: F.body }}>
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
                                <div style={{ flex: 1, padding: '10px 12px', background: C.redBg, borderRadius: 8, border: `1px solid ${C.red}30` }}>
                                  <div style={{ fontSize: 9, fontWeight: 700, color: C.red, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: F.body }}>Plancher min.</div>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: C.red, fontFamily: F.body }}>{fmtNum(computed.floorPrice)} <span style={{ fontSize: 11, fontWeight: 600 }}>{priceSuffix}</span></div>
                                </div>
                              )}
                              {computed.refPrice > 0 && (
                                <div style={{ flex: 1, padding: '10px 12px', background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                                  <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: F.body }}>Référence</div>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: C.muted, fontFamily: F.body }}>{fmtNum(computed.refPrice)} <span style={{ fontSize: 11, fontWeight: 600 }}>{priceSuffix}</span></div>
                                </div>
                              )}
                            </div>
                          )}

                          <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: F.body }}>
                              Prix par {isTileProd ? 'm²' : unitLbl} ({currency})
                            </label>
                            <input type="number" min="0" value={unitPrice} onChange={e => setUnitPrice(e.target.value)}
                              placeholder={computed.floorPrice > 0 ? `min. ${fmtNum(computed.floorPrice)}` : 'ex : 5 000'}
                              style={inputStyle(computed.floorViolation)} />
                          </div>

                          {computed.floorViolation && (
                            <div style={{ padding: '10px 12px', background: C.redBg, borderRadius: 8, border: `1px solid ${C.red}`, fontSize: 12, fontWeight: 600, color: C.red, marginBottom: 12, fontFamily: F.body }}>
                              Prix inférieur au plancher — vente bloquée
                            </div>
                          )}

                          {error && (
                            <div style={{ padding: '10px 12px', background: C.redBg, borderRadius: 8, border: `1px solid ${C.red}`, fontSize: 12, fontWeight: 600, color: C.red, marginBottom: 12, fontFamily: F.body }}>
                              {error}
                            </div>
                          )}

                          <button className="btn-amber"
                            onClick={addToCart}
                            disabled={computed.floorViolation || computed.stockInsufficient || computed.price <= 0 || computed.tiles <= 0}
                            style={{ width: '100%', padding: '13px', borderRadius: R.md, border: 'none', cursor: computed.floorViolation||computed.stockInsufficient||computed.price<=0 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: F.body, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: computed.floorViolation||computed.stockInsufficient||computed.price<=0 ? 0.5 : 1, height: 44 }}>
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
                <label style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8, fontFamily: F.body }}>Boutique</label>
                <select value={selectedBoutique?.id??''} onChange={e => setBoutique(allBoutiques.find(b=>b.id===e.target.value)??null)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink, background: C.surface, fontFamily: F.body, outline: 'none' }}>
                  {allBoutiques.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}

            {/* Cart panel + Continuer — desktop only; mobile shows fixed bottom bar */}
            {!isMobile && (<>
            <div style={{ background: C.sidebarBg, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 24px rgba(60,30,10,0.18)' }}>
              {/* Cart header */}
              <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="6" cy="13" r="1.2" fill="rgba(255,255,255,0.6)"/><circle cx="12" cy="13" r="1.2" fill="rgba(255,255,255,0.6)"/>
                    <path d="M1 1h2l2 8h7l1.5-5H5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: F.body }}>Panier</span>
                </div>
                {cart.length > 0 && (
                  <div style={{ background: C.amber, color: '#FAF5EE', fontSize: 10, fontWeight: 800, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {cart.length}
                  </div>
                )}
              </div>

              {/* Cart items */}
              <div style={{ maxHeight: 280, overflowY: 'auto', padding: '8px' }}>
                {cart.length === 0 ? (
                  <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', fontFamily: F.body }}>Aucun produit ajouté</div>
                  </div>
                ) : cart.map((item, idx) => {
                  const isItemTile  = (item.product?.product_type ?? 'tile') === 'tile'
                  const itemType   = item.product?.product_type ?? 'unit'
                  const unitLbl    = item.product?.unit_label ?? 'unité'
                  const bagKg      = itemType === 'bag' && item.product?.bag_weight_kg
                    ? Math.round(item.quantityTiles * parseFloat(item.product.bag_weight_kg)) : null
                  const pkgCount   = itemType === 'unit' && item.product?.pieces_per_package && item.quantityTiles > 0
                    ? Math.floor(item.quantityTiles / parseInt(item.product.pieces_per_package)) : null
                  const qtyDisplay = isItemTile
                    ? `${fmtM2(item.quantityM2)} · ${item.quantityCartons} ctn${item.looseTiles>0?` +${item.looseTiles}`:''}`
                    : bagKg
                    ? `${fmtNum(item.quantityTiles)} sac${item.quantityTiles>1?'s':''} (${fmtNum(bagKg)} kg)`
                    : pkgCount && pkgCount > 0
                    ? `${fmtNum(item.quantityTiles)} ${pluralize(unitLbl, item.quantityTiles)} (${pkgCount} ${item.product?.package_label ?? 'lot'}${pkgCount>1?'s':''})`
                    : `${fmtNum(item.quantityTiles)} ${pluralize(unitLbl, item.quantityTiles)}`
                  const priceDisplay = isItemTile
                    ? `${fmtNum(item.unitPricePerM2)} ${currency}/m²`
                    : `${fmtNum(item.unitPricePerM2)} ${currency}/${unitLbl}`
                  return (
                    <div key={idx} style={{ padding: '12px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.14)', marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#FAF5EE', fontFamily: F.body, flex: 1, marginRight: 8, lineHeight: 1.3 }}>{item.product.product_name}</span>
                        <button onClick={() => removeFromCart(idx)}
                          style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', width: 22, height: 22, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </button>
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(250,245,238,0.55)', marginBottom: 6, fontFamily: F.body }}>
                        {qtyDisplay}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 11, color: 'rgba(250,245,238,0.40)', fontFamily: F.body }}>{priceDisplay}</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: '#FAF5EE', fontFamily: F.display, letterSpacing: '-0.03em' }}>{fmt(item.totalPrice)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Cart total */}
              {cart.length > 0 && (
                <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: F.body }}>Total</span>
                  <span style={{ color: '#fff', fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', fontFamily: F.display }}>{fmt(cartTotal)}</span>
                </div>
              )}
            </div>

            {/* Continue button */}
            <button className="btn-amber"
              onClick={() => { setError(null); setFormStep(2) }}
              disabled={cart.length === 0}
              style={{ width: '100%', padding: '14px', borderRadius: R.md, border: 'none', cursor: cart.length===0?'not-allowed':'pointer', fontSize: 14, fontWeight: 700, fontFamily: F.body, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: cart.length===0 ? 0.45 : 1, height: 48 }}>
              Continuer
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8M7 3l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            </>)}

          </div>
        </div>
      )}

      {/* Mobile floating cart bar — fixed bottom, step 1 only */}
      {formStep === 1 && isMobile && cart.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          background: C.sidebarBg,
          padding: '12px 16px 16px',
          boxShadow: '0 -4px 24px rgba(26,15,6,0.40)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          {/* Left: tap to open cart sheet */}
          <button onClick={() => setCartSheet(true)}
            style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: F.body, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              {cart.length} article{cart.length > 1 ? 's' : ''}
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.4 }}>
                <path d="M2 7l3-3 3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#FAF5EE', letterSpacing: '-0.03em', fontFamily: F.display, lineHeight: 1 }}>
              {fmt(cartTotal)}
            </div>
          </button>
          <button className="btn-amber"
            onClick={() => { setError(null); setFormStep(2) }}
            style={{ padding: '12px 22px', borderRadius: R.md, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: F.body, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            Continuer
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M7 3l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* Mobile cart bottom sheet */}
      {formStep === 1 && isMobile && cartSheetOpen && (
        <>
          {/* Overlay */}
          <div onClick={() => setCartSheet(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 110, background: 'rgba(26,15,6,0.55)' }} />
          {/* Sheet */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 120,
            background: C.sidebarBg,
            borderRadius: '20px 20px 0 0',
            boxShadow: '0 -8px 40px rgba(26,15,6,0.50)',
            display: 'flex', flexDirection: 'column',
            maxHeight: '75vh',
          }}>
            {/* Sheet header */}
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="6" cy="13" r="1.2" fill="rgba(255,255,255,0.6)"/><circle cx="12" cy="13" r="1.2" fill="rgba(255,255,255,0.6)"/>
                  <path d="M1 1h2l2 8h7l1.5-5H5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', fontFamily: F.body }}>Panier</span>
                <div style={{ background: C.amber, color: '#FAF5EE', fontSize: 10, fontWeight: 800, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {cart.length}
                </div>
              </div>
              <button onClick={() => setCartSheet(false)}
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', width: 28, height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Cart items — scrollable */}
            <div style={{ overflowY: 'auto', padding: '10px 12px', flex: 1 }}>
              {cart.map((item, idx) => {
                const isItemTile   = (item.product?.product_type ?? 'tile') === 'tile'
                const itemType     = item.product?.product_type ?? 'unit'
                const unitLbl      = item.product?.unit_label ?? 'unité'
                const bagKg        = itemType === 'bag' && item.product?.bag_weight_kg
                  ? Math.round(item.quantityTiles * parseFloat(item.product.bag_weight_kg)) : null
                const pkgCount     = itemType === 'unit' && item.product?.pieces_per_package && item.quantityTiles > 0
                  ? Math.floor(item.quantityTiles / parseInt(item.product.pieces_per_package)) : null
                const qtyDisplay   = isItemTile
                  ? `${fmtM2(item.quantityM2)} · ${item.quantityCartons} ctn${item.looseTiles>0?` +${item.looseTiles}`:''}`
                  : bagKg
                  ? `${fmtNum(item.quantityTiles)} sac${item.quantityTiles>1?'s':''} (${fmtNum(bagKg)} kg)`
                  : pkgCount && pkgCount > 0
                  ? `${fmtNum(item.quantityTiles)} ${pluralize(unitLbl, item.quantityTiles)} (${pkgCount} ${item.product?.package_label ?? 'lot'}${pkgCount>1?'s':''})`
                  : `${fmtNum(item.quantityTiles)} ${pluralize(unitLbl, item.quantityTiles)}`
                const priceDisplay = isItemTile
                  ? `${fmtNum(item.unitPricePerM2)} ${currency}/m²`
                  : `${fmtNum(item.unitPricePerM2)} ${currency}/${unitLbl}`
                return (
                  <div key={idx} style={{ padding: '12px', borderRadius: 10, background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.14)', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#FAF5EE', fontFamily: F.body, flex: 1, marginRight: 8, lineHeight: 1.3 }}>{item.product.product_name}</span>
                      <button onClick={() => removeFromCart(idx)}
                        style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="9" height="9" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(250,245,238,0.55)', marginBottom: 6, fontFamily: F.body }}>{qtyDisplay}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 11, color: 'rgba(250,245,238,0.40)', fontFamily: F.body }}>{priceDisplay}</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#FAF5EE', fontFamily: F.display, letterSpacing: '-0.03em' }}>{fmt(item.totalPrice)}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Sheet footer — total + Continuer */}
            <div style={{ padding: '12px 16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: F.body }}>Total</span>
                <span style={{ color: '#fff', fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', fontFamily: F.display }}>{fmt(cartTotal)}</span>
              </div>
              <button className="btn-amber"
                onClick={() => { setCartSheet(false); setError(null); setFormStep(2) }}
                style={{ width: '100%', padding: '14px', borderRadius: R.md, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: F.body, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48 }}>
                Continuer
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M7 3l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════ STEP 2 ═══════════════════════════════ */}
      {formStep === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 320px', gap: 16, alignItems: 'start' }}>

          {/* ── Left: Client + Payment ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Back */}
            <button onClick={() => { setError(null); setFormStep(1) }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.full, color: C.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '7px 14px 7px 10px', fontFamily: F.body, alignSelf: 'flex-start' }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M11 7H3M7 3L3 7l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Retour au panier
            </button>

            {/* Client info */}
            <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '20px', boxShadow: '0 1px 4px rgba(60,30,10,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: F.body }}>
                  Informations client
                </div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>
                  <span style={{ color: C.red }}>*</span> requis pour la vente &nbsp;·&nbsp; téléphone et CNI optionnels pour un devis
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                <div style={{ position: 'relative' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: F.body }}>Nom du client <span style={{ color: C.red }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <input type="text" value={customerName}
                      onChange={e => { setName(e.target.value); setCustomerId(null) }}
                      onFocus={() => { if (suggestions.length > 0) setShowSugg(true) }}
                      onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                      placeholder="ex : Michel Abanda"
                      style={{ ...inputStyle(!customerName.trim() && !!error), paddingRight: customerId ? 32 : undefined }} />
                    {customerId && (
                      <button type="button" onClick={() => { setCustomerId(null); setSuggestions([]); setShowSugg(false) }}
                        title="Dissocier le client"
                        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: C.green, border: 'none', cursor: 'pointer', color: 'white', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                        <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    )}
                  </div>
                  {/* Linked customer badge */}
                  {customerId && (
                    <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="6" r="5" fill={C.greenBg} stroke={C.greenBd} strokeWidth="1"/>
                        <path d="M3.5 6l2 2 3-3" stroke={C.green} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ fontSize: 10, color: C.green, fontWeight: 600, fontFamily: F.body }}>Client lié — historique disponible</span>
                    </div>
                  )}
                  {/* Autocomplete dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, background: C.surfaceEl, border: `1.5px solid ${C.border}`, borderRadius: R.md, boxShadow: '0 8px 24px rgba(60,30,10,0.14)', marginTop: 4, overflow: 'hidden' }}>
                      {suggestions.map((s, i) => (
                        <button key={s.id} type="button"
                          onMouseDown={() => selectCustomer(s)}
                          style={{ width: '100%', textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? `1px solid ${C.borderSub}` : 'none', display: 'flex', alignItems: 'center', gap: 10 }}
                          onMouseEnter={e => (e.currentTarget.style.background = C.surfaceHov)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.amberGlow, border: `1px solid ${C.amber}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: C.amber, fontFamily: F.body }}>
                              {s.full_name.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]?.toUpperCase() ?? '').join('')}
                            </span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, fontFamily: F.body }}>{s.full_name}</div>
                            {s.phone && <div style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>{s.phone}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: F.body }}>
                    N° CNI <span style={{ color: C.red }}>*</span> <span style={{ fontSize: 11, fontWeight: 400, color: C.muted }}>(optionnel pour devis)</span>
                  </label>
                  <input type="text" value={customerCNI} onChange={e => setCNI(e.target.value)} placeholder="ex : 1 23 04 5678 912 34" style={inputStyle(!customerCNI.trim() && !!error)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: F.body }}>
                    Téléphone principal <span style={{ color: C.red }}>*</span> <span style={{ fontSize: 11, fontWeight: 400, color: C.muted }}>(optionnel pour devis)</span>
                  </label>
                  <input type="tel" value={customerPhone} onChange={e => setPhone(e.target.value)} placeholder="ex : 6 99 11 22 33" style={inputStyle(!customerPhone.trim() && !!error)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: F.body }}>Téléphone secondaire <span style={{ fontSize: 11, fontWeight: 400, color: C.muted }}>(optionnel)</span></label>
                  <input type="tel" value={customerPhone2} onChange={e => setPhone2(e.target.value)} placeholder="ex : 6 88 44 55 66" style={inputStyle()} />
                </div>
              </div>
              {!customerId && customerName.trim().length >= 2 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={saveAsCustomer} onChange={e => setSaveAsCustomer(e.target.checked)}
                    style={{ width: 14, height: 14, accentColor: C.amber, cursor: 'pointer' }} />
                  <span style={{ fontSize: 11, color: C.muted, fontFamily: F.body }}>Mémoriser ce client pour les prochains achats</span>
                </label>
              )}
              <div style={{ marginTop: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.ink, display: 'block', marginBottom: 6, fontFamily: F.body }}>Notes <span style={{ fontSize: 11, fontWeight: 400, color: C.muted }}>(optionnel)</span></label>
                <textarea value={notes} rows={2} onChange={e => setNotes(e.target.value)} placeholder="Instructions de livraison, observations…" style={{ ...inputStyle(), resize: 'vertical' }} />
              </div>
            </div>

            {/* Payment */}
            <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: '20px', boxShadow: '0 1px 4px rgba(60,30,10,0.05)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16, fontFamily: F.body }}>
                Paiement
              </div>

              {/* Quick-select */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <button type="button" onClick={() => setAmountPaid(String(cartTotal))}
                  style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1.5px solid ${parseFloat(amountPaid)>=cartTotal&&amountPaid ? C.green : C.border}`, background: parseFloat(amountPaid)>=cartTotal&&amountPaid ? C.greenBg : C.bg, color: parseFloat(amountPaid)>=cartTotal&&amountPaid ? C.green : C.muted, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: F.body }}>
                  Paiement complet
                </button>
                <button type="button" onClick={() => setAmountPaid('')}
                  style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1.5px solid ${amountPaid==='' ? C.amber : C.border}`, background: amountPaid==='' ? C.amberGlow : C.bg, color: amountPaid==='' ? C.amber : C.muted, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: F.body }}>
                  Acompte / Partiel
                </button>
              </div>

              {/* Payment method */}
              {(() => {
                const methods: { key: string; label: string }[] = [
                  { key: 'especes',      label: 'Espèces' },
                  { key: 'mobile_money', label: 'Mobile Money' },
                  { key: 'virement',     label: 'Virement' },
                  { key: 'cheque',       label: 'Chèque' },
                ]
                return (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                    {methods.map(m => {
                      const active = paymentMethod === m.key
                      return (
                        <button key={m.key} type="button"
                          onClick={() => setPaymentMethod(m.key)}
                          style={{
                            padding: '6px 12px', borderRadius: 20,
                            border: `1.5px solid ${active ? C.amber : C.border}`,
                            background: active ? C.amberGlow : C.bg,
                            color: active ? C.amber : C.muted,
                            fontSize: 12, fontWeight: active ? 700 : 500,
                            cursor: 'pointer', fontFamily: F.body,
                            transition: 'all 0.12s ease',
                          }}
                        >{m.label}</button>
                      )
                    })}
                  </div>
                )
              })()}

              <input type="number" min="0" step="100" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} placeholder={`Montant encaissé (max ${fmt(cartTotal)})`} style={inputStyle()} />

              {/* Balance summary */}
              {(() => {
                const paid    = Math.max(0, parseFloat(amountPaid) || 0)
                const balance = cartTotal - paid
                const isOver  = paid > cartTotal
                if (paid === 0) return null
                return (
                  <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 9, background: isOver ? C.redBg : balance===0 ? C.greenBg : C.orangeBg, border: `1px solid ${isOver ? C.red : balance===0 ? C.green : C.orange}`, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <span style={{ fontSize: 13, color: C.muted, fontFamily: F.body }}>Encaissé : <strong>{fmt(paid)}</strong></span>
                    {isOver ? (
                      <span style={{ fontSize: 13, color: C.red, fontWeight: 700, fontFamily: F.body }}>Montant supérieur au total</span>
                    ) : balance === 0 ? (
                      <span style={{ fontSize: 13, color: C.green, fontWeight: 700, fontFamily: F.body }}>Soldé</span>
                    ) : (
                      <span style={{ fontSize: 13, color: C.orange, fontWeight: 700, fontFamily: F.body }}>Reste : {fmt(balance)}</span>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>

          {/* ── Right: Order summary + confirm ── */}
          <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Cart summary (read-only) */}
            <div style={{ background: C.sidebarBg, borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 24px rgba(60,30,10,0.18)' }}>
              <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: F.body }}>Récapitulatif</span>
              </div>
              <div style={{ padding: '8px', maxHeight: 260, overflowY: 'auto' }}>
                {cart.map((item, idx) => {
                  const isItemTile  = (item.product?.product_type ?? 'tile') === 'tile'
                  const itemType2   = item.product?.product_type ?? 'unit'
                  const unitLbl2    = item.product?.unit_label ?? 'unité'
                  const bagKg2      = itemType2 === 'bag' && item.product?.bag_weight_kg
                    ? Math.round(item.quantityTiles * parseFloat(item.product.bag_weight_kg)) : null
                  const pkgCount2   = itemType2 === 'unit' && item.product?.pieces_per_package && item.quantityTiles > 0
                    ? Math.floor(item.quantityTiles / parseInt(item.product.pieces_per_package)) : null
                  const qtyDisp2 = isItemTile
                    ? `${fmtM2(item.quantityM2)}`
                    : bagKg2
                    ? `${fmtNum(item.quantityTiles)} sac${item.quantityTiles>1?'s':''} (${fmtNum(bagKg2)} kg)`
                    : pkgCount2 && pkgCount2 > 0
                    ? `${fmtNum(item.quantityTiles)} ${pluralize(unitLbl2, item.quantityTiles)} (${pkgCount2} ${item.product?.package_label ?? 'lot'}${pkgCount2>1?'s':''})`
                    : `${fmtNum(item.quantityTiles)} ${pluralize(unitLbl2, item.quantityTiles)}`
                  const priceDisp2 = isItemTile ? `${fmtNum(item.unitPricePerM2)} ${currency}/m²` : `${fmtNum(item.unitPricePerM2)} ${currency}/${unitLbl2}`
                  return (
                    <div key={idx} style={{ padding: '10px', borderRadius: 8, marginBottom: 5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontFamily: F.body, flex: 1 }}>{item.product.product_name}</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', fontFamily: F.body, flexShrink: 0 }}>{fmt(item.totalPrice)}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2, fontFamily: F.body }}>
                        {qtyDisp2} · {priceDisp2}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: F.body }}>Total</span>
                <span style={{ color: '#fff', fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', fontFamily: F.display }}>{fmt(cartTotal)}</span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: '12px 14px', background: C.redBg, borderRadius: 10, border: `1px solid ${C.red}`, fontSize: 13, fontWeight: 600, color: C.red, fontFamily: F.body }}>
                {error}
              </div>
            )}

            {/* Confirm sale */}
            <button className="btn-amber" onClick={handleConfirm} disabled={loading || quoteLoading}
              style={{ width: '100%', padding: '15px', borderRadius: R.md, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 800, fontFamily: F.body, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.7 : 1, height: 52 }}>
              {loading ? (
                <><span className="spinner" />Enregistrement…</>
              ) : (
                <><svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8l4 4 6-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>Confirmer la vente · {fmt(cartTotal)}</>
              )}
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <span style={{ fontSize: 11, color: C.muted, fontFamily: F.body, whiteSpace: 'nowrap' }}>ou</span>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>

            {/* Save as quote */}
            <button
              onClick={handleSaveQuote}
              disabled={loading || quoteLoading}
              style={{ width: '100%', padding: '12px', borderRadius: 10, cursor: quoteLoading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, fontFamily: F.body, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: loading ? 0.5 : 1, background: C.surface, border: `1.5px solid ${C.gold}`, color: C.gold }}>
              {quoteLoading ? (
                <><span className="spinner" style={{ borderTopColor: C.gold, borderRightColor: `${C.gold}40` }} />Enregistrement du devis…</>
              ) : (
                <>
                  <svg width="13" height="14" viewBox="0 0 13 16" fill="none">
                    <path d="M2 1h7l3 3v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1Z" stroke={C.gold} strokeWidth="1.4" strokeLinejoin="round"/>
                    <path d="M9 1v4h3" stroke={C.gold} strokeWidth="1.4" strokeLinejoin="round"/>
                    <path d="M4 8h5M4 11h5M4 14h3" stroke={C.gold} strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  Enregistrer comme devis
                </>
              )}
            </button>
            <p style={{ fontSize: 11, color: C.muted, textAlign: 'center', margin: 0, fontFamily: F.body }}>
              Le devis n'engage pas le stock — il peut être converti en vente plus tard.
            </p>
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
