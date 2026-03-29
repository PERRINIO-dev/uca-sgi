'use server'

import { createClient }                      from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath }                    from 'next/cache'
import { sendPushToRoles }                   from '@/lib/push/send'

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
  quantity_tiles:            number   // tile count for tiles; unit count for others
  unit_price_per_m2:         number   // price/m² for tiles; price/unit for others
  total_price:               number
  floor_price_snapshot:      number
  reference_price_snapshot:  number
  purchase_price_snapshot:   number
  tile_area_m2_snapshot:     number | null
  tiles_per_carton_snapshot: number | null
}

interface CreateSalePayload {
  boutique_id:    string
  vendor_id:      string
  customer_name:  string | null
  customer_phone: string | null
  customer_cni:   string | null
  total_amount:   number
  amount_paid:    number
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
    .select('role, company_id')
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
    .select('id, product_type, floor_price_per_m2, reference_price_per_m2, floor_price_per_unit, reference_price_per_unit, purchase_price, tile_area_m2, tiles_per_carton')
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

    const isTile = (dbProd.product_type ?? 'tile') === 'tile'

    // Floor price validation — branch by product type
    const dbFloorPrice = isTile
      ? parseFloat(String(dbProd.floor_price_per_m2 ?? 0))
      : parseFloat(String(dbProd.floor_price_per_unit ?? 0))
    const dbRefPrice = isTile
      ? parseFloat(String(dbProd.reference_price_per_m2 ?? 0))
      : parseFloat(String(dbProd.reference_price_per_unit ?? 0))

    if (dbFloorPrice > 0 && item.unit_price_per_m2 < dbFloorPrice) {
      await getAdminClient().from('audit_logs').insert({
        user_id:            user.id,
        user_role_snapshot: callerProfile.role,
        action_type:        'FLOOR_PRICE_VIOLATION_ATTEMPT',
        entity_type:        'sale_items',
        entity_id:          item.product_id,
        company_id:         callerProfile.company_id,
        data_after: {
          attempted_price: item.unit_price_per_m2,
          floor_price:     dbFloorPrice,
          product_type:    dbProd.product_type,
        },
      })
      return { error: 'Prix inférieur au plancher détecté. Vente refusée.' }
    }

    // Recalculate totals server-side
    let itemTotal: number
    let tileAreaM2: number | null = null
    let tpc: number | null = null

    if (isTile) {
      tileAreaM2 = parseFloat(String(dbProd.tile_area_m2))
      tpc        = parseInt(String(dbProd.tiles_per_carton))
      const quantityM2 = item.quantity_tiles * tileAreaM2
      itemTotal = Math.round(item.unit_price_per_m2 * quantityM2)
    } else {
      // Non-tile: total = quantity × unit_price (unit_price_per_m2 stores price/unit)
      itemTotal = Math.round(item.unit_price_per_m2 * item.quantity_tiles)
    }
    serverTotal += itemTotal

    serverItems.push({
      ...item,
      floor_price_snapshot:      dbFloorPrice,
      reference_price_snapshot:  dbRefPrice,
      purchase_price_snapshot:   parseFloat(String(dbProd.purchase_price ?? 0)) || 0,
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
      return { error: `Stock insuffisant. Disponible : ${available} unité(s).` }
    }
  }

