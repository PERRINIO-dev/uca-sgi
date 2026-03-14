'use server'

import { createClient }   from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getCallerProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null }

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()

  return { supabase, user, profile }
}

export async function approveStockRequest(
  requestId: string,
  comment?:  string
) {
  const { supabase, user, profile } = await getCallerProfile()
  if (!user || !profile) return { error: 'Non authentifié.' }
  if (!['owner', 'admin'].includes(profile.role)) return { error: 'Accès refusé.' }

  // 1. Mark as approved
  const { error } = await supabase
    .from('stock_requests')
    .update({
      status:         'approved',
      reviewed_by:    user.id,
      reviewed_at:    new Date().toISOString(),
      review_comment: comment ?? null,
    })
    .eq('id', requestId)
    .eq('status', 'pending')

  if (error) return { error: error.message }

  // 2. Apply stock change via SECURITY DEFINER RPC
  const { error: rpcError } = await supabase
    .rpc('apply_approved_stock_request', { request_id: requestId })

  if (rpcError) return { error: rpcError.message }

  await supabase.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'STOCK_REQUEST_APPROVED',
    entity_type:        'stock_requests',
    entity_id:          requestId,
  })

  revalidatePath('/dashboard')
  revalidatePath('/warehouse')
  return { success: true }
}

export async function rejectStockRequest(
  requestId: string,
  comment:   string
) {
  const { supabase, user, profile } = await getCallerProfile()
  if (!user || !profile) return { error: 'Non authentifié.' }
  if (!['owner', 'admin'].includes(profile.role)) return { error: 'Accès refusé.' }

  const { error } = await supabase
    .from('stock_requests')
    .update({
      status:         'rejected',
      reviewed_by:    user.id,
      reviewed_at:    new Date().toISOString(),
      review_comment: comment,
    })
    .eq('id', requestId)
    .eq('status', 'pending')

  if (error) return { error: error.message }

  await supabase.from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'STOCK_REQUEST_REJECTED',
    entity_type:        'stock_requests',
    entity_id:          requestId,
    data_after:         { comment },
  })

  revalidatePath('/dashboard')
  return { success: true }
}
