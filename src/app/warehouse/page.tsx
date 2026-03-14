import { createClient }   from '@/lib/supabase/server'
import { redirect }       from 'next/navigation'
import { getBadgeCounts } from '@/lib/supabase/badge-counts'
import WarehouseClient    from './WarehouseClient'

export default async function WarehousePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, role, boutique_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (!['warehouse', 'admin', 'owner'].includes(profile.role)) {
    redirect('/dashboard')
  }

  // Active orders — confirmed, preparing, ready
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, created_at,
      expected_delivery_date,
      preparation_started_at,
      preparation_confirmed_at,
      assigned_to,
      sales (
        id, sale_number, customer_name,
        customer_phone, total_amount, notes,
        boutiques ( name ),
        users!sales_vendor_id_fkey ( full_name ),
        sale_items (
          id, quantity_tiles, unit_price_per_m2,
          total_price, tile_area_m2_snapshot,
          tiles_per_carton_snapshot,
          products ( name, reference_code )
        )
      )
    `)
    .in('status', ['confirmed', 'preparing', 'ready'])
    .order('created_at', { ascending: true })

  // Recent delivered orders (last 10)
  const { data: deliveredOrders } = await supabase
    .from('orders')
    .select(`
      id, order_number, status,
      delivery_confirmed_at,
      sales (
        sale_number, customer_name, total_amount,
        boutiques ( name ),
        sale_items (
          id, quantity_tiles,
          tile_area_m2_snapshot,
          tiles_per_carton_snapshot,
          products ( name, reference_code )
        )
      )
    `)
    .eq('status', 'delivered')
    .order('delivery_confirmed_at', { ascending: false })
    .limit(10)

  // All active products for stock request form
  const { data: products } = await supabase
    .from('products')
    .select('id, name, reference_code, tiles_per_carton, tile_area_m2')
    .eq('is_active', true)
    .order('name')

  // Stock levels — only for active products
  const activeProductIds = new Set((products ?? []).map(p => p.id))
  const { data: allStockLevels } = await supabase
    .from('stock_view')
    .select('*')
    .order('product_name')
  const stockLevels = (allStockLevels ?? []).filter(s => activeProductIds.has(s.product_id))

  // My pending stock requests
  const { data: myRequests } = await supabase
    .from('stock_requests')
    .select(`
      id, created_at, request_type,
      quantity_tiles_delta, justification,
      status, review_comment,
      products ( name, reference_code )
    `)
    .eq('requested_by', user.id)
    .order('created_at', { ascending: false })
    .limit(15)

  const badgeCounts = await getBadgeCounts(profile.role, supabase)

  return (
    <WarehouseClient
      profile={profile}
      orders={orders ?? []}
      deliveredOrders={deliveredOrders ?? []}
      stockLevels={stockLevels ?? []}
      products={products ?? []}
      myRequests={myRequests ?? []}
      badgeCounts={badgeCounts}
    />
  )
}