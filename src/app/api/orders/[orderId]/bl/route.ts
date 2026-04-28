import { NextResponse }      from 'next/server'
import { createClient }       from '@/lib/supabase/server'
import { getAdminClient }     from '@/lib/supabase/admin'
import { renderToBuffer }     from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { BLDocument }         from '@/lib/pdf/BLDocument'
import type { BLData, BLItem } from '@/lib/pdf/types'
import fs   from 'fs'
import path from 'path'
import React from 'react'

export const dynamic = 'force-dynamic'

// ── Logo: loaded once, cached for the process lifetime ────────────────────────
let LOGO_DATA_URI: string | null = null
try {
  const logoPath = path.join(process.cwd(), 'public', 'logo.jpeg')
  const buf      = fs.readFileSync(logoPath)
  LOGO_DATA_URI  = `data:image/jpeg;base64,${buf.toString('base64')}`
} catch {
  // No logo — BL will render without it
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  // ── 1. Input validation ───────────────────────────────────────────────────
  const { orderId } = await params
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 })
  }

  // ── 2. Auth ───────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

  // ── 3. Caller profile ─────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('users')
    .select('id, role, company_id, is_active, is_platform_admin, companies(name, currency)')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active || profile.is_platform_admin) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  const companyName = (profile.companies as any)?.name ?? 'SGI'

  // ── 4. Fetch order with full context (admin client for RLS bypass on join) ─
  // We use admin client so that the warehouse role (which can't query sales
  // directly) can still generate the BL for an order they're delivering.
  const { data: order, error: orderErr } = await getAdminClient()
    .from('orders')
    .select(`
      id, order_number, status, notes,
      delivery_confirmed_at, assigned_to, company_id,
      sales (
        id, sale_number, created_at, vendor_id,
        customer_name, customer_phone, customer_cni,
        boutiques ( name, address, phone ),
        users!sales_vendor_id_fkey ( full_name ),
        sale_items (
          quantity_tiles,
          tile_area_m2_snapshot,
          tiles_per_carton_snapshot,
          products ( name, reference_code, product_type, unit_label )
        )
      )
    `)
    .eq('id', orderId)
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 })
  }

  // ── 5. Tenant isolation (defense-in-depth on top of RLS) ──────────────────
  if (order.company_id !== profile.company_id) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  // ── 6. Status guard — BL only makes sense once goods are ready ────────────
  if (!['ready', 'delivered'].includes(order.status)) {
    return NextResponse.json(
      { error: 'Le bon de livraison est disponible uniquement quand la commande est prête ou livrée.' },
      { status: 422 },
    )
  }

  // ── 7. Resolve warehouse preparer name (if assigned) ──────────────────────
  let preparedByName: string | null = null
  if (order.assigned_to) {
    const { data: preparer } = await getAdminClient()
      .from('users')
      .select('full_name')
      .eq('id', order.assigned_to)
      .single()
    preparedByName = preparer?.full_name ?? null
  }

  // ── 8. Build BLData ───────────────────────────────────────────────────────
  const sale    = order.sales      as any
  const boutique = sale?.boutiques as any
  const vendor   = sale?.users     as any

  const items: BLItem[] = ((sale?.sale_items ?? []) as any[]).map((si: any) => ({
    product_name:              si.products?.name             ?? '(produit supprimé)',
    reference_code:            si.products?.reference_code   ?? null,
    product_type:              si.products?.product_type     ?? 'tile',
    unit_label:                si.products?.unit_label       ?? 'unité',
    quantity_tiles:            Number(si.quantity_tiles),
    tile_area_m2_snapshot:     si.tile_area_m2_snapshot     != null ? Number(si.tile_area_m2_snapshot)     : null,
    tiles_per_carton_snapshot: si.tiles_per_carton_snapshot != null ? Number(si.tiles_per_carton_snapshot) : null,
  }))

  const blData: BLData = {
    order_number:     order.order_number,
    sale_number:      sale?.sale_number   ?? '—',
    sale_created_at:  sale?.created_at    ?? new Date().toISOString(),
    delivery_date:    order.delivery_confirmed_at ?? null,
    company_name:     companyName,
    logo_data_uri:    LOGO_DATA_URI,
    boutique_name:    boutique?.name     ?? '',
    boutique_address: boutique?.address  ?? null,
    boutique_phone:   boutique?.phone    ?? null,
    vendor_name:      vendor?.full_name  ?? 'Vendeur',
    prepared_by:      preparedByName,
    customer_name:    sale?.customer_name  ?? null,
    customer_phone:   sale?.customer_phone ?? null,
    customer_cni:     sale?.customer_cni   ?? null,
    items,
    order_notes:      order.notes ?? null,
  }

  // ── 9. Render PDF ─────────────────────────────────────────────────────────
  let buffer: Buffer
  try {
    const el = React.createElement(BLDocument, { data: blData }) as React.ReactElement<DocumentProps>
    buffer = await renderToBuffer(el)
  } catch (err) {
    console.error('[BL PDF] renderToBuffer error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du bon de livraison.' },
      { status: 500 },
    )
  }

  const safeNum  = order.order_number.replace(/[^a-zA-Z0-9_\-]/g, '_')
  const filename = `BL_${safeNum}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'private, no-store',
    },
  })
}
