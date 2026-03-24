'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter }    from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createProduct, updateProduct } from './actions'
import PageLayout       from '@/components/PageLayout'
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
const fmtM2 = (n: number) =>
  new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 4, maximumFractionDigits: 4,
  }).format(n) + ' m²'

const CATEGORIES = [
  'Carreaux Sol', 'Carreaux Mur', 'Carreaux Extérieur',
  'Mosaïque', 'Plinthes', 'Accessoires',
]

function generateRefCode(name: string, category: string, w: string, h: string): string {
  const catAbbr = category.split(' ').map(word => word[0].toUpperCase()).join('')
  const cleanName = name.trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9\s]/g, '')
  const words = cleanName.split(/\s+/).filter(Boolean)
  const namePart = words.slice(0, 2).map(wd => wd.slice(0, 3)).join('')
  const dims = w && h ? `-${w}X${h}` : ''
  return namePart ? `${catAbbr}-${namePart}${dims}` : ''
}

const emptyForm = () => ({
  referenceCode:       '',
  name:                '',
  category:            'Carreaux Sol',
  supplier:            '',
  widthCm:             '',
  heightCm:            '',
  tilesPerCarton:      '',
  purchasePrice:       '',
  floorPricePerM2:     '',
  referencePricePerM2: '',
  initialCartons:      '',
  initialLooseTiles:   '',
})

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
  const [form,              setForm]              = useState(emptyForm())
  const [loading,           setLoading]           = useState(false)
  const [toggleLoadingId,   setToggleLoadingId]   = useState<string | null>(null)
  const [error,             setError]             = useState<string | null>(null)
  const [success,           setSuccess]           = useState<string | null>(null)
  const [filterActive,      setFilterActive]      = useState<'all' | 'active' | 'inactive'>('active')
  const [search,            setSearch]            = useState('')
  const refCodeTouched = useRef(false)

  // Auto-generate reference code when creating a new product
  useEffect(() => {
    if (!showCreate || refCodeTouched.current) return
    const gen = generateRefCode(form.name, form.category, form.widthCm, form.heightCm)
    if (gen) setField('referenceCode', gen)
  }, [form.name, form.category, form.widthCm, form.heightCm, showCreate])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const setField = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  // Computed tile area preview
  const tileAreaPreview = (() => {
    const w = parseFloat(form.widthCm)
    const h = parseFloat(form.heightCm)
    if (!w || !h) return null
    const area = (w / 100) * (h / 100)
    const tpc  = parseInt(form.tilesPerCarton) || 0
    return { area, cartonArea: area * tpc }
  })()

  // ── Create ────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const required = [
      form.referenceCode, form.name, form.supplier,
      form.widthCm, form.heightCm, form.tilesPerCarton,
      form.purchasePrice, form.floorPricePerM2, form.referencePricePerM2,
    ]
    if (required.some(v => !v)) {
      setError('Veuillez remplir tous les champs obligatoires.')
      return
    }
    if (parseFloat(form.floorPricePerM2) >= parseFloat(form.referencePricePerM2)) {
      setError('Le prix plancher doit être inférieur au prix de référence.')
      return
    }
    setLoading(true)
    setError(null)

    const result = await createProduct({
      referenceCode:       form.referenceCode,
      name:                form.name,
      category:            form.category,
      supplier:            form.supplier,
      widthCm:             parseFloat(form.widthCm),
      heightCm:            parseFloat(form.heightCm),
      tilesPerCarton:      parseInt(form.tilesPerCarton),
      purchasePrice:       parseFloat(form.purchasePrice),
      floorPricePerM2:     parseFloat(form.floorPricePerM2),
      referencePricePerM2: parseFloat(form.referencePricePerM2),
      initialCartons:      parseInt(form.initialCartons)    || 0,
      initialLooseTiles:   parseInt(form.initialLooseTiles) || 0,
    })

    setLoading(false)
    if (result.error) { setError(result.error); return }

    setSuccess('Produit créé avec succès.')
    setForm(emptyForm())
    setTimeout(() => {
      setSuccess(null)
      setShowCreate(false)
      router.refresh()
    }, 1800)
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  const openEdit = (p: any) => {
    setEditProduct(p)
    setForm({
      ...emptyForm(),
      name:                p.name,
      category:            p.category,
      supplier:            p.supplier,
      purchasePrice:       String(p.purchase_price),
      floorPricePerM2:     String(p.floor_price_per_m2),
      referencePricePerM2: String(p.reference_price_per_m2),
    })
    setError(null)
    setSuccess(null)
  }

  const handleUpdate = async () => {
    if (!editProduct) return
    if (parseFloat(form.floorPricePerM2) >= parseFloat(form.referencePricePerM2)) {
      setError('Le prix plancher doit être inférieur au prix de référence.')
      return
    }
    setLoading(true)
    setError(null)

    const result = await updateProduct({
      productId:           editProduct.id,
      name:                form.name,
      category:            form.category,
      supplier:            form.supplier,
      purchasePrice:       parseFloat(form.purchasePrice),
      floorPricePerM2:     parseFloat(form.floorPricePerM2),
      referencePricePerM2: parseFloat(form.referencePricePerM2),
      isActive:            editProduct.is_active,
    })

    setLoading(false)
    if (result.error) { setError(result.error); return }

    setSuccess('Produit mis à jour.')
    setTimeout(() => {
      setSuccess(null)
      setEditProduct(null)
      router.refresh()
    }, 1500)
  }

  const handleToggleActive = async (p: any) => {
    setToggleLoadingId(p.id)
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
    setToggleLoadingId(null)
    router.refresh()
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = products.filter(p => {
    if (filterActive === 'active'   && !p.is_active) return false
    if (filterActive === 'inactive' && p.is_active)  return false
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
            onClick={() => { setForm(emptyForm()); setError(null); setSuccess(null); refCodeTouched.current = false; setShowCreate(true) }}
            style={{ padding: '11px 20px', background: C.navy,
              color: C.surface, border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: FONT }}>
            + Nouveau produit
          </button>
        </div>

        {/* Filter bar — white panel */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap',
          background: C.surface, padding: '12px 16px', borderRadius: 12,
          border: `1px solid ${C.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou référence…"
            style={{ ...inputStyle, width: 280, padding: '8px 12px', fontSize: 13 }} />
          <select value={filterActive}
            onChange={e => setFilterActive(e.target.value as any)}
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
            {filtered.map((p: any) => {
              const stock      = Array.isArray(p.stock) ? p.stock[0] : p.stock
              const total      = parseInt(stock?.total_tiles    ?? '0')
              const reserved   = parseInt(stock?.reserved_tiles ?? '0')
              const available  = total - reserved
              const tileArea   = parseFloat(p.tile_area_m2)
              const availM2    = available * tileArea
              const tpc        = parseInt(p.tiles_per_carton)
              const availCartons = Math.floor(available / tpc)
              const isCritical   = availCartons < 20
              const isLow        = availCartons < 50
              const stockColor = !p.is_active ? C.muted : isCritical ? C.red : isLow ? C.orange : C.green

              return (
                <div key={p.id} style={{
                  background: C.surface, borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  padding: '20px 22px',
                  opacity: p.is_active ? 1 : 0.6,
                  borderLeft: `4px solid ${stockColor}`,
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    marginBottom: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700,
                        color: C.ink, marginBottom: 2, fontFamily: FONT }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>
                        {p.reference_code} · {p.category}
                      </div>
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center',
                      gap: 5, fontSize: 11, fontWeight: 600,
                      padding: '3px 10px', height: 'fit-content',
                      borderRadius: 100, flexShrink: 0, marginLeft: 8,
                      background: p.is_active ? C.greenL : C.redL,
                      color:      p.is_active ? C.green  : C.red,
                      fontFamily: FONT }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%',
                        background: p.is_active ? C.green : C.red, flexShrink: 0 }} />
                      {p.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>

                  {/* Info grid */}
                  <div style={{ display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 6, marginBottom: 12 }}>
                    {([
                      ['Format',          `${p.width_cm}×${p.height_cm} cm`],
                      ['Surface/car.',    fmtM2(tileArea)],
                      ['Car./carton',     String(tpc)],
                      ['Prix plancher',   fmtCFA(p.floor_price_per_m2) + '/m²'],
                      ['Prix référence',  fmtCFA(p.reference_price_per_m2) + '/m²'],
                      ['Fournisseur',     p.supplier],
                    ] as [string, string][]).map(([lbl, val]) => (
                      <div key={lbl} style={{ padding: '7px 8px',
                        background: C.bg, borderRadius: 6 }}>
                        <div style={{ fontSize: 9, fontWeight: 600,
                          color: C.muted, textTransform: 'uppercase',
                          letterSpacing: '0.05em', fontFamily: FONT }}>
                          {lbl}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600,
                          color: C.ink, marginTop: 2, fontFamily: FONT }}>
                          {val}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Stock summary */}
                  <div style={{
                    padding: '10px 12px',
                    background: isCritical ? C.redL : isLow ? C.orangeL : C.greenL,
                    borderRadius: 8, marginBottom: 12,
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600,
                        color: C.muted, textTransform: 'uppercase', fontFamily: FONT }}>
                        Stock disponible
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 900,
                        color: isCritical ? C.red : isLow ? C.orange : C.green,
                        fontFamily: FONT }}>
                        {new Intl.NumberFormat('fr-FR', {
                          minimumFractionDigits: 2, maximumFractionDigits: 2,
                        }).format(availM2)} m²
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>
                        {fmtNum(available)} carreaux ·{' '}
                        {Math.floor(available / tpc)} cartons
                        {available % tpc > 0 ? ` + ${available % tpc}` : ''}
                      </div>
                    </div>
                    {reserved > 0 && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: C.muted, fontFamily: FONT }}>Réservé</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.orange, fontFamily: FONT }}>
                          {fmtNum(reserved)} car.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => openEdit(p)}
                      style={{ flex: 1, padding: '8px',
                        background: C.blueL, color: C.blue,
                        border: 'none', borderRadius: 7,
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        fontFamily: FONT }}>
                      Modifier
                    </button>
                    <button
                      onClick={() => p.is_active
                        ? setConfirmDeactivate(p)
                        : handleToggleActive(p)
                      }
                      disabled={toggleLoadingId === p.id}
                      style={{ flex: 1, padding: '8px',
                        background: p.is_active ? C.redL   : C.greenL,
                        color:      p.is_active ? C.red    : C.green,
                        border: 'none', borderRadius: 7,
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        opacity: toggleLoadingId === p.id ? 0.6 : 1,
                        fontFamily: FONT }}>
                      {toggleLoadingId === p.id ? '…' : p.is_active ? 'Désactiver' : 'Réactiver'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      {/* ── Deactivate confirmation ── */}
      {confirmDeactivate && (
        <Modal
          title="Désactiver ce produit ?"
          onClose={() => setConfirmDeactivate(null)}
        >
          <div style={{ padding: '4px 0 8px' }}>
            <p style={{ fontSize: 14, color: '#475569', margin: '0 0 12px', lineHeight: 1.6, fontFamily: FONT }}>
              Le produit <strong style={{ color: '#0F172A' }}>{confirmDeactivate.name}</strong> sera
              immédiatement retiré du formulaire de vente. Les ventes existantes ne sont pas affectées.
            </p>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: 0, fontFamily: FONT }}>
              Vous pourrez le réactiver à tout moment depuis cette page.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <button
              onClick={() => setConfirmDeactivate(null)}
              style={{
                padding: '9px 18px', borderRadius: 8, border: '1.5px solid #E2E8F0',
                background: 'white', color: '#475569', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: FONT,
              }}>
              Annuler
            </button>
            <button
              onClick={async () => {
                const p = confirmDeactivate
                await handleToggleActive(p)
                setConfirmDeactivate(null)
              }}
              disabled={toggleLoadingId === confirmDeactivate?.id}
              style={{
                padding: '9px 18px', borderRadius: 8, border: 'none',
                background: toggleLoadingId === confirmDeactivate?.id ? '#94A3B8' : '#DC2626',
                color: 'white', fontSize: 13, fontWeight: 600,
                cursor: toggleLoadingId === confirmDeactivate?.id ? 'not-allowed' : 'pointer',
                fontFamily: FONT,
              }}>
              {toggleLoadingId === confirmDeactivate?.id ? 'Désactivation…' : 'Désactiver'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Create modal ── */}
      {showCreate && (
        <Modal title="Nouveau produit" onClose={() => setShowCreate(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <Row>
              <Field label="Code référence *">
                <input value={form.referenceCode}
                  readOnly
                  placeholder="Généré automatiquement"
                  style={{ ...inputStyle, background: '#F1F5F9', cursor: 'default', color: C.slate }} />
              </Field>
              <Field label="Catégorie *">
                <select value={form.category}
                  onChange={e => setField('category', e.target.value)}
                  style={inputStyle}>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </Row>

            <Field label="Nom du produit *">
              <input value={form.name}
                onChange={e => setField('name', e.target.value)}
                placeholder="ex : Granit Noir 60×60"
                style={inputStyle} />
            </Field>

            <Field label="Fournisseur *">
              <input value={form.supplier}
                onChange={e => setField('supplier', e.target.value)}
                placeholder="ex : Ceramiche Italia"
                style={inputStyle} />
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
              <Field label="Prix d'achat (FCFA) *">
                <input type="number" min="0" value={form.purchasePrice}
                  onChange={e => setField('purchasePrice', e.target.value)}
                  placeholder="ex : 8000" style={inputStyle} />
              </Field>
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
      {editProduct && (
        <Modal
          title={`Modifier — ${editProduct.reference_code}`}
          onClose={() => setEditProduct(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <Field label="Nom du produit *">
              <input value={form.name}
                onChange={e => setField('name', e.target.value)}
                style={inputStyle} />
            </Field>

            <Row>
              <Field label="Catégorie">
                <select value={form.category}
                  onChange={e => setField('category', e.target.value)}
                  style={inputStyle}>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Fournisseur">
                <input value={form.supplier}
                  onChange={e => setField('supplier', e.target.value)}
                  style={inputStyle} />
              </Field>
            </Row>

            <Row>
              <Field label="Prix d'achat (FCFA)">
                <input type="number" min="0" value={form.purchasePrice}
                  onChange={e => setField('purchasePrice', e.target.value)}
                  style={inputStyle} />
              </Field>
              <Field label="Prix plancher/m²">
                <input type="number" min="0" value={form.floorPricePerM2}
                  onChange={e => setField('floorPricePerM2', e.target.value)}
                  style={inputStyle} />
              </Field>
              <Field label="Prix référence/m²">
                <input type="number" min="0" value={form.referencePricePerM2}
                  onChange={e => setField('referencePricePerM2', e.target.value)}
                  style={inputStyle} />
              </Field>
            </Row>

            <div style={{ padding: '10px 12px', background: C.bg,
              borderRadius: 8, fontSize: 12, color: C.muted, fontFamily: FONT }}>
              Format {editProduct.width_cm}×{editProduct.height_cm} cm ·{' '}
              {editProduct.tiles_per_carton} car./carton ·{' '}
              {fmtM2(parseFloat(editProduct.tile_area_m2))}/carreau
              <br />
              <span style={{ fontSize: 11 }}>
                Les dimensions et le format ne peuvent pas être modifiés après création.
              </span>
            </div>

            <FormFooter
              error={error} success={success} loading={loading}
              onConfirm={handleUpdate}
              onCancel={() => setEditProduct(null)}
              confirmLabel="Enregistrer"
            />
          </div>
        </Modal>
      )}
    </PageLayout>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
      <div style={{ background: '#FFFFFF', borderRadius: 16,
        width: '100%', maxWidth: 560, maxHeight: '92vh',
        boxShadow: '0 32px 80px -16px rgba(0,0,0,0.28), 0 0 0 1px rgba(15,23,42,0.06)',
        animation: 'modalPanel 0.22s cubic-bezier(0.16,1,0.3,1)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 24px 16px',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 16, flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0F172A',
            letterSpacing: '-0.02em', fontFamily: FONT }}>
            {title}
          </h3>
          <button onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: 8,
              background: '#F8FAFC', border: '1px solid #E2E8F0',
              cursor: 'pointer', flexShrink: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
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

function Field({ label, children }: {
  label:    string
  children: React.ReactNode
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={{ fontSize: 11.5, fontWeight: 600,
        color: '#475569', display: 'block', marginBottom: 6, fontFamily: FONT,
        textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {children}
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
  const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif"
  return (
    <>
      {error && (
        <div style={{ padding: '10px 12px', background: '#FEF2F2',
          borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#DC2626',
          fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="6" stroke="#DC2626" strokeWidth="1.3"/>
            <path d="M7 4v3.5" stroke="#DC2626" strokeWidth="1.4" strokeLinecap="round"/>
            <circle cx="7" cy="10" r="0.7" fill="#DC2626"/>
          </svg>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '10px 12px', background: '#ECFDF5',
          borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#059669',
          fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="6" stroke="#059669" strokeWidth="1.3"/>
            <path d="M4 7l2.5 2.5L10 5" stroke="#059669" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {success}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={onConfirm} disabled={loading}
          style={{ flex: 1, padding: '12px',
            background: loading ? '#94A3B8' : '#1B3A6B',
            color: 'white', border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: FONT }}>
          {loading ? 'Enregistrement…' : confirmLabel}
        </button>
        <button onClick={onCancel}
          style={{ padding: '12px 16px', background: 'white',
            color: '#94A3B8', border: '1.5px solid #E2E8F0',
            borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: FONT }}>
          Annuler
        </button>
      </div>
    </>
  )
}
