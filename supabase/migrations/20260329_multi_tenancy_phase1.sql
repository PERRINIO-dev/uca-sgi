-- ═══════════════════════════════════════════════════════════════════════════════
-- UCA SGI — Multi-tenancy Phase 1
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Strategy: non-destructive
--   1. Create companies table + seed UCA
--   2. Add nullable company_id columns to every tenant table
--   3. Backfill all existing rows → UCA UUID
--   4. Enforce NOT NULL + foreign keys
--   5. Scope reference_code uniqueness per company
--   6. Create SECURITY DEFINER helpers (get_my_company_id, get_my_role)
--   7. Rewrite set_sale_number / set_order_number triggers (per-company seq)
--   8. Recreate stock_view with security_invoker = on
--   9. Drop all old RLS policies (via pg_policies scan)
--  10. Recreate all RLS policies with company_id scoping
--
-- Run once in the Supabase SQL editor.  Safe to re-run — most steps are
-- idempotent (IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT DO NOTHING).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. companies
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS companies (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the founding company with a stable, well-known UUID so every
-- existing row can be backfilled with a simple literal.
INSERT INTO companies (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'UCA', 'uca')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add company_id (nullable) to every tenant table
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE boutiques      ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE users          ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE products       ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE stock          ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE sales          ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE sale_items     ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE sale_payments  ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE orders         ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE audit_logs     ADD COLUMN IF NOT EXISTS company_id UUID;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Backfill all existing rows → UCA
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE boutiques      SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE users          SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE products       SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE stock          SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE stock_requests SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE sales          SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE sale_items     SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE sale_payments  SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE orders         SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE audit_logs     SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. NOT NULL + foreign keys
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE boutiques      ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE users          ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE products       ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE stock          ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE stock_requests ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE sales          ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE sale_items     ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE sale_payments  ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE orders         ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE audit_logs     ALTER COLUMN company_id SET NOT NULL;

-- Add FK constraints (idempotent via name uniqueness — re-run will error if
-- constraint already exists, but the migration won't be re-run in production).
ALTER TABLE boutiques      ADD CONSTRAINT boutiques_company_id_fk
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE users          ADD CONSTRAINT users_company_id_fk
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE products       ADD CONSTRAINT products_company_id_fk
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE stock          ADD CONSTRAINT stock_company_id_fk
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE stock_requests ADD CONSTRAINT stock_requests_company_id_fk
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE sales          ADD CONSTRAINT sales_company_id_fk
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE sale_items     ADD CONSTRAINT sale_items_company_id_fk
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE sale_payments  ADD CONSTRAINT sale_payments_company_id_fk
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE orders         ADD CONSTRAINT orders_company_id_fk
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE audit_logs     ADD CONSTRAINT audit_logs_company_id_fk
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Performance indexes on company_id
--    (RLS policies use get_my_company_id() in USING clauses — these indexes
--     let Postgres satisfy those filters efficiently as data grows.)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_boutiques_company_id      ON boutiques      (company_id);
CREATE INDEX IF NOT EXISTS idx_users_company_id          ON users          (company_id);
CREATE INDEX IF NOT EXISTS idx_products_company_id       ON products       (company_id);
CREATE INDEX IF NOT EXISTS idx_stock_company_id          ON stock          (company_id);
CREATE INDEX IF NOT EXISTS idx_stock_requests_company_id ON stock_requests (company_id);
CREATE INDEX IF NOT EXISTS idx_sales_company_id          ON sales          (company_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_company_id     ON sale_items     (company_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_company_id  ON sale_payments  (company_id);
CREATE INDEX IF NOT EXISTS idx_orders_company_id         ON orders         (company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id     ON audit_logs     (company_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Scope reference_code uniqueness per company
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop any existing global unique constraint on reference_code (name varies)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT constraint_name
    FROM   information_schema.table_constraints
    WHERE  table_schema    = 'public'
      AND  table_name      = 'products'
      AND  constraint_type = 'UNIQUE'
      AND  constraint_name ILIKE '%reference_code%'
  LOOP
    EXECUTE format('ALTER TABLE products DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
  END LOOP;
END;
$$;

-- New composite unique: a code must be unique within a company, not globally
ALTER TABLE products
  ADD CONSTRAINT products_reference_code_company_unique
  UNIQUE (reference_code, company_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. SECURITY DEFINER helper functions
--    Policies call these to avoid re-reading the users table on every row.
-- ─────────────────────────────────────────────────────────────────────────────

-- Returns the company_id of the currently authenticated user
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM users WHERE id = auth.uid();
$$;

-- Returns the role of the currently authenticated user
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION get_my_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_role()        TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Rewrite set_sale_number() — sequence scoped per company × year
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_sale_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_seq  BIGINT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');

  -- Count existing sales in the same company for the current year.
  -- Adding 1 gives the next sequence number (gaps are acceptable on rollback).
  SELECT COUNT(*) + 1 INTO v_seq
  FROM   sales
  WHERE  company_id               = NEW.company_id
    AND  TO_CHAR(created_at, 'YYYY') = v_year;

  NEW.sale_number := 'VNT-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Rewrite set_order_number() — sequence scoped per company × year,
--    and inherit company_id from the parent sale automatically.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year       TEXT;
  v_seq        BIGINT;
  v_company_id UUID;
BEGIN
  -- Pull the company from the parent sale so the caller never needs to supply it
  SELECT company_id INTO v_company_id
  FROM   sales
  WHERE  id = NEW.sale_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'set_order_number: could not resolve company_id for sale_id=%', NEW.sale_id;
  END IF;

  NEW.company_id := v_company_id;

  v_year := TO_CHAR(NOW(), 'YYYY');

  SELECT COUNT(*) + 1 INTO v_seq
  FROM   orders
  WHERE  company_id               = v_company_id
    AND  TO_CHAR(created_at, 'YYYY') = v_year;

  NEW.order_number := 'CMD-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Recreate stock_view with security_invoker = on
--     security_invoker means the view runs under the caller's identity, so
--     the underlying RLS policies on products and stock are automatically
--     respected — no duplicate company_id filter needed in the view itself.
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS stock_view;

CREATE VIEW stock_view
WITH (security_invoker = on)
AS
SELECT
  s.product_id,
  s.company_id,
  p.name                                                               AS product_name,
  p.reference_code,
  p.tiles_per_carton,
  p.tile_area_m2,
  s.total_tiles,
  s.reserved_tiles,

  -- Available stock (unreserved)
  (s.total_tiles - s.reserved_tiles)                                   AS available_tiles,

  -- Available stock broken down into full cartons + loose tiles
  FLOOR((s.total_tiles - s.reserved_tiles) / p.tiles_per_carton)      AS available_full_cartons,
  ((s.total_tiles - s.reserved_tiles)
    - FLOOR((s.total_tiles - s.reserved_tiles) / p.tiles_per_carton)
      * p.tiles_per_carton)                                            AS loose_tiles,

  -- Available surface area in m²
  ((s.total_tiles - s.reserved_tiles) * p.tile_area_m2)               AS available_m2,

  -- Total cartons in stock (regardless of reservations) — useful for display
  FLOOR(s.total_tiles / p.tiles_per_carton)                            AS full_cartons

FROM stock     s
JOIN products  p ON p.id = s.product_id;

GRANT SELECT ON stock_view TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Drop ALL existing RLS policies on tenant tables
--     (We don't know the original policy names, so we scan pg_policies.)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM   pg_policies
    WHERE  schemaname = 'public'
      AND  tablename  IN (
        'companies', 'boutiques', 'users', 'products',
        'stock', 'stock_requests', 'sales', 'sale_items',
        'sale_payments', 'orders', 'audit_logs'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END;
$$;

-- Ensure RLS is enabled on every table (including the new one)
ALTER TABLE companies      ENABLE ROW LEVEL SECURITY;
ALTER TABLE boutiques      ENABLE ROW LEVEL SECURITY;
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs     ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. Recreate all RLS policies — company-scoped
-- ─────────────────────────────────────────────────────────────────────────────

-- ── companies ──────────────────────────────────────────────────────────────
-- Users can only see their own company record (tenant isolation at the root)
CREATE POLICY companies_select ON companies
  FOR SELECT TO authenticated
  USING (id = get_my_company_id());

-- ── users (profiles) ───────────────────────────────────────────────────────
-- Any authenticated user can read profiles within their company
CREATE POLICY users_select ON users
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

-- A user can always update their own row (e.g. push_subscription refresh)
CREATE POLICY users_update_own ON users
  FOR UPDATE TO authenticated
  USING    (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Owner / admin can update any profile in their company
CREATE POLICY users_update_manager ON users
  FOR UPDATE TO authenticated
  USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin')
  )
  WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin')
  );

-- Inserts always go through the service role (Supabase Auth admin client)
-- → no authenticated INSERT policy required on users

-- ── boutiques ──────────────────────────────────────────────────────────────
CREATE POLICY boutiques_select ON boutiques
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

CREATE POLICY boutiques_insert ON boutiques
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin')
  );

CREATE POLICY boutiques_update ON boutiques
  FOR UPDATE TO authenticated
  USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin')
  )
  WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin')
  );

-- ── products ───────────────────────────────────────────────────────────────
CREATE POLICY products_select ON products
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

CREATE POLICY products_insert ON products
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin')
  );

CREATE POLICY products_update ON products
  FOR UPDATE TO authenticated
  USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin')
  )
  WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin')
  );

-- ── stock ──────────────────────────────────────────────────────────────────
-- Readable by all roles in the company; all writes go through SECURITY
-- DEFINER functions or the service-role admin client (both bypass RLS).
CREATE POLICY stock_select ON stock
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

-- ── stock_requests ─────────────────────────────────────────────────────────
-- All roles can read requests within their company (warehouse sees their own
-- requests; owner/admin need to review them — filtering done in the UI).
CREATE POLICY stock_requests_select ON stock_requests
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

CREATE POLICY stock_requests_insert ON stock_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin', 'warehouse')
  );

-- Only owner / admin can approve or reject (change status)
CREATE POLICY stock_requests_update ON stock_requests
  FOR UPDATE TO authenticated
  USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin')
  )
  WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin')
  );

