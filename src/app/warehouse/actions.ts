'use server'

import { createClient }    from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sendPushToRoles, sendPushToUser } from '@/lib/push/send'
import { LOW_STOCK_CARTONS, LOW_STOCK_UNITS } from '@/lib/constants'

// Local alias — warehouse actions use getAdmin() name internally
const getAdmin = getAdminClient

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
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['warehouse', 'admin', 'owner'].includes(profile.role)) {
    return { error: 'Accès refusé.' }
  }

  // Fetch order to validate current status
  const { data: order } = await supabase
    .from('orders')
    .select('id, sale_id, status, order_number')
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

  await getAdmin().from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        actionMap[newStatus],
    entity_type:        'orders',
    entity_id:          orderId,
    company_id:         profile.company_id,
    data_after:         { order_number: order.order_number, previous_status: order.status, new_status: newStatus },
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

      // Check for low stock post-delivery (admin client — must filter company explicitly)
      const [{ data: postStocks }, { data: productTypes }] = await Promise.all([
        admin
          .from('stock_view')
          .select('product_id, product_name, available_full_cartons, available_tiles')
          .in('product_id', productIds)
          .eq('company_id', profile.company_id),
        admin
          .from('products')
          .select('id, product_type')
          .in('id', productIds),
      ])

      const typeMap = new Map((productTypes ?? []).map((p: any) => [p.id, p.product_type]))
      const lowStock = (postStocks ?? []).filter((s: any) => {
        const type = typeMap.get(s.product_id) ?? 'tile'
        return type === 'tile'
          ? Number(s.available_full_cartons) < LOW_STOCK_CARTONS
          : Number(s.available_tiles)        < LOW_STOCK_UNITS
      })
      if (lowStock.length > 0) {
        const names = lowStock.map((s: any) => s.product_name).join(', ')
        sendPushToRoles(admin, ['admin', 'owner'], {
          title: 'Stock bas',
          body:  `Stock bas après livraison : ${names}`,
          url:   '/products',
          tag:   'low-stock',
        }, profile.company_id).catch(console.error)
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
    .select('role, company_id')
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
      company_id:           profile.company_id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  const { data: product } = await supabase
    .from('products').select('name').eq('id', payload.productId).single()

  await getAdmin().from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'STOCK_REQUEST_SUBMITTED',
    entity_type:        'stock_requests',
    entity_id:          data.id,
    company_id:         profile.company_id,
    data_after: {
      product_name:       product?.name ?? '',
      request_type:       payload.requestType,
      quantity_delta:     payload.quantityTilesDelta,
      justification:      payload.justification,
    },
  })

  revalidatePath('/warehouse')
  revalidatePath('/dashboard')
  sendPushToRoles(getAdmin(), ['admin', 'owner'], {
    title: 'Demande de stock',
    body:  `Nouvelle demande pour ${product?.name ?? 'un produit'} — approbation requise`,
    url:   '/dashboard',
    tag:   `stock-request-${data.id}`,
  }, profile.company_id).catch(console.error)

  return { success: true }
}
