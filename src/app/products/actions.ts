'use server'

import { createClient }                      from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath }                    from 'next/cache'
import type { ProductType }                  from '@/lib/types'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth helper
// ─────────────────────────────────────────────────────────────────────────────

async function getAuthorizedProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null }

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  return { supabase, user, profile }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create product
// ─────────────────────────────────────────────────────────────────────────────

export type CreateProductPayload =
  | CreateTilePayload
  | CreateUnitPayload
  | CreateLinearPayload
  | CreateBagPayload
  | CreateLiterPayload

/** Payload for product_type = 'tile' — logique existante inchangée */
export interface CreateTilePayload {
  productType:         'tile'
  referenceCode:       string
  name:                string
  category:            string
  supplier:            string
  widthCm:             number
  heightCm:            number
  tilesPerCarton:      number
  purchasePrice:       number
  floorPricePerM2:     number
  referencePricePerM2: number
  initialCartons:      number
  initialLooseTiles:   number
}

/** Payload for product_type = 'unit' */
export interface CreateUnitPayload {
  productType:          'unit'
  referenceCode:        string
  name:                 string
  category:             string
  supplier:             string
  unitLabel:            string   // ex: 'pièce', 'kit', 'set'
  packageLabel:         string   // ex: 'boîte', 'lot', 'palette'
  piecesPerPackage:     number | null
  purchasePrice:        number
  floorPricePerUnit:    number
  referencePricePerUnit: number
  initialQuantity:      number
}

/** Payload for product_type = 'linear_m' */
export interface CreateLinearPayload {
  productType:           'linear_m'
  referenceCode:         string
  name:                  string
  category:              string
  supplier:              string
  unitLabel:             string   // ex: 'm'
  packageLabel:          string   // ex: 'barre', 'rouleau'
  pieceLengthM:          number   // longueur d'une barre en mètres
  piecesPerPackage:      number | null
  purchasePrice:         number
  floorPricePerUnit:     number   // prix par mètre linéaire
  referencePricePerUnit: number
  initialQuantity:       number   // nombre de barres/pièces
}

/** Payload for product_type = 'bag' */
export interface CreateBagPayload {
  productType:           'bag'
  referenceCode:         string
  name:                  string
  category:              string
  supplier:              string
  unitLabel:             string   // ex: 'sac', 'poche'
  packageLabel:          string   // ex: 'palette'
  bagWeightKg:           number | null
  piecesPerPackage:      number | null
  purchasePrice:         number
  floorPricePerUnit:     number   // prix par sac
  referencePricePerUnit: number
  initialQuantity:       number   // nombre de sacs
}

/** Payload for product_type = 'liter' */
export interface CreateLiterPayload {
  productType:           'liter'
  referenceCode:         string
  name:                  string
  category:              string
  supplier:              string
  unitLabel:             string   // ex: 'L', 'mL'
  packageLabel:          string   // ex: 'bidon', 'pot', 'seau'
  containerVolumeL:      number   // volume d'un contenant en litres
  piecesPerPackage:      number | null
  purchasePrice:         number
  floorPricePerUnit:     number   // prix par litre
  referencePricePerUnit: number
  initialQuantity:       number   // nombre de contenants
}

