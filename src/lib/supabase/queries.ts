import { createClient } from '@/lib/supabase/server'

export async function getDashboardStats() {
  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()

  // Month-to-date window
  const mtdStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const mtdISO   = mtdStart.toISOString()

  // Previous full month window
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const prevMonthEnd   = new Date(mtdStart.getTime() - 1)
  const prevStartISO   = prevMonthStart.toISOString()
  const prevEndISO     = prevMonthEnd.toISOString()

  const [
    todayResult, mtdResult, prevMonthResult,
    stockResult, pendingResult, boutiqueResult, activeOrdersResult,
    creancesResult, productTypesResult,
  ] = await Promise.all([

    // Today's confirmed sales (drafts are not yet revenue)
    supabase
      .from('sales')
      .select('total_amount, amount_paid')
      .gte('created_at', todayISO)
      .in('status', ['confirmed', 'preparing', 'ready', 'delivered']),

    // Month-to-date confirmed sales — sale_items include product_type so the
    // shared KPI helper can use it as the authoritative isTile signal
    supabase
      .from('sales')
      .select('total_amount, amount_paid, boutique_id, boutiques(name), sale_items(purchase_price_snapshot, quantity_tiles, tile_area_m2_snapshot, products(product_type))')
      .gte('created_at', mtdISO)
      .in('status', ['confirmed', 'preparing', 'ready', 'delivered']),

    // Previous full month — confirmed only, for apples-to-apples trend
    supabase
      .from('sales')
      .select('total_amount, created_at')
      .gte('created_at', prevStartISO)
      .lte('created_at', prevEndISO)
      .in('status', ['confirmed', 'preparing', 'ready', 'delivered']),

    // Stock levels with alerts
    supabase
      .from('stock_view')
      .select('*')
      .order('available_qty', { ascending: true }),

    // Pending stock requests
    supabase
      .from('stock_requests')
      .select(`
        id, created_at, request_type,
        quantity_tiles_delta, justification,
        stock_before_tiles, product_id,
        products(name, reference_code, product_type, unit_label, package_label, tiles_per_carton, tile_area_m2, piece_length_m, container_volume_l, pieces_per_package),
        users!stock_requests_requested_by_fkey(full_name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),

    // MTD confirmed sales by boutique
    supabase
      .from('sales')
      .select('total_amount, boutique_id, boutiques(name), created_at')
      .gte('created_at', mtdISO)
      .in('status', ['confirmed', 'preparing', 'ready', 'delivered']),

    // Active orders count (confirmed + preparing + ready)
    supabase
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .in('status', ['confirmed', 'preparing', 'ready']),

    // All-time outstanding créances — confirmed sales with unpaid/partial balance
    // Drafts are excluded: the amount is not yet due until a sale is confirmed
    supabase
      .from('sales')
      .select('total_amount, amount_paid')
      .in('payment_status', ['partial', 'unpaid'])
      .in('status', ['confirmed', 'preparing', 'ready', 'delivered']),

    // Product types for type-aware stock alert thresholds
    supabase
      .from('products')
      .select('id, product_type'),
  ])

  return {
    todaySales:        todayResult.data       ?? [],
    mtdSales:          mtdResult.data         ?? [],
    prevMonthSales:    prevMonthResult.data   ?? [],
    stockLevels:       stockResult.data       ?? [],
    pendingRequests:   pendingResult.data     ?? [],
    weekSales:         boutiqueResult.data    ?? [],
    activeOrdersCount: activeOrdersResult.count ?? 0,
    allTimeCreanceSales: creancesResult.data  ?? [],
    productTypes:      productTypesResult.data ?? [],
  }
}


export async function getSalesByPeriod(days: number) {
  const supabase = await createClient()
  const from = new Date()
  from.setDate(from.getDate() - days)

  const { data } = await supabase
    .from('sales')
    .select('created_at, total_amount, boutique_id, boutiques(name)')
    .gte('created_at', from.toISOString())
    .in('status', ['confirmed', 'preparing', 'ready', 'delivered'])
    .order('created_at', { ascending: true })

  return data ?? []
}

