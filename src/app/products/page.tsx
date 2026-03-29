import { createClient }         from '@/lib/supabase/server'
import { redirect }             from 'next/navigation'
import { getBadgeCounts }       from '@/lib/supabase/badge-counts'
import { getProductCategories } from './actions'
import ProductsClient           from './ProductsClient'

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
  if (profile.is_platform_admin) redirect('/admin')
  if (!['owner', 'admin'].includes(profile.role)) redirect('/dashboard')

  const [{ data: products }, categories, badgeCounts] = await Promise.all([
    supabase
      .from('products')
      .select(`
        id, reference_code, name, category, category_id, supplier, is_active, created_at,
        product_type, unit_label, package_label,
        width_cm, height_cm, tiles_per_carton, tile_area_m2, carton_area_m2,
        purchase_price, floor_price_per_m2, reference_price_per_m2,
        floor_price_per_unit, reference_price_per_unit,
        piece_length_m, container_volume_l, bag_weight_kg, pieces_per_package,
        stock ( total_tiles, reserved_tiles, last_updated_at )
      `)
      .order('created_at', { ascending: false }),

    getProductCategories(),

    getBadgeCounts(profile.role, supabase),
  ])

  return (
    <ProductsClient
      profile={profile}
      products={products ?? []}
      categories={categories}
      badgeCounts={badgeCounts}
    />
  )
}