export async function createProduct(payload: CreateProductPayload) {
  const adminSupabase               = getAdminClient()
  const { supabase, user, profile } = await getAuthorizedProfile()

  if (!user || !profile) return { error: 'Non authentifié.' }
  if (!['owner', 'admin'].includes(profile.role)) return { error: 'Accès refusé.' }

  // ── Reference code uniqueness ──────────────────────────────────────────────
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('reference_code', payload.referenceCode.trim().toUpperCase())
    .maybeSingle()

  if (existing) return { error: 'Ce code référence existe déjà.' }

  // ── Tile product — logique originale inchangée ─────────────────────────────
  if (payload.productType === 'tile') {
    if (payload.floorPricePerM2 >= payload.referencePricePerM2)
      return { error: 'Le prix plancher doit être strictement inférieur au prix de référence.' }

    const safePurchasePrice = profile.role === 'owner'
      ? (isNaN(payload.purchasePrice) ? 0 : payload.purchasePrice)
      : 0

    const { data: product, error: prodError } = await supabase
      .from('products')
      .insert({
        reference_code:         payload.referenceCode.trim().toUpperCase(),
        name:                   payload.name.trim(),
        category:               payload.category.trim(),
        supplier:               payload.supplier.trim(),
        product_type:           'tile',
        unit_label:             'm²',
        package_label:          'carton',
        width_cm:               payload.widthCm,
        height_cm:              payload.heightCm,
        tiles_per_carton:       payload.tilesPerCarton,
        purchase_price:         safePurchasePrice,
        floor_price_per_m2:     payload.floorPricePerM2,
        reference_price_per_m2: payload.referencePricePerM2,
        is_active:              true,
        company_id:             profile.company_id,
      })
      .select('id, name')
      .single()

    if (prodError || !product) return { error: prodError?.message }

    const initTiles =
      payload.initialCartons * payload.tilesPerCarton +
      payload.initialLooseTiles

    if (initTiles > 0) {
      const { error: stockError } = await adminSupabase
        .from('stock')
        .upsert({
          product_id:      product.id,
          total_tiles:     initTiles,
          last_updated_at: new Date().toISOString(),
          last_updated_by: user.id,
          company_id:      profile.company_id,
        }, { onConflict: 'product_id' })

      if (stockError) return { error: stockError.message }
    }

    await supabase.from('audit_logs').insert({
      user_id:            user.id,
      user_role_snapshot: profile.role,
      action_type:        'PRODUCT_CREATED',
      entity_type:        'products',
      entity_id:          product.id,
      company_id:         profile.company_id,
      data_after: {
        name:          payload.name,
        referenceCode: payload.referenceCode,
        productType:   'tile',
        initialTiles:  initTiles,
      },
    })

    revalidatePath('/products')
    revalidatePath('/sales/new')
    return { success: true, productId: product.id }
  }

  // ── Non-tile products ──────────────────────────────────────────────────────

  const p = payload as CreateUnitPayload | CreateLinearPayload | CreateBagPayload | CreateLiterPayload

  if (p.floorPricePerUnit >= p.referencePricePerUnit)
    return { error: 'Le prix plancher doit être strictement inférieur au prix de référence.' }

  // Additional validation by type
  if (payload.productType === 'linear_m' && !(payload as CreateLinearPayload).pieceLengthM)
    return { error: 'La longueur par barre/pièce est obligatoire.' }

  if (payload.productType === 'liter' && !(payload as CreateLiterPayload).containerVolumeL)
    return { error: 'Le volume par contenant est obligatoire.' }

  const safePurchasePrice = profile.role === 'owner'
    ? (isNaN(p.purchasePrice) ? 0 : p.purchasePrice)
    : 0

  const insertData: Record<string, unknown> = {
    reference_code:          payload.referenceCode.trim().toUpperCase(),
    name:                    p.name.trim(),
    category:                p.category.trim(),
    supplier:                p.supplier.trim(),
    product_type:            payload.productType,
    unit_label:              p.unitLabel,
    package_label:           p.packageLabel,
    purchase_price:          safePurchasePrice,
    floor_price_per_unit:    p.floorPricePerUnit,
    reference_price_per_unit: p.referencePricePerUnit,
    pieces_per_package:      p.piecesPerPackage ?? null,
    is_active:               true,
    company_id:              profile.company_id,
  }

  if (payload.productType === 'linear_m')
    insertData.piece_length_m = (payload as CreateLinearPayload).pieceLengthM

  if (payload.productType === 'liter')
    insertData.container_volume_l = (payload as CreateLiterPayload).containerVolumeL

  if (payload.productType === 'bag')
    insertData.bag_weight_kg = (payload as CreateBagPayload).bagWeightKg ?? null

  const { data: product, error: prodError } = await supabase
    .from('products')
    .insert(insertData)
    .select('id, name')
    .single()

  if (prodError || !product) return { error: prodError?.message }

  // Initial stock — stored in total_tiles as a generic quantity counter
  if (p.initialQuantity > 0) {
    const { error: stockError } = await adminSupabase
      .from('stock')
      .upsert({
        product_id:      product.id,
        total_tiles:     p.initialQuantity,
        last_updated_at: new Date().toISOString(),
        last_updated_by: user.id,
        company_id:      profile.company_id,
      }, { onConflict: 'product_id' })

    if (stockError) return { error: stockError.message }
  }

  await supabase.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'PRODUCT_CREATED',
    entity_type:        'products',
    entity_id:          product.id,
    company_id:         profile.company_id,
    data_after: {
      name:            p.name,
      referenceCode:   payload.referenceCode,
      productType:     payload.productType,
      initialQuantity: p.initialQuantity,
    },
  })

  revalidatePath('/products')
  revalidatePath('/sales/new')
  return { success: true, productId: product.id }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update product
