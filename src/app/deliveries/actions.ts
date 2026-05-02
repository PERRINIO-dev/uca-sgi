'use server'

import { createClient }    from '@/lib/supabase/server'
import { getAdminClient }  from '@/lib/supabase/admin'
import { revalidatePath }  from 'next/cache'

export async function confirmDelivery(orderId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['delivery', 'warehouse', 'manager', 'owner'].includes(profile.role)) {
    return { error: 'Accès refusé.' }
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id, sale_id, status, order_number, assigned_delivery_id')
    .eq('id', orderId)
    .single()

  if (!order) return { error: 'Commande introuvable.' }
  if (order.status !== 'ready') return { error: 'Cette commande n\'est pas encore prête à livrer.' }

  // Delivery role can only confirm their own assigned orders
  if (profile.role === 'delivery' && order.assigned_delivery_id !== user.id) {
    return { error: 'Accès refusé : cette livraison ne vous est pas assignée.' }
  }

  const admin = getAdminClient()

  const { error } = await supabase
    .from('orders')
    .update({
      status:                'delivered',
      delivery_confirmed_by: user.id,
      delivery_confirmed_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  if (error) return { error: error.message }

  await admin.from('sales').update({ status: 'delivered' }).eq('id', order.sale_id)

  // Decrement stock on delivery
  const { data: items } = await admin
    .from('sale_items')
    .select('product_id, quantity_tiles')
    .eq('sale_id', order.sale_id)

  if (items?.length) {
    const qtyMap = new Map<string, number>()
    for (const item of items as any[]) {
      qtyMap.set(item.product_id, (qtyMap.get(item.product_id) ?? 0) + item.quantity_tiles)
    }
    for (const [productId, qty] of qtyMap) {
      await admin.rpc('decrement_stock_on_delivery', {
        p_product_id: productId,
        p_quantity:   qty,
        p_company_id: profile.company_id,
      })
    }
  }

  await admin.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'ORDER_DELIVERED',
    entity_type:        'orders',
    entity_id:          orderId,
    company_id:         profile.company_id,
    data_after:         { order_number: order.order_number },
  })

  revalidatePath('/deliveries')
  revalidatePath('/warehouse')
  revalidatePath('/dashboard')
  revalidatePath('/sales')
  return { success: true }
}

export async function assignDelivery(orderId: string, deliveryUserId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['warehouse', 'manager', 'owner'].includes(profile.role)) {
    return { error: 'Accès refusé.' }
  }

  const { error } = await supabase
    .from('orders')
    .update({ assigned_delivery_id: deliveryUserId })
    .eq('id', orderId)
    .in('status', ['confirmed', 'preparing', 'ready'])

  if (error) return { error: error.message }

  revalidatePath('/deliveries')
  revalidatePath('/warehouse')
  return { success: true }
}
