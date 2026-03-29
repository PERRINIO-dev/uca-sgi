export type UserRole = 'owner' | 'admin' | 'vendor' | 'warehouse'

/**
 * Product unit type — defines how a product is measured, priced and stocked.
 *
 * tile      : carreaux et revêtements m² (logique existante inchangée)
 * unit      : produit vendu à la pièce (sanitaire, robinetterie, meuble, accessoire)
 * linear_m  : produit vendu au mètre linéaire (profilés, plinthes, seuils)
 * bag       : produit vendu au sac (colle, joint, ciment, enduit)
 * liter     : produit vendu au litre (peinture, étanchéité, produits liquides)
 */
export type ProductType = 'tile' | 'unit' | 'linear_m' | 'bag' | 'liter'

export type SaleStatus =
  | 'draft'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled'

export type StockRequestStatus = 'pending' | 'approved' | 'rejected'
export type StockRequestType   = 'stock_in' | 'correction'

export interface UserProfile {
  id:          string
  full_name:   string
  email:       string
  role:        UserRole
  boutique_id: string | null
  is_active:   boolean
}

export interface Boutique {
  id:        string
  name:      string
  is_active: boolean
}

export interface Product {
  id:             string
  reference_code: string
  name:           string
  category:       string
  supplier:       string
  is_active:      boolean
  company_id:     string

  // ── Product type ───────────────────────────────────────────────────────────
  product_type:  ProductType
  unit_label:    string   // display unit : 'm²', 'pièce', 'm', 'sac', 'L'
  package_label: string   // packaging    : 'carton', 'boîte', 'palette', 'lot'

  // ── Tile-specific fields (product_type = 'tile') ───────────────────────────
  // These fields remain unchanged — the tile logic is never touched.
  width_cm:               number | null
  height_cm:              number | null
  tiles_per_carton:       number | null
  tile_area_m2:           number | null
  carton_area_m2:         number | null
  floor_price_per_m2:     number | null
  reference_price_per_m2: number | null

  // ── Generic pricing (non-tile types) ──────────────────────────────────────
  floor_price_per_unit:     number | null  // prix plancher par unit_label
  reference_price_per_unit: number | null  // prix de référence par unit_label

  // ── Type-specific physical attributes ─────────────────────────────────────
  piece_length_m:     number | null  // linear_m : longueur d'une barre/pièce (m)
  container_volume_l: number | null  // liter    : volume par contenant (L)
  bag_weight_kg:      number | null  // bag      : poids par sac (kg)
  pieces_per_package: number | null  // unit/bag/liter : unités par lot/boîte (optionnel)

  // ── Purchase price (universal — per unit_label for any type) ──────────────
  purchase_price: number | null
}

export interface StockView {
  product_id:             string
  reference_code:         string
  product_name:           string
  tiles_per_carton:       number
  tile_area_m2:           number
  total_tiles:            number
  reserved_tiles:         number
  available_tiles:        number
  full_cartons:           number
  loose_tiles:            number
  available_full_cartons: number
  total_m2:               number
  available_m2:           number
  last_updated_at:        string
}

export interface Sale {
  id:            string
  created_at:    string
  sale_number:   string
  boutique_id:   string
  vendor_id:     string
  customer_name: string | null
  status:        SaleStatus
  total_amount:  number
  boutiques:     { name: string } | null
  users:         { full_name: string } | null
}

export interface StockRequest {
  id:                   string
  created_at:           string
  product_id:           string
  request_type:         StockRequestType
  quantity_tiles_delta: number
  justification:        string
  status:               StockRequestStatus
  review_comment:       string | null
  stock_before_tiles:   number
  products:             { name: string; reference_code: string } | null
  users:                { full_name: string } | null
}
