-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260418_rename_stock_columns
--
-- Renames stock.total_tiles  → total_qty
--         stock.reserved_tiles → reserved_qty
--
-- "tiles" was the original name when the system only managed ceramic tiles.
-- The platform now tracks units, linear metres, bags, and litres.  The
-- generic "_qty" suffix reflects the actual semantic: a raw quantity in
-- whatever unit the product uses.
--
-- All DB objects that reference the old column names are rebuilt here:
--   • stock_view          (available_tiles → available_qty)
--   • create_stock_on_product_insert()  trigger function
--   • reserve_stock_on_sale()
--   • release_stock_on_cancel()
--   • decrement_stock_on_delivery()
--   • apply_approved_stock_request()   (written from scratch — canonical version)
--   • reserve_sale_items()             (new atomic reservation function)
--
-- Run AFTER 20260418_db_integrity.sql.
-- TypeScript changes (column name references in .ts/.tsx files) are applied
-- as part of the same deployment so the app and DB are never out of sync.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Column renames ─────────────────────────────────────────────────────────

ALTER TABLE stock RENAME COLUMN total_tiles    TO total_qty;
ALTER TABLE stock RENAME COLUMN reserved_tiles TO reserved_qty;

-- ── 2. Rebuild stock_view ─────────────────────────────────────────────────────
-- Drops and recreates the view so computed column aliases update too.
-- available_tiles → available_qty  (same formula, new name).

DROP VIEW IF EXISTS stock_view;

CREATE VIEW stock_view
WITH (security_invoker = on)
AS
SELECT
  s.product_id,
  s.company_id,
  p.name                                                                     AS product_name,
  p.reference_code,
  p.product_type,
  p.unit_label,
  p.tiles_per_carton,
  p.tile_area_m2,
  s.total_qty,
  s.reserved_qty,

  -- Available stock (unreserved)
  (s.total_qty - s.reserved_qty)                                             AS available_qty,

  -- Carton breakdown — meaningful for tile products; 0 for others
  CASE
    WHEN p.tiles_per_carton IS NULL OR p.tiles_per_carton = 0 THEN 0
    ELSE FLOOR((s.total_qty - s.reserved_qty) / p.tiles_per_carton)
  END                                                                        AS available_full_cartons,

  CASE
    WHEN p.tiles_per_carton IS NULL OR p.tiles_per_carton = 0 THEN 0
    ELSE (
      (s.total_qty - s.reserved_qty)
      - FLOOR((s.total_qty - s.reserved_qty) / p.tiles_per_carton)
        * p.tiles_per_carton
    )
  END                                                                        AS loose_tiles,

  -- Surface area — tile products only; 0 for others
  COALESCE((s.total_qty - s.reserved_qty) * p.tile_area_m2, 0)              AS available_m2,

  -- Total cartons in stock (ignores reservations) — for display
  CASE
    WHEN p.tiles_per_carton IS NULL OR p.tiles_per_carton = 0 THEN 0
    ELSE FLOOR(s.total_qty / p.tiles_per_carton)
  END                                                                        AS full_cartons

FROM stock     s
JOIN products  p ON p.id = s.product_id;

GRANT SELECT ON stock_view TO authenticated;

-- ── 3. create_stock_on_product_insert() ──────────────────────────────────────

