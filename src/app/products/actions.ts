'use server'

import { createClient }                      from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath }                    from 'next/cache'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function createProduct(payload: {
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
}) {
  const supabase      = await createClient()
  const adminSupabase = getAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()

  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return { error: 'Accès refusé.' }
  }

  if (payload.floorPricePerM2 >= payload.referencePricePerM2) {
    return { error: 'Le prix plancher doit être strictement inférieur au prix de référence.' }
  }

  // Only the owner may set a meaningful purchase price — enforce server-side
  const safePurchasePrice = profile.role === 'owner'
    ? (isNaN(payload.purchasePrice) ? 0 : payload.purchasePrice)
    : 0

  // Check reference code uniqueness
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('reference_code', payload.referenceCode.trim().toUpperCase())
    .maybeSingle()

  if (existing) return { error: 'Ce code référence existe déjà.' }

  // Create product
  const { data: product, error: prodError } = await supabase
    .from('products')
    .insert({
      reference_code:         payload.referenceCode.trim().toUpperCase(),
      name:                   payload.name.trim(),
      category:               payload.category.trim(),
      supplier:               payload.supplier.trim(),
      width_cm:               payload.widthCm,
      height_cm:              payload.heightCm,
      tiles_per_carton:       payload.tilesPerCarton,
      purchase_price:         safePurchasePrice,
      floor_price_per_m2:     payload.floorPricePerM2,
      reference_price_per_m2: payload.referencePricePerM2,
      is_active:              true,
    })
    .select('id, name')
    .single()

  if (prodError || !product) return { error: prodError?.message }

  // Set initial stock if provided
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
      }, { onConflict: 'product_id' })

    if (stockError) return { error: stockError.message }
  }

  await supabase.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'PRODUCT_CREATED',
    entity_type:        'products',
    entity_id:          product.id,
    data_after: {
      name:          payload.name,
      referenceCode: payload.referenceCode,
      initialTiles:  initTiles,
    },
  })

  revalidatePath('/products')
  revalidatePath('/sales/new')
  return { success: true, productId: product.id }
}

export async function updateProduct(payload: {
  productId:           string
  name:                string
  category:            string
  supplier:            string
  purchasePrice:       number
  floorPricePerM2:     number
  referencePricePerM2: number
  isActive:            boolean
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()

  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return { error: 'Accès refusé.' }
  }

  if (payload.floorPricePerM2 >= payload.referencePricePerM2) {
    return { error: 'Le prix plancher doit être strictement inférieur au prix de référence.' }
  }

  const safePurchasePrice = profile.role === 'owner'
    ? (isNaN(payload.purchasePrice) ? 0 : payload.purchasePrice)
    : undefined  // admin: do not overwrite the existing purchase_price

  const { error } = await supabase
    .from('products')
    .update({
      name:                   payload.name.trim(),
      category:               payload.category.trim(),
      supplier:               payload.supplier.trim(),
      ...(safePurchasePrice !== undefined ? { purchase_price: safePurchasePrice } : {}),
      floor_price_per_m2:     payload.floorPricePerM2,
      reference_price_per_m2: payload.referencePricePerM2,
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
    data_after:         payload,
  })

  revalidatePath('/products')
  revalidatePath('/sales/new')
  return { success: true }
}
