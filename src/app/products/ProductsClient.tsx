'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter }    from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createProduct, updateProduct } from './actions'
import PageLayout       from '@/components/PageLayout'
import type { BadgeCounts } from '@/lib/supabase/badge-counts'
import type { ProductType } from '@/lib/types'
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

const fmtNum = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
const fmtM2  = (n: number) =>
  new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 4, maximumFractionDigits: 4,
  }).format(n) + ' m²'

// ── Categories by product type ────────────────────────────────────────────────

const CATEGORIES_BY_TYPE: Record<ProductType, string[]> = {
  tile: [
    'Carreaux Sol', 'Carreaux Mur', 'Carreaux Extérieur',
    'Carreaux Décoratifs', 'Mosaïque', 'Plinthes',
    'Parquet & Stratifié', 'Vinyle & LVT',
  ],
  unit: [
    'Sanitaire', 'Robinetterie',
    'Meubles de salle de bain', 'Accessoires de salle de bain',
    'Portes & Fenêtres', 'Accessoires & Outillage', 'Divers',
  ],
  linear_m: [
    'Profilés & Finitions', 'Plinthes', 'Cornières & Seuils',
    'Moulures', 'Accessoires & Outillage', 'Divers',
  ],
  bag: [
    'Colles & Mortiers', 'Joints & Enduits',
    'Ciments & Liants', 'Imperméabilisants', 'Divers',
  ],
  liter: [
    'Peinture & Revêtements', 'Imperméabilisants',
    'Primaires & Apprêts', 'Produits d\'entretien', 'Divers',
  ],
}

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
  category:      CATEGORIES_BY_TYPE[type][0] ?? '',
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
  products,
  badgeCounts,
}: {
  profile:      any
  products:     any[]
  badgeCounts?: BadgeCounts
}) {
  const router   = useRouter()
  const supabase = createClient()

  const [showCreate,        setShowCreate]        = useState(false)
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

  // Reset category when type changes
  useEffect(() => {
    if (!showCreate) return
    setField('category', CATEGORIES_BY_TYPE[productType][0] ?? '')
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
          <h1 style={{ fontSize: 22, fontWeight: 700, color: C.ink,
            margin: '0 0 4px', letterSpacing: '-0.02em', fontFamily: FONT }}>
            Catalogue produits
          </h1>
          <p style={{ fontSize: 13, color: C.slate, margin: 0, fontFamily: FONT }}>
            {products.filter(p => p.is_active).length} produit
            {products.filter(p => p.is_active).length !== 1 ? 's' : ''} actif
            {products.filter(p => p.is_active).length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => {
            setForm(emptyForm('tile'))
            setError(null)
            setSuccess(null)
            refCodeTouched.current = false
            setShowCreate(true)
          }}
          style={{ padding: '11px 20px', background: C.navy,
            color: C.surface, border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
          + Nouveau produit
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

      {/* ── Create modal ── */}
      {showCreate && (
        <Modal title="Nouveau produit" onClose={() => setShowCreate(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Type selector */}
            <div>
              <label style={labelStyle}>Type de produit *</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(Object.entries(TYPE_LABELS) as [ProductType, string][]).map(([val, lbl]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setField('productType', val)
                      refCodeTouched.current = false
                    }}
                    style={{
                      padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
                      fontSize: 12, fontWeight: 600, fontFamily: FONT, textAlign: 'left',
                      border: `2px solid ${productType === val ? C.blue : C.border}`,
                      background: productType === val ? C.blueL : C.surface,
                      color: productType === val ? C.blue : C.slate,
                    }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* ── TILE FORM — logique originale inchangée ── */}
            {productType === 'tile' && (
              <>
                <Row>
                  <Field label="Code référence *">
                    <input value={form.referenceCode} readOnly
                      placeholder="Généré automatiquement"
                      style={{ ...inputStyle, background: '#F1F5F9', cursor: 'default', color: C.slate }} />
                  </Field>
                  <Field label="Catégorie *">
                    <select value={form.category} onChange={e => setField('category', e.target.value)} style={inputStyle}>
                      {CATEGORIES_BY_TYPE.tile.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                </Row>

                <Field label="Nom du produit *">
                  <input value={form.name} onChange={e => setField('name', e.target.value)}
                    placeholder="ex : Granit Noir 60×60" style={inputStyle} />
                </Field>

                <Field label="Fournisseur *">
                  <input value={form.supplier} onChange={e => setField('supplier', e.target.value)}
                    placeholder="ex : Ceramiche Italia" style={inputStyle} />
                </Field>

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
                  <div style={{ padding: '10px 12px', background: C.blueL,
                    borderRadius: 8, fontSize: 12, color: C.blue, fontFamily: FONT }}>
                    Surface/carreau : <strong>{tileAreaPreview.area.toFixed(4)} m²</strong>
                    {tileAreaPreview.cartonArea > 0 && (
                      <> · Carton : <strong>{tileAreaPreview.cartonArea.toFixed(4)} m²</strong></>
                    )}
                  </div>
                )}

                <Row>
                  {profile.role === 'owner' && (
                    <Field label="Prix d'achat/m² *">
                      <input type="number" min="0" value={form.purchasePrice}
                        onChange={e => setField('purchasePrice', e.target.value)}
                        placeholder="ex : 8000" style={inputStyle} />
                    </Field>
                  )}
                  <Field label="Prix plancher/m² *">
                    <input type="number" min="0" value={form.floorPricePerM2}
                      onChange={e => setField('floorPricePerM2', e.target.value)}
                      placeholder="ex : 12000" style={inputStyle} />
                  </Field>
                  <Field label="Prix référence/m² *">
                    <input type="number" min="0" value={form.referencePricePerM2}
                      onChange={e => setField('referencePricePerM2', e.target.value)}
                      placeholder="ex : 15000" style={inputStyle} />
                  </Field>
                </Row>

                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.muted,
                    textTransform: 'uppercase', letterSpacing: '0.07em',
                    marginBottom: 12, fontFamily: FONT }}>
                    Stock initial (optionnel)
                  </div>
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
                </div>
              </>
            )}

            {/* ── NON-TILE COMMON FIELDS ── */}
            {productType !== 'tile' && (
              <>
                <Row>
                  <Field label="Code référence *">
                    <input value={form.referenceCode} readOnly
                      placeholder="Généré automatiquement"
                      style={{ ...inputStyle, background: '#F1F5F9', cursor: 'default', color: C.slate }} />
                  </Field>
                  <Field label="Catégorie *">
                    <select value={form.category} onChange={e => setField('category', e.target.value)} style={inputStyle}>
                      {CATEGORIES_BY_TYPE[productType].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                </Row>

                <Field label="Nom du produit *">
                  <input value={form.name} onChange={e => setField('name', e.target.value)}
                    placeholder="ex : Mitigeur lavabo chromé" style={inputStyle} />
                </Field>

                <Field label="Fournisseur *">
                  <input value={form.supplier} onChange={e => setField('supplier', e.target.value)}
                    placeholder="ex : Ideal Standard" style={inputStyle} />
                </Field>

                <Row>
                  <Field label="Unité de vente">
                    <input value={form.unitLabel} onChange={e => setField('unitLabel', e.target.value)}
                      style={inputStyle} />
                  </Field>
                  <Field label="Conditionnement">
                    <input value={form.packageLabel} onChange={e => setField('packageLabel', e.target.value)}
                      style={inputStyle} />
                  </Field>
                </Row>

                {/* linear_m specific */}
                {productType === 'linear_m' && (
                  <Field label="Longueur par barre/pièce (m) *">
                    <input type="number" min="0.01" step="0.01" value={form.pieceLengthM}
                      onChange={e => setField('pieceLengthM', e.target.value)}
                      placeholder="ex : 2.5" style={inputStyle} />
                  </Field>
                )}

                {/* liter specific */}
                {productType === 'liter' && (
                  <Field label="Volume par contenant (L) *">
                    <input type="number" min="0.1" step="0.1" value={form.containerVolumeL}
                      onChange={e => setField('containerVolumeL', e.target.value)}
                      placeholder="ex : 5" style={inputStyle} />
                  </Field>
                )}

                {/* bag specific */}
                {productType === 'bag' && (
                  <Field label="Poids par sac (kg)">
                    <input type="number" min="0.1" step="0.1" value={form.bagWeightKg}
                      onChange={e => setField('bagWeightKg', e.target.value)}
                      placeholder="ex : 25" style={inputStyle} />
                  </Field>
                )}

                {/* Pricing */}
                <Row>
                  {profile.role === 'owner' && (
                    <Field label={`Prix d'achat / ${form.unitLabel} *`}>
                      <input type="number" min="0" value={form.purchasePrice}
                        onChange={e => setField('purchasePrice', e.target.value)}
                        placeholder="ex : 5000" style={inputStyle} />
                    </Field>
                  )}
                  <Field label={`Prix plancher / ${form.unitLabel} *`}>
                    <input type="number" min="0" value={form.floorPricePerUnit}
                      onChange={e => setField('floorPricePerUnit', e.target.value)}
                      placeholder="ex : 8000" style={inputStyle} />
                  </Field>
                  <Field label={`Prix référence / ${form.unitLabel} *`}>
                    <input type="number" min="0" value={form.referencePricePerUnit}
                      onChange={e => setField('referencePricePerUnit', e.target.value)}
                      placeholder="ex : 12000" style={inputStyle} />
                  </Field>
                </Row>

                {/* Packaging */}
                <Row>
                  <Field label={`${form.packageLabel}s par lot (optionnel)`}>
                    <input type="number" min="1" value={form.piecesPerPackage}
                      onChange={e => setField('piecesPerPackage', e.target.value)}
                      placeholder="ex : 12" style={inputStyle} />
                  </Field>
                  <Field label="Stock initial (optionnel)">
                    <input type="number" min="0" value={form.initialQuantity}
                      onChange={e => setField('initialQuantity', e.target.value)}
                      placeholder={`Nb de ${form.unitLabel}s`} style={inputStyle} />
                  </Field>
                </Row>
              </>
            )}

            <FormFooter
              error={error} success={success} loading={loading}
              onConfirm={handleCreate}
              onCancel={() => setShowCreate(false)}
              confirmLabel="Créer le produit"
            />
          </div>
        </Modal>
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
                  <select value={form.category} onChange={e => setField('category', e.target.value)} style={inputStyle}>
                    {CATEGORIES_BY_TYPE[pt].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
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

function ProductCard({ p, profile, toggleLoadingId, onEdit, onToggle }: {
  p:               any
  profile:         any
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

  return (
    <div style={{
      background: C.surface, borderRadius: 12,
      border: `1px solid ${C.border}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      padding: '20px 22px',
      opacity: p.is_active ? 1 : 0.6,
      borderLeft: `4px solid ${stockColor}`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 2, fontFamily: FONT }}>
            {p.name}
          </div>
          <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>
            {p.reference_code} · {p.category}
            {pt !== 'tile' && (
              <span style={{ marginLeft: 6, padding: '2px 7px', borderRadius: 100,
                background: C.bg, border: `1px solid ${C.border}`, fontSize: 10, fontWeight: 600 }}>
                {TYPE_LABELS[pt]}
              </span>
            )}
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
      {pt === 'tile' && <TileInfoGrid p={p} />}
      {pt !== 'tile' && <NonTileInfoGrid p={p} />}

      {/* Stock */}
      <StockBlock
        pt={pt} p={p} available={available} reserved={reserved}
        isCritical={isCritical} isLow={isLow}
      />

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onEdit(p)}
          style={{ flex: 1, padding: '8px', background: C.blueL, color: C.blue,
            border: `1px solid transparent`, borderRadius: 7,
            fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
          Modifier
        </button>
        <button
          onClick={() => onToggle(p)}
          disabled={toggleLoadingId === p.id}
          style={{ flex: 1, padding: '8px',
            background: p.is_active ? C.redL   : C.greenL,
            color:      p.is_active ? C.red    : C.green,
            border: 'none', borderRadius: 7,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontFamily: FONT }}>
          {toggleLoadingId === p.id
            ? <><span className="spinner-blue" />…</>
            : p.is_active ? 'Désactiver' : 'Réactiver'}
        </button>
      </div>
    </div>
  )
}

// ── Tile info grid (original layout — unchanged) ──────────────────────────────

function TileInfoGrid({ p }: { p: any }) {
  const fmtCFA = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))
  const tileArea = parseFloat(p.tile_area_m2) || 0
  const tpc      = parseInt(p.tiles_per_carton) || 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 12 }}>
      {([
        ['Format',         `${p.width_cm}×${p.height_cm} cm`],
        ['Surface/car.',   fmtM2(tileArea)],
        ['Car./carton',    String(tpc)],
        ['Prix plancher',  fmtCFA(p.floor_price_per_m2) + '/m²'],
        ['Prix référence', fmtCFA(p.reference_price_per_m2) + '/m²'],
        ['Fournisseur',    p.supplier],
      ] as [string, string][]).map(([lbl, val]) => (
        <InfoCell key={lbl} label={lbl} value={val} />
      ))}
    </div>
  )
}

// ── Non-tile info grid ────────────────────────────────────────────────────────

function NonTileInfoGrid({ p }: { p: any }) {
  const fmtCFA  = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))
  const pt: ProductType = p.product_type
  const unit    = p.unit_label ?? 'unité'

  const rows: [string, string][] = [
    ['Prix plancher',  fmtCFA(p.floor_price_per_unit)     + ' / ' + unit],
    ['Prix référence', fmtCFA(p.reference_price_per_unit) + ' / ' + unit],
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
