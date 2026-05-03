import { createClient }   from '@/lib/supabase/server'
import { redirect }       from 'next/navigation'
import { getBadgeCounts } from '@/lib/supabase/badge-counts'
import CaisseClient       from './CaisseClient'
import { getCaisseData }  from './actions'

export default async function CaissePage({
  searchParams,
}: {
  searchParams: Promise<{ boutique_id?: string; date?: string }>
}) {
  const params  = await searchParams
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
  if (profile.role === 'delivery')    redirect('/deliveries')
  if (profile.role === 'warehouse')   redirect('/warehouse')
  if (profile.role === 'seller')      redirect('/sales/new')
  if (profile.role === 'field_agent') redirect('/pipeline')
  if (!['owner', 'manager', 'cashier', 'accountant'].includes(profile.role)) redirect('/dashboard')

  const isOwnerOrManager = ['owner', 'manager'].includes(profile.role)
  const today = new Date().toISOString().slice(0, 10)
  const date  = params.date ?? today

  // Resolve boutique: cashier → own boutique; owner/manager/accountant → param or first active
  let boutiqueId = profile.role === 'cashier'
    ? (profile.boutique_id ?? '')
    : (params.boutique_id ?? '')

  const [badgeCounts, boutiquesResult] = await Promise.all([
    getBadgeCounts(profile.role, supabase),
    isOwnerOrManager
      ? supabase.from('boutiques').select('id, name').eq('is_active', true).order('name')
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const boutiques: { id: string; name: string }[] = (boutiquesResult as any).data ?? []

  // If owner/manager with no boutique_id param, default to first boutique
  if (isOwnerOrManager && !boutiqueId && boutiques.length > 0) {
    boutiqueId = boutiques[0].id
  }

  const currency    = (profile.companies as any)?.currency ?? 'FCFA'
  const companyName = (profile.companies as any)?.name ?? 'SGI'

  // Run caisse data + pending sales in parallel
  const [{ data: initialData }, { data: pendingSales }] = await Promise.all([
    boutiqueId ? getCaisseData(boutiqueId, date) : Promise.resolve({ data: null }),
    boutiqueId
      ? supabase
          .from('sales')
          .select('id, sale_number, customer_name, customer_phone, total_amount, amount_paid')
          .eq('boutique_id', boutiqueId)
          .in('status', ['confirmed', 'preparing', 'ready'])
          .not('payment_status', 'eq', 'paid')
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as any[] }),
  ])

  return (
    <CaisseClient
      profile={profile}
      currency={currency}
      companyName={companyName}
      badgeCounts={badgeCounts}
      boutiques={boutiques}
      initialBoutiqueId={boutiqueId}
      initialDate={date}
      initialData={initialData}
      pendingSales={pendingSales ?? []}
    />
  )
}
