'use server'

import { createClient }    from '@/lib/supabase/server'
import { getAdminClient }  from '@/lib/supabase/admin'
import { revalidatePath }  from 'next/cache'
import { auditLog }        from '@/lib/supabase/audit'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Supplier {
  id:           string
  name:         string
  contact_name: string | null
  phone:        string | null
  email:        string | null
  address:      string | null
  notes:        string | null
  is_active:    boolean
  created_at:   string
}

export interface POItem {
  id:           string
  product_id:   string
  qty_ordered:  number
  unit_price:   number
  qty_received: number
  products:     { name: string; reference_code: string; unit_label: string; product_type: string } | null
}

export interface PurchaseOrder {
  id:            string
  order_number:  string
  supplier_id:   string
  status:        'draft' | 'ordered' | 'partial' | 'received' | 'cancelled'
  expected_date: string | null
  notes:         string | null
  total_amount:  number
  created_at:    string
  received_at:   string | null
  suppliers:     { name: string } | null
  purchase_order_items?: POItem[]
}

// ── Auth guard helper ─────────────────────────────────────────────────────────

async function getOwnerAdminProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null, error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users')
    .select('id, role, company_id, is_active, is_platform_admin')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active || profile.is_platform_admin) {
    return { supabase, user, profile: null, error: 'Accès refusé.' }
  }
  if (!['owner', 'admin'].includes(profile.role)) {
    return { supabase, user, profile: null, error: 'Accès refusé.' }
  }

  return { supabase, user, profile, error: null }
}

// ═══════════════════════════════════════ SUPPLIERS ════════════════════════════

export async function createSupplier(payload: {
  name:         string
  contact_name: string
  phone:        string
  email:        string
  address:      string
  notes:        string
}): Promise<{ error: string | null }> {
  const { supabase, user, profile, error } = await getOwnerAdminProfile()
  if (error || !profile || !user) return { error: error ?? 'Accès refusé.' }

  const name = payload.name.trim()
  if (name.length < 2) return { error: 'Le nom du fournisseur est requis (2 caractères minimum).' }

  const { error: dbErr } = await supabase.from('suppliers').insert({
    company_id:   profile.company_id,
    name,
    contact_name: payload.contact_name.trim() || null,
    phone:        payload.phone.trim()        || null,
    email:        payload.email.trim()        || null,
    address:      payload.address.trim()      || null,
    notes:        payload.notes.trim()        || null,
  })

  if (dbErr) return { error: dbErr.message }
  revalidatePath('/suppliers')
  return { error: null }
}

export async function updateSupplier(
  supplierId: string,
  payload: {
    name:         string
    contact_name: string
    phone:        string
    email:        string
    address:      string
    notes:        string
  },
): Promise<{ error: string | null }> {
  if (!supplierId || !/^[0-9a-f-]{36}$/i.test(supplierId)) {
    return { error: 'Identifiant invalide.' }
  }

  const { supabase, profile, error } = await getOwnerAdminProfile()
  if (error || !profile) return { error: error ?? 'Accès refusé.' }

  const name = payload.name.trim()
  if (name.length < 2) return { error: 'Le nom du fournisseur est requis.' }

  const { error: dbErr } = await supabase
    .from('suppliers')
    .update({
      name,
      contact_name: payload.contact_name.trim() || null,
      phone:        payload.phone.trim()        || null,
      email:        payload.email.trim()        || null,
      address:      payload.address.trim()      || null,
      notes:        payload.notes.trim()        || null,
    })
    .eq('id', supplierId)

  if (dbErr) return { error: dbErr.message }
  revalidatePath('/suppliers')
  return { error: null }
}

export async function toggleSupplierActive(
  supplierId: string,
  isActive:   boolean,
): Promise<{ error: string | null }> {
  if (!supplierId || !/^[0-9a-f-]{36}$/i.test(supplierId)) {
    return { error: 'Identifiant invalide.' }
  }

  const { supabase, profile, error } = await getOwnerAdminProfile()
  if (error || !profile) return { error: error ?? 'Accès refusé.' }

  const { error: dbErr } = await supabase
    .from('suppliers')
    .update({ is_active: isActive })
    .eq('id', supplierId)

  if (dbErr) return { error: dbErr.message }
  revalidatePath('/suppliers')
  return { error: null }
}

// ═════════════════════════════════════ PURCHASE ORDERS ════════════════════════

