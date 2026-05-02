// ─────────────────────────────────────────────────────────────────────────────
// Rôles utilisateurs — 8 rôles terrain
// ─────────────────────────────────────────────────────────────────────────────
export type UserRole =
  | 'owner'        // Propriétaire — accès total, visibilité financière complète
  | 'manager'      // Gérant boutique — supervision opérationnelle, scope boutique(s)
  | 'seller'       // Vendeur — création ventes/devis, conseil client
  | 'cashier'      // Caissier — encaissement uniquement
  | 'warehouse'    // Magasinier — stock, réceptions, préparations, livraisons
  | 'delivery'     // Livreur — livraisons assignées, interface mobile
  | 'accountant'   // Comptable — lecture financière complète, aucune écriture
  | 'field_agent'  // Commercial terrain — soumet des devis pour validation

// Groupes fonctionnels — utilisés dans les guards pages et actions
export const ROLES = {
  management:     ['owner', 'manager']                                                   as UserRole[],
  commercial:     ['owner', 'manager', 'seller', 'field_agent']                          as UserRole[],
  payment:        ['owner', 'manager', 'cashier']                                        as UserRole[],
  stock:          ['owner', 'manager', 'warehouse']                                      as UserRole[],
  financial:      ['owner', 'accountant']                                                as UserRole[],
  purchasing:     ['owner', 'manager', 'warehouse', 'accountant']                        as UserRole[],
  customerFacing: ['owner', 'manager', 'seller', 'field_agent']                          as UserRole[],
  allOps:         ['owner', 'manager', 'seller', 'cashier', 'warehouse', 'field_agent']  as UserRole[],
} as const

// Page d'accueil par rôle — utilisée dans les redirects
export const ROLE_LANDING: Record<UserRole, string> = {
  owner:       '/dashboard',
  manager:     '/dashboard',
  seller:      '/sales/new',
  cashier:     '/caisse',
  warehouse:   '/warehouse',
  delivery:    '/deliveries',
  accountant:  '/reports',
  field_agent: '/pipeline',
}

// Libellés terrain
export const ROLE_LABELS: Record<UserRole, string> = {
  owner:       'Propriétaire',
  manager:     'Gérant',
  seller:      'Vendeur',
  cashier:     'Caissier',
  warehouse:   'Magasinier',
  delivery:    'Livreur',
  accountant:  'Comptable',
  field_agent: 'Commercial terrain',
}

// ─────────────────────────────────────────────────────────────────────────────
// Types produit
// ─────────────────────────────────────────────────────────────────────────────
export type ProductType = 'tile' | 'unit' | 'linear_m' | 'bag' | 'liter'

export type PaymentMethod = 'especes' | 'mobile_money' | 'virement' | 'cheque' | 'autre'

export type SaleStatus =
  | 'draft'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled'

export type StockRequestStatus = 'pending' | 'approved' | 'rejected'
export type StockRequestType   = 'stock_in' | 'correction'

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────────────────────
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

export interface ProductCategory {
  id:           string
  company_id:   string
  product_type: ProductType
  name:         string
  slug:         string
  usage_count:  number
  created_at:   string
}

export interface Product {
  id:             string
  reference_code: string
  name:           string
  category:       string
  category_id:    string | null
  supplier:       string
  is_active:      boolean
  company_id:     string

  product_type:  ProductType
  unit_label:    string
  package_label: string

  // Tile-specific
  width_cm:               number | null
  height_cm:              number | null
  tiles_per_carton:       number | null
  tile_area_m2:           number | null
  carton_area_m2:         number | null
  floor_price_per_m2:     number | null
  reference_price_per_m2: number | null

  // Generic pricing
  floor_price_per_unit:     number | null
  reference_price_per_unit: number | null

  // Type-specific attributes
  piece_length_m:     number | null
  container_volume_l: number | null
  bag_weight_kg:      number | null
  pieces_per_package: number | null

  // Sensitive — visible uniquement owner + accountant
  purchase_price: number | null
}

export interface StockView {
  product_id:             string
  reference_code:         string
  product_name:           string
  tiles_per_carton:       number
  tile_area_m2:           number
  total_qty:              number
  reserved_qty:           number
  available_qty:          number
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
