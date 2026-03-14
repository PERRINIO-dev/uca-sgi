'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

  // Mirror status to sale for all transitions.
  // For 'delivered', the DB trigger deduct_stock_on_delivery also fires —
  // this explicit update is a safe redundancy that guarantees the sale
  // status reaches 'delivered' even if the trigger only handles stock deduction.
  await supabase
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
  return { success: true }
}
