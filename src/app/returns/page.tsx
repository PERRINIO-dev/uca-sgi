import { createClient }   from '@/lib/supabase/server'
import { redirect }        from 'next/navigation'
import { getBadgeCounts }  from '@/lib/supabase/badge-counts'
import ReturnsClient       from './ReturnsClient'

export default async function ReturnsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, role, is_active, boutique_id, is_platform_admin, companies(currency, name)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (!profile.is_active) redirect('/login?error=account_suspended')
  if (profile.is_platform_admin) redirect('/admin')
  if (!['owner', 'manager', 'seller', 'warehouse', 'accountant'].includes(profile.role)) redirect('/dashboard')

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const [
    { data: returns },
    { data: deliveredSales },
    { data: existingReturnItems },
    { data: nonCancelledReturns },
    badgeCounts,
  ] = await Promise.all([

    // All returns for this company
    supabase
      .from('sale_returns')
      .select(`
        id, return_number, status, resolution, total_amount, notes,
        created_at, validated_at,
        sales ( sale_number, customer_name, customer_phone, total_amount ),
        sale_return_items (
          id, qty_returned, unit_price, tile_area_m2, total_price,
          products ( name, reference_code, product_type, unit_label )
        ),
        users!sale_returns_created_by_fkey ( full_name ),
        users!sale_returns_validated_by_fkey ( full_name )
      `)
      .order('created_at', { ascending: false })
      .limit(200),

    // Delivered sales last 90 days (for create modal)
    supabase
      .from('sales')
      .select(`
        id, sale_number, customer_name, customer_phone, created_at, total_amount,
        boutiques ( name ),
        sale_items (
          id, quantity_tiles, unit_price_per_m2, total_price,
          tile_area_m2_snapshot, tiles_per_carton_snapshot,
          products ( id, name, reference_code, product_type, unit_label )
        )
      `)
      .eq('status', 'delivered')
      .gte('created_at', ninetyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(200),

    // All return items (to compute already-returned quantities)
    supabase
      .from('sale_return_items')
      .select('sale_item_id, qty_returned, return_id'),

    // Non-cancelled return IDs (to filter existingReturnItems)
    supabase
      .from('sale_returns')
      .select('id')
      .neq('status', 'cancelled'),

    getBadgeCounts(profile.role, supabase),
  ])

  // Build map: sale_item_id → total qty already returned (active returns only)
  const validReturnIds = new Set((nonCancelledReturns ?? []).map((r: any) => r.id))
  const returnedQtyMap: Record<string, number> = {}
  for (const item of existingReturnItems ?? []) {
    if (!validReturnIds.has((item as any).return_id)) continue
    const id = (item as any).sale_item_id
    returnedQtyMap[id] = (returnedQtyMap[id] ?? 0) + Number((item as any).qty_returned)
  }

  const currency    = (profile.companies as any)?.currency ?? 'FCFA'
  const companyName = (profile.companies as any)?.name     ?? 'SGI'

  return (
    <ReturnsClient
      profile={profile}
      currency={currency}
      companyName={companyName}
      returns={returns ?? []}
      deliveredSales={deliveredSales ?? []}
      returnedQtyMap={returnedQtyMap}
      badgeCounts={badgeCounts}
    />
  )
}
