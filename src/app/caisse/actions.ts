'use server'

import { createClient }   from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { auditLog }       from '@/lib/supabase/audit'

// ── Types ────────────────────────────────────────────────────────────────────

export type CashEntryType = 'expense' | 'withdrawal' | 'opening'

export interface CashEntry {
  id:          string
  entry_type:  CashEntryType
  amount:      number
  description: string
  created_by:  string
  created_at:  string
  users:        { full_name: string } | null
}

export interface EspecesPayment {
  id:          string
  amount:      number
  created_at:  string
  notes:       string | null
  sale_id:     string
  sales:       { sale_number: string; customer_name: string | null } | null
}

export interface CashClosing {
  id:               string
  closing_date:     string
  expected_amount:  number
  declared_amount:  number
  difference:       number
  notes:            string | null
  closed_at:        string
  users:            { full_name: string } | null
}

export interface CaisseDay {
  boutique_id:     string
  boutique_name:   string
  date:            string
  payments:        EspecesPayment[]
  entries:         CashEntry[]
  closing:         CashClosing | null
}

// ── Fetch caisse data for a boutique + date ───────────────────────────────────

export async function getCaisseData(
  boutiqueId: string,
  date: string,   // ISO date string 'YYYY-MM-DD'
): Promise<{ data: CaisseDay | null; error: string | null }> {
  if (!boutiqueId || !/^[0-9a-f-]{36}$/i.test(boutiqueId)) {
    return { data: null, error: 'Identifiant boutique invalide.' }
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { data: null, error: 'Date invalide.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id, boutique_id, is_active, is_platform_admin')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active || profile.is_platform_admin) {
    return { data: null, error: 'Accès refusé.' }
  }

  // Vendor can only see their own boutique
  if (profile.role === 'cashier' && profile.boutique_id !== boutiqueId) {
    return { data: null, error: 'Accès refusé.' }
  }

  const dayStart = `${date}T00:00:00`
  const dayEnd   = `${date}T23:59:59.999`

  const [boutiqueRes, paymentsRes, entriesRes, closingRes] = await Promise.all([
    supabase.from('boutiques').select('id, name').eq('id', boutiqueId).single(),

    // Espèces payments for sales of this boutique on this day
    supabase
      .from('sale_payments')
      .select('id, amount, created_at, notes, sale_id, sales!inner(sale_number, customer_name, boutique_id)')
      .eq('payment_method', 'especes')
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd)
      .eq('sales.boutique_id', boutiqueId)
      .order('created_at', { ascending: true }),

    supabase
      .from('cash_entries')
      .select('id, entry_type, amount, description, created_by, created_at, users(full_name)')
      .eq('boutique_id', boutiqueId)
      .eq('entry_date', date)
      .order('created_at', { ascending: true }),

    supabase
      .from('cash_closings')
      .select('id, closing_date, expected_amount, declared_amount, difference, notes, closed_at, users(full_name)')
      .eq('boutique_id', boutiqueId)
      .eq('closing_date', date)
      .maybeSingle(),
  ])

  if (!boutiqueRes.data) return { data: null, error: 'Boutique introuvable.' }

  return {
    data: {
      boutique_id:   boutiqueRes.data.id,
      boutique_name: boutiqueRes.data.name,
      date,
      payments: (paymentsRes.data ?? []).map((p: any) => ({
        id:         p.id,
        amount:     Number(p.amount),
        created_at: p.created_at,
        notes:      p.notes,
        sale_id:    p.sale_id,
        sales:      p.sales ? { sale_number: p.sales.sale_number, customer_name: p.sales.customer_name } : null,
      })),
      entries: (entriesRes.data ?? []).map((e: any) => ({
        id:          e.id,
        entry_type:  e.entry_type as CashEntryType,
        amount:      Number(e.amount),
        description: e.description,
        created_by:  e.created_by,
        created_at:  e.created_at,
        users:       e.users ? { full_name: e.users.full_name } : null,
      })),
      closing: closingRes.data ? {
        id:              closingRes.data.id,
        closing_date:    closingRes.data.closing_date,
        expected_amount: Number(closingRes.data.expected_amount),
        declared_amount: Number(closingRes.data.declared_amount),
        difference:      Number(closingRes.data.difference),
        notes:           closingRes.data.notes,
        closed_at:       closingRes.data.closed_at,
        users:           (closingRes.data.users as any)
          ? { full_name: (closingRes.data.users as any).full_name }
          : null,
      } : null,
    },
    error: null,
  }
}

// ── Fetch closing history for a boutique ─────────────────────────────────────

export async function getCaisseHistory(
  boutiqueId: string,
  limit = 30,
): Promise<{ data: CashClosing[]; error: string | null }> {
  if (!boutiqueId || !/^[0-9a-f-]{36}$/i.test(boutiqueId)) {
    return { data: [], error: 'Identifiant boutique invalide.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users')
    .select('role, boutique_id, is_active, is_platform_admin')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active || profile.is_platform_admin) {
    return { data: [], error: 'Accès refusé.' }
  }

  if (profile.role === 'cashier' && profile.boutique_id !== boutiqueId) {
    return { data: [], error: 'Accès refusé.' }
  }

  const { data, error } = await supabase
    .from('cash_closings')
    .select('id, closing_date, expected_amount, declared_amount, difference, notes, closed_at, users(full_name)')
    .eq('boutique_id', boutiqueId)
    .order('closing_date', { ascending: false })
    .limit(limit)

  if (error) return { data: [], error: error.message }

  return {
    data: (data ?? []).map((c: any) => ({
      id:              c.id,
      closing_date:    c.closing_date,
      expected_amount: Number(c.expected_amount),
      declared_amount: Number(c.declared_amount),
      difference:      Number(c.difference),
      notes:           c.notes,
      closed_at:       c.closed_at,
      users:           c.users ? { full_name: c.users.full_name } : null,
    })),
    error: null,
  }
}

