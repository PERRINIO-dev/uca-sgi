import { createClient }   from '@/lib/supabase/server'
import { redirect }       from 'next/navigation'
import { getBadgeCounts } from '@/lib/supabase/badge-counts'
import DeliveriesClient   from './DeliveriesClient'

export default async function DeliveriesPage() {
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
  if (!['delivery', 'owner', 'manager', 'warehouse'].includes(profile.role)) redirect('/dashboard')

  const isDelivery = profile.role === 'delivery'

  const [ordersRes, badgeCounts] = await Promise.all([
    isDelivery
      ? supabase
          .from('orders')
          .select(`
            id, order_number, status, created_at,
            expected_delivery_date,
            assigned_delivery_id,
            sales (
              id, sale_number, customer_name, customer_phone,
              total_amount, notes,
              boutiques ( name ),
              sale_items (
                id, quantity_tiles, unit_price_per_m2,
                total_price, tile_area_m2_snapshot,
                tiles_per_carton_snapshot,
                products ( name, reference_code, product_type, unit_label, package_label )
              )
            )
          `)
          .eq('status', 'ready')
          .eq('assigned_delivery_id', user.id)
          .order('created_at', { ascending: true })
      : supabase
          .from('orders')
          .select(`
            id, order_number, status, created_at,
            expected_delivery_date,
            assigned_delivery_id,
            sales (
              id, sale_number, customer_name, customer_phone,
              total_amount, notes,
              boutiques ( name ),
              sale_items (
                id, quantity_tiles, unit_price_per_m2,
                total_price, tile_area_m2_snapshot,
                tiles_per_carton_snapshot,
                products ( name, reference_code, product_type, unit_label, package_label )
              )
            )
          `)
          .eq('status', 'ready')
          .order('created_at', { ascending: true }),

    getBadgeCounts(profile.role, supabase),
  ])

  const currency    = (profile.companies as any)?.currency ?? 'FCFA'
  const companyName = (profile.companies as any)?.name ?? 'SGI'

  return (
    <DeliveriesClient
      profile={profile}
      currency={currency}
      companyName={companyName}
      orders={ordersRes.data ?? []}
      badgeCounts={badgeCounts}
    />
  )
}
