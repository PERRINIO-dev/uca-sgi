'use server'

import { createClient }   from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// ─────────────────────────────────────────────────────────────────────────────
// searchCustomers — lightweight autocomplete, no auth cookie required beyond
// being logged in.  Returns at most 8 matches ordered by full_name.
// ─────────────────────────────────────────────────────────────────────────────
export async function searchCustomers(query: string) {
  if (!query || query.trim().length < 2) return { data: [] as any[] }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [] as any[] }

  // Escape ILIKE metacharacters to prevent injection
  const safe = query.trim().replace(/%/g, '\\%').replace(/_/g, '\\_')
  const like = `%${safe}%`

  const { data } = await supabase
    .from('customers')
    .select('id, full_name, phone, phone2, cni, last_sale_at:updated_at')
    .or(`full_name.ilike.${like},phone.ilike.${like}`)
    .order('full_name')
    .limit(8)

  return { data: data ?? [] }
}

// ─────────────────────────────────────────────────────────────────────────────
// createCustomer
// ─────────────────────────────────────────────────────────────────────────────
export async function createCustomer(payload: {
  full_name: string
  phone:     string | null
  phone2:    string | null
  cni:       string | null
  notes:     string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users').select('role, company_id').eq('id', user.id).single()
  if (!profile) return { error: 'Profil introuvable.' }
  if (!['seller', 'manager', 'owner', 'field_agent'].includes(profile.role))
    return { error: 'Accès refusé.' }

  if (!payload.full_name?.trim() || payload.full_name.trim().length < 2)
    return { error: 'Le nom doit contenir au moins 2 caractères.' }

  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      company_id: profile.company_id,
      full_name:  payload.full_name.trim(),
      phone:      payload.phone?.trim()  || null,
      phone2:     payload.phone2?.trim() || null,
      cni:        payload.cni?.trim()    || null,
      notes:      payload.notes?.trim()  || null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await getAdminClient().from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'CUSTOMER_CREATED',
    entity_type:        'customers',
    entity_id:          customer.id,
    company_id:         profile.company_id,
    data_after:         { full_name: payload.full_name.trim() },
  })

  revalidatePath('/customers')
  return { success: true, customerId: customer.id }
}

// ─────────────────────────────────────────────────────────────────────────────
// updateCustomer — admin/owner only
// ─────────────────────────────────────────────────────────────────────────────
export async function updateCustomer(customerId: string, payload: {
  full_name: string
  phone:     string | null
  phone2:    string | null
  cni:       string | null
  notes:     string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users').select('role, company_id').eq('id', user.id).single()
  if (!profile) return { error: 'Profil introuvable.' }
  if (!['manager', 'owner'].includes(profile.role)) return { error: 'Accès refusé.' }

  if (!payload.full_name?.trim() || payload.full_name.trim().length < 2)
    return { error: 'Le nom doit contenir au moins 2 caractères.' }

  const adminClient = getAdminClient()
  const { data: updated, error } = await adminClient
    .from('customers')
    .update({
      full_name: payload.full_name.trim(),
      phone:     payload.phone?.trim()  || null,
      phone2:    payload.phone2?.trim() || null,
      cni:       payload.cni?.trim()    || null,
      notes:     payload.notes?.trim()  || null,
    })
    .eq('id', customerId)
    .eq('company_id', profile.company_id)
    .select('id')
    .single()

  if (error || !updated) return { error: error?.message ?? 'Client introuvable.' }

  await adminClient.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'CUSTOMER_UPDATED',
    entity_type:        'customers',
    entity_id:          customerId,
    company_id:         profile.company_id,
    data_after:         { full_name: payload.full_name.trim() },
  })

  revalidatePath('/customers')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// deleteCustomer — admin/owner only; blocked if the customer has active sales
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteCustomer(customerId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users').select('role, company_id').eq('id', user.id).single()
  if (!profile) return { error: 'Profil introuvable.' }
  if (!['manager', 'owner'].includes(profile.role)) return { error: 'Accès refusé.' }

  // Block if any non-cancelled sales are linked — preserves audit trail
  const { count } = await supabase
    .from('sales')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .not('status', 'in', '(cancelled)')

  if ((count ?? 0) > 0)
    return {
      error: `Ce client a ${count} vente${count! > 1 ? 's' : ''} active${count! > 1 ? 's' : ''}. Suppression impossible.`,
    }

  const adminClient = getAdminClient()

  const { data: customer } = await adminClient
    .from('customers')
    .select('full_name')
    .eq('id', customerId)
    .eq('company_id', profile.company_id)
    .single()

  const { error } = await adminClient
    .from('customers')
    .delete()
    .eq('id', customerId)
    .eq('company_id', profile.company_id)

  if (error) return { error: error.message }

  await adminClient.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'CUSTOMER_DELETED',
    entity_type:        'customers',
    entity_id:          customerId,
    company_id:         profile.company_id,
    data_after:         { full_name: customer?.full_name },
  })

  revalidatePath('/customers')
  return { success: true }
}
