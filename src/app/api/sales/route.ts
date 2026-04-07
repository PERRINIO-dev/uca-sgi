import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { getBadgeCounts }           from '@/lib/supabase/badge-counts'

const PAGE_SIZE = 50

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, full_name, role, is_active, boutique_id, is_platform_admin, boutiques(id, name), companies(currency, name)')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active || profile.is_platform_admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (profile.role === 'warehouse') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sp          = request.nextUrl.searchParams
  const currentPage = Math.min(10_000, Math.max(1, parseInt(sp.get('page') ?? '1')))
  const offset      = (currentPage - 1) * PAGE_SIZE
  const isOwnerOrAdmin = ['owner', 'admin'].includes(profile.role)

  const search     = sp.get('search')?.trim()     ?? ''
  const status     = sp.get('status')             ?? ''
  const payment    = sp.get('payment')            ?? ''
  const dateFrom   = sp.get('dateFrom')           ?? ''
  const dateTo     = sp.get('dateTo')             ?? ''
  const boutiqueId = sp.get('boutique_id')        ?? ''

  let query = supabase
    .from('sales')
    .select(`
      id, created_at, sale_number, status, vendor_id,
      total_amount, amount_paid, payment_status,
      customer_name, customer_phone, customer_cni, notes,
      boutiques(name),
      users!sales_vendor_id_fkey(full_name),
      sale_items (
        id, quantity_tiles, unit_price_per_m2,
        total_price, tile_area_m2_snapshot,
        tiles_per_carton_snapshot,
        products ( name, reference_code, product_type, unit_label )
      )
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  let countQuery = supabase
    .from('sales')
    .select('id', { count: 'exact', head: true })

  if (profile.role === 'vendor') {
    query      = query.eq('vendor_id', user.id)
    countQuery = countQuery.eq('vendor_id', user.id)
  }

  if (search) {
    const escaped = search.replace(/%/g, '\\%').replace(/_/g, '\\_')
    const like    = `%${escaped}%`
    query      = query.or(`sale_number.ilike.${like},customer_name.ilike.${like},customer_phone.ilike.${like}`)
    countQuery = countQuery.or(`sale_number.ilike.${like},customer_name.ilike.${like},customer_phone.ilike.${like}`)
  }
  if (status)     { query = query.eq('status', status);               countQuery = countQuery.eq('status', status) }
  if (payment)    { query = query.eq('payment_status', payment);      countQuery = countQuery.eq('payment_status', payment) }
  if (dateFrom)   { query = query.gte('created_at', dateFrom + 'T00:00:00'); countQuery = countQuery.gte('created_at', dateFrom + 'T00:00:00') }
  if (dateTo)     { query = query.lte('created_at', dateTo + 'T23:59:59');   countQuery = countQuery.lte('created_at', dateTo + 'T23:59:59') }
  if (boutiqueId) { query = query.eq('boutique_id', boutiqueId);      countQuery = countQuery.eq('boutique_id', boutiqueId) }

  const [{ data: sales }, { count: totalCount }, badgeCounts, boutiquesResult, ownerResult] = await Promise.all([
    query,
    countQuery,
    getBadgeCounts(profile.role, supabase),
    isOwnerOrAdmin
      ? supabase.from('boutiques').select('id, name').eq('is_active', true).order('name')
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase.from('users').select('full_name').eq('role', 'owner').limit(1).single(),
  ])

  const boutiquesList = isOwnerOrAdmin ? ((boutiquesResult as any).data ?? []) : []
  const total         = totalCount ?? 0

  return NextResponse.json({
    sales:        sales ?? [],
    totalCount:   total,
    totalPages:   Math.max(1, Math.ceil(total / PAGE_SIZE)),
    currency:     (profile.companies as any)?.currency ?? 'FCFA',
    companyName:  (profile.companies as any)?.name ?? 'SGI',
    ownerName:    (ownerResult as any).data?.full_name ?? 'Le Propriétaire',
    hasBoutiques: isOwnerOrAdmin ? boutiquesList.length > 0 : true,
    boutiquesList,
    badgeCounts,
    profile: {
      id:         profile.id,
      full_name:  profile.full_name,
      role:       profile.role,
      boutique_id: profile.boutique_id,
      boutiques:  profile.boutiques,
      is_platform_admin: profile.is_platform_admin,
    },
  })
}