-- ── sales ──────────────────────────────────────────────────────────────────
-- owner / admin → all sales in the company
-- vendor         → only their own sales
CREATE POLICY sales_select ON sales
  FOR SELECT TO authenticated
  USING (
    company_id = get_my_company_id()
    AND (
      get_my_role() IN ('owner', 'admin')
      OR vendor_id = auth.uid()
    )
  );

CREATE POLICY sales_insert ON sales
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin', 'vendor')
  );

-- Vendors can update their own sales (cancel); managers can update any
CREATE POLICY sales_update ON sales
  FOR UPDATE TO authenticated
  USING (
    company_id = get_my_company_id()
    AND (
      get_my_role() IN ('owner', 'admin')
      OR (get_my_role() = 'vendor' AND vendor_id = auth.uid())
    )
  )
  WITH CHECK (
    company_id = get_my_company_id()
    AND (
      get_my_role() IN ('owner', 'admin')
      OR (get_my_role() = 'vendor' AND vendor_id = auth.uid())
    )
  );

-- ── sale_items ─────────────────────────────────────────────────────────────
-- Visibility mirrors sales: owner/admin see all, vendor sees own items
CREATE POLICY sale_items_select ON sale_items
  FOR SELECT TO authenticated
  USING (
    company_id = get_my_company_id()
    AND EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items.sale_id
        AND (
          get_my_role() IN ('owner', 'admin')
          OR s.vendor_id = auth.uid()
        )
    )
  );

