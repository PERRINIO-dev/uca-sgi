'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter }    from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createProduct, updateProduct } from './actions'
import PageLayout       from '@/components/PageLayout'
import type { BadgeCounts }    from '@/lib/supabase/badge-counts'
import type { ProductType, ProductCategory } from '@/lib/types'
import {
  LOW_STOCK_CARTONS, CRITICAL_STOCK_CARTONS,
  LOW_STOCK_UNITS,   CRITICAL_STOCK_UNITS,
} from '@/lib/constants'
import { fmtCurrency } from '@/lib/format'

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
  new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 4, maximumFractionDigits: 4,
  }).format(n) + ' m²'

// Default unit/package labels per type
const DEFAULT_LABELS: Record<ProductType, { unit: string; pkg: string }> = {
  tile:      { unit: 'm²',    pkg: 'carton'  },
  unit:      { unit: 'pièce', pkg: 'boîte'   },
  linear_m:  { unit: 'm',     pkg: 'barre'   },
  bag:       { unit: 'sac',   pkg: 'palette' },
  liter:     { unit: 'L',     pkg: 'bidon'   },
}

const TYPE_LABELS: Record<ProductType, string> = {
  tile:     'Carreau / Revêtement m²',
  unit:     'Pièce (unité)',
  linear_m: 'Mètre linéaire',
  bag:      'Sac / Conditionnement',
  liter:    'Litre / Volume',
}

// ── Reference code generator ──────────────────────────────────────────────────

function generateRefCode(
  name: string,
  category: string,
  productType: ProductType,
  widthCm = '',
  heightCm = '',
): string {
  const catAbbr = category.split(' ').map(w => w[0]?.toUpperCase() ?? '').join('').slice(0, 3)
  const cleanName = name.trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9\s]/g, '')
  const words    = cleanName.split(/\s+/).filter(Boolean)
  const namePart = words.slice(0, 2).map(w => w.slice(0, 3)).join('')
  const dims     = productType === 'tile' && widthCm && heightCm
    ? `-${widthCm}X${heightCm}`
    : ''
  return namePart ? `${catAbbr}-${namePart}${dims}` : ''
}

// ── Empty form ────────────────────────────────────────────────────────────────

const emptyForm = (type: ProductType = 'tile') => ({
  // Common
  productType:  type,
  referenceCode: '',
  name:          '',
  category:      '',
  supplier:      '',
  // Tile-specific
  widthCm:             '',
  heightCm:            '',
  tilesPerCarton:      '',
  purchasePrice:       '',
  floorPricePerM2:     '',
  referencePricePerM2: '',
  initialCartons:      '',
  initialLooseTiles:   '',
  // Non-tile shared
  unitLabel:            DEFAULT_LABELS[type].unit,
  packageLabel:         DEFAULT_LABELS[type].pkg,
  piecesPerPackage:     '',
  floorPricePerUnit:    '',
  referencePricePerUnit: '',
  initialQuantity:      '',
  // linear_m
  pieceLengthM: '',
  // liter
  containerVolumeL: '',
  // bag
  bagWeightKg: '',
})

