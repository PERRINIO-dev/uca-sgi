'use server'

import { createClient }    from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sendPushToRoles } from '@/lib/push/send'

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
  boutique_id:      string
  vendor_id:        string
  customer_id:      string | null
  customer_name:    string | null
  customer_phone:   string | null
  customer_cni:     string | null
  total_amount:     number
  amount_paid:      number
  payment_method:   string
  notes:            string | null
  items:            SaleItem[]
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
  if (!['seller', 'manager', 'owner'].includes(callerProfile.role)) {
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

    if (!Number.isFinite(item.quantity_tiles) || item.quantity_tiles <= 0) {
      return { error: 'Les quantités doivent être des nombres positifs.' }
    }

    if (!Number.isFinite(item.unit_price_per_m2) || item.unit_price_per_m2 < 0) {
      return { error: 'Le prix unitaire doit être un nombre positif.' }
    }

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
    .select('product_id, total_qty, reserved_qty')
    .in('product_id', productIds)

  if (!stocks || stocks.length < productIds.length) {
    return { error: 'Stock introuvable pour un ou plusieurs produits.' }
  }

  const stockMap = new Map(stocks.map(s => [s.product_id, s]))
  for (const item of payload.items) {
    const stock = stockMap.get(item.product_id)
    if (!stock) return { error: 'Stock introuvable pour un produit.' }
    const available = stock.total_qty - stock.reserved_qty
    if (available < item.quantity_tiles) {
      return { error: `Stock insuffisant. Disponible : ${available} unité(s).` }
    }
  }

  // 3–5. Create sale, items, reserve stock, and create order — one DB transaction.
  // create_confirmed_sale() executes all four steps atomically: a crash at any
  // point leaves the DB unchanged (no orphaned sale, no partial reservation).
  // INSUFFICIENT_STOCK exception rolls back everything; the sale never exists.
  // Round to nearest integer — client totals may carry sub-unit float noise
  // (e.g., 60 ×35.28 m² = 2116.8 client-side vs Math.round = 2117 server-side).
  // Rounding here prevents a 0.2-unit delta from producing a false 'partial' status.
  const amountPaid   = Math.round(Math.max(0, payload.amount_paid ?? 0))
  const paymentStatus =
    amountPaid >= serverTotal ? 'paid' :
    amountPaid > 0            ? 'partial' : 'unpaid'

  const adminSupabase = getAdminClient()

  const { data: created, error: createError } = await adminSupabase
    .rpc('create_confirmed_sale', {
      p_boutique_id:    payload.boutique_id,
      p_vendor_id:      user.id,
      p_customer_id:    payload.customer_id ?? null,
      p_customer_name:  payload.customer_name,
      p_customer_phone: payload.customer_phone,
      p_customer_cni:   payload.customer_cni,
      p_total_amount:   serverTotal,
      p_amount_paid:    amountPaid,
      p_payment_status: paymentStatus,
      p_notes:          payload.notes,
      p_company_id:     callerProfile.company_id,
      p_items:          serverItems,
    })

  if (createError) {
    if (createError.message.includes('INSUFFICIENT_STOCK')) {
      return { error: 'Stock insuffisant (vente simultanée détectée). Veuillez vérifier le stock disponible et réessayer.' }
    }
    return { error: createError.message ?? 'Erreur lors de la création de la vente.' }
  }

  const sale = created as { sale_id: string; sale_number: string }

  // 5.5 Record initial payment in history (enables multi-tranche tracking).
  // Uses admin client — the authenticated sale_payments_insert RLS only covers
  // owner/admin; server actions already authenticate the caller, so bypassing
  // RLS here is safe and ensures vendor-created sales record the initial payment.
  if (amountPaid > 0) {
    const { data: initPayment } = await adminSupabase
      .from('sale_payments')
      .insert({ sale_id: sale.sale_id, amount: amountPaid, notes: 'Paiement initial', payment_method: payload.payment_method || 'especes', created_by: user.id, company_id: callerProfile.company_id })
      .select('id')
      .single()
    // Trigger sync_sale_payment_totals() fires automatically in DB

    await getAdminClient().from('audit_logs').insert({
      user_id:            user.id,
      user_role_snapshot: callerProfile.role,
      action_type:        'PAYMENT_RECORDED',
      entity_type:        'sales',
      entity_id:          sale.sale_id,
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
    entity_id:          sale.sale_id,
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
  sendPushToRoles(getAdminClient(), ['warehouse', 'manager', 'owner'], {
    title: 'Nouvelle commande',
    body:  `Vente ${sale.sale_number} — ${payload.items.length} article(s) à préparer`,
    url:   '/warehouse',
    tag:   `order-${sale.sale_id}`,
  }, callerProfile.company_id).catch(console.error)

  return { success: true, saleNumber: sale.sale_number, saleId: sale.sale_id, serverTotal }
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

  const isAdminOrOwner = ['owner', 'manager'].includes(profile.role)
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
        .select('id, sale_number, customer_name')
    : await adminSupabase
        .from('sales')
        .update({ status: 'cancelled' })
        .eq('id', saleId)
        .eq('vendor_id', user.id)
        .eq('company_id', profile.company_id)
        .in('status', ['draft', 'confirmed'])
        .select('id, sale_number, customer_name')

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

  // Release all reserved stock for this sale in one atomic DB operation.
  await adminSupabase.rpc('release_sale_items', { p_sale_id: saleId })

  const cancelledSale = updatedSales[0]
  await getAdminClient().from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'SALE_CANCELLED',
    entity_type:        'sales',
    entity_id:          saleId,
    company_id:         profile.company_id,
    data_after:         { sale_number: cancelledSale?.sale_number, customer_name: cancelledSale?.customer_name },
  })

  revalidatePath('/sales')
  revalidatePath('/warehouse')
  revalidatePath('/dashboard')
  revalidatePath('/products')
  revalidatePath('/reports')
  return { success: true }
}

export async function addPayment(
  saleId:          string,
  amount:          number,
  notes:           string | null,
  paymentMethod:   string = 'especes',
  scheduleItemId?: string | null,
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
  if (sale.status === 'draft')     return { error: 'Convertissez d\'abord le devis en vente confirmée avant d\'enregistrer un paiement.' }

  const isAdminOrOwner = ['owner', 'manager', 'cashier'].includes(profile.role)
  if (!isAdminOrOwner && sale.vendor_id !== user.id) return { error: 'Accès refusé.' }
  if (!amount || amount <= 0) return { error: 'Le montant doit être supérieur à 0.' }

  const remaining = Number(sale.total_amount) - Number(sale.amount_paid ?? 0)
  if (amount > remaining + 0.01) {
    return { error: `Montant dépasse le solde restant (${new Intl.NumberFormat('fr-FR').format(Math.round(remaining))}).` }
  }

  // Use admin client — sale_payments_insert RLS only covers owner/admin;
  // server action already authenticates and authorises the caller.
  const { data: newPayment, error: insertError } = await getAdminClient()
    .from('sale_payments')
    .insert({ sale_id: saleId, amount, notes, payment_method: paymentMethod || 'especes', created_by: user.id, company_id: profile.company_id })
    .select('id')
    .single()

  if (insertError) return { error: insertError.message }
  // DB trigger sync_sale_payment_totals() automatically updates sales.amount_paid + payment_status

  // Mark schedule item paid if one was linked
  if (scheduleItemId) {
    await getAdminClient()
      .from('sale_payment_schedules')
      .update({ is_paid: true, paid_at: new Date().toISOString() })
      .eq('id', scheduleItemId)
      .eq('company_id', profile.company_id)
  }

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
  revalidatePath('/dashboard')
  return { success: true }
}

// ── Schedule item CRUD (owner / admin only) ───────────────────────────────────

export async function createScheduleItem(payload: {
  saleId:   string
  dueDate:  string
  amount:   number
  label:    string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users').select('role, company_id').eq('id', user.id).single()
  if (!profile || !['owner', 'manager'].includes(profile.role))
    return { error: 'Accès refusé.' }

  if (!payload.dueDate)       return { error: 'Date d\'échéance requise.' }
  if (payload.amount <= 0)    return { error: 'Montant invalide.' }

  // Verify sale belongs to this company
  const { data: sale } = await supabase
    .from('sales').select('id, status').eq('id', payload.saleId).single()
  if (!sale) return { error: 'Vente introuvable.' }
  if (sale.status === 'cancelled') return { error: 'Vente annulée.' }

  const { error } = await getAdminClient()
    .from('sale_payment_schedules')
    .insert({
      company_id: profile.company_id,
      sale_id:    payload.saleId,
      due_date:   payload.dueDate,
      amount:     Math.round(payload.amount),
      label:      payload.label.trim() || null,
      created_by: user.id,
    })

  if (error) return { error: error.message }
  revalidatePath('/sales')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function deleteScheduleItem(itemId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users').select('role, company_id').eq('id', user.id).single()
  if (!profile || !['owner', 'manager'].includes(profile.role))
    return { error: 'Accès refusé.' }

  const { data: item } = await supabase
    .from('sale_payment_schedules')
    .select('id, is_paid, company_id')
    .eq('id', itemId)
    .single()

  if (!item || item.company_id !== profile.company_id) return { error: 'Échéance introuvable.' }
  if (item.is_paid) return { error: 'Impossible de supprimer une échéance déjà encaissée.' }

  const { error } = await supabase
    .from('sale_payment_schedules')
    .delete()
    .eq('id', itemId)

  if (error) return { error: error.message }
  revalidatePath('/sales')
  revalidatePath('/dashboard')
  return { success: true }
}
