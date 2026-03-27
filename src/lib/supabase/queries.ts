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
  ] = await Promise.all([

    // Today's sales (all non-cancelled — not just delivered)
    supabase
      .from('sales')
      .select('total_amount, amount_paid')
      .gte('created_at', todayISO)
      .neq('status', 'cancelled'),

    // Month-to-date sales
    supabase
      .from('sales')
      .select('total_amount, amount_paid, boutique_id, boutiques(name)')
      .gte('created_at', mtdISO)
      .neq('status', 'cancelled'),

    // Previous full month (for trend)
    supabase
      .from('sales')
      .select('total_amount')
      .gte('created_at', prevStartISO)
      .lte('created_at', prevEndISO)
      .neq('status', 'cancelled'),

    // Stock levels with alerts
    supabase
      .from('stock_view')
      .select('*')
      .order('available_tiles', { ascending: true }),

    // Pending stock requests
    supabase
      .from('stock_requests')
      .select(`
        id, created_at, request_type,
        quantity_tiles_delta, justification,
        stock_before_tiles, product_id,
        products(name, reference_code),
        users!stock_requests_requested_by_fkey(full_name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),

    // MTD sales by boutique (replaces week-only)
    supabase
      .from('sales')
      .select('total_amount, boutique_id, boutiques(name), created_at')
      .gte('created_at', mtdISO)
      .neq('status', 'cancelled'),

    // Active orders count (confirmed + preparing + ready)
    supabase
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .in('status', ['confirmed', 'preparing', 'ready']),
  ])

  return {
    todaySales:       todayResult.data       ?? [],
    mtdSales:         mtdResult.data         ?? [],
    prevMonthSales:   prevMonthResult.data   ?? [],
    stockLevels:      stockResult.data       ?? [],
    pendingRequests:  pendingResult.data     ?? [],
    weekSales:        boutiqueResult.data    ?? [],
    activeOrdersCount: activeOrdersResult.count ?? 0,
  }
}

export async function getRecentActivity(limit = 20) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('audit_logs')
    .select(`
      id, created_at, action_type,
      entity_type, entity_id,
      users!audit_logs_user_id_fkey(full_name, role)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

export async function getSalesByPeriod(days: number) {
  const supabase = await createClient()
  const from = new Date()
  from.setDate(from.getDate() - days)

  const { data } = await supabase
    .from('sales')
    .select('created_at, total_amount, boutique_id, boutiques(name)')
    .gte('created_at', from.toISOString())
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true })

  return data ?? []
}

function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}
