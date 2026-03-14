export type UserRole = 'owner' | 'admin' | 'vendor' | 'warehouse'

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
  id:                      string
  reference_code:          string
  name:                    string
  category:                string
  supplier:                string
  width_cm:                number
  height_cm:               number
  tiles_per_carton:        number
  tile_area_m2:            number
  carton_area_m2:          number
  floor_price_per_m2:      number
  reference_price_per_m2:  number
  is_active:               boolean
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