export async function createPurchaseOrder(payload: {
  supplier_id:   string
  items:         { product_id: string; qty_ordered: number; unit_price: number }[]
  expected_date: string | null
  notes:         string
}): Promise<{ error: string | null; order_number?: string }> {
  if (!payload.supplier_id || !/^[0-9a-f-]{36}$/i.test(payload.supplier_id)) {
    return { error: 'Fournisseur invalide.' }
  }
  if (!payload.items || payload.items.length === 0) {
    return { error: 'Au moins un article est requis.' }
  }

  const { supabase, user, profile, error } = await getOwnerAdminProfile()
  if (error || !profile || !user) return { error: error ?? 'Accès refusé.' }

  // Validate supplier belongs to this company
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, is_active')
    .eq('id', payload.supplier_id)
    .single()

  if (!supplier) return { error: 'Fournisseur introuvable.' }
  if (!supplier.is_active) return { error: 'Ce fournisseur est inactif.' }

  // Validate items
  for (const item of payload.items) {
    if (!item.product_id || !/^[0-9a-f-]{36}$/i.test(item.product_id)) {
      return { error: 'Produit invalide.' }
    }
    if (!Number.isFinite(item.qty_ordered) || item.qty_ordered <= 0) {
      return { error: 'Quantité invalide.' }
    }
    if (!Number.isFinite(item.unit_price) || item.unit_price < 0) {
      return { error: 'Prix unitaire invalide.' }
    }
  }

  const total = Math.round(
    payload.items.reduce((s, i) => s + i.qty_ordered * i.unit_price, 0)
  )

  // Insert order (trigger sets order_number)
  const { data: order, error: orderErr } = await supabase
    .from('purchase_orders')
    .insert({
      company_id:    profile.company_id,
      supplier_id:   payload.supplier_id,
      order_number:  '',
      expected_date: payload.expected_date || null,
      notes:         payload.notes.trim() || null,
      total_amount:  total,
      created_by:    user.id,
    })
    .select('id, order_number')
    .single()

  if (orderErr || !order) return { error: orderErr?.message ?? 'Erreur lors de la création.' }

  // Insert items
  const itemRows = payload.items.map(i => ({
    company_id:   profile.company_id,
    order_id:     order.id,
    product_id:   i.product_id,
    qty_ordered:  i.qty_ordered,
    unit_price:   Math.round(i.unit_price),
    qty_received: 0,
  }))

  const { error: itemsErr } = await supabase.from('purchase_order_items').insert(itemRows)
  if (itemsErr) return { error: itemsErr.message }

  revalidatePath('/suppliers')
  return { error: null, order_number: order.order_number }
}

export async function markPOOrdered(orderId: string): Promise<{ error: string | null }> {
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return { error: 'Identifiant invalide.' }
  }

  const { supabase, profile, error } = await getOwnerAdminProfile()
  if (error || !profile) return { error: error ?? 'Accès refusé.' }

  const { error: dbErr } = await supabase
    .from('purchase_orders')
    .update({ status: 'ordered' })
    .eq('id', orderId)
    .eq('status', 'draft')  // only from draft

  if (dbErr) return { error: dbErr.message }
  revalidatePath('/suppliers')
  return { error: null }
}

export async function cancelPO(orderId: string): Promise<{ error: string | null }> {
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return { error: 'Identifiant invalide.' }
  }

  const { supabase, profile, error } = await getOwnerAdminProfile()
  if (error || !profile) return { error: error ?? 'Accès refusé.' }

  const { error: dbErr } = await supabase
    .from('purchase_orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .in('status', ['draft', 'ordered'])

  if (dbErr) return { error: dbErr.message }
  revalidatePath('/suppliers')
  return { error: null }
}

export async function receivePOItems(
  orderId: string,
  receipts: { item_id: string; qty: number }[],
): Promise<{ error: string | null; new_status?: string }> {
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return { error: 'Identifiant invalide.' }
  }
  if (!receipts || receipts.length === 0) {
    return { error: 'Aucune quantité renseignée.' }
  }
  if (receipts.every(r => r.qty <= 0)) {
    return { error: 'Renseignez au moins une quantité reçue.' }
  }

  const { profile, error } = await getOwnerAdminProfile()
  if (error || !profile) return { error: error ?? 'Accès refusé.' }

  const { data, error: rpcErr } = await getAdminClient().rpc('receive_po_items', {
    p_order_id: orderId,
    p_receipts: receipts,
  })

  if (rpcErr) return { error: rpcErr.message }
  revalidatePath('/suppliers')
  return { error: null, new_status: data as string }
}
