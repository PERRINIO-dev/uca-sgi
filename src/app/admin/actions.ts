'use server'

import { createClient }                      from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath }                    from 'next/cache'

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/** Verify the caller is a platform admin — always read from DB, never trust client. */
async function verifyPlatformAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, caller: null }

  const { data: caller } = await supabase
    .from('users')
    .select('role, company_id, is_platform_admin')
    .eq('id', user.id)
    .single()

  return { supabase, user, caller }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function createCompanyWithOwner(payload: {
  companyName:   string
  slug:          string
  ownerFullName: string
  ownerEmail:    string
  ownerPassword: string
}) {
  const admin = getAdmin()
  const { user, caller } = await verifyPlatformAdmin()

  if (!user || !caller?.is_platform_admin) {
    return { error: 'Accès réservé aux administrateurs de la plateforme.' }
  }

  // ── Input validation ──────────────────────────────────────────────────────
  const name     = payload.companyName.trim()
  const slug     = payload.slug.trim().toLowerCase()
  const email    = payload.ownerEmail.trim().toLowerCase()
  const fullName = payload.ownerFullName.trim()
  const password = payload.ownerPassword

  if (!name || name.length < 2)
    return { error: "Le nom de l'entreprise doit contenir au moins 2 caractères." }

  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    return { error: 'Le slug doit contenir uniquement des lettres minuscules, chiffres et tirets.' }

  if (!fullName)
    return { error: 'Le nom complet du propriétaire est requis.' }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: 'Adresse email invalide.' }

  if (password.length < 8)
    return { error: 'Le mot de passe doit contenir au moins 8 caractères.' }

  // ── Slug uniqueness ───────────────────────────────────────────────────────
  const { data: existingSlug } = await admin
    .from('companies')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existingSlug)
    return { error: `Le slug "${slug}" est déjà utilisé par une autre entreprise.` }

  // ── Email uniqueness (global — one account per person across the platform) ─
  const { data: existingEmail } = await admin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existingEmail)
    return { error: 'Un compte avec cette adresse email existe déjà.' }

  // ── Create company ────────────────────────────────────────────────────────
  const { data: company, error: companyError } = await admin
    .from('companies')
    .insert({ name, slug, is_active: true })
    .select('id, name')
    .single()

  if (companyError || !company)
    return { error: companyError?.message ?? "Erreur lors de la création de l'entreprise." }

  // ── Create Supabase Auth user ─────────────────────────────────────────────
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: 'owner' },
  })

  if (authError || !authData.user) {
    await admin.from('companies').delete().eq('id', company.id)
    return { error: authError?.message ?? 'Erreur lors de la création du compte.' }
  }

  const newUserId = authData.user.id

  // ── Upsert user profile ───────────────────────────────────────────────────
  const { error: profileError } = await admin
    .from('users')
    .upsert({
      id:                newUserId,
      email,
      full_name:         fullName,
      role:              'owner',
      company_id:        company.id,
      is_active:         true,
      is_platform_admin: false,
    }, { onConflict: 'id' })

  if (profileError) {
    // Full rollback
    await admin.auth.admin.deleteUser(newUserId)
    await admin.from('companies').delete().eq('id', company.id)
    return { error: profileError.message }
  }

  // ── Audit log (recorded in the platform admin's company context) ──────────
  await admin.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: caller.is_platform_admin ? 'platform_admin' : caller.role,
    action_type:        'COMPANY_CREATED',
    entity_type:        'companies',
    entity_id:          company.id,
    company_id:         caller.company_id,
    data_after:         { name, slug, ownerEmail: email, ownerFullName: fullName },
  })

  revalidatePath('/admin')
  return { success: true, companyId: company.id, companyName: company.name }
}

export async function toggleCompanyActive(companyId: string, isActive: boolean) {
  const admin = getAdmin()
  const { user, caller } = await verifyPlatformAdmin()

  if (!user || !caller?.is_platform_admin)
    return { error: 'Accès réservé aux administrateurs de la plateforme.' }

  // Prevent deactivating the founding company
  if (companyId === '00000000-0000-0000-0000-000000000001' && !isActive)
    return { error: "L'entreprise fondatrice ne peut pas être désactivée." }

  const { error } = await admin
    .from('companies')
    .update({ is_active: isActive })
    .eq('id', companyId)

  if (error) return { error: error.message }

  await admin.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: caller.is_platform_admin ? 'platform_admin' : caller.role,
    action_type:        isActive ? 'COMPANY_ACTIVATED' : 'COMPANY_DEACTIVATED',
    entity_type:        'companies',
    entity_id:          companyId,
    company_id:         caller.company_id,
  })

  revalidatePath('/admin')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────

/** Reset any user's password — platform admin only. */
export async function resetUserPassword(userId: string, newPassword: string) {
  const admin = getAdmin()
  const { user, caller } = await verifyPlatformAdmin()

  if (!user || !caller?.is_platform_admin)
    return { error: 'Accès réservé aux administrateurs de la plateforme.' }

  if (newPassword.length < 8)
    return { error: 'Le mot de passe doit contenir au moins 8 caractères.' }

  // Fetch target user for audit context
  const { data: target } = await admin
    .from('users')
    .select('email, company_id')
    .eq('id', userId)
    .single()

  if (!target) return { error: 'Utilisateur introuvable.' }

  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
  if (error) return { error: error.message }

  await admin.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: caller.is_platform_admin ? 'platform_admin' : caller.role,
    action_type:        'PLATFORM_USER_PASSWORD_RESET',
    entity_type:        'users',
    entity_id:          userId,
    company_id:         caller.company_id,
    data_after:         { target_email: target.email, target_company_id: target.company_id },
  })

  return { success: true }
}

/** Suspend or reactivate any user across any company — platform admin only. */
export async function togglePlatformUserActive(userId: string, isActive: boolean) {
  const admin = getAdmin()
  const { user, caller } = await verifyPlatformAdmin()

  if (!user || !caller?.is_platform_admin)
    return { error: 'Accès réservé aux administrateurs de la plateforme.' }

  if (userId === user.id)
    return { error: 'Impossible de modifier votre propre compte.' }

  const { data: target } = await admin
    .from('users')
    .select('email, company_id, role')
    .eq('id', userId)
    .single()

  if (!target) return { error: 'Utilisateur introuvable.' }

  // Update profile in DB
  const { error: profileError } = await admin
    .from('users')
    .update({ is_active: isActive })
    .eq('id', userId)

  if (profileError) return { error: profileError.message }

  // Reflect in Supabase Auth (ban / unban)
  await admin.auth.admin.updateUserById(userId, {
    ban_duration: isActive ? 'none' : '876000h',
  })

  await admin.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: caller.is_platform_admin ? 'platform_admin' : caller.role,
    action_type:        isActive ? 'PLATFORM_USER_REACTIVATED' : 'PLATFORM_USER_SUSPENDED',
    entity_type:        'users',
    entity_id:          userId,
    company_id:         caller.company_id,
    data_after:         { target_email: target.email, target_company_id: target.company_id, is_active: isActive },
  })

  revalidatePath('/admin')
  return { success: true }
}
