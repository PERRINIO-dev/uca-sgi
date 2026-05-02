import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole }       from '@/lib/types'

export interface BadgeCounts {
  pendingApprovals:  number  // demandes stock en attente → dashboard owner/manager
  confirmedOrders:   number  // commandes confirmées à préparer → entrepôt
  pendingPayments:   number  // ventes en attente de paiement → caisse cashier
  pendingDeliveries: number  // livraisons assignées en attente → delivery
}

export async function getBadgeCounts(
  role: UserRole | string,
  supabase: SupabaseClient,
): Promise<BadgeCounts> {
  const counts: BadgeCounts = {
    pendingApprovals:  0,
    confirmedOrders:   0,
    pendingPayments:   0,
    pendingDeliveries: 0,
  }

  const tasks: PromiseLike<void>[] = []

  // Direction : approbations stock + commandes à préparer
  if (['owner', 'manager'].includes(role)) {
    tasks.push(
      supabase
        .from('stock_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .then(r => { counts.pendingApprovals = r.count ?? 0 }),

      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'confirmed')
        .then(r => { counts.confirmedOrders = r.count ?? 0 }),
    )
  }

  // Warehouse : commandes à préparer
  if (role === 'warehouse') {
    tasks.push(
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'confirmed')
        .then(r => { counts.confirmedOrders = r.count ?? 0 }),
    )
  }

  // Cashier : ventes en attente de paiement
  if (role === 'cashier') {
    tasks.push(
      supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .in('payment_status', ['unpaid', 'partial'])
        .in('status', ['confirmed', 'preparing', 'ready', 'delivered'])
        .then(r => { counts.pendingPayments = r.count ?? 0 }),
    )
  }

  // Delivery : livraisons assignées
  if (role === 'delivery') {
    tasks.push(
      supabase.auth.getUser().then(({ data }) => {
        if (!data.user) return
        return supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'ready')
          .eq('assigned_delivery_id', data.user.id)
          .then(r => { counts.pendingDeliveries = r.count ?? 0 })
      }),
    )
  }

  await Promise.all(tasks)
  return counts
}