  // 3. Create sale header (use server-verified user.id and server-calculated total)
  const amountPaid   = Math.max(0, payload.amount_paid ?? 0)
  const paymentStatus =
    amountPaid >= serverTotal ? 'paid' :
    amountPaid > 0            ? 'partial' : 'unpaid'

  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      boutique_id:    payload.boutique_id,
      vendor_id:      user.id,
      customer_name:  payload.customer_name,
      customer_phone: payload.customer_phone,
      customer_cni:   payload.customer_cni,
      total_amount:   serverTotal,
      amount_paid:    amountPaid,
      payment_status: paymentStatus,
      notes:          payload.notes,
      status:         'confirmed',
      sale_number:    '',
      company_id:     callerProfile.company_id,
    })
    .select('id, sale_number')
    .single()

  if (saleError || !sale) {
    return { error: saleError?.message ?? 'Erreur lors de la création de la vente.' }
  }

  // 4. Create sale items (using server-recalculated values)
  const { error: itemsError } = await supabase
    .from('sale_items')
    .insert(serverItems.map(item => ({ ...item, sale_id: sale.id, company_id: callerProfile.company_id })))

  if (itemsError) {
    await supabase.from('sales').delete().eq('id', sale.id)
    return { error: itemsError.message }
  }

  // 4.5 Reserve stock atomically — uses a SECURITY DEFINER RPC with SELECT FOR UPDATE
  // so two concurrent sales for the same product cannot both succeed past the
  // availability check (each holds a row-level lock for the duration of the call).
  const adminSupabase = getAdminClient()
  const reserveMap    = new Map<string, number>()
  for (const item of serverItems) {
    reserveMap.set(
      item.product_id,
      (reserveMap.get(item.product_id) ?? 0) + item.quantity_tiles
    )
  }

  for (const [productId, qty] of reserveMap) {
    const { data: reserved, error: rpcError } = await adminSupabase
      .rpc('reserve_stock_on_sale', { p_product_id: productId, p_quantity: qty })

    if (rpcError || reserved === false) {
      // Rollback: remove items and sale already inserted above
      await supabase.from('sale_items').delete().eq('sale_id', sale.id)
      await supabase.from('sales').delete().eq('id', sale.id)
      if (rpcError) return { error: 'Erreur lors de la réservation du stock. Veuillez réessayer.' }
      return {
        error: 'Stock insuffisant (vente simultanée détectée). Veuillez vérifier le stock disponible et réessayer.',
      }
    }
  }

  // 5. Create the warehouse order
  // company_id is inherited automatically by the set_order_number() trigger,
  // but we pass it explicitly here for defense-in-depth.
  const { error: orderError } = await supabase
    .from('orders')
    .insert({
      sale_id:      sale.id,
      order_number: '',
      status:       'confirmed',
      company_id:   callerProfile.company_id,
    })

  if (orderError) {
    // Clean up orphaned sale and items to preserve data consistency
    // Release the reservations we just made using the atomic RPC
    for (const [productId, qty] of reserveMap) {
      await adminSupabase.rpc('release_stock_on_cancel', {
        p_product_id: productId,
        p_quantity:   qty,
      })
    }
    await supabase.from('sale_items').delete().eq('sale_id', sale.id)
    await supabase.from('sales').delete().eq('id', sale.id)
    return { error: orderError.message }
  }

  // 5.5 Record initial payment in history (enables multi-tranche tracking)
  if (amountPaid > 0) {
    const { data: initPayment } = await supabase
      .from('sale_payments')
      .insert({ sale_id: sale.id, amount: amountPaid, notes: 'Paiement initial', created_by: user.id, company_id: callerProfile.company_id })
      .select('id')
      .single()
    // Trigger sync_sale_payment_totals() fires automatically in DB

    await getAdminClient().from('audit_logs').insert({
      user_id:            user.id,
      user_role_snapshot: callerProfile.role,
      action_type:        'PAYMENT_RECORDED',
      entity_type:        'sales',
      entity_id:          sale.id,
      company_id:         callerProfile.company_id,
      data_after:         { amount: amountPaid, notes: 'Paiement initial', payment_id: initPayment?.id },
    })
  }

  // 6. Audit log
  await getAdminClient().from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: callerProfile.role,
    action_type:        'SALE_CREATED',
    entity_type:        'sales',
    entity_id:          sale.id,
    company_id:         callerProfile.company_id,
    data_after: {
      sale_number:  sale.sale_number,
      total_amount: serverTotal,
      item_count:   payload.items.length,
    },
  })

  revalidatePath('/sales')
  revalidatePath('/dashboard')

  // Fire-and-forget push to warehouse/admin/owner about the new order
  sendPushToRoles(getAdminClient(), ['warehouse', 'admin', 'owner'], {
    title: 'Nouvelle commande',
    body:  `Vente ${sale.sale_number} — ${payload.items.length} article(s) à préparer`,
    url:   '/warehouse',
    tag:   `order-${sale.id}`,
  }, callerProfile.company_id).catch(console.error)

  return { success: true, saleNumber: sale.sale_number, saleId: sale.id, serverTotal }
}

