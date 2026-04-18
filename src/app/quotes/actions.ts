'use server'

import { createClient }    from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

interface QuoteItem {
  product_id:                string
  quantity_tiles:            number
  unit_price_per_m2:         number
  total_price:               number
  floor_price_snapshot:      number
  reference_price_snapshot:  number
  purchase_price_snapshot:   number
  tile_area_m2_snapshot:     number | null
  tiles_per_carton_snapshot: number | null
}

interface CreateQuotePayload {
  boutique_id:    string
  vendor_id:      string
  customer_name:  string | null
  customer_phone: string | null
  customer_cni:   string | null
  total_amount:   number
  notes:          string | null
  items:          QuoteItem[]
}

export async function createQuote(payload: CreateQuotePayload) {
  const supabase = await createClient()

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
  const serverItems: QuoteItem[] = []

  for (const item of payload.items) {
    const dbProd = dbProdMap.get(item.product_id)
    if (!dbProd) return { error: 'Produit introuvable.' }

    if (!Number.isFinite(item.quantity_tiles) || item.quantity_tiles <= 0) {
      return { error: 'Les quantités doivent être des nombres positifs.' }
    }
    if (!Number.isFinite(item.unit_price_per_m2) || item.unit_price_per_m2 < 0) {
      return { error: 'Le prix unitaire doit être un nombre positif.' }
    }

    const isTile       = (dbProd.product_type ?? 'tile') === 'tile'
    const dbFloorPrice = isTile
      ? parseFloat(String(dbProd.floor_price_per_m2 ?? 0))
      : parseFloat(String(dbProd.floor_price_per_unit ?? 0))
    const dbRefPrice = isTile
      ? parseFloat(String(dbProd.reference_price_per_m2 ?? 0))
      : parseFloat(String(dbProd.reference_price_per_unit ?? 0))

    if (dbFloorPrice > 0 && item.unit_price_per_m2 < dbFloorPrice) {
      return { error: 'Prix inférieur au plancher détecté. Devis refusé.' }
    }

    let itemTotal: number
    let tileAreaM2: number | null = null
    let tpc: number | null = null

    if (isTile) {
      tileAreaM2 = parseFloat(String(dbProd.tile_area_m2))
      tpc        = parseInt(String(dbProd.tiles_per_carton))
      itemTotal  = Math.round(item.unit_price_per_m2 * item.quantity_tiles * tileAreaM2)
    } else {
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

  // Insert with status='draft' — BEFORE INSERT trigger assigns DEV number automatically
  const { data: quote, error: quoteError } = await supabase
    .from('sales')
    .insert({
      boutique_id:    payload.boutique_id,
      vendor_id:      user.id,
      customer_name:  payload.customer_name,
      customer_phone: payload.customer_phone,
      customer_cni:   payload.customer_cni,
      total_amount:   serverTotal,
      amount_paid:    0,
      payment_status: 'unpaid',
      notes:          payload.notes,
      status:         'draft',
      sale_number:    '',
      company_id:     callerProfile.company_id,
    })
    .select('id, quote_number')
    .single()

  if (quoteError || !quote) {
    return { error: quoteError?.message ?? 'Erreur lors de la création du devis.' }
  }

  const { error: itemsError } = await supabase
    .from('sale_items')
    .insert(serverItems.map(item => ({ ...item, sale_id: quote.id, company_id: callerProfile.company_id })))

  if (itemsError) {
    await supabase.from('sales').delete().eq('id', quote.id)
    return { error: itemsError.message }
  }

  await getAdminClient().from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: callerProfile.role,
    action_type:        'QUOTE_CREATED',
    entity_type:        'sales',
    entity_id:          quote.id,
    company_id:         callerProfile.company_id,
    data_after: {
      quote_number: quote.quote_number,
      total_amount: serverTotal,
      item_count:   payload.items.length,
    },
  })

  revalidatePath('/quotes')

  return { success: true, quoteNumber: quote.quote_number, quoteId: quote.id, serverTotal }
}