CREATE POLICY sale_items_insert ON sale_items
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin', 'vendor')
  );

-- ── sale_payments ──────────────────────────────────────────────────────────
CREATE POLICY sale_payments_select ON sale_payments
  FOR SELECT TO authenticated
  USING (
    company_id = get_my_company_id()
    AND EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_payments.sale_id
        AND (
          get_my_role() IN ('owner', 'admin')
          OR s.vendor_id = auth.uid()
        )
    )
  );

-- Only owner / admin can record payments
CREATE POLICY sale_payments_insert ON sale_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin')
  );

-- ── orders ─────────────────────────────────────────────────────────────────
-- All roles in the company can read orders (warehouse needs them)
CREATE POLICY orders_select ON orders
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

-- Inserts go through the admin client or the set_order_number trigger path
CREATE POLICY orders_insert ON orders
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin', 'vendor')
  );

-- Status updates: warehouse, owner, admin
CREATE POLICY orders_update ON orders
  FOR UPDATE TO authenticated
  USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin', 'warehouse')
  )
  WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin', 'warehouse')
  );

-- ── audit_logs ─────────────────────────────────────────────────────────────
-- Read: owner / admin only (sensitive operation history)
-- Write: always through the service-role admin client → no INSERT policy needed
CREATE POLICY audit_logs_select ON audit_logs
  FOR SELECT TO authenticated
  USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin')
  );

COMMIT;