// ── Add a cash entry (expense / withdrawal / opening) ────────────────────────

export async function addCashEntry(payload: {
  boutique_id: string
  entry_date:  string
  entry_type:  CashEntryType
  amount:      number
  description: string
}): Promise<{ error: string | null }> {
  if (!payload.boutique_id || !/^[0-9a-f-]{36}$/i.test(payload.boutique_id)) {
    return { error: 'Identifiant boutique invalide.' }
  }
  if (!payload.entry_date || !/^\d{4}-\d{2}-\d{2}$/.test(payload.entry_date)) {
    return { error: 'Date invalide.' }
  }
  if (!['expense', 'withdrawal', 'opening'].includes(payload.entry_type)) {
    return { error: 'Type de mouvement invalide.' }
  }
  const amount = Math.round(payload.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Le montant doit être un nombre positif.' }
  }
  const description = payload.description.trim()
  if (description.length < 2) {
    return { error: 'Veuillez décrire le mouvement (2 caractères minimum).' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id, boutique_id, is_active, is_platform_admin')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active || profile.is_platform_admin) {
    return { error: 'Accès refusé.' }
  }
  if (profile.role === 'warehouse') return { error: 'Accès refusé.' }

  // Vendor restricted to their boutique
  if (profile.role === 'cashier' && profile.boutique_id !== payload.boutique_id) {
    return { error: 'Accès refusé.' }
  }

  // Verify boutique belongs to the same company
  const { data: boutique } = await supabase
    .from('boutiques')
    .select('id, company_id')
    .eq('id', payload.boutique_id)
    .single()

  if (!boutique || boutique.company_id !== profile.company_id) {
    return { error: 'Boutique introuvable.' }
  }

  // Cannot add entries to a day that's already closed
  const { data: closing } = await supabase
    .from('cash_closings')
    .select('id')
    .eq('boutique_id', payload.boutique_id)
    .eq('closing_date', payload.entry_date)
    .maybeSingle()

  if (closing) {
    return { error: 'La caisse de ce jour est clôturée — aucun mouvement ne peut être ajouté.' }
  }

  const { error } = await supabase.from('cash_entries').insert({
    company_id:  profile.company_id,
    boutique_id: payload.boutique_id,
    entry_date:  payload.entry_date,
    entry_type:  payload.entry_type,
    amount,
    description,
    created_by:  user.id,
  })

  if (error) return { error: error.message }

  revalidatePath('/caisse')
  return { error: null }
}

// ── Clôturer la caisse ────────────────────────────────────────────────────────

export async function closeCaisse(payload: {
  boutique_id:     string
  closing_date:    string
  expected_amount: number
  declared_amount: number
  notes:           string | null
}): Promise<{ error: string | null }> {
  if (!payload.boutique_id || !/^[0-9a-f-]{36}$/i.test(payload.boutique_id)) {
    return { error: 'Identifiant boutique invalide.' }
  }
  if (!payload.closing_date || !/^\d{4}-\d{2}-\d{2}$/.test(payload.closing_date)) {
    return { error: 'Date invalide.' }
  }
  const expected = Math.round(payload.expected_amount)
  const declared = Math.round(payload.declared_amount)
  if (!Number.isFinite(declared) || declared < 0) {
    return { error: 'Le montant déclaré doit être un nombre positif ou nul.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id, boutique_id, is_active, is_platform_admin')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active || profile.is_platform_admin) {
    return { error: 'Accès refusé.' }
  }
  if (profile.role === 'warehouse') return { error: 'Accès refusé.' }

  if (profile.role === 'cashier' && profile.boutique_id !== payload.boutique_id) {
    return { error: 'Accès refusé.' }
  }

  // Verify boutique belongs to this company
  const { data: boutique } = await supabase
    .from('boutiques')
    .select('id, company_id, name')
    .eq('id', payload.boutique_id)
    .single()

  if (!boutique || boutique.company_id !== profile.company_id) {
    return { error: 'Boutique introuvable.' }
  }

  // Insert — UNIQUE constraint on (boutique_id, closing_date) prevents double-close
  const { error } = await supabase.from('cash_closings').insert({
    company_id:      profile.company_id,
    boutique_id:     payload.boutique_id,
    closing_date:    payload.closing_date,
    expected_amount: expected,
    declared_amount: declared,
    difference:      declared - expected,
    notes:           payload.notes?.trim() || null,
    closed_by:       user.id,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: 'La caisse de ce jour est déjà clôturée.' }
    }
    return { error: error.message }
  }

  await auditLog({
    action_type:        'CAISSE_CLOSED',
    entity_type:        'cash_closings',
    entity_id:          payload.boutique_id,
    company_id:         profile.company_id,
    user_id:            user.id,
    user_role_snapshot: profile.role,
    data_after:         { boutique: boutique.name, date: payload.closing_date, expected, declared, difference: declared - expected },
  })

  revalidatePath('/caisse')
  return { error: null }
}