export async function cancelSale(saleId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: 'Profil introuvable.' }

  const isAdminOrOwner = ['owner', 'admin'].includes(profile.role)
  const adminSupabase  = getAdminClient()

  // Use admin client to bypass RLS — authorization is enforced by server-side
  // role check and vendor_id comparison above, not by RLS alone.
  // company_id filter is added for defense-in-depth even though the admin client
  // bypasses RLS: prevents a compromised saleId from cancelling another tenant's sale.
  // Admins/owners: cancel any non-final status (including preparing/ready)
  // Vendors: only cancel their own sales when still confirmed/draft
  const { data: updatedSales, error } = isAdminOrOwner
    ? await adminSupabase
        .from('sales')
        .update({ status: 'cancelled' })
        .eq('id', saleId)
        .eq('company_id', profile.company_id)
        .in('status', ['draft', 'confirmed', 'preparing', 'ready'])
        .select('id')
    : await adminSupabase
        .from('sales')
        .update({ status: 'cancelled' })
        .eq('id', saleId)
        .eq('vendor_id', user.id)
        .eq('company_id', profile.company_id)
        .in('status', ['draft', 'confirmed'])
        .select('id')

  if (error) return { error: error.message }

  if (!updatedSales || updatedSales.length === 0) {
    return { error: 'Vente introuvable ou non annulable (statut incompatible).' }
  }

  // Cancel the associated warehouse order so it disappears from the queue
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
    // Aggregate quantities per product then atomically release reserved_tiles
    // via RPC — eliminates the read-then-write race condition.
    const releaseMap = new Map<string, number>()
    for (const item of saleItems) {
      releaseMap.set(
        item.product_id,
        (releaseMap.get(item.product_id) ?? 0) + item.quantity_tiles
      )
    }
    for (const [productId, qty] of releaseMap) {
      await adminSupabase.rpc('release_stock_on_cancel', {
        p_product_id: productId,
        p_quantity:   qty,
      })
    }
  }

  await getAdminClient().from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'SALE_CANCELLED',
    entity_type:        'sales',
    entity_id:          saleId,
    company_id:         profile.company_id,
  })

  revalidatePath('/sales')
  revalidatePath('/warehouse')
  revalidatePath('/dashboard')
  revalidatePath('/products')
  revalidatePath('/reports')
  return { success: true }
}

export async function addPayment(
  saleId:  string,
  amount:  number,
  notes:   string | null,
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users').select('role, company_id').eq('id', user.id).single()
  if (!profile) return { error: 'Profil introuvable.' }

  const { data: sale } = await supabase
    .from('sales').select('id, vendor_id, status, total_amount, amount_paid').eq('id', saleId).single()
  if (!sale) return { error: 'Vente introuvable.' }
  if (sale.status === 'cancelled') return { error: 'Impossible d\'ajouter un paiement à une vente annulée.' }

  const isAdminOrOwner = ['owner', 'admin'].includes(profile.role)
  if (!isAdminOrOwner && sale.vendor_id !== user.id) return { error: 'Accès refusé.' }
  if (!amount || amount <= 0) return { error: 'Le montant doit être supérieur à 0.' }

  const remaining = Number(sale.total_amount) - Number(sale.amount_paid ?? 0)
  if (amount > remaining + 0.01) {
    return { error: `Montant dépasse le solde restant (${new Intl.NumberFormat('fr-FR').format(Math.round(remaining))} FCFA).` }
  }

  const { data: newPayment, error: insertError } = await supabase
    .from('sale_payments')
    .insert({ sale_id: saleId, amount, notes, created_by: user.id, company_id: profile.company_id })
    .select('id')
    .single()

  if (insertError) return { error: insertError.message }
  // DB trigger sync_sale_payment_totals() automatically updates sales.amount_paid + payment_status

  // Use admin client + actual payment UUID as entity_id to satisfy any FK trigger on audit_logs
  await getAdminClient().from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'PAYMENT_RECORDED',
    entity_type:        'sales',
    entity_id:          saleId,
    company_id:         profile.company_id,
    data_after:         { amount, notes, payment_id: newPayment?.id },
  })

  revalidatePath('/sales')
  revalidatePath('/reports')
  return { success: true }
}
