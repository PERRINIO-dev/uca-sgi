import { NextResponse }       from 'next/server'
import { createClient }        from '@/lib/supabase/server'
import { getAdminClient }      from '@/lib/supabase/admin'
import { renderToBuffer }      from '@react-pdf/renderer'
import type { DocumentProps }  from '@react-pdf/renderer'
import { InvoiceDocument }     from '@/lib/pdf/InvoiceDocument'
import type { InvoiceData, InvoiceItem, InvoicePayment } from '@/lib/pdf/types'
import fs   from 'fs'
import path from 'path'
import React from 'react'

// Keep this route in Node.js runtime — @react-pdf/renderer requires Node APIs
export const dynamic = 'force-dynamic'

// ── Logo: load once at module level, cache for the process lifetime ───────────
let LOGO_DATA_URI: string | null = null
try {
  const logoPath = path.join(process.cwd(), 'public', 'MERAM-Logo.jpeg')
  const buf      = fs.readFileSync(logoPath)
  LOGO_DATA_URI  = `data:image/jpeg;base64,${buf.toString('base64')}`
} catch {
  // Logo file missing — PDF will render a cognac initial block instead
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ saleId: string }> },
) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────
  const { saleId } = await params

  if (!saleId || !/^[0-9a-f-]{36}$/i.test(saleId)) {
    return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

  // ── 2. Caller profile ────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('users')
    .select('id, role, company_id, is_active, is_platform_admin, companies(name, currency)')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active || profile.is_platform_admin) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }
  if (profile.role === 'warehouse') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  const companyName = (profile.companies as any)?.name ?? 'SGI'
  const currency    = (profile.companies as any)?.currency ?? 'FCFA'

  // ── 3. Fetch sale (RLS enforces company scope automatically) ─────────────
  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .select(`
      id, sale_number, quote_number, status, created_at,
      customer_name, customer_phone, customer_cni,
      total_amount, amount_paid, payment_status, notes,
      company_id, vendor_id,
      boutiques ( name, address, phone ),
      users!sales_vendor_id_fkey ( full_name ),
      sale_items (
        quantity_tiles, unit_price_per_m2, total_price,
        tile_area_m2_snapshot, tiles_per_carton_snapshot,
        products ( name, reference_code, product_type, unit_label )
      )
    `)
    .eq('id', saleId)
    .neq('status', 'cancelled')
    .single()

  if (saleErr || !sale) {
    return NextResponse.json({ error: 'Document introuvable.' }, { status: 404 })
  }

  // Defense-in-depth: confirm same tenant even though RLS already does this
  if (sale.company_id !== profile.company_id) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  // Vendors can only download their own documents
  const isAdminOrOwner = ['owner', 'manager'].includes(profile.role)
  if (!isAdminOrOwner && sale.vendor_id !== user.id) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  // ── 4. Payment history (use admin client — RLS may restrict vendors) ──────
  const { data: rawPayments } = await getAdminClient()
    .from('sale_payments')
    .select('amount, notes, created_at, users!sale_payments_created_by_fkey(full_name)')
    .eq('sale_id', saleId)
    .order('created_at', { ascending: true })

  // ── 5. Owner name ────────────────────────────────────────────────────────
  const { data: ownerRow } = await supabase
    .from('users')
    .select('full_name')
    .eq('company_id', profile.company_id)
    .eq('role', 'owner')
    .limit(1)
    .single()

  // ── 6. Build InvoiceData ──────────────────────────────────────────────────
  const isDraft   = sale.status === 'draft'
  const docNumber = isDraft ? (sale.quote_number ?? '') : (sale.sale_number ?? '')
  const boutique  = sale.boutiques as any
  const vendor    = sale.users    as any

  const items: InvoiceItem[] = ((sale.sale_items ?? []) as any[]).map(si => ({
    product_name:              si.products?.name ?? '(produit supprimé)',
    reference_code:            si.products?.reference_code ?? null,
    product_type:              si.products?.product_type ?? 'tile',
    unit_label:                si.products?.unit_label ?? 'unité',
    quantity_tiles:            Number(si.quantity_tiles),
    unit_price_per_m2:         Number(si.unit_price_per_m2),
    total_price:               Number(si.total_price),
    tile_area_m2_snapshot:     si.tile_area_m2_snapshot     != null ? Number(si.tile_area_m2_snapshot)     : null,
    tiles_per_carton_snapshot: si.tiles_per_carton_snapshot != null ? Number(si.tiles_per_carton_snapshot) : null,
  }))

  const payments: InvoicePayment[] = ((rawPayments ?? []) as any[]).map(p => ({
    amount:     Number(p.amount),
    notes:      p.notes ?? null,
    created_at: p.created_at,
    payer_name: (p.users as any)?.full_name ?? null,
  }))

  const invoiceData: InvoiceData = {
    doc_number:       docNumber,
    doc_type:         isDraft ? 'quote' : 'sale',
    created_at:       sale.created_at,
    company_name:     companyName,
    currency,
    owner_name:       ownerRow?.full_name ?? 'Le Propriétaire',
    logo_data_uri:    LOGO_DATA_URI,
    boutique_name:    boutique?.name     ?? '',
    boutique_phone:   boutique?.phone    ?? null,
    boutique_address: boutique?.address  ?? null,
    vendor_name:      vendor?.full_name  ?? 'Vendeur',
    customer_name:    sale.customer_name  ?? null,
    customer_phone:   sale.customer_phone ?? null,
    customer_cni:     sale.customer_cni   ?? null,
    total_amount:     Number(sale.total_amount),
    amount_paid:      Number(sale.amount_paid  ?? 0),
    payment_status:   sale.payment_status ?? 'unpaid',
    items,
    payments,
    notes: sale.notes ?? null,
  }

  // ── 7. Render PDF ────────────────────────────────────────────────────────
  let buffer: Buffer
  try {
    const el = React.createElement(InvoiceDocument, { data: invoiceData }) as React.ReactElement<DocumentProps>
    buffer = await renderToBuffer(el)
  } catch (err) {
    console.error('[PDF] renderToBuffer error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du PDF.' },
      { status: 500 },
    )
  }

  const safeNum  = docNumber.replace(/[^a-zA-Z0-9_\-]/g, '_')
  const filename = `Facture_${safeNum}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'private, no-store',
    },
  })
}