type FormState = ReturnType<typeof emptyForm>

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function ProductsClient({
  profile,
  currency,
  products,
  categories,
  badgeCounts,
}: {
  profile:      any
  currency:     string
  products:     any[]
  categories:   ProductCategory[]
  badgeCounts?: BadgeCounts
}) {
  const router   = useRouter()
  const supabase = createClient()

  const [showCreate,        setShowCreate]        = useState(false)
  const [modalStep,         setModalStep]         = useState<1|2|3|4>(1)
  const [editProduct,       setEditProduct]       = useState<any>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState<any>(null)
  const [form,              setForm]              = useState<FormState>(emptyForm('tile'))
  const [loading,           setLoading]           = useState(false)
  const [toggleLoadingId,   setToggleLoadingId]   = useState<string | null>(null)
  const [error,             setError]             = useState<string | null>(null)
  const [success,           setSuccess]           = useState<string | null>(null)
  const [filterActive,      setFilterActive]      = useState<'all' | 'active' | 'inactive'>('active')
  const [filterType,        setFilterType]        = useState<ProductType | 'all'>('all')
  const [search,            setSearch]            = useState('')
  const refCodeTouched = useRef(false)

  const productType = form.productType as ProductType

  // Auto-generate reference code
  useEffect(() => {
    if (!showCreate || refCodeTouched.current) return
    const gen = generateRefCode(form.name, form.category, productType, form.widthCm, form.heightCm)
    if (gen) setField('referenceCode', gen)
  }, [form.name, form.category, productType, form.widthCm, form.heightCm, showCreate])

  // Reset category and labels when type changes
  useEffect(() => {
    if (!showCreate) return
    setField('category',     '')
    setField('unitLabel',    DEFAULT_LABELS[productType].unit)
    setField('packageLabel', DEFAULT_LABELS[productType].pkg)
  }, [productType])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const setField = (key: keyof FormState, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  // ── Tile area preview (tile only) ────────────────────────────────────────
  const tileAreaPreview = (() => {
    if (productType !== 'tile') return null
    const w = parseFloat(form.widthCm)
    const h = parseFloat(form.heightCm)
    if (!w || !h) return null
    const area = (w / 100) * (h / 100)
    const tpc  = parseInt(form.tilesPerCarton) || 0
    return { area, cartonArea: area * tpc }
  })()

  // ── Create ────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    setError(null)

    if (productType === 'tile') {
      // Tile validation — unchanged from original
      const required = [
        form.referenceCode, form.name, form.supplier,
        form.widthCm, form.heightCm, form.tilesPerCarton,
        ...(profile.role === 'owner' ? [form.purchasePrice] : []),
        form.floorPricePerM2, form.referencePricePerM2,
      ]
      if (required.some(v => !v)) {
        setError('Veuillez remplir tous les champs obligatoires.')
        return
      }
      if (profile.role === 'owner' && parseFloat(form.purchasePrice) >= parseFloat(form.floorPricePerM2)) {
        setError("Le prix d'achat doit être inférieur au prix plancher.")
        return
      }
      if (parseFloat(form.floorPricePerM2) >= parseFloat(form.referencePricePerM2)) {
        setError('Le prix plancher doit être inférieur au prix de référence.')
        return
      }

      setLoading(true)
      const result = await createProduct({
        productType:         'tile',
        referenceCode:       form.referenceCode,
        name:                form.name,
        category:            form.category,
        supplier:            form.supplier,
        widthCm:             parseFloat(form.widthCm),
        heightCm:            parseFloat(form.heightCm),
        tilesPerCarton:      parseInt(form.tilesPerCarton),
        purchasePrice:       parseFloat(form.purchasePrice) || 0,
        floorPricePerM2:     parseFloat(form.floorPricePerM2),
        referencePricePerM2: parseFloat(form.referencePricePerM2),
        initialCartons:      parseInt(form.initialCartons)    || 0,
        initialLooseTiles:   parseInt(form.initialLooseTiles) || 0,
      })
      setLoading(false)
      if (result.error) { setError(result.error); return }

    } else {
      // Non-tile common validation
      if (!form.referenceCode || !form.name || !form.supplier ||
          !form.floorPricePerUnit || !form.referencePricePerUnit) {
        setError('Veuillez remplir tous les champs obligatoires.')
        return
      }
      if (productType === 'linear_m' && !form.pieceLengthM) {
        setError('La longueur par barre/pièce est obligatoire.')
        return
      }
      if (productType === 'liter' && !form.containerVolumeL) {
        setError('Le volume par contenant est obligatoire.')
        return
      }
      if (profile.role === 'owner' && form.purchasePrice &&
          parseFloat(form.purchasePrice) >= parseFloat(form.floorPricePerUnit)) {
        setError("Le prix d'achat doit être inférieur au prix plancher.")
        return
      }
      if (parseFloat(form.floorPricePerUnit) >= parseFloat(form.referencePricePerUnit)) {
        setError('Le prix plancher doit être inférieur au prix de référence.')
        return
      }

      const commonNonTile = {
        referenceCode:         form.referenceCode,
        name:                  form.name,
        category:              form.category,
        supplier:              form.supplier,
        unitLabel:             form.unitLabel,
        packageLabel:          form.packageLabel,
        piecesPerPackage:      parseInt(form.piecesPerPackage) || null,
        purchasePrice:         parseFloat(form.purchasePrice)    || 0,
        floorPricePerUnit:     parseFloat(form.floorPricePerUnit),
        referencePricePerUnit: parseFloat(form.referencePricePerUnit),
        initialQuantity:       parseInt(form.initialQuantity) || 0,
      }

      setLoading(true)
      let result

      if (productType === 'unit') {
        result = await createProduct({ productType: 'unit', ...commonNonTile })
      } else if (productType === 'linear_m') {
        result = await createProduct({
          productType: 'linear_m', ...commonNonTile,
          pieceLengthM: parseFloat(form.pieceLengthM),
        })
      } else if (productType === 'bag') {
        result = await createProduct({
          productType: 'bag', ...commonNonTile,
          bagWeightKg: parseFloat(form.bagWeightKg) || null,
        })
      } else {
        result = await createProduct({
          productType: 'liter', ...commonNonTile,
          containerVolumeL: parseFloat(form.containerVolumeL),
        })
      }
      setLoading(false)
      if (result.error) { setError(result.error); return }
    }

    setSuccess('Produit créé avec succès.')
    setForm(emptyForm(productType))
    refCodeTouched.current = false
    setTimeout(() => {
      setSuccess(null)
      setShowCreate(false)
      router.refresh()
    }, 1800)
  }

  // ── Wizard step validation ────────────────────────────────────────────────
  const advanceModalStep = () => {
    setError(null)
    if (modalStep === 1) {
      setModalStep(2)
    } else if (modalStep === 2) {
      if (!form.name.trim())     { setError('Le nom du produit est requis.'); return }
      if (!form.supplier.trim()) { setError('Le fournisseur est requis.'); return }
      if (productType === 'tile') {
        if (!form.widthCm || !form.heightCm) { setError('Les dimensions sont requises.'); return }
        if (!form.tilesPerCarton)            { setError('Le nombre de carreaux par carton est requis.'); return }
      }
      if (productType === 'linear_m' && !form.pieceLengthM)   { setError('La longueur par barre est requise.'); return }
      if (productType === 'liter'    && !form.containerVolumeL) { setError('Le volume par contenant est requis.'); return }
      setModalStep(3)
    } else if (modalStep === 3) {
      const isTileType = productType === 'tile'
      const floor = parseFloat(isTileType ? form.floorPricePerM2   : form.floorPricePerUnit)
      const ref   = parseFloat(isTileType ? form.referencePricePerM2 : form.referencePricePerUnit)
      if (!floor || !ref)  { setError('Les prix plancher et référence sont requis.'); return }
      if (floor >= ref)    { setError('Le prix plancher doit être inférieur au prix de référence.'); return }
      if (profile.role === 'owner' && form.purchasePrice) {
        const purchase = parseFloat(form.purchasePrice)
        if (!isNaN(purchase) && purchase >= floor) {
          setError("Le prix d'achat doit être inférieur au prix plancher."); return
        }
      }
      setModalStep(4)
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  const openEdit = (p: any) => {
    const pt: ProductType = p.product_type ?? 'tile'
    setEditProduct(p)
    setForm({
      ...emptyForm(pt),
      name:                p.name,
      category:            p.category,
      supplier:            p.supplier,
      unitLabel:           p.unit_label    ?? DEFAULT_LABELS[pt].unit,
      packageLabel:        p.package_label ?? DEFAULT_LABELS[pt].pkg,
      // Tile pricing
      purchasePrice:       String(p.purchase_price ?? ''),
      floorPricePerM2:     String(p.floor_price_per_m2 ?? ''),
      referencePricePerM2: String(p.reference_price_per_m2 ?? ''),
      // Non-tile pricing
      floorPricePerUnit:    String(p.floor_price_per_unit ?? ''),
      referencePricePerUnit: String(p.reference_price_per_unit ?? ''),
    })
    setError(null)
    setSuccess(null)
  }

  const handleUpdate = async () => {
    if (!editProduct) return
    const pt: ProductType = editProduct.product_type ?? 'tile'

    if (pt === 'tile') {
      if (profile.role === 'owner' && form.purchasePrice &&
          parseFloat(form.purchasePrice) >= parseFloat(form.floorPricePerM2)) {
        setError("Le prix d'achat doit être inférieur au prix plancher.")
        return
      }
      if (parseFloat(form.floorPricePerM2) >= parseFloat(form.referencePricePerM2)) {
        setError('Le prix plancher doit être inférieur au prix de référence.')
        return
      }
      setLoading(true)
      const result = await updateProduct({
        productId:           editProduct.id,
        name:                form.name,
        category:            form.category,
        supplier:            form.supplier,
        purchasePrice:       parseFloat(form.purchasePrice) || 0,
        floorPricePerM2:     parseFloat(form.floorPricePerM2),
        referencePricePerM2: parseFloat(form.referencePricePerM2),
        isActive:            editProduct.is_active,
      })
      setLoading(false)
      if (result.error) { setError(result.error); return }
    } else {
      if (profile.role === 'owner' && form.purchasePrice &&
          parseFloat(form.purchasePrice) >= parseFloat(form.floorPricePerUnit)) {
        setError("Le prix d'achat doit être inférieur au prix plancher.")
        return
      }
      if (parseFloat(form.floorPricePerUnit) >= parseFloat(form.referencePricePerUnit)) {
        setError('Le prix plancher doit être inférieur au prix de référence.')
        return
      }
      setLoading(true)
      const result = await updateProduct({
        productId:             editProduct.id,
        name:                  form.name,
        category:              form.category,
        supplier:              form.supplier,
        purchasePrice:         parseFloat(form.purchasePrice) || 0,
        floorPricePerUnit:     parseFloat(form.floorPricePerUnit),
        referencePricePerUnit: parseFloat(form.referencePricePerUnit),
        isActive:              editProduct.is_active,
      })
      setLoading(false)
      if (result.error) { setError(result.error); return }
    }

    setSuccess('Produit mis à jour.')
    setTimeout(() => {
      setSuccess(null)
      setEditProduct(null)
      router.refresh()
    }, 1500)
  }

  const handleToggleActive = async (p: any) => {
    const pt: ProductType = p.product_type ?? 'tile'
    setToggleLoadingId(p.id)
    if (pt === 'tile') {
      await updateProduct({
        productId:           p.id,
        name:                p.name,
        category:            p.category,
        supplier:            p.supplier,
        purchasePrice:       p.purchase_price,
        floorPricePerM2:     p.floor_price_per_m2,
        referencePricePerM2: p.reference_price_per_m2,
        isActive:            !p.is_active,
      })
    } else {
      await updateProduct({
        productId:             p.id,
        name:                  p.name,
        category:              p.category,
        supplier:              p.supplier,
        purchasePrice:         p.purchase_price,
        floorPricePerUnit:     p.floor_price_per_unit,
        referencePricePerUnit: p.reference_price_per_unit,
        isActive:              !p.is_active,
      })
    }
    setToggleLoadingId(null)
    router.refresh()
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = products.filter(p => {
    if (filterActive === 'active'   && !p.is_active) return false
    if (filterActive === 'inactive' && p.is_active)  return false
    if (filterType !== 'all' && (p.product_type ?? 'tile') !== filterType) return false
    if (search) {
      const q = search.toLowerCase()
      if (!p.name.toLowerCase().includes(q) &&
          !p.reference_code.toLowerCase().includes(q)) return false
    }
    return true
  })

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: `1.5px solid ${C.border}`, fontSize: 13, color: C.ink,
    outline: 'none', boxSizing: 'border-box',
    background: C.surface, fontFamily: FONT,
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <PageLayout profile={profile} activeRoute="/products" onLogout={handleLogout} badgeCounts={badgeCounts}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.ink,
            margin: '0 0 4px', letterSpacing: '-0.03em', fontFamily: FONT }}>
            Catalogue produits
          </h1>
          <p style={{ fontSize: 13, color: C.muted, margin: 0, fontFamily: FONT }}>
            {products.filter(p => p.is_active).length} produit
            {products.filter(p => p.is_active).length !== 1 ? 's' : ''} actif
            {products.filter(p => p.is_active).length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          className="btn-meram"
          onClick={() => {
            setForm(emptyForm('tile'))
            setError(null)
            setSuccess(null)
            refCodeTouched.current = false
            setModalStep(1)
            setShowCreate(true)
          }}
          style={{ padding: '11px 20px', border: 'none', borderRadius: 9,
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
            display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
          Nouveau produit
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap',
        background: C.surface, padding: '12px 16px', borderRadius: 12,
        border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou référence…"
          style={{ ...inputStyle, width: 260, padding: '8px 12px', fontSize: 13 }} />
        <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
          style={{ ...inputStyle, width: 'auto', padding: '8px 12px', fontSize: 13 }}>
          <option value="all">Tous les types</option>
          {(Object.entries(TYPE_LABELS) as [ProductType, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select value={filterActive} onChange={e => setFilterActive(e.target.value as any)}
          style={{ ...inputStyle, width: 'auto', padding: '8px 12px', fontSize: 13 }}>
          <option value="active">Actifs</option>
          <option value="inactive">Désactivés</option>
          <option value="all">Tous</option>
        </select>
      </div>

      {/* Product grid */}
      {filtered.length === 0 ? (
        <div style={{ background: C.surface, borderRadius: 12,
          border: `1px solid ${C.border}`, padding: '48px',
          textAlign: 'center', color: C.muted, fontSize: 14, fontFamily: FONT }}>
          Aucun produit trouvé.
        </div>
      ) : (
        <div style={{ display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 14 }}>
          {filtered.map((p: any) => (
            <ProductCard
              key={p.id}
              p={p}
              profile={profile}
              currency={currency}
              toggleLoadingId={toggleLoadingId}
              onEdit={openEdit}
              onToggle={p => p.is_active ? setConfirmDeactivate(p) : handleToggleActive(p)}
            />
          ))}
        </div>
      )}

      {/* ── Deactivate confirmation ── */}
      {confirmDeactivate && (
        <Modal title="Désactiver ce produit ?" onClose={() => setConfirmDeactivate(null)}>
          <div style={{ padding: '4px 0 8px' }}>
            <p style={{ fontSize: 14, color: C.slate, margin: '0 0 12px', lineHeight: 1.6, fontFamily: FONT }}>
              Le produit <strong style={{ color: C.ink }}>{confirmDeactivate.name}</strong> sera
              immédiatement retiré du formulaire de vente. Les ventes existantes ne sont pas affectées.
            </p>
            <p style={{ fontSize: 13, color: C.muted, margin: 0, fontFamily: FONT }}>
              Vous pourrez le réactiver à tout moment depuis cette page.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => setConfirmDeactivate(null)}
              style={{ padding: '9px 18px', borderRadius: 8, border: `1.5px solid ${C.border}`,
                background: C.surface, color: C.slate, fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: FONT }}>
              Annuler
            </button>
            <button
              onClick={async () => { await handleToggleActive(confirmDeactivate); setConfirmDeactivate(null) }}
              disabled={toggleLoadingId === confirmDeactivate?.id}
              style={{ padding: '9px 18px', borderRadius: 8, border: 'none',
                background: toggleLoadingId === confirmDeactivate?.id ? C.muted : C.red,
                color: 'white', fontSize: 13, fontWeight: 600,
                cursor: toggleLoadingId === confirmDeactivate?.id ? 'not-allowed' : 'pointer',
                fontFamily: FONT, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {toggleLoadingId === confirmDeactivate?.id
                ? <><span className="spinner" />Désactivation…</>
                : 'Désactiver'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Create drawer (4-step wizard) ── */}
      {showCreate && (
        <CreateDrawer title="Nouveau produit" step={modalStep} onClose={() => { setShowCreate(false); setModalStep(1) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Step indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {([
                [1, 'Type'],
                [2, 'Configuration'],
                [3, 'Prix & stock'],
                [4, 'Résumé'],
              ] as [number, string][]).map(([n, label], i) => (
                <React.Fragment key={n}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: modalStep === n ? C.blue : modalStep > n ? C.green : C.border,
                      color: modalStep >= n ? '#fff' : C.muted,
                      fontSize: 11, fontWeight: 700,
                    }}>
                      {modalStep > n
                        ? <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        : n}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: modalStep === n ? 700 : 400,
                      color: modalStep === n ? C.blue : C.muted, fontFamily: FONT,
                      whiteSpace: 'nowrap',
                    }}>
                      {label}
                    </span>
                  </div>
                  {i < 3 && (
                    <div style={{ flex: 1, height: 2, background: modalStep > n ? C.green : C.border,
                      marginBottom: 18, marginLeft: 4, marginRight: 4 }} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* ── STEP 1 — Comment vendez-vous ce produit ? ── */}
            {modalStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 13, color: C.muted, margin: '0 0 4px', fontFamily: FONT, lineHeight: 1.6 }}>
                  Choisissez comment ce produit est vendu. Le formulaire s'adaptera automatiquement.
                </p>
                {([
                  ['tile',     'Carrelage / m²',       'Vente en m² ou en cartons + carreaux', '#2563EB', '#EFF6FF',
                    <svg key="t" width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="1" y="1" width="7" height="7" rx="1.5" fill="#2563EB"/><rect x="12" y="1" width="7" height="7" rx="1.5" fill="#2563EB"/><rect x="1" y="12" width="7" height="7" rx="1.5" fill="#2563EB"/><rect x="12" y="12" width="7" height="7" rx="1.5" fill="#2563EB"/></svg>,
                  ],
                  ['unit',     'Pièce / unité',        'Robinet, lavabo, porte — stock à la pièce', '#7C3AED', '#F5F3FF',
                    <svg key="u" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2L18 7v8L10 19 2 15V7L10 2z" stroke="#7C3AED" strokeWidth="1.6" strokeLinejoin="round"/><path d="M2 7l8 4.5 8-4.5M10 2v17" stroke="#7C3AED" strokeWidth="1.4" strokeLinejoin="round"/></svg>,
                  ],
                  ['bag',      'Sac / conditionnement','Ciment, colle, sable — stock en sacs', '#D97706', '#FFFBEB',
                    <svg key="b" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 8h12l-2 10H6L4 8z" stroke="#D97706" strokeWidth="1.6" strokeLinejoin="round"/><path d="M7 8c0-3.3 1.3-6 3-6s3 2.7 3 6" stroke="#D97706" strokeWidth="1.6" strokeLinecap="round"/></svg>,
                  ],
                  ['liter',    'Litre / volume',       'Peinture, résine — vente au litre ou au bidon', '#0891B2', '#ECFEFF',
                    <svg key="l" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2L5 10a5 5 0 1 0 10 0L10 2z" stroke="#0891B2" strokeWidth="1.6" strokeLinejoin="round"/><path d="M7 13a3 3 0 0 0 3 3" stroke="#0891B2" strokeWidth="1.3" strokeLinecap="round" opacity="0.6"/></svg>,
                  ],
                  ['linear_m', 'Mètre linéaire',       'Tuyaux PVC, câbles — vente au mètre ou à la barre', '#059669', '#F0FDF4',
                    <svg key="m" width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="1" y="7" width="18" height="6" rx="2" stroke="#059669" strokeWidth="1.6"/><path d="M5 7v2.5M9 7v3.5M13 7v2.5M17 7v2.5" stroke="#059669" strokeWidth="1.4" strokeLinecap="round"/></svg>,
                  ],
                ] as [ProductType, string, string, string, string, React.ReactNode][]).map(([val, lbl, sub, color, bg, icon]) => {
                  const isSelected = productType === val
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => { setField('productType', val); refCodeTouched.current = false }}
                      style={{
                        padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                        textAlign: 'left', fontFamily: FONT,
                        border: `2px solid ${isSelected ? color : C.border}`,
                        background: isSelected ? bg : C.surface,
                        display: 'flex', alignItems: 'center', gap: 14,
                        transition: 'border-color 0.15s, background 0.15s',
                      }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: isSelected ? bg : C.bg, border: `1px solid ${isSelected ? color + '40' : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: isSelected ? color : C.ink, fontFamily: FONT }}>
                          {lbl}
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, marginTop: 3, fontFamily: FONT }}>{sub}</div>
                      </div>
                      {isSelected && (
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* ── STEP 2 — Configuration physique ── */}
            {modalStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Row>
                  <Field label="Code référence">
                    <input value={form.referenceCode} readOnly
                      placeholder="Généré automatiquement"
                      style={{ ...inputStyle, background: '#F1F5F9', cursor: 'default', color: C.slate }} />
                  </Field>
                  <Field label="Catégorie *">
                    <CategoryCombobox
                      value={form.category}
                      onChange={v => setField('category', v)}
                      categories={categories.filter(c => c.product_type === productType)}
                      inputStyle={inputStyle}
                    />
                  </Field>
                </Row>

                <Field label="Nom du produit *">
                  <input value={form.name} onChange={e => setField('name', e.target.value)}
                    placeholder={
                      productType === 'tile'     ? 'ex : Granit Noir 60×60'
                    : productType === 'bag'      ? 'ex : Ciment Portland CPA 42.5'
                    : productType === 'liter'    ? 'ex : Peinture blanche satinée 20L'
                    : productType === 'linear_m' ? 'ex : Tuyau PVC ⌀32'
                    : 'ex : Mitigeur lavabo chromé'
                    }
                    style={inputStyle} />
                </Field>

                <Field label="Fournisseur *">
                  <input value={form.supplier} onChange={e => setField('supplier', e.target.value)}
                    placeholder="ex : Ceramiche Italia" style={inputStyle} />
                </Field>

                {/* Tile dimensions */}
                {productType === 'tile' && (
                  <>
                    <Row>
                      <Field label="Largeur (cm) *">
                        <input type="number" min="1" value={form.widthCm}
                          onChange={e => setField('widthCm', e.target.value)}
                          placeholder="ex : 60" style={inputStyle} />
                      </Field>
                      <Field label="Hauteur (cm) *">
                        <input type="number" min="1" value={form.heightCm}
                          onChange={e => setField('heightCm', e.target.value)}
                          placeholder="ex : 60" style={inputStyle} />
                      </Field>
                      <Field label="Car./carton *">
                        <input type="number" min="1" value={form.tilesPerCarton}
                          onChange={e => setField('tilesPerCarton', e.target.value)}
                          placeholder="ex : 4" style={inputStyle} />
                      </Field>
                    </Row>
                    {tileAreaPreview && (
                      <div style={{ padding: '10px 14px', background: C.blueL,
                        borderRadius: 8, fontSize: 12, color: C.blue, fontFamily: FONT }}>
                        1 carreau = <strong>{tileAreaPreview.area.toFixed(4)} m²</strong>
                        {tileAreaPreview.cartonArea > 0 && (
                          <> · 1 carton = <strong>{tileAreaPreview.cartonArea.toFixed(4)} m²</strong></>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* linear_m */}
                {productType === 'linear_m' && (
                  <>
                    <Row>
                      <Field label="Unité de vente">
                        <input value={form.unitLabel} onChange={e => setField('unitLabel', e.target.value)} style={inputStyle} />
                      </Field>
                      <Field label="Conditionnement">
                        <input value={form.packageLabel} onChange={e => setField('packageLabel', e.target.value)} style={inputStyle} />
                      </Field>
                    </Row>
                    <Field label={`Longueur par ${form.packageLabel || 'barre'} (m) *`}>
                      <input type="number" min="0.01" step="0.01" value={form.pieceLengthM}
                        onChange={e => setField('pieceLengthM', e.target.value)}
                        placeholder="ex : 6" style={inputStyle} />
                    </Field>
                    {form.pieceLengthM && (
                      <div style={{ padding: '8px 14px', background: C.blueL,
                        borderRadius: 8, fontSize: 12, color: C.blue, fontFamily: FONT }}>
                        1 {form.packageLabel || 'barre'} = <strong>{form.pieceLengthM} m</strong>
                        {' · '}Le vendeur saisit en mètres ou en {form.packageLabel || 'barres'}
                      </div>
                    )}
                  </>
                )}

                {/* liter */}
                {productType === 'liter' && (
                  <>
                    <Row>
                      <Field label="Unité de vente">
                        <input value={form.unitLabel} onChange={e => setField('unitLabel', e.target.value)} style={inputStyle} />
                      </Field>
                      <Field label="Conditionnement">
                        <input value={form.packageLabel} onChange={e => setField('packageLabel', e.target.value)} style={inputStyle} />
                      </Field>
                    </Row>
                    <Field label={`Volume par ${form.packageLabel || 'bidon'} (L) *`}>
                      <input type="number" min="0.1" step="0.1" value={form.containerVolumeL}
                        onChange={e => setField('containerVolumeL', e.target.value)}
                        placeholder="ex : 20" style={inputStyle} />
                    </Field>
                    {form.containerVolumeL && (
                      <div style={{ padding: '8px 14px', background: C.blueL,
                        borderRadius: 8, fontSize: 12, color: C.blue, fontFamily: FONT }}>
                        1 {form.packageLabel || 'bidon'} = <strong>{form.containerVolumeL} L</strong>
                        {' · '}Le vendeur saisit en litres ou en {form.packageLabel || 'bidons'}
                      </div>
                    )}
                  </>
                )}

                {/* bag */}
                {productType === 'bag' && (
                  <>
                    <Row>
                      <Field label="Unité de vente">
                        <input value={form.unitLabel} onChange={e => setField('unitLabel', e.target.value)} style={inputStyle} />
                      </Field>
                      <Field label="Conditionnement">
                        <input value={form.packageLabel} onChange={e => setField('packageLabel', e.target.value)} style={inputStyle} />
                      </Field>
                    </Row>
                    <Field label="Poids par sac (kg)">
                      <input type="number" min="0.1" step="0.1" value={form.bagWeightKg}
                        onChange={e => setField('bagWeightKg', e.target.value)}
                        placeholder="ex : 50" style={inputStyle} />
                    </Field>
                    {form.bagWeightKg && (
                      <div style={{ padding: '8px 14px', background: C.blueL,
                        borderRadius: 8, fontSize: 12, color: C.blue, fontFamily: FONT }}>
                        1 sac = <strong>{form.bagWeightKg} kg</strong>
                        {' · '}Stock et vente comptés en nombre de sacs
                      </div>
                    )}
                  </>
                )}

                {/* unit */}
                {productType === 'unit' && (
                  <>
                    <Row>
                      <Field label="Unité de vente">
                        <input value={form.unitLabel} onChange={e => setField('unitLabel', e.target.value)} style={inputStyle} />
                      </Field>
                      <Field label="Conditionnement">
                        <input value={form.packageLabel} onChange={e => setField('packageLabel', e.target.value)} style={inputStyle} />
                      </Field>
                    </Row>
                    <div style={{ padding: '8px 14px', background: C.greenL,
                      borderRadius: 8, fontSize: 12, color: C.green, fontFamily: FONT }}>
                      Produit vendu à la pièce · Stock compté en {form.unitLabel || 'pièces'}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── STEP 3 — Prix & stock ── */}
            {modalStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontSize: 13, color: C.slate, margin: '0 0 4px', fontFamily: FONT, lineHeight: 1.5 }}>
                  Prix par <strong>{productType === 'tile' ? 'm²' : (form.unitLabel || 'unité')}</strong>
                </p>
                <Row>
                  {profile.role === 'owner' && (
                    <Field label="Prix d'achat *">
                      <input type="number" min="0" value={form.purchasePrice}
                        onChange={e => setField('purchasePrice', e.target.value)}
                        placeholder="ex : 8 000" style={inputStyle} />
                    </Field>
                  )}
                  <Field label="Prix plancher *">
                    <input type="number" min="0"
                      value={productType === 'tile' ? form.floorPricePerM2   : form.floorPricePerUnit}
                      onChange={e => setField(productType === 'tile' ? 'floorPricePerM2' : 'floorPricePerUnit', e.target.value)}
                      placeholder="ex : 12 000" style={inputStyle} />
                  </Field>
                  <Field label="Prix référence *">
                    <input type="number" min="0"
                      value={productType === 'tile' ? form.referencePricePerM2 : form.referencePricePerUnit}
                      onChange={e => setField(productType === 'tile' ? 'referencePricePerM2' : 'referencePricePerUnit', e.target.value)}
                      placeholder="ex : 15 000" style={inputStyle} />
                  </Field>
                </Row>

                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.muted,
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                    marginBottom: 12, fontFamily: FONT }}>
                    Stock initial (optionnel)
                  </div>
                  {productType === 'tile' ? (
                    <>
                      <Row>
                        <Field label="Cartons complets">
                          <input type="number" min="0" value={form.initialCartons}
                            onChange={e => setField('initialCartons', e.target.value)}
                            placeholder="ex : 50" style={inputStyle} />
                        </Field>
                        <Field label="Carreaux en plus">
                          <input type="number" min="0" value={form.initialLooseTiles}
                            onChange={e => setField('initialLooseTiles', e.target.value)}
                            placeholder="ex : 3" style={inputStyle} />
                        </Field>
                      </Row>
                      {(form.initialCartons || form.initialLooseTiles) && form.tilesPerCarton && (
                        <div style={{ fontSize: 12, color: C.blue, fontWeight: 600, marginTop: 6, fontFamily: FONT }}>
                          = {fmtNum(
                            (parseInt(form.initialCartons) || 0) * parseInt(form.tilesPerCarton)
                            + (parseInt(form.initialLooseTiles) || 0)
                          )} carreaux total
                        </div>
                      )}
                    </>
                  ) : (
                    <Row>
                      <Field label={`${form.packageLabel || 'Unités'} par lot (optionnel)`}>
                        <input type="number" min="1" value={form.piecesPerPackage}
                          onChange={e => setField('piecesPerPackage', e.target.value)}
                          placeholder="ex : 12" style={inputStyle} />
                      </Field>
                      <Field label={`Stock initial (${form.unitLabel || 'unités'})`}>
                        <input type="number" min="0" value={form.initialQuantity}
                          onChange={e => setField('initialQuantity', e.target.value)}
                          placeholder="ex : 200" style={inputStyle} />
                      </Field>
                    </Row>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 4 — Résumé intelligent ── */}
            {modalStep === 4 && (() => {
              const isTileType     = productType === 'tile'
              const tileAreaVal    = isTileType && form.widthCm && form.heightCm
                ? (parseFloat(form.widthCm) / 100) * (parseFloat(form.heightCm) / 100) : null
              const cartonAreaVal  = tileAreaVal && form.tilesPerCarton
                ? tileAreaVal * parseInt(form.tilesPerCarton) : null
              const initStock      = isTileType
                ? (parseInt(form.initialCartons) || 0) * (parseInt(form.tilesPerCarton) || 0)
                  + (parseInt(form.initialLooseTiles) || 0)
                : parseInt(form.initialQuantity) || 0
              const convLine       =
                isTileType && tileAreaVal
                  ? `1 carreau = ${tileAreaVal.toFixed(4)} m² · 1 carton = ${(cartonAreaVal ?? 0).toFixed(4)} m²`
                : productType === 'linear_m' && form.pieceLengthM
                  ? `1 ${form.packageLabel || 'barre'} = ${form.pieceLengthM} m`
                : productType === 'liter' && form.containerVolumeL
                  ? `1 ${form.packageLabel || 'bidon'} = ${form.containerVolumeL} L`
                : productType === 'bag' && form.bagWeightKg
                  ? `1 sac = ${form.bagWeightKg} kg`
                : null
              const priceUnit      = isTileType ? 'm²' : (form.unitLabel || 'unité')
              const refP           = parseFloat(isTileType ? form.referencePricePerM2 : form.referencePricePerUnit)
              const floorP         = parseFloat(isTileType ? form.floorPricePerM2     : form.floorPricePerUnit)
              const stockLine      = isTileType
                ? `${form.initialCartons || 0} carton(s)${parseInt(form.initialLooseTiles) > 0 ? ` + ${form.initialLooseTiles} carreau(x)` : ''}`
                : `${initStock} ${form.unitLabel || 'unité'}(s)`
              const sellMode: Record<ProductType, string> = {
                tile:     'Par surface (m²) — cartons + carreaux',
                unit:     'À la pièce',
                bag:      'Par sac',
                liter:    'Par volume (litre)',
                linear_m: 'Au mètre linéaire — barres/rouleaux',
              }
              const rows: [string, string][] = [
                ['Mode de vente',  sellMode[productType]],
                ...(convLine ? [['Conversion', convLine] as [string, string]] : []),
                ['Stock initial',  stockLine],
                ['Prix référence', `${fmtNum(refP)} / ${priceUnit}`],
                ['Prix plancher',  `${fmtNum(floorP)} / ${priceUnit}`],
                ...(profile.role === 'owner' && form.purchasePrice
                  ? [["Prix d'achat", `${fmtNum(parseFloat(form.purchasePrice))} / ${priceUnit}`] as [string, string]]
                  : []),
              ]
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ fontSize: 13, color: C.slate, margin: 0, fontFamily: FONT }}>
                    Vérifiez les informations avant de créer le produit.
                  </p>
                  <div style={{ background: C.blueL, borderRadius: 12,
                    border: `1.5px solid ${C.blue}33`, padding: '18px 20px' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.ink,
                      letterSpacing: '-0.02em', fontFamily: FONT, marginBottom: 4 }}>
                      {form.name || '—'}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, fontFamily: FONT, marginBottom: 14 }}>
                      {form.referenceCode} · {form.category} · {form.supplier}
                    </div>
                    {rows.map(([label, value]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', padding: '8px 0',
                        borderTop: `1px solid ${C.blue}22` }}>
                        <span style={{ fontSize: 12, color: C.slate, fontFamily: FONT }}>{label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, fontFamily: FONT }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Error / success feedback */}
            {error && (
              <div style={{ padding: '10px 14px', background: C.redL, borderRadius: 8,
                fontSize: 12, fontWeight: 600, color: C.red, fontFamily: FONT }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ padding: '10px 14px', background: C.greenL, borderRadius: 8,
                fontSize: 12, fontWeight: 600, color: C.green, fontFamily: FONT }}>
                {success}
              </div>
            )}

            {/* Wizard navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setShowCreate(false); setModalStep(1) }}
                  style={{ padding: '10px 16px', borderRadius: 8,
                    border: `1.5px solid ${C.border}`, background: C.surface,
                    color: C.slate, fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', fontFamily: FONT }}>
                  Annuler
                </button>
                {modalStep > 1 && (
                  <button
                    onClick={() => { setError(null); setModalStep(prev => (prev - 1) as 1|2|3|4) }}
                    style={{ padding: '10px 16px', borderRadius: 8,
                      border: `1.5px solid ${C.border}`, background: C.surface,
                      color: C.blue, fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', fontFamily: FONT }}>
                    ← Retour
                  </button>
                )}
              </div>
              {modalStep < 4 ? (
                <button
                  className="btn-meram"
                  onClick={advanceModalStep}
                  style={{ padding: '10px 24px', borderRadius: 9,
                    border: 'none', fontSize: 13, fontWeight: 700,
                    cursor: 'pointer', fontFamily: FONT,
                    display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  Suivant
                  <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5h10M7 1l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              ) : (
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  style={{ padding: '10px 24px', borderRadius: 8,
                    border: 'none',
                    background: loading ? C.muted : C.green,
                    color: 'white', fontSize: 13, fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: FONT,
                    display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {loading ? <><span className="spinner" />Création…</> : 'Créer le produit'}
                </button>
              )}
            </div>
          </div>
        </CreateDrawer>
      )}

      {/* ── Edit modal ── */}
      {editProduct && (() => {
        const pt: ProductType = editProduct.product_type ?? 'tile'
        return (
          <Modal title={`Modifier — ${editProduct.reference_code}`} onClose={() => setEditProduct(null)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              <Field label="Nom du produit *">
                <input value={form.name} onChange={e => setField('name', e.target.value)} style={inputStyle} />
              </Field>

              <Row>
                <Field label="Catégorie">
                  <CategoryCombobox
                    value={form.category}
                    onChange={v => setField('category', v)}
                    categories={categories.filter(c => c.product_type === pt)}
                    inputStyle={inputStyle}
                  />
                </Field>
                <Field label="Fournisseur">
                  <input value={form.supplier} onChange={e => setField('supplier', e.target.value)} style={inputStyle} />
                </Field>
              </Row>

              {/* Tile edit — original unchanged */}
              {pt === 'tile' && (
                <>
                  <Row>
                    {profile.role === 'owner' && (
                      <Field label="Prix d'achat/m²">
                        <input type="number" min="0" value={form.purchasePrice}
                          onChange={e => setField('purchasePrice', e.target.value)} style={inputStyle} />
                      </Field>
                    )}
                    <Field label="Prix plancher/m²">
                      <input type="number" min="0" value={form.floorPricePerM2}
                        onChange={e => setField('floorPricePerM2', e.target.value)} style={inputStyle} />
                    </Field>
                    <Field label="Prix référence/m²">
                      <input type="number" min="0" value={form.referencePricePerM2}
                        onChange={e => setField('referencePricePerM2', e.target.value)} style={inputStyle} />
                    </Field>
                  </Row>
                  <div style={{ padding: '10px 12px', background: C.bg,
                    borderRadius: 8, fontSize: 12, color: C.muted, fontFamily: FONT }}>
                    Format {editProduct.width_cm}×{editProduct.height_cm} cm ·{' '}
                    {editProduct.tiles_per_carton} car./carton ·{' '}
                    {fmtM2(parseFloat(editProduct.tile_area_m2))}/carreau
                    <br />
                    <span style={{ fontSize: 11 }}>Les dimensions ne peuvent pas être modifiées après création.</span>
                  </div>
                </>
              )}

              {/* Non-tile edit */}
              {pt !== 'tile' && (
                <>
                  <Row>
                    {profile.role === 'owner' && (
                      <Field label={`Prix d'achat / ${editProduct.unit_label}`}>
                        <input type="number" min="0" value={form.purchasePrice}
                          onChange={e => setField('purchasePrice', e.target.value)} style={inputStyle} />
                      </Field>
                    )}
                    <Field label={`Prix plancher / ${editProduct.unit_label}`}>
                      <input type="number" min="0" value={form.floorPricePerUnit}
                        onChange={e => setField('floorPricePerUnit', e.target.value)} style={inputStyle} />
                    </Field>
                    <Field label={`Prix référence / ${editProduct.unit_label}`}>
                      <input type="number" min="0" value={form.referencePricePerUnit}
                        onChange={e => setField('referencePricePerUnit', e.target.value)} style={inputStyle} />
                    </Field>
                  </Row>
                  <NonTileInfoBadge p={editProduct} />
                </>
              )}

              <FormFooter
                error={error} success={success} loading={loading}
                onConfirm={handleUpdate}
                onCancel={() => setEditProduct(null)}
                confirmLabel="Enregistrer"
              />
            </div>
          </Modal>
        )
      })()}
    </PageLayout>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Product card — type-aware display
// ─────────────────────────────────────────────────────────────────────────────

function ProductCard({ p, profile, currency, toggleLoadingId, onEdit, onToggle }: {
  p:               any
  profile:         any
  currency:        string
  toggleLoadingId: string | null
  onEdit:          (p: any) => void
  onToggle:        (p: any) => void
}) {
  const pt: ProductType = p.product_type ?? 'tile'
  const stock     = Array.isArray(p.stock) ? p.stock[0] : p.stock
  const total     = parseInt(stock?.total_tiles    ?? '0')
  const reserved  = parseInt(stock?.reserved_tiles ?? '0')
  const available = total - reserved

  // Stock color logic
  let isCritical = false
  let isLow      = false

  if (pt === 'tile') {
    const tpc = parseInt(p.tiles_per_carton) || 1
    const availCartons = Math.floor(available / tpc)
    isCritical = availCartons < CRITICAL_STOCK_CARTONS
    isLow      = availCartons < LOW_STOCK_CARTONS
  } else {
    isCritical = available < CRITICAL_STOCK_UNITS
    isLow      = available < LOW_STOCK_UNITS
  }

  const stockColor = !p.is_active ? C.muted : isCritical ? C.red : isLow ? C.orange : C.green

  const typeConfig: Record<ProductType, { color: string; bg: string }> = {
    tile:     { color: '#2563EB', bg: '#EFF6FF' },
    unit:     { color: '#7C3AED', bg: '#F5F3FF' },
    bag:      { color: '#D97706', bg: '#FFFBEB' },
    liter:    { color: '#0891B2', bg: '#ECFEFF' },
    linear_m: { color: '#059669', bg: '#F0FDF4' },
  }
  const tcfg = typeConfig[pt] ?? typeConfig.unit

  return (
    <div style={{
      background: C.surface, borderRadius: 14,
      border: `1px solid ${C.border}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      overflow: 'hidden',
      opacity: p.is_active ? 1 : 0.6,
    }}>
      {/* Color top stripe based on stock status */}
      <div style={{ height: 3, background: !p.is_active ? C.muted : isCritical ? C.red : isLow ? C.orange : C.green }} />

      <div style={{ padding: '16px 18px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, gap: 10, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: tcfg.bg, border: `1px solid ${tcfg.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ProductTypeIcon type={pt} color={tcfg.color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 2, fontFamily: FONT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {p.name}
            </div>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>
              {p.reference_code}{p.category ? ` · ${p.category}` : ''}
            </div>
          </div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center',
          gap: 5, fontSize: 11, fontWeight: 600,
          padding: '3px 10px', height: 'fit-content',
          borderRadius: 100, flexShrink: 0, marginLeft: 8,
          background: p.is_active ? C.greenL : C.redL,
          color:      p.is_active ? C.green  : C.red, fontFamily: FONT }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%',
            background: p.is_active ? C.green : C.red, flexShrink: 0 }} />
          {p.is_active ? 'Actif' : 'Inactif'}
        </span>
      </div>

      {/* Info grid */}
      {pt === 'tile' && <TileInfoGrid p={p} currency={currency} />}
      {pt !== 'tile' && <NonTileInfoGrid p={p} currency={currency} />}

      {/* Stock */}
      <StockBlock
        pt={pt} p={p} available={available} reserved={reserved}
        isCritical={isCritical} isLow={isLow}
      />

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onEdit(p)}
          style={{ flex: 1, padding: '8px', background: C.blueL, color: C.blue,
            border: `1px solid ${C.blue}20`, borderRadius: 8,
            fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
          Modifier
        </button>
        <button
          onClick={() => onToggle(p)}
          disabled={toggleLoadingId === p.id}
          style={{ flex: 1, padding: '8px',
            background: p.is_active ? C.redL   : C.greenL,
            color:      p.is_active ? C.red    : C.green,
            border: 'none', borderRadius: 8,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontFamily: FONT }}>
          {toggleLoadingId === p.id
            ? <><span className="spinner-blue" />…</>
            : p.is_active ? 'Désactiver' : 'Réactiver'}
        </button>
      </div>
      </div>
    </div>
  )
}

function ProductTypeIcon({ type, color }: { type: string; color: string }) {
  const s = 15
  switch (type) {
    case 'tile': return <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="5.5" height="5.5" rx="1.2" fill={color}/><rect x="9.5" y="1" width="5.5" height="5.5" rx="1.2" fill={color}/><rect x="1" y="9.5" width="5.5" height="5.5" rx="1.2" fill={color}/><rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1.2" fill={color}/></svg>
    case 'bag':  return <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M3 6h10l-1.5 8H4.5L3 6z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/><path d="M5.5 6C5.5 3.5 6.5 2 8 2s2.5 1.5 2.5 4" stroke={color} strokeWidth="1.4" strokeLinecap="round"/></svg>
    case 'liter': return <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M8 2L4 8a4 4 0 1 0 8 0L8 2z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/></svg>
    case 'linear_m': return <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><rect x="1" y="5.5" width="14" height="5" rx="1.5" stroke={color} strokeWidth="1.4"/><path d="M4 5.5v2M7 5.5v3M10 5.5v2M13 5.5v2" stroke={color} strokeWidth="1.2" strokeLinecap="round"/></svg>
    default: return <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M8 1.5L14 5v6L8 14.5 2 11V5L8 1.5z" stroke={color} strokeWidth="1.4" strokeLinejoin="round"/><path d="M2 5l6 3.5 6-3.5M8 1.5v13" stroke={color} strokeWidth="1.2" strokeLinejoin="round"/></svg>
  }
}

// ── Tile info grid (original layout — unchanged) ──────────────────────────────

function TileInfoGrid({ p, currency }: { p: any; currency: string }) {
  const fmt = (n: number) => fmtCurrency(n, currency)
  const tileArea = parseFloat(p.tile_area_m2) || 0
  const tpc      = parseInt(p.tiles_per_carton) || 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
      {([
        ['Format',         `${p.width_cm}×${p.height_cm} cm`],
        ['Surface/car.',   fmtM2(tileArea)],
        ['Car./carton',    String(tpc)],
        ['Prix plancher',  fmt(p.floor_price_per_m2) + '/m²'],
        ['Prix référence', fmt(p.reference_price_per_m2) + '/m²'],
        ['Fournisseur',    p.supplier],
      ] as [string, string][]).map(([lbl, val]) => (
        <InfoCell key={lbl} label={lbl} value={val} />
      ))}
    </div>
  )
}

// ── Non-tile info grid ────────────────────────────────────────────────────────

function NonTileInfoGrid({ p, currency }: { p: any; currency: string }) {
  const fmt     = (n: number) => fmtCurrency(n, currency)
  const pt: ProductType = p.product_type
  const unit    = p.unit_label ?? 'unité'

  const rows: [string, string][] = [
    ['Prix plancher',  fmt(p.floor_price_per_unit)     + ' / ' + unit],
    ['Prix référence', fmt(p.reference_price_per_unit) + ' / ' + unit],
    ['Fournisseur',    p.supplier],
  ]

  if (pt === 'linear_m' && p.piece_length_m)
    rows.unshift(['Long. / barre', p.piece_length_m + ' m'])

  if (pt === 'liter' && p.container_volume_l)
    rows.unshift(['Vol. / bidon', p.container_volume_l + ' L'])

  if (pt === 'bag' && p.bag_weight_kg)
    rows.unshift(['Poids / sac', p.bag_weight_kg + ' kg'])

  if (p.pieces_per_package)
    rows.push([p.package_label ?? 'Par lot', String(p.pieces_per_package) + ' ' + unit + 's'])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
      {rows.map(([lbl, val]) => <InfoCell key={lbl} label={lbl} value={val} />)}
    </div>
  )
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '7px 8px', background: C.bg, borderRadius: 6 }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: C.muted,
        textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: FONT }}>
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, marginTop: 2, fontFamily: FONT }}>
        {value}
      </div>
    </div>
  )
}

// ── Stock block — type-aware ──────────────────────────────────────────────────

function StockBlock({ pt, p, available, reserved, isCritical, isLow }: {
  pt:         ProductType
  p:          any
  available:  number
  reserved:   number
  isCritical: boolean
  isLow:      boolean
}) {
  const bg    = isCritical ? C.redL    : isLow ? C.orangeL : C.greenL
  const color = isCritical ? C.red     : isLow ? C.orange  : C.green

  let mainLabel = ''
  let subLabel  = ''

  if (pt === 'tile') {
    const tileArea = parseFloat(p.tile_area_m2) || 0
    const tpc      = parseInt(p.tiles_per_carton) || 1
    const availM2  = available * tileArea
    mainLabel = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(availM2) + ' m²'
    subLabel = `${fmtNum(available)} carreaux · ${Math.floor(available / tpc)} cartons`
      + (available % tpc > 0 ? ` + ${available % tpc}` : '')
  } else if (pt === 'linear_m' && p.piece_length_m) {
    const totalM = available * parseFloat(p.piece_length_m)
    mainLabel = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 1, maximumFractionDigits: 1,
    }).format(totalM) + ' m'
    subLabel = `${fmtNum(available)} barre${available !== 1 ? 's' : ''}`
  } else if (pt === 'liter' && p.container_volume_l) {
    const totalL = available * parseFloat(p.container_volume_l)
    mainLabel = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0, maximumFractionDigits: 1,
    }).format(totalL) + ' L'
    subLabel = `${fmtNum(available)} ${p.package_label ?? 'bidon'}${available !== 1 ? 's' : ''}`
  } else if (pt === 'bag' && p.bag_weight_kg) {
    const totalKg = available * parseFloat(p.bag_weight_kg)
    mainLabel = fmtNum(Math.round(totalKg)) + ' kg'
    subLabel  = `${fmtNum(available)} sac${available !== 1 ? 's' : ''}`
  } else {
    const unit = p.unit_label ?? 'pièce'
    mainLabel  = `${fmtNum(available)} ${unit}${available !== 1 ? 's' : ''}`
    subLabel   = ''
  }

  return (
    <div style={{ padding: '10px 12px', background: bg, borderRadius: 8, marginBottom: 12,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: C.muted,
          textTransform: 'uppercase', fontFamily: FONT }}>
          Stock disponible
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, color, fontFamily: FONT }}>
          {mainLabel}
        </div>
        {subLabel && (
          <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>{subLabel}</div>
        )}
      </div>
      {reserved > 0 && (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: C.muted, fontFamily: FONT }}>Réservé</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.orange, fontFamily: FONT }}>
            {fmtNum(reserved)} {p.unit_label ?? 'car.'}
          </div>
        </div>
      )}
    </div>
  )
}

