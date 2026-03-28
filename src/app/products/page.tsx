import { createClient }   from '@/lib/supabase/server'
import { redirect }       from 'next/navigation'
import { getBadgeCounts } from '@/lib/supabase/badge-counts'
import ProductsClient     from './ProductsClient'

export default async function ProductsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, role, is_platform_admin')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (!['owner', 'admin'].includes(profile.role)) redirect('/dashboard')

  const [{ data: products }, badgeCounts] = await Promise.all([
    supabase
      .from('products')
      .select(`
        id, reference_code, name, category, supplier,
        width_cm, height_cm, tiles_per_carton,
        tile_area_m2, carton_area_m2,
        purchase_price, floor_price_per_m2,
        reference_price_per_m2, is_active, created_at,
        stock ( total_tiles, reserved_tiles, last_updated_at )
      `)
      .order('created_at', { ascending: false }),

    getBadgeCounts(profile.role, supabase),
  ])

  return (
    <ProductsClient
      profile={profile}
      products={products ?? []}
      badgeCounts={badgeCounts}
    />
  )
}
