// ── Bon de Livraison ──────────────────────────────────────────────────────────

export interface BLItem {
  product_name:              string
  reference_code:            string | null
  product_type:              string
  unit_label:                string
  quantity_tiles:            number
  tile_area_m2_snapshot:     number | null
  tiles_per_carton_snapshot: number | null
}

export interface BLData {
  // Document identity
  order_number:     string          // CMD-2026-0001
  sale_number:      string          // VNT-2026-0002
  sale_created_at:  string
  delivery_date:    string | null   // delivery_confirmed_at when available

  // Company
  company_name:     string
  logo_data_uri:    string | null

  // Boutique
  boutique_name:    string
  boutique_address: string | null
  boutique_phone:   string | null

  // People
  vendor_name:      string          // who made the sale
  prepared_by:      string | null   // assigned_to user (warehouse)

  // Customer
  customer_name:    string | null
  customer_phone:   string | null
  customer_cni:     string | null

  // Content
  items:            BLItem[]
  order_notes:      string | null
}

// ── Invoice ───────────────────────────────────────────────────────────────────

export interface InvoiceItem {
  product_name:              string
  reference_code:            string | null
  product_type:              string
  unit_label:                string
  quantity_tiles:            number
  unit_price_per_m2:         number
  total_price:               number
  tile_area_m2_snapshot:     number | null
  tiles_per_carton_snapshot: number | null
}

export interface InvoicePayment {
  amount:     number
  notes:      string | null
  created_at: string
  payer_name: string | null
}

export interface InvoiceData {
  // Document identity
  doc_number:       string          // VNT-2026-0042 or DEV-2026-0001
  doc_type:         'sale' | 'quote'
  created_at:       string

  // Company
  company_name:     string
  currency:         string
  owner_name:       string
  logo_data_uri:    string | null   // base64 data URI embedded in PDF

  // Boutique
  boutique_name:    string
  boutique_phone:   string | null
  boutique_address: string | null

  // Vendor
  vendor_name:      string

  // Customer
  customer_name:    string | null
  customer_phone:   string | null
  customer_cni:     string | null

  // Financials
  total_amount:     number
  amount_paid:      number
  payment_status:   string

  // Content
  items:    InvoiceItem[]
  payments: InvoicePayment[]
  notes:    string | null
}
