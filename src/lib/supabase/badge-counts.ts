import type { SupabaseClient } from '@supabase/supabase-js'

export interface BadgeCounts {
  pendingApprovals: number  // pending stock requests → dashboard badge
  confirmedOrders:  number  // confirmed orders awaiting prep → warehouse badge
}

/**
 * Fetch sidebar badge counts in a single parallel round-trip.
 * Uses HEAD requests (count only, no data) so it's very lightweight.
 */
export async function getBadgeCounts(
  role: string,
  supabase: SupabaseClient,
): Promise<BadgeCounts> {
  const isOwnerAdmin = ['owner', 'admin'].includes(role)
  const isWarehouse  = role === 'warehouse'

  const [approvalsRes, ordersRes] = await Promise.all([
    isOwnerAdmin
      ? supabase
          .from('stock_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
      : Promise.resolve({ count: 0, error: null }),

    (isOwnerAdmin || isWarehouse)
      ? supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'confirmed')
      : Promise.resolve({ count: 0, error: null }),
  ])

  return {
    pendingApprovals: approvalsRes.count ?? 0,
    confirmedOrders:  ordersRes.count ?? 0,
  }
}
