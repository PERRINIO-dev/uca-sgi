-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260419_customers
--
-- Introduces a first-class customer record system:
--   1. customers table with company-scoped RLS
--   2. sales.customer_id nullable FK (existing rows unaffected)
--   3. get_customers_with_stats() SECURITY INVOKER RPC
--   4. CUSTOMER_* audit action types
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. customers table ────────────────────────────────────────────────────────

CREATE TABLE customers (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID        NOT NULL REFERENCES companies(id),
  full_name  TEXT        NOT NULL CHECK (char_length(trim(full_name)) >= 2),
  phone      TEXT,
  phone2     TEXT,
  cni        TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast autocomplete: name fragment search and phone lookup
CREATE INDEX customers_name_idx  ON customers (company_id, lower(full_name));
CREATE INDEX customers_phone_idx ON customers (company_id, phone) WHERE phone IS NOT NULL;

-- ── 2. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- All selling roles can read their company's customers (needed for autocomplete)
CREATE POLICY customers_select ON customers FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

-- Vendors can create customers; admin/owner can also create
CREATE POLICY customers_insert ON customers FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('vendor', 'admin', 'owner')
  );

-- Edit restricted to admin/owner to prevent vendor data tampering
CREATE POLICY customers_update ON customers FOR UPDATE TO authenticated
  USING  (company_id = get_my_company_id())
  WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('admin', 'owner')
  );

-- Delete restricted to admin/owner
CREATE POLICY customers_delete ON customers FOR DELETE TO authenticated
  USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('admin', 'owner')
  );

-- ── 3. updated_at trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _set_customers_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION _set_customers_updated_at();

-- ── 4. sales.customer_id FK ──────────────────────────────────────────────────
-- Nullable: existing rows are unaffected and the link is optional per sale.
-- ON DELETE SET NULL: deleting a customer record never deletes their sales history.

ALTER TABLE sales
  ADD COLUMN customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;

CREATE INDEX sales_customer_id_idx ON sales (customer_id)
  WHERE customer_id IS NOT NULL;

-- ── 5. Audit action types ─────────────────────────────────────────────────────

ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'CUSTOMER_CREATED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'CUSTOMER_UPDATED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'CUSTOMER_DELETED';

-- ── 6. get_customers_with_stats() RPC ────────────────────────────────────────
-- Returns every customer for the caller's company with aggregated sales stats.
-- SECURITY INVOKER: runs as the calling user — RLS on customers and sales
-- filters rows to the caller's tenant automatically.

CREATE OR REPLACE FUNCTION get_customers_with_stats()
RETURNS TABLE (
  id                  UUID,
  full_name           TEXT,
  phone               TEXT,
  phone2              TEXT,
  cni                 TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ,
  sale_count          BIGINT,
  total_spent         NUMERIC,
  outstanding_balance NUMERIC,
  last_sale_at        TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT
    c.id,
    c.full_name,
    c.phone,
    c.phone2,
    c.cni,
    c.notes,
    c.created_at,
    c.updated_at,
    COUNT(s.id)                                                                  AS sale_count,
    COALESCE(
      SUM(s.total_amount)
        FILTER (WHERE s.status NOT IN ('cancelled', 'draft')),
      0
    )::numeric                                                                   AS total_spent,
    COALESCE(
      SUM(s.total_amount - COALESCE(s.amount_paid, 0))
        FILTER (WHERE s.status NOT IN ('cancelled', 'draft')
          AND s.payment_status != 'paid'),
      0
    )::numeric                                                                   AS outstanding_balance,
    MAX(s.created_at)
      FILTER (WHERE s.status NOT IN ('cancelled', 'draft'))                      AS last_sale_at
  FROM customers c
  LEFT JOIN sales s ON s.customer_id = c.id AND s.company_id = c.company_id
  WHERE c.company_id = get_my_company_id()
  GROUP BY c.id, c.full_name, c.phone, c.phone2, c.cni, c.notes, c.created_at, c.updated_at
  ORDER BY c.full_name;
$$;

-- ── 7. Update create_confirmed_sale() to store customer_id ───────────────────
-- Drop and recreate with the extra p_customer_id parameter (DEFAULT NULL keeps
-- all existing callers working without changes until they opt in).

DROP FUNCTION IF EXISTS create_confirmed_sale(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, UUID, JSONB);

CREATE OR REPLACE FUNCTION create_confirmed_sale(
  p_boutique_id    UUID,
  p_vendor_id      UUID,
  p_customer_name  TEXT,
  p_customer_phone TEXT,
  p_customer_cni   TEXT,
  p_total_amount   NUMERIC,
  p_amount_paid    NUMERIC,
  p_payment_status TEXT,
  p_notes          TEXT,
  p_company_id     UUID,
  p_items          JSONB,
  p_customer_id    UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id     UUID;
  v_sale_number TEXT;
BEGIN
  INSERT INTO sales (
    boutique_id,     vendor_id,        customer_name,
    customer_phone,  customer_cni,     total_amount,
    amount_paid,     payment_status,   notes,
    status,          sale_number,      company_id,
    customer_id
  )
  VALUES (
    p_boutique_id,   p_vendor_id,      p_customer_name,
    p_customer_phone, p_customer_cni,  p_total_amount,
    p_amount_paid,   p_payment_status, p_notes,
    'confirmed',     '',               p_company_id,
    p_customer_id
  )
  RETURNING id, sale_number INTO v_sale_id, v_sale_number;

  INSERT INTO sale_items (
    sale_id,          product_id,                  company_id,
    quantity_tiles,   unit_price_per_m2,            total_price,
    floor_price_snapshot,   reference_price_snapshot,
    purchase_price_snapshot, tile_area_m2_snapshot,
    tiles_per_carton_snapshot
  )
  SELECT
    v_sale_id,
    (item->>'product_id')::UUID,
    p_company_id,
    (item->>'quantity_tiles')::NUMERIC,
    (item->>'unit_price_per_m2')::NUMERIC,
    (item->>'total_price')::NUMERIC,
    (item->>'floor_price_snapshot')::NUMERIC,
    (item->>'reference_price_snapshot')::NUMERIC,
    (item->>'purchase_price_snapshot')::NUMERIC,
    (item->>'tile_area_m2_snapshot')::NUMERIC,
    (item->>'tiles_per_carton_snapshot')::NUMERIC
  FROM jsonb_array_elements(p_items) AS item;

  IF NOT reserve_sale_items(v_sale_id) THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK';
  END IF;

  INSERT INTO orders (sale_id, order_number, status, company_id)
  VALUES (v_sale_id, '', 'confirmed', p_company_id);

  RETURN jsonb_build_object('sale_id', v_sale_id, 'sale_number', v_sale_number);
END;
$$;

GRANT EXECUTE ON FUNCTION create_confirmed_sale(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, UUID, JSONB, UUID) TO service_role;

COMMIT;
