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
    .select('id, full_name, role, boutique_id, is_platform_admin, companies(currency)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (profile.is_platform_admin) redirect('/admin')
  if (!['warehouse', 'admin', 'owner'].includes(profile.role)) {
    redirect('/dashboard')
  }

  // All independent queries run in parallel after profile is known
  const [
    { data: orders },
    { data: deliveredOrders },
    { data: products },
    { data: allStockLevels },
    { data: myRequests },
    badgeCounts,
  ] = await Promise.all([
    // Active orders — confirmed, preparing, ready
    supabase
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
            products ( name, reference_code, product_type, unit_label, package_label )
          )
        )
      `)
      .in('status', ['confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: true }),

    // Recent delivered orders (last 10)
    supabase
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
            products ( name, reference_code, product_type, unit_label, package_label )
          )
        )
      `)
      .eq('status', 'delivered')
      .order('delivery_confirmed_at', { ascending: false })
      .limit(10),

    // All active products for stock request form
    supabase
      .from('products')
      .select('id, name, reference_code, product_type, unit_label, package_label, tiles_per_carton, tile_area_m2, piece_length_m, container_volume_l, bag_weight_kg')
      .eq('is_active', true)
      .order('name'),

    // All stock levels (filtered in JS after both resolve)
    supabase
      .from('stock_view')
      .select('*')
      .order('product_name'),

    // My pending stock requests
    supabase
      .from('stock_requests')
      .select(`
        id, created_at, request_type,
        quantity_tiles_delta, justification,
        status, review_comment,
        products ( name, reference_code )
      `)
      .eq('requested_by', user.id)
      .order('created_at', { ascending: false })
      .limit(15),

    getBadgeCounts(profile.role, supabase),
  ])

  // Filter stock to active products only (done in JS, not a separate query)
  const activeProductIds = new Set((products ?? []).map((p: any) => p.id))
  const stockLevels = (allStockLevels ?? []).filter((s: any) => activeProductIds.has(s.product_id))

  const currency = (profile.companies as any)?.currency ?? 'FCFA'

  return (
    <WarehouseClient
      profile={profile}
      currency={currency}
      orders={orders ?? []}
      deliveredOrders={deliveredOrders ?? []}
      stockLevels={stockLevels ?? []}
      products={products ?? []}
      myRequests={myRequests ?? []}
      badgeCounts={badgeCounts}
    />
  )
}