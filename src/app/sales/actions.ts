'use server'

import { createClient }                      from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath }                    from 'next/cache'

// Admin client bypasses RLS — needed to update stock.reserved_tiles
function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

interface SaleItem {
  product_id:                string
  quantity_tiles:            number
  unit_price_per_m2:         number
  total_price:               number
  floor_price_snapshot:      number
  reference_price_snapshot:  number
  tile_area_m2_snapshot:     number
  tiles_per_carton_snapshot: number
}

interface CreateSalePayload {
  boutique_id:    string
  vendor_id:      string
  customer_name:  string | null
  customer_phone: string | null
  total_amount:   number
  notes:          string | null
  items:          SaleItem[]
}

export async function createSale(payload: CreateSalePayload) {
  const supabase = await createClient()

  // 0. Server-side authentication — never trust client-provided vendor_id
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  if (user.id !== payload.vendor_id) return { error: 'Accès refusé.' }

  const { data: callerProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!callerProfile) return { error: 'Profil introuvable.' }
  if (!['vendor', 'admin', 'owner'].includes(callerProfile.role)) {
    return { error: 'Accès refusé.' }
  }

  // 1. Validate floor prices against DB — never trust client-provided snapshots
  const productIds = payload.items.map(i => i.product_id)

  const { data: dbProducts } = await supabase
    .from('products')
    .select('id, floor_price_per_m2, reference_price_per_m2, tile_area_m2, tiles_per_carton')
    .in('id', productIds)
    .eq('is_active', true)

  if (!dbProducts || dbProducts.length < productIds.length) {
    return { error: 'Un ou plusieurs produits sont introuvables ou inactifs.' }
  }

  const dbProdMap = new Map(dbProducts.map(p => [p.id, p]))

  let serverTotal = 0
  const serverItems: (SaleItem & { sale_id?: string })[] = []

  for (const item of payload.items) {
    const dbProd = dbProdMap.get(item.product_id)
    if (!dbProd) return { error: 'Produit introuvable.' }

    const dbFloorPrice = parseFloat(String(dbProd.floor_price_per_m2))
    const tileAreaM2   = parseFloat(String(dbProd.tile_area_m2))
    const tpc          = parseInt(String(dbProd.tiles_per_carton))

    if (item.unit_price_per_m2 < dbFloorPrice) {
      await supabase.from('audit_logs').insert({
        user_id:            user.id,
        user_role_snapshot: callerProfile.role,
        action_type:        'FLOOR_PRICE_VIOLATION_ATTEMPT',
        entity_type:        'sale_items',
        entity_id:          item.product_id,
        data_after: {
          attempted_price: item.unit_price_per_m2,
          floor_price:     dbFloorPrice,
        },
      })
      return { error: 'Prix inférieur au plancher détecté. Vente refusée.' }
    }

    // Recalculate totals server-side using DB tile dimensions
    const quantityM2 = item.quantity_tiles * tileAreaM2
    const itemTotal  = Math.round(item.unit_price_per_m2 * quantityM2)
    serverTotal += itemTotal

    serverItems.push({
      ...item,
      floor_price_snapshot:      dbFloorPrice,
      reference_price_snapshot:  parseFloat(String(dbProd.reference_price_per_m2)),
      tile_area_m2_snapshot:     tileAreaM2,
      tiles_per_carton_snapshot: tpc,
      total_price:               itemTotal,
    })
  }

  // 2. Check stock availability — single batched query (no N+1)
  const { data: stocks } = await supabase
    .from('stock')
    .select('product_id, total_tiles, reserved_tiles')
    .in('product_id', productIds)

  if (!stocks || stocks.length < productIds.length) {
    return { error: 'Stock introuvable pour un ou plusieurs produits.' }
  }

  const stockMap = new Map(stocks.map(s => [s.product_id, s]))
  for (const item of payload.items) {
    const stock = stockMap.get(item.product_id)
    if (!stock) return { error: 'Stock introuvable pour un produit.' }
    const available = stock.total_tiles - stock.reserved_tiles
    if (available < item.quantity_tiles) {
      return { error: `Stock insuffisant. Disponible : ${available} carreaux.` }
    }
  }

  // 3. Create sale header (use server-verified user.id and server-calculated total)
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      boutique_id:    payload.boutique_id,
      vendor_id:      user.id,
      customer_name:  payload.customer_name,
      customer_phone: payload.customer_phone,
      total_amount:   serverTotal,
      notes:          payload.notes,
      status:         'confirmed',
      sale_number:    '',
    })
    .select('id, sale_number')
    .single()

  if (saleError || !sale) {
    return { error: saleError?.message ?? 'Erreur lors de la création de la vente.' }
  }

  // 4. Create sale items (using server-recalculated values)
  const { error: itemsError } = await supabase
    .from('sale_items')
    .insert(serverItems.map(item => ({ ...item, sale_id: sale.id })))

  if (itemsError) {
    await supabase.from('sales').delete().eq('id', sale.id)
    return { error: itemsError.message }
  }

  // 4.5 Reserve stock — re-read current values right before updating to minimise the
  // race window (full atomicity requires a SECURITY DEFINER RPC with SELECT FOR UPDATE;
  // see QA_REPORT.md BUG-04 for the recommended DB-level fix).
  const adminSupabase = getAdminClient()
  const reserveMap    = new Map<string, number>()
  for (const item of serverItems) {
    reserveMap.set(
      item.product_id,
      (reserveMap.get(item.product_id) ?? 0) + item.quantity_tiles
    )
  }

  for (const [productId, qty] of reserveMap) {
    // Fresh read to use the most current reserved_tiles value
    const { data: freshStock } = await adminSupabase
      .from('stock')
      .select('total_tiles, reserved_tiles')
      .eq('product_id', productId)
      .single()

    if (!freshStock) {
      await supabase.from('sale_items').delete().eq('sale_id', sale.id)
      await supabase.from('sales').delete().eq('id', sale.id)
      return { error: 'Erreur lecture du stock. Veuillez réessayer.' }
    }

    const available = freshStock.total_tiles - freshStock.reserved_tiles
    if (available < qty) {
      // Another concurrent sale consumed this stock — rollback
      await supabase.from('sale_items').delete().eq('sale_id', sale.id)
      await supabase.from('sales').delete().eq('id', sale.id)
      return {
        error: `Stock insuffisant (vente simultanée détectée). Disponible : ${available} carreaux. Veuillez réessayer.`,
      }
    }

    await adminSupabase
      .from('stock')
      .update({ reserved_tiles: freshStock.reserved_tiles + qty })
      .eq('product_id', productId)
  }

  // 5. Create the warehouse order
  const { error: orderError } = await supabase
    .from('orders')
    .insert({
      sale_id:      sale.id,
      order_number: '',
      status:       'confirmed',
    })

  if (orderError) {
    // Clean up orphaned sale and items to preserve data consistency
    // Also release the reservation we just made
    for (const [productId, qty] of reserveMap) {
      const current = stockMap.get(productId)?.reserved_tiles ?? 0
      await adminSupabase
        .from('stock')
        .update({ reserved_tiles: Math.max(0, current - qty) })
        .eq('product_id', productId)
    }
    await supabase.from('sale_items').delete().eq('sale_id', sale.id)
    await supabase.from('sales').delete().eq('id', sale.id)
    return { error: orderError.message }
  }

  // 6. Audit log
  await supabase.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: callerProfile.role,
    action_type:        'SALE_CREATED',
    entity_type:        'sales',
    entity_id:          sale.id,
    data_after: {
      sale_number:  sale.sale_number,
      total_amount: serverTotal,
      item_count:   payload.items.length,
    },
  })

  revalidatePath('/sales')
  revalidatePath('/dashboard')

  return { success: true, saleNumber: sale.sale_number, saleId: sale.id, serverTotal }
}

