'use server'

import { createClient }                      from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath }                    from 'next/cache'

// Admin client with service role — bypasses RLS
function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function createEmployee(payload: {
  email:      string
  fullName:   string
  role:       'vendor' | 'warehouse' | 'admin'
  boutiqueId: string | null
  password:   string
}) {
  const supabase      = await createClient()
  const adminSupabase = getAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return { error: 'Accès refusé.' }
  }

  if (payload.role === 'vendor' && !payload.boutiqueId) {
    return { error: 'Une boutique doit être assignée aux vendeurs.' }
  }

  if (payload.password.length < 8) {
    return { error: 'Le mot de passe doit contenir au moins 8 caractères.' }
  }

  // Check email uniqueness within the company
  const { data: existing } = await adminSupabase
    .from('users')
    .select('id')
    .eq('email', payload.email.trim().toLowerCase())
    .eq('company_id', profile.company_id)
    .maybeSingle()

  if (existing) {
    return { error: 'Un compte avec cet email existe déjà.' }
  }

  // Create auth user with service role
  const { data: authData, error: authError } =
    await adminSupabase.auth.admin.createUser({
      email:         payload.email.trim().toLowerCase(),
      password:      payload.password,
      email_confirm: true,
      user_metadata: {
        full_name:   payload.fullName.trim(),
        role:        payload.role,
        boutique_id: payload.boutiqueId ?? '',
      },
    })

  if (authError || !authData.user) {
    return { error: authError?.message ?? 'Erreur création du compte.' }
  }

  const userId = authData.user.id

  // Upsert public.users (trigger may or may not have fired)
  const { error: profileError } = await adminSupabase
    .from('users')
    .upsert({
      id:          userId,
      email:       payload.email.trim().toLowerCase(),
      full_name:   payload.fullName.trim(),
      role:        payload.role,
      boutique_id: payload.boutiqueId ?? null,
      is_active:   true,
      company_id:  profile.company_id,
    }, { onConflict: 'id' })

  if (profileError) {
    await adminSupabase.auth.admin.deleteUser(userId)
    return { error: profileError.message }
  }

  await supabase.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'USER_CREATED',
    entity_type:        'users',
    entity_id:          userId,
    company_id:         profile.company_id,
    data_after: {
      email:    payload.email,
      role:     payload.role,
      fullName: payload.fullName,
    },
  })

  revalidatePath('/users')
  return { success: true, userId }
}

export async function toggleUserActive(
  targetUserId: string,
  isActive:     boolean
) {
  const supabase      = await createClient()
  const adminSupabase = getAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return { error: 'Accès refusé.' }
  }

  if (targetUserId === user.id) {
    return { error: 'Vous ne pouvez pas désactiver votre propre compte.' }
  }

  // Role hierarchy: admin cannot touch owner accounts; also verify target is in same company
  const { data: targetProfile } = await adminSupabase
    .from('users')
    .select('role')
    .eq('id', targetUserId)
    .eq('company_id', profile.company_id)
    .single()

  if (targetProfile?.role === 'owner' && profile.role !== 'owner') {
    return { error: 'Accès refusé : vous ne pouvez pas modifier un compte propriétaire.' }
  }

  const { error } = await adminSupabase
    .from('users')
    .update({ is_active: isActive })
    .eq('id', targetUserId)

  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
    entity_type:        'users',
    entity_id:          targetUserId,
    company_id:         profile.company_id,
  })

  revalidatePath('/users')
  return { success: true }
}

export async function createBoutique(payload: { name: string; address: string }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return { error: 'Accès refusé.' }
  }

  const trimmed = payload.name.trim()
  if (!trimmed) return { error: 'Le nom est requis.' }

  const adminSupabase = getAdminClient()
  const { data: boutique, error } = await adminSupabase
    .from('boutiques')
    .insert({ name: trimmed, address: payload.address.trim(), is_active: true, company_id: profile.company_id })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'BOUTIQUE_CREATED',
    entity_type:        'boutiques',
    entity_id:          boutique.id,
    company_id:         profile.company_id,
    data_after:         { name: trimmed, address: payload.address.trim() },
  })

  revalidatePath('/users')
  return { success: true }
}

export async function resetPassword(
  targetUserId: string,
  newPassword:  string
) {
  const supabase      = await createClient()
  const adminSupabase = getAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return { error: 'Accès refusé.' }
  }

  if (newPassword.length < 8) {
    return { error: 'Le mot de passe doit contenir au moins 8 caractères.' }
  }

  // Role hierarchy: admin cannot reset owner's password; verify target is in same company
  const { data: targetProfile } = await adminSupabase
    .from('users')
    .select('role')
    .eq('id', targetUserId)
    .eq('company_id', profile.company_id)
    .single()

  if (targetProfile?.role === 'owner' && profile.role !== 'owner') {
    return { error: 'Accès refusé : vous ne pouvez pas modifier un compte propriétaire.' }
  }

  const { error } = await adminSupabase.auth.admin.updateUserById(
    targetUserId,
    { password: newPassword }
  )

  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'PASSWORD_RESET',
    entity_type:        'users',
    entity_id:          targetUserId,
    company_id:         profile.company_id,
  })

  return { success: true }
}

export async function toggleBoutiqueActive(
  boutiqueId: string,
  isActive:   boolean
) {
  const supabase      = await createClient()
  const adminSupabase = getAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return { error: 'Accès refusé.' }
  }

  const { error } = await adminSupabase
    .from('boutiques')
    .update({ is_active: isActive })
    .eq('id', boutiqueId)
    .eq('company_id', profile.company_id)

  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        isActive ? 'BOUTIQUE_ACTIVATED' : 'BOUTIQUE_DEACTIVATED',
    entity_type:        'boutiques',
    entity_id:          boutiqueId,
    company_id:         profile.company_id,
  })

  revalidatePath('/users')
  return { success: true }
}

export async function updateEmployee(payload: {
  userId:     string
  fullName:   string
  role:       'vendor' | 'warehouse' | 'admin'
  boutiqueId: string | null
}) {
  const supabase      = await createClient()
  const adminSupabase = getAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['owner', 'admin'].includes(profile.role)) {
    return { error: 'Accès refusé.' }
  }

  if (payload.role === 'vendor' && !payload.boutiqueId) {
    return { error: 'Une boutique doit être assignée aux vendeurs.' }
  }

  // Role hierarchy: admin cannot edit owner accounts; verify target is in same company
  const { data: targetProfile } = await adminSupabase
    .from('users')
    .select('role')
    .eq('id', payload.userId)
    .eq('company_id', profile.company_id)
    .single()

  if (targetProfile?.role === 'owner' && profile.role !== 'owner') {
    return { error: 'Accès refusé : vous ne pouvez pas modifier un compte propriétaire.' }
  }

  const { error } = await adminSupabase
    .from('users')
    .update({
      full_name:   payload.fullName.trim(),
      role:        payload.role,
      boutique_id: payload.boutiqueId ?? null,
    })
    .eq('id', payload.userId)

  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'USER_UPDATED',
    entity_type:        'users',
    entity_id:          payload.userId,
    company_id:         profile.company_id,
    data_after: {
      full_name:   payload.fullName,
      role:        payload.role,
      boutique_id: payload.boutiqueId,
    },
  })

  revalidatePath('/users')
  return { success: true }
}
