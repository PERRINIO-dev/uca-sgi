import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'
import SalesListClient  from './SalesListClient'

export default async function SalesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, role, boutique_id, boutiques(id, name)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Warehouse role has no access to the sales page
  if (profile.role === 'warehouse') redirect('/warehouse')

  let query = supabase
    .from('sales')
    .select(`
      id, created_at, sale_number, status, vendor_id,
      total_amount, customer_name, customer_phone, notes,
      boutiques(name),
      users!sales_vendor_id_fkey(full_name),
      sale_items (
        id, quantity_tiles, unit_price_per_m2,
        total_price, tile_area_m2_snapshot,
        tiles_per_carton_snapshot,
        products ( name, reference_code )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(500)

  if (profile.role === 'vendor') {
    query = query.eq('boutique_id', profile.boutique_id!)
  }

  const { data: sales } = await query

  return (
    <SalesListClient
      profile={profile}
      sales={sales ?? []}
    />
  )
}