CREATE OR REPLACE FUNCTION create_stock_on_product_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO stock (product_id, company_id, total_qty, reserved_qty)
  VALUES (NEW.id, NEW.company_id, 0, 0)
  ON CONFLICT (product_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── 4. reserve_stock_on_sale() ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION reserve_stock_on_sale(
  p_product_id UUID,
  p_quantity    NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available NUMERIC;
BEGIN
  SELECT total_qty - reserved_qty
  INTO   v_available
  FROM   stock
  WHERE  product_id = p_product_id
  FOR    UPDATE;

  IF v_available IS NULL OR v_available < p_quantity THEN
    RETURN FALSE;
  END IF;

  UPDATE stock
  SET    reserved_qty = reserved_qty + p_quantity
  WHERE  product_id = p_product_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION reserve_stock_on_sale(UUID, NUMERIC) TO service_role;

-- ── 5. release_stock_on_cancel() ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION release_stock_on_cancel(
  p_product_id UUID,
  p_quantity   NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE stock
  SET    reserved_qty = GREATEST(0, reserved_qty - p_quantity)
  WHERE  product_id = p_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION release_stock_on_cancel(UUID, NUMERIC) TO service_role;

-- ── 6. decrement_stock_on_delivery() ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION decrement_stock_on_delivery(
  p_product_id UUID,
  p_quantity   NUMERIC,
  p_company_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE stock
  SET
    total_qty    = GREATEST(0, total_qty    - p_quantity),
    reserved_qty = GREATEST(0, reserved_qty - p_quantity)
  WHERE  product_id = p_product_id
    AND  (p_company_id IS NULL OR company_id = p_company_id);
END;
$$;

GRANT EXECUTE ON FUNCTION decrement_stock_on_delivery(UUID, NUMERIC, UUID) TO service_role;

-- ── 7. apply_approved_stock_request() ────────────────────────────────────────
-- Canonical definition — applies a stock delta from an approved stock_request
-- directly to total_qty.  quantity_tiles_delta is already signed: positive
-- for stock-in, negative for corrections that reduce stock.  GREATEST(0, …)
-- prevents total_qty from going below zero.

CREATE OR REPLACE FUNCTION apply_approved_stock_request(request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req stock_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req
  FROM   stock_requests
  WHERE  id = request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'apply_approved_stock_request: request not found (id=%)', request_id;
  END IF;

  UPDATE stock
  SET    total_qty = GREATEST(0, total_qty + v_req.quantity_tiles_delta)
  WHERE  product_id = v_req.product_id
    AND  company_id = v_req.company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'apply_approved_stock_request: no stock row for product_id=%, company_id=%',
      v_req.product_id, v_req.company_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION apply_approved_stock_request(UUID) TO authenticated, service_role;

-- ── 8. reserve_sale_items() — atomic multi-product reservation ────────────────
-- Replaces the per-product loop in TypeScript (sales/actions.ts and
-- quotes/actions.ts).  Locks all affected stock rows in product_id order
-- (deterministic) to prevent deadlocks, checks all availabilities, then
-- applies all increments in a single pass.
--
-- Returns TRUE  if all products had sufficient stock and are now reserved.
-- Returns FALSE if any product was insufficient — NO reservations are made
-- (fully atomic: either everything succeeds or nothing changes).
--
-- The caller must pass a sale_id whose sale_items already exist in the DB.

CREATE OR REPLACE FUNCTION reserve_sale_items(p_sale_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item      RECORD;
  v_available NUMERIC;
BEGIN
  -- Phase 1: acquire row-level locks and check availability for every product.
  -- ORDER BY product_id ensures a consistent lock acquisition order across
  -- concurrent calls, eliminating deadlock risk.
  FOR v_item IN
    SELECT   product_id,
             SUM(quantity_tiles) AS qty
    FROM     sale_items
    WHERE    sale_id = p_sale_id
    GROUP BY product_id
    ORDER BY product_id
  LOOP
    SELECT total_qty - reserved_qty
    INTO   v_available
    FROM   stock
    WHERE  product_id = v_item.product_id
    FOR    UPDATE;

    IF v_available IS NULL OR v_available < v_item.qty THEN
      -- Insufficient stock for this product.  All locks acquired so far are
      -- released when this function returns (auto-commit RPC context).
      RETURN FALSE;
    END IF;
  END LOOP;

  -- Phase 2: all products cleared — apply reservations atomically.
  UPDATE stock
  SET    reserved_qty = reserved_qty + (
    SELECT SUM(si.quantity_tiles)
    FROM   sale_items si
    WHERE  si.sale_id    = p_sale_id
      AND  si.product_id = stock.product_id
  )
  WHERE  product_id IN (
    SELECT DISTINCT product_id
    FROM   sale_items
    WHERE  sale_id = p_sale_id
  );

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION reserve_sale_items(UUID) TO service_role;

COMMIT;
