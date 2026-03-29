import { createClient }   from '@/lib/supabase/server'
import { redirect }       from 'next/navigation'
import { getBadgeCounts } from '@/lib/supabase/badge-counts'
import VendorSaleForm     from './VendorSaleForm'

export default async function NewSalePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, role, boutique_id, is_platform_admin, boutiques(id, name), companies(currency)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (profile.is_platform_admin) redirect('/admin')
  if (!['vendor', 'admin', 'owner'].includes(profile.role)) redirect('/dashboard')

  const isOwnerOrAdmin = ['owner', 'admin'].includes(profile.role)

  let boutique = profile.boutiques as any
  let allBoutiques: any[] = []

  if (!isOwnerOrAdmin && !profile.boutique_id) redirect('/dashboard?error=no_boutique')

  // Run all independent queries in parallel
  const [boutiqueRes, productsRes, pricingRes, badgeCounts, ownerRes] = await Promise.all([
    isOwnerOrAdmin
      ? supabase.from('boutiques').select('id, name').eq('is_active', true).order('name')
      : Promise.resolve({ data: [] as any[] }),

    supabase
      .from('stock_view')
      .select(`
        product_id, reference_code, product_name,
        tiles_per_carton, tile_area_m2,
        available_tiles, available_full_cartons,
        available_m2, full_cartons, loose_tiles
      `)
      .gt('available_tiles', 0)
      .order('product_name'),

    supabase
      .from('products')
      .select('id, product_type, unit_label, package_label, floor_price_per_m2, reference_price_per_m2, floor_price_per_unit, reference_price_per_unit, tiles_per_carton, tile_area_m2')
      .eq('is_active', true),

    getBadgeCounts(profile.role, supabase),
    supabase.from('users').select('full_name').eq('role', 'owner').limit(1).single(),
  ])

  if (isOwnerOrAdmin) {
    allBoutiques = (boutiqueRes as any).data ?? []
    if (allBoutiques.length === 0) redirect('/sales?error=no_boutique')
    boutique = allBoutiques[0]
  }

  const pricingMap: Record<string, any> = {}
  pricingRes.data?.forEach((p: any) => { pricingMap[p.id] = p })

  const enrichedProducts = (productsRes.data ?? [])
    .filter((p: any) => pricingMap[p.product_id] !== undefined)
    .map((p: any) => ({
      ...p,
      product_type:             pricingMap[p.product_id].product_type,
      unit_label:               pricingMap[p.product_id].unit_label,
      package_label:            pricingMap[p.product_id].package_label,
      floor_price_per_m2:       pricingMap[p.product_id].floor_price_per_m2,
      reference_price_per_m2:   pricingMap[p.product_id].reference_price_per_m2,
      floor_price_per_unit:     pricingMap[p.product_id].floor_price_per_unit,
      reference_price_per_unit: pricingMap[p.product_id].reference_price_per_unit,
    }))

  const ownerName = (ownerRes as any).data?.full_name ?? 'Le Propriétaire'

  const currency = (profile.companies as any)?.currency ?? 'FCFA'

  return (
    <VendorSaleForm
      profile={profile}
      currency={currency}
      boutique={boutique}
      products={enrichedProducts}
      allBoutiques={allBoutiques}
      isOwnerOrAdmin={isOwnerOrAdmin}
      badgeCounts={badgeCounts}
      ownerName={ownerName}
    />
  )
}
