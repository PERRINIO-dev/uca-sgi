import { NextResponse }     from 'next/server'
import { createClient }     from '@/lib/supabase/server'
import { renderToBuffer }   from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import { PODocument }       from '@/lib/pdf/PODocument'
import type { PODocData }   from '@/lib/pdf/PODocument'
import React from 'react'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, role, company_id, full_name, is_active, is_platform_admin')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active || profile.is_platform_admin) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }
  if (!['owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  // Fetch order with supplier + items + products
  const { data: order, error: orderErr } = await supabase
    .from('purchase_orders')
    .select(`
      id, order_number, status, expected_date, notes, created_at, company_id,
      suppliers (
        name, contact_name, phone, email, address
      ),
      purchase_order_items (
        qty_ordered, unit_price,
        products ( name, reference_code, unit_label, product_type )
      ),
      users!purchase_orders_created_by_fkey ( full_name )
    `)
    .eq('id', orderId)
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 })
  }

  // Tenant isolation
  if (order.company_id !== profile.company_id) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  // Fetch company name + currency
  const { data: company } = await supabase
    .from('companies')
    .select('name, currency')
    .eq('id', profile.company_id)
    .single()

  const currency    = (company as any)?.currency ?? 'FCFA'
  const companyName = (company as any)?.name     ?? 'SGI'
  const supplier    = order.suppliers as any
  const items       = (order.purchase_order_items as any[]) ?? []

  const poData: PODocData = {
    order_number:     order.order_number,
    created_at:       order.created_at,
    expected_date:    order.expected_date,
    notes:            order.notes,
    company_name:     companyName,
    supplier_name:    supplier?.name         ?? '—',
    supplier_contact: supplier?.contact_name ?? null,
    supplier_phone:   supplier?.phone        ?? null,
    supplier_email:   supplier?.email        ?? null,
    supplier_address: supplier?.address      ?? null,
    ordered_by:       (order.users as any)?.full_name ?? profile.full_name,
    currency,
    items: items.map((i: any) => ({
      product_name:   i.products?.name           ?? '(produit supprimé)',
      reference_code: i.products?.reference_code ?? null,
      unit_label:     i.products?.unit_label      ?? 'unité',
      qty_ordered:    Number(i.qty_ordered),
      unit_price:     Number(i.unit_price),
    })),
  }

  let buffer: Buffer
  try {
    const el = React.createElement(PODocument, { data: poData }) as React.ReactElement<DocumentProps>
    buffer = await renderToBuffer(el)
  } catch (err) {
    console.error('[PO PDF] renderToBuffer error:', err)
    return NextResponse.json({ error: 'Erreur lors de la génération du PDF.' }, { status: 500 })
  }

  const safeNum  = order.order_number.replace(/[^a-zA-Z0-9_\-]/g, '_')
  const filename = `BC_${safeNum}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'private, no-store',
    },
  })
}