// ─────────────────────────────────────────────────────────────────────────────

export async function updateProduct(payload: {
  productId:    string
  name:         string
  category:     string
  supplier:     string
  purchasePrice: number
  // Tile pricing (used when product_type = 'tile')
  floorPricePerM2?:     number
  referencePricePerM2?: number
  // Generic pricing (used for non-tile types)
  floorPricePerUnit?:     number
  referencePricePerUnit?: number
  isActive: boolean
}) {
  const { supabase, user, profile } = await getAuthorizedProfile()

  if (!user || !profile) return { error: 'Non authentifié.' }
  if (!['owner', 'admin'].includes(profile.role)) return { error: 'Accès refusé.' }

  // Fetch current product type (never trust client for this)
  const { data: current } = await supabase
    .from('products')
    .select('product_type, purchase_price')
    .eq('id', payload.productId)
    .single()

  if (!current) return { error: 'Produit introuvable.' }

  const productType = current.product_type as ProductType

  // ── Tile — logique originale inchangée ────────────────────────────────────
  if (productType === 'tile') {
    const fp = payload.floorPricePerM2     ?? 0
    const rp = payload.referencePricePerM2 ?? 0
    if (fp >= rp)
      return { error: 'Le prix plancher doit être strictement inférieur au prix de référence.' }

    const safePurchasePrice = profile.role === 'owner'
      ? (isNaN(payload.purchasePrice) ? 0 : payload.purchasePrice)
      : undefined

    const { error } = await supabase
      .from('products')
      .update({
        name:                   payload.name.trim(),
        category:               payload.category.trim(),
        supplier:               payload.supplier.trim(),
        ...(safePurchasePrice !== undefined ? { purchase_price: safePurchasePrice } : {}),
        floor_price_per_m2:     fp,
        reference_price_per_m2: rp,
        is_active:              payload.isActive,
      })
      .eq('id', payload.productId)

    if (error) return { error: error.message }

    await supabase.from('audit_logs').insert({
      user_id:            user.id,
      user_role_snapshot: profile.role,
      action_type:        'PRODUCT_UPDATED',
      entity_type:        'products',
      entity_id:          payload.productId,
      company_id:         profile.company_id,
      data_after:         { ...payload, productType: 'tile' },
    })

    revalidatePath('/products')
    revalidatePath('/sales/new')
    return { success: true }
  }

  // ── Non-tile types ─────────────────────────────────────────────────────────
  const fp = payload.floorPricePerUnit     ?? 0
  const rp = payload.referencePricePerUnit ?? 0
  if (fp >= rp)
    return { error: 'Le prix plancher doit être strictement inférieur au prix de référence.' }

  const safePurchasePrice = profile.role === 'owner'
    ? (isNaN(payload.purchasePrice) ? 0 : payload.purchasePrice)
    : undefined

  const { error } = await supabase
    .from('products')
    .update({
      name:                    payload.name.trim(),
      category:                payload.category.trim(),
      supplier:                payload.supplier.trim(),
      ...(safePurchasePrice !== undefined ? { purchase_price: safePurchasePrice } : {}),
      floor_price_per_unit:    fp,
      reference_price_per_unit: rp,
      is_active:               payload.isActive,
    })
    .eq('id', payload.productId)

  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'PRODUCT_UPDATED',
    entity_type:        'products',
    entity_id:          payload.productId,
    company_id:         profile.company_id,
    data_after:         { ...payload, productType },
  })

  revalidatePath('/products')
  revalidatePath('/sales/new')
  return { success: true }
}
