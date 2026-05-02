import { createClient }   from '@/lib/supabase/server'
import { redirect }       from 'next/navigation'
import { getBadgeCounts } from '@/lib/supabase/badge-counts'
import PipelineClient     from './PipelineClient'

const PAGE_SIZE = 50

export default async function PipelinePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, role, is_active, boutique_id, is_platform_admin, boutiques(id, name), companies(currency, name)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (!profile.is_active) redirect('/login?error=account_suspended')
  if (profile.is_platform_admin) redirect('/admin')
  if (!['field_agent', 'owner', 'manager'].includes(profile.role)) redirect('/dashboard')

  const isManagement = ['owner', 'manager'].includes(profile.role)

  // For field_agent: own quotes only; for owner/manager: all quotes
  const [quotesRes, badgeCounts, boutiqueRes] = await Promise.all([
    (() => {
      let q = supabase
        .from('sales')
        .select(`
          id, created_at, quote_number, sale_number, status, vendor_id,
          total_amount, amount_paid, payment_status,
          customer_name, customer_phone, notes,
          boutiques(name),
          users!sales_vendor_id_fkey(full_name),
          sale_items (
            id, quantity_tiles, unit_price_per_m2,
            total_price, tile_area_m2_snapshot, tiles_per_carton_snapshot,
            products ( name, reference_code, product_type, unit_label, package_label )
          )
        `)
        .not('quote_number', 'is', null)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (!isManagement) q = q.eq('vendor_id', user.id)
      return q
    })(),

    getBadgeCounts(profile.role, supabase),

    isManagement
      ? supabase.from('boutiques').select('id, name').eq('is_active', true).order('name')
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const currency    = (profile.companies as any)?.currency ?? 'FCFA'
  const companyName = (profile.companies as any)?.name ?? 'SGI'
  const boutiques   = (boutiqueRes as any).data ?? []

  return (
    <PipelineClient
      profile={profile}
      currency={currency}
      companyName={companyName}
      quotes={quotesRes.data ?? []}
      boutiques={boutiques}
      badgeCounts={badgeCounts}
    />
  )
}
