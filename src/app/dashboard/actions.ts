'use server'

import { createClient }    from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sendPushToUser } from '@/lib/push/send'

const getAdmin = getAdminClient

async function getCallerProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null }

  const { data: profile } = await supabase
    .from('users').select('role, company_id').eq('id', user.id).single()

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

  // Fetch request details for audit + notification (single query for both)
  const { data: req } = await supabase
    .from('stock_requests')
    .select('requested_by, quantity_tiles_delta, request_type, products(name)')
    .eq('id', requestId)
    .single()

  await getAdmin().from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'STOCK_REQUEST_APPROVED',
    entity_type:        'stock_requests',
    entity_id:          requestId,
    company_id:         profile.company_id,
    data_after: {
      product_name:   (req?.products as any)?.name ?? '',
      request_type:   req?.request_type,
      quantity_delta: req?.quantity_tiles_delta,
      comment:        comment ?? null,
    },
  })

  revalidatePath('/dashboard')
  revalidatePath('/warehouse')
  if (req?.requested_by) {
    sendPushToUser(getAdmin(), req.requested_by, {
      title: 'Demande approuvée',
      body:  `Votre demande de stock pour ${(req.products as any)?.name ?? 'ce produit'} a été approuvée.`,
      url:   '/warehouse',
      tag:   `approved-${requestId}`,
    }).catch(console.error)
  }

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

  // Fetch request details for audit + notification (single query)
  const { data: req } = await supabase
    .from('stock_requests')
    .select('requested_by, quantity_tiles_delta, request_type, products(name)')
    .eq('id', requestId)
    .single()

  await getAdmin().from('audit_logs').insert({
    user_id:            user.id,
    user_role_snapshot: profile.role,
    action_type:        'STOCK_REQUEST_REJECTED',
    entity_type:        'stock_requests',
    entity_id:          requestId,
    company_id:         profile.company_id,
    data_after: {
      product_name:   (req?.products as any)?.name ?? '',
      request_type:   req?.request_type,
      quantity_delta: req?.quantity_tiles_delta,
      comment,
    },
  })

  revalidatePath('/dashboard')
  revalidatePath('/warehouse')
  if (req?.requested_by) {
    sendPushToUser(getAdmin(), req.requested_by, {
      title: 'Demande refusée',
      body:  `Votre demande de stock pour ${(req.products as any)?.name ?? 'ce produit'} a été refusée.${comment ? ` Motif : ${comment}` : ''}`,
      url:   '/warehouse',
      tag:   `rejected-${requestId}`,
    }).catch(console.error)
  }

  return { success: true }
}