export async function convertQuote(
  quoteId:        string,
  amountPaid:     number,
  notes:          string | null,
  customerPhone:  string | null = null,
  customerCni:    string | null = null,
  customerPhone2: string | null = null,
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: 'Profil introuvable.' }
  if (!['vendor', 'admin', 'owner'].includes(profile.role)) return { error: 'Accès refusé.' }

  const adminSupabase  = getAdminClient()
  const isAdminOrOwner = ['owner', 'admin'].includes(profile.role)

  // Load the quote with its items
  const { data: quote } = await supabase
    .from('sales')
    .select('id, vendor_id, status, total_amount, boutique_id, sale_items(product_id, quantity_tiles)')
    .eq('id', quoteId)
    .eq('status', 'draft')
    .single()

  if (!quote) return { error: 'Devis introuvable ou déjà converti.' }
  if (!isAdminOrOwner && quote.vendor_id !== user.id) return { error: 'Accès refusé.' }

  const saleItems = quote.sale_items as { product_id: string; quantity_tiles: number }[]

  // Re-validate that all products are still active (they may have been deactivated
  // between quote creation and conversion).
  const productIds = saleItems.map(i => i.product_id)
  const { data: activeProducts } = await supabase
    .from('products')
    .select('id')
    .in('id', productIds)
    .eq('is_active', true)

  if (!activeProducts || activeProducts.length < productIds.length) {
    return { error: 'Un ou plusieurs produits du devis ont été désactivés. Veuillez créer un nouveau devis.' }
  }

  // Check stock availability before committing
  const { data: stocks } = await supabase
    .from('stock')
    .select('product_id, total_qty, reserved_qty')
    .in('product_id', productIds)

  if (!stocks || stocks.length < productIds.length) {
    return { error: 'Stock introuvable pour un ou plusieurs produits.' }
  }

  const stockMap = new Map(stocks.map(s => [s.product_id, s]))
  for (const item of saleItems) {
    const stock = stockMap.get(item.product_id)
    if (!stock) return { error: 'Stock introuvable pour un produit.' }
    const available = stock.total_qty - stock.reserved_qty
    if (available < item.quantity_tiles) {
      return { error: `Stock insuffisant pour la conversion. Disponible : ${available} unité(s).` }
    }
  }

  // Patch phone / CNI / phone2 if they were missing at quote creation
  {
    const patch: Record<string, string> = {}
    if (customerPhone)  patch.customer_phone  = customerPhone
    if (customerCni)    patch.customer_cni    = customerCni
    if (customerPhone2) patch.customer_phone2 = customerPhone2
    if (Object.keys(patch).length > 0) {
      await adminSupabase.from('sales').update(patch).eq('id', quoteId)
    }
  }

  // Atomically generate VNT number and set status=confirmed
  const { data: saleNumber, error: rpcError } = await adminSupabase
    .rpc('confirm_quote', { p_sale_id: quoteId })

  if (rpcError || !saleNumber) {
    return { error: rpcError?.message ?? 'Erreur lors de la confirmation du devis.' }
  }

  // Atomically reserve stock for all sale items in a single DB round-trip.
  // reserve_sale_items() locks rows in product_id order (no deadlocks), checks
  // all availabilities, then applies all increments — or returns FALSE with
  // zero partial state if any product is insufficient.
  const { data: reserved, error: reserveError } = await adminSupabase
    .rpc('reserve_sale_items', { p_sale_id: quoteId })

  if (reserveError || reserved === false) {
    await adminSupabase.from('sales').update({ status: 'draft', sale_number: '' }).eq('id', quoteId)
    return { error: 'Stock insuffisant (vente simultanée détectée). Veuillez réessayer.' }
  }

  // Create the warehouse order
  const { error: orderError } = await supabase
    .from('orders')
    .insert({
      sale_id:      quoteId,
      order_number: '',
      status:       'confirmed',
      company_id:   profile.company_id,
    })

  if (orderError) {
    for (const item of saleItems) {
      await adminSupabase.rpc('release_stock_on_cancel', { p_product_id: item.product_id, p_quantity: item.quantity_tiles })
    }
    await adminSupabase.from('sales').update({ status: 'draft', sale_number: '' }).eq('id', quoteId)
    return { error: orderError.message }
  }

  // Record initial payment.
  // Uses admin client — sale_payments_insert RLS only covers owner/admin;
  // server action already authenticates the caller.
  const paidAmount = Math.max(0, amountPaid ?? 0)
  if (paidAmount > 0) {
    const totalAmount    = Number(quote.total_amount)
    const paymentStatus  = paidAmount >= totalAmount ? 'paid' : 'partial'

    await adminSupabase.from('sales')
      .update({ amount_paid: paidAmount, payment_status: paymentStatus })
      .eq('id', quoteId)

    const { data: initPayment } = await adminSupabase
      .from('sale_payments')
      .insert({
        sale_id:    quoteId,
        amount:     paidAmount,
        notes:      notes ?? 'Paiement à la confirmation du devis',
        created_by: user.id,
        company_id: profile.company_id,
      })
      .select('id')
      .single()

    await adminSupabase.from('audit_logs').insert({
      user_id:            user.id,
      user_role_snapshot: profile.role,
      action_type:        'PAYMENT_RECORDED',
      entity_type:        'sales',
      entity_id:          quoteId,
      company_id:         profile.company_id,
      data_after:         { amount: paidAmount, payment_id: initPayment?.id },
    })
  }

  await adminSupabase.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'QUOTE_CONVERTED',
    entity_type:        'sales',
    entity_id:          quoteId,
    company_id:         profile.company_id,
    data_after:         { sale_number: saleNumber, converted_from_quote: true },
  })

  revalidatePath('/quotes')
  revalidatePath('/sales')
  revalidatePath('/warehouse')
  revalidatePath('/dashboard')

  return { success: true, saleNumber: saleNumber as string }
}

export async function cancelQuote(quoteId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: 'Profil introuvable.' }

  const adminSupabase  = getAdminClient()
  const isAdminOrOwner = ['owner', 'admin'].includes(profile.role)

  const { data: updatedQuotes, error } = isAdminOrOwner
    ? await adminSupabase
        .from('sales')
        .update({ status: 'cancelled' })
        .eq('id', quoteId)
        .eq('company_id', profile.company_id)
        .eq('status', 'draft')
        .select('id, quote_number')
    : await adminSupabase
        .from('sales')
        .update({ status: 'cancelled' })
        .eq('id', quoteId)
        .eq('vendor_id', user.id)
        .eq('company_id', profile.company_id)
        .eq('status', 'draft')
        .select('id, quote_number')

  if (error) return { error: error.message }
  if (!updatedQuotes || updatedQuotes.length === 0) {
    return { error: 'Devis introuvable ou déjà annulé.' }
  }

  await adminSupabase.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'QUOTE_CANCELLED',
    entity_type:        'sales',
    entity_id:          quoteId,
    company_id:         profile.company_id,
    data_after:         { quote_number: updatedQuotes[0]?.quote_number },
  })

  revalidatePath('/quotes')
  return { success: true }
}
