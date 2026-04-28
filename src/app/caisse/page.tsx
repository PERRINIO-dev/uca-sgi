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
  if (profile.role === 'warehouse') redirect('/warehouse')

  const isOwnerOrAdmin = ['owner', 'admin'].includes(profile.role)
  const today = new Date().toISOString().slice(0, 10)
  const date  = params.date ?? today

  // Resolve boutique: vendor → own boutique; owner/admin → param or first active
  let boutiqueId = profile.role === 'vendor'
    ? (profile.boutique_id ?? '')
    : (params.boutique_id ?? '')

  const [badgeCounts, boutiquesResult] = await Promise.all([
    getBadgeCounts(profile.role, supabase),
    isOwnerOrAdmin
      ? supabase.from('boutiques').select('id, name').eq('is_active', true).order('name')
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const boutiques: { id: string; name: string }[] = (boutiquesResult as any).data ?? []

  // If owner/admin with no boutique_id param, default to first boutique
  if (isOwnerOrAdmin && !boutiqueId && boutiques.length > 0) {
    boutiqueId = boutiques[0].id
  }

  const currency    = (profile.companies as any)?.currency ?? 'FCFA'
  const companyName = (profile.companies as any)?.name ?? 'SGI'

  // Pre-fetch today's (or requested) caisse data
  const { data: initialData } = boutiqueId
    ? await getCaisseData(boutiqueId, date)
    : { data: null }

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
    />
  )
}
