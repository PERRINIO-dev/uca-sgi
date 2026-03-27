'use server'

import { createClient }                      from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath }                    from 'next/cache'
import { sendPushToRoles, sendPushToUser }   from '@/lib/push/send'
import { LOW_STOCK_CARTONS }                 from '@/lib/constants'

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  confirmed: ['preparing'],
  preparing: ['ready'],
  ready:     ['delivered'],
}

export async function updateOrderStatus(
  orderId:   string,
  newStatus: 'preparing' | 'ready' | 'delivered',
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  // Verify the caller has warehouse access
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['warehouse', 'admin', 'owner'].includes(profile.role)) {
    return { error: 'Accès refusé.' }
  }

  // Fetch order to validate current status
  const { data: order } = await supabase
    .from('orders')
    .select('id, sale_id, status')
    .eq('id', orderId)
    .single()

  if (!order) return { error: 'Commande introuvable.' }

  // Validate transition is legal
  if (!VALID_TRANSITIONS[order.status]?.includes(newStatus)) {
    return { error: `Transition de statut invalide : ${order.status} → ${newStatus}` }
  }

  const updateData: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'preparing') {
    updateData.preparation_started_at = new Date().toISOString()
    updateData.assigned_to            = user.id
  }
  if (newStatus === 'ready') {
    updateData.preparation_confirmed_at = new Date().toISOString()
  }
  if (newStatus === 'delivered') {
    updateData.delivery_confirmed_by = user.id
    updateData.delivery_confirmed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)

  if (error) return { error: error.message }

  // Mirror status to sale — use admin client to bypass RLS since warehouse
  // workers don't have UPDATE permission on sales in most RLS setups.
  await getAdmin()
    .from('sales')
    .update({ status: newStatus })
    .eq('id', order.sale_id)

  const actionMap = {
    preparing: 'ORDER_PREPARING',
    ready:     'ORDER_READY',
    delivered: 'ORDER_DELIVERED',
  } as const

  await supabase.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        actionMap[newStatus],
    entity_type:        'orders',
    entity_id:          orderId,
  })

  revalidatePath('/warehouse')
  revalidatePath('/dashboard')
  if (newStatus === 'delivered') {
    revalidatePath('/products')
    revalidatePath('/reports')
    revalidatePath('/sales')
  }

  // On delivery: decrement stock (tiles physically left the warehouse)
  if (newStatus === 'delivered') {
    const admin = getAdmin()

    const { data: items } = await admin
      .from('sale_items')
      .select('product_id, quantity_tiles, products(name)')
      .eq('sale_id', order.sale_id)

    if (items?.length) {
      const productIds = items.map((i: any) => i.product_id)

      // Aggregate quantities per product (a sale can theoretically have two
      // line-items for the same product, so we sum before decrementing)
      const qtyMap = new Map<string, number>()
      for (const item of items as any[]) {
        qtyMap.set(item.product_id,
          (qtyMap.get(item.product_id) ?? 0) + item.quantity_tiles
        )
      }

      // Atomic decrement via RPC — single UPDATE per product, no read-then-write race.
      // Requires the `decrement_stock_on_delivery` function from
      // supabase/migrations/20260326_decrement_stock_on_delivery.sql
      for (const [productId, qty] of qtyMap) {
        await admin.rpc('decrement_stock_on_delivery', {
          p_product_id: productId,
          p_quantity:   qty,
        })
      }

      // Check for low stock post-delivery
      const { data: postStocks } = await admin
        .from('stock_view')
        .select('product_id, product_name, available_full_cartons')
        .in('product_id', productIds)

      const lowStock = (postStocks ?? []).filter((s: any) => Number(s.available_full_cartons) < LOW_STOCK_CARTONS)
      if (lowStock.length > 0) {
        const names = lowStock.map((s: any) => s.product_name).join(', ')
        sendPushToRoles(admin, ['admin', 'owner'], {
          title: 'Stock bas',
          body:  `Stock bas (<${LOW_STOCK_CARTONS} cartons) après livraison : ${names}`,
          url:   '/products',
          tag:   'low-stock',
        }).catch(console.error)
      }
    }
  }

  return { success: true }
}

export async function submitStockRequest(payload: {
  productId:          string
  requestType:        'stock_in' | 'correction'
  quantityTilesDelta: number
  justification:      string
  stockBeforeTiles:   number
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  // Verify the caller has warehouse access
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['warehouse', 'admin', 'owner'].includes(profile.role)) {
    return { error: 'Accès refusé.' }
  }

  if (payload.quantityTilesDelta === 0) {
    return { error: 'La quantité doit être différente de zéro.' }
  }

  const { data, error } = await supabase
    .from('stock_requests')
    .insert({
      requested_by:         user.id,
      product_id:           payload.productId,
      request_type:         payload.requestType,
      quantity_tiles_delta: payload.quantityTilesDelta,
      justification:        payload.justification,
      stock_before_tiles:   payload.stockBeforeTiles,
      status:               'pending',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'STOCK_REQUEST_SUBMITTED',
    entity_type:        'stock_requests',
    entity_id:          data.id,
  })

  revalidatePath('/warehouse')
  revalidatePath('/dashboard')

  // Notify admin/owner about the pending approval
  const { data: product } = await supabase
    .from('products').select('name').eq('id', payload.productId).single()
  sendPushToRoles(getAdmin(), ['admin', 'owner'], {
    title: 'Demande de stock',
    body:  `Nouvelle demande pour ${product?.name ?? 'un produit'} — approbation requise`,
    url:   '/dashboard',
    tag:   `stock-request-${data.id}`,
  }).catch(console.error)

  return { success: true }
}