export async function cancelSale(saleId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: 'Profil introuvable.' }

  const isAdminOrOwner = ['owner', 'admin'].includes(profile.role)

  // Admins/owners can cancel any sale; vendors can only cancel their own
  const { data: updatedSales, error } = isAdminOrOwner
    ? await supabase
        .from('sales')
        .update({ status: 'cancelled' })
        .eq('id', saleId)
        .in('status', ['confirmed', 'draft'])
        .select('id')
    : await supabase
        .from('sales')
        .update({ status: 'cancelled' })
        .eq('id', saleId)
        .eq('vendor_id', user.id)
        .in('status', ['confirmed', 'draft'])
        .select('id')

  if (error) return { error: error.message }

  if (!updatedSales || updatedSales.length === 0) {
    return { error: 'Vente introuvable ou non annulable (statut incompatible).' }
  }

  // Cancel the associated warehouse order so it disappears from the queue
  // (orders table RLS blocks vendor writes — must use admin client)
  const adminSupabase = getAdminClient()
  const { error: orderCancelError } = await adminSupabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('sale_id', saleId)
    .in('status', ['confirmed', 'preparing', 'ready'])

  if (orderCancelError) {
    // Log only — do not block, the sale itself is already cancelled in DB
    console.error('[cancelSale] Échec annulation order:', orderCancelError)
  }

  // Release reserved stock for the cancelled sale items
  const { data: saleItems } = await supabase
    .from('sale_items')
    .select('product_id, quantity_tiles')
    .eq('sale_id', saleId)

  if (saleItems && saleItems.length > 0) {
    const itemProductIds  = [...new Set(saleItems.map(i => i.product_id))]
    const { data: currentStocks } = await adminSupabase
      .from('stock')
      .select('product_id, reserved_tiles')
      .in('product_id', itemProductIds)

    if (currentStocks) {
      const currentStockMap = new Map(currentStocks.map(s => [s.product_id, s]))
      const releaseMap = new Map<string, number>()
      for (const item of saleItems) {
        releaseMap.set(
          item.product_id,
          (releaseMap.get(item.product_id) ?? 0) + item.quantity_tiles
        )
      }
      for (const [productId, qty] of releaseMap) {
        const current = currentStockMap.get(productId)?.reserved_tiles ?? 0
        await adminSupabase
          .from('stock')
          .update({ reserved_tiles: Math.max(0, current - qty) })
          .eq('product_id', productId)
      }
    }
  }

  await supabase.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'SALE_CANCELLED',
    entity_type:        'sales',
    entity_id:          saleId,
  })

  revalidatePath('/sales')
  revalidatePath('/warehouse')
  revalidatePath('/dashboard')
  return { success: true }
}