function NonTileInfoBadge({ p }: { p: any }) {
  const pt: ProductType = p.product_type
  const lines: string[] = [
    `Type : ${TYPE_LABELS[pt]}`,
    `Unité : ${p.unit_label}`,
  ]
  if (pt === 'linear_m' && p.piece_length_m)
    lines.push(`Longueur/barre : ${p.piece_length_m} m`)
  if (pt === 'liter' && p.container_volume_l)
    lines.push(`Volume/contenant : ${p.container_volume_l} L`)
  if (pt === 'bag' && p.bag_weight_kg)
    lines.push(`Poids/sac : ${p.bag_weight_kg} kg`)

  return (
    <div style={{ padding: '10px 12px', background: C.bg,
      borderRadius: 8, fontSize: 12, color: C.muted, fontFamily: FONT }}>
      {lines.join(' · ')}
      <br />
      <span style={{ fontSize: 11 }}>Ces attributs ne peuvent pas être modifiés après création.</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: C.slate,
  display: 'block', marginBottom: 6, fontFamily: FONT,
  textTransform: 'uppercase', letterSpacing: '0.05em',
}

// ── Full-height drawer from right (for create wizard) ────────────────────────

// ── Full-height drawer from right (for create wizard) ────────────────────────

function CreateDrawer({ title, step, children, onClose }: {
  title:    string
  step:     number
  children: React.ReactNode
  onClose:  () => void
}) {
  const stepSubtitles = ['', 'Type de produit', 'Configuration physique', 'Prix & stock initial', 'Vérification finale']
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', justifyContent: 'flex-end',
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(15,23,42,0.42)',
          backdropFilter: 'blur(4px)',
          animation: 'modalBackdrop 0.2s ease',
        }}
      />
      {/* Drawer panel */}
      <div className="drawer-panel" style={{
        position: 'relative',
        width: '100%', maxWidth: 560,
        background: C.surface,
        boxShadow: '-12px 0 48px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Blue accent stripe */}
        <div style={{ height: 3, background: 'linear-gradient(90deg,#1D4ED8 0%,#3B82F6 60%,#60A5FA 100%)', flexShrink: 0 }} />
        {/* Drawer header */}
        <div style={{
          padding: '18px 24px 14px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexShrink: 0,
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.ink, letterSpacing: '-0.025em', fontFamily: FONT }}>
              {title}
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: C.muted, fontFamily: FONT }}>
              Étape {step} — {stepSubtitles[step]}
            </p>
          </div>
          <button onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: C.bg, border: `1px solid ${C.border}`,
              cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted,
            }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function Modal({ title, children, onClose }: {
  title:    string
  children: React.ReactNode
  onClose:  () => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
        animation: 'modalBackdrop 0.2s ease',
      }}>
      <div style={{ background: C.surface, borderRadius: 16,
        width: '100%', maxWidth: 560, maxHeight: '92vh',
        boxShadow: '0 32px 80px -16px rgba(0,0,0,0.28), 0 0 0 1px rgba(15,23,42,0.06)',
        animation: 'modalPanel 0.22s cubic-bezier(0.16,1,0.3,1)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 24px 16px',
          borderBottom: `1px solid #F1F5F9`,
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 16, flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.ink,
            letterSpacing: '-0.02em', fontFamily: FONT }}>
            {title}
          </h3>
          <button onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 8,
              background: C.bg, border: `1px solid ${C.border}`,
              cursor: 'pointer', flexShrink: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: C.muted }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div style={{ padding: '22px 24px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 10 }}>{children}</div>
}

// ─────────────────────────────────────────────────────────────────────────────
// CategoryCombobox
// ─────────────────────────────────────────────────────────────────────────────
// Free-text input with dropdown autocomplete.
// - Existing categories (scoped to company + type) are shown filtered by query.
// - If the typed value doesn't match any slug, a "+ Créer '...'" option appears.
// - Selection sets the value; the server action resolves/creates on submit.
// ─────────────────────────────────────────────────────────────────────────────

function CategoryCombobox({
  value,
  onChange,
  categories,
  inputStyle,
}: {
  value:      string
  onChange:   (v: string) => void
  categories: ProductCategory[]
  inputStyle: React.CSSProperties
}) {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState(value)
  const containerRef      = useRef<HTMLDivElement>(null)

  // Sync query when external value resets (e.g. type change)
  useEffect(() => { setQuery(value) }, [value])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const slugify = (s: string) =>
    s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ')

  const querySlug  = slugify(query)
  const filtered   = querySlug
    ? categories.filter(c => c.slug.includes(querySlug))
    : categories

  const exactMatch = categories.some(c => c.slug === querySlug)
  const showCreate = query.trim().length > 0 && !exactMatch

  const select = (name: string) => {
    onChange(name)
    setQuery(name)
    setOpen(false)
  }

  const dropdownVisible = open && (filtered.length > 0 || showCreate)

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Tapez ou choisissez…"
        style={inputStyle}
        autoComplete="off"
      />
      {dropdownVisible && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: C.surface, border: `1.5px solid ${C.border}`,
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
          zIndex: 100, maxHeight: 220, overflowY: 'auto',
        }}>
          {filtered.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => select(c.name)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: '100%', padding: '9px 12px', border: 'none',
                background: 'transparent', cursor: 'pointer', textAlign: 'left',
                fontSize: 13, color: C.ink, fontFamily: FONT,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span>{c.name}</span>
              {c.usage_count > 0 && (
                <span style={{ fontSize: 11, color: C.muted, marginLeft: 8, flexShrink: 0 }}>
                  {c.usage_count}
                </span>
              )}
            </button>
          ))}
          {showCreate && (
            <>
              {filtered.length > 0 && (
                <div style={{ height: 1, background: C.border, margin: '2px 0' }} />
              )}
              <button
                type="button"
                onClick={() => select(query.trim())}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  width: '100%', padding: '9px 12px', border: 'none',
                  background: 'transparent', cursor: 'pointer', textAlign: 'left',
                  fontSize: 13, color: C.blue, fontWeight: 600, fontFamily: FONT,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = C.blueL)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke={C.blue} strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                Créer &ldquo;{query.trim()}&rdquo;
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function FormFooter({ error, success, loading, onConfirm, onCancel, confirmLabel }: {
  error:        string | null
  success:      string | null
  loading:      boolean
  onConfirm:    () => void
  onCancel:     () => void
  confirmLabel: string
}) {
  return (
    <>
      {error && (
        <div style={{ padding: '10px 12px', background: C.redL,
          borderRadius: 8, fontSize: 12, fontWeight: 600, color: C.red,
          fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="6" stroke={C.red} strokeWidth="1.3"/>
            <path d="M7 4v3.5" stroke={C.red} strokeWidth="1.4" strokeLinecap="round"/>
            <circle cx="7" cy="10" r="0.7" fill={C.red}/>
          </svg>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '10px 12px', background: C.greenL,
          borderRadius: 8, fontSize: 12, fontWeight: 600, color: C.green,
          fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="6" stroke={C.green} strokeWidth="1.3"/>
            <path d="M4 7l2 2 4-4" stroke={C.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {success}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
        <button onClick={onCancel}
          style={{ padding: '9px 18px', borderRadius: 8, border: `1.5px solid ${C.border}`,
            background: C.surface, color: C.slate, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: FONT }}>
          Annuler
        </button>
        <button onClick={onConfirm} disabled={loading}
          style={{ padding: '9px 20px', borderRadius: 8, border: 'none',
            background: loading ? C.muted : C.navy,
            color: 'white', fontSize: 13, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: FONT, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {loading ? <><span className="spinner" />{confirmLabel}…</> : confirmLabel}
        </button>
      </div>
    </>
  )
}
