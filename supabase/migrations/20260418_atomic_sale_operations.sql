-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260418_atomic_sale_operations
--
-- Closes two remaining data-integrity gaps:
--
--   GAP 1 — Release is still a loop.
--     reserve_sale_items() is atomic but the cancel/rollback paths still call
--     release_stock_on_cancel() per product in TypeScript, creating a window
--     for partial release if the server dies mid-loop.
--     Fix: release_sale_items(p_sale_id) — single UPDATE that aggregates and
--     releases all products for a sale in one statement.
--
--   GAP 2 — Three-step sale creation has no DB-level transaction.
--     TypeScript previously executed: insert sale → insert items →
--     reserve_sale_items as three separate network calls.  A crash between
--     any two steps leaves the DB in an inconsistent state (confirmed sale
--     with no items, or items with no stock reservation, or stock reserved
--     but no warehouse order).
--
--     For DIRECT SALES: create_confirmed_sale() wraps all four steps —
--     sale, items, reservation, and order — in one DB transaction.
--
--     For QUOTE CONVERSION: confirm_quote() extended to also call
--     reserve_sale_items() and create the warehouse order.  Any failure
--     (including insufficient stock) raises an exception that rolls back
--     the entire transaction; the quote stays in 'draft' with no
--     side-effects.
--
-- Run AFTER 20260418_rename_stock_columns.sql.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. release_sale_items() ───────────────────────────────────────────────────
-- Symmetric counterpart to reserve_sale_items().
-- A single UPDATE aggregates quantities across all items for the sale and
-- decrements reserved_qty in one statement — atomic, no loop, no partial state.
-- GREATEST(0, …) prevents reserved_qty going negative under any condition.

CREATE OR REPLACE FUNCTION release_sale_items(p_sale_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE stock
  SET    reserved_qty = GREATEST(0, reserved_qty - (
    SELECT SUM(si.quantity_tiles)
    FROM   sale_items si
    WHERE  si.sale_id    = p_sale_id
      AND  si.product_id = stock.product_id
  ))
  WHERE  product_id IN (
    SELECT DISTINCT product_id
    FROM   sale_items
    WHERE  sale_id = p_sale_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION release_sale_items(UUID) TO service_role;

-- ── 2. confirm_quote() — extended to include reservation + order ──────────────
-- Previous version: only assigned the VNT number and changed status.
-- The caller (TypeScript) then made two more round-trips: reserve_sale_items,
-- then order insert.  A crash between any of these left the DB inconsistent.
--
-- New version: all four operations — number assignment, status change,
-- stock reservation, and order creation — run inside one transaction.
-- If reserve_sale_items() returns FALSE, an exception is raised and the
-- entire transaction rolls back.  The quote stays 'draft'; no VNT number
-- is wasted; no stock is touched.

CREATE OR REPLACE FUNCTION confirm_quote(p_sale_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year        TEXT;
  v_seq         INTEGER;
  v_company_id  UUID;
  v_sale_number TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');

  SELECT company_id INTO v_company_id
  FROM   sales
  WHERE  id = p_sale_id AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'confirm_quote: devis introuvable ou déjà converti (id=%)', p_sale_id;
  END IF;

  -- Atomic counter upsert — race-proof, gap-immune
  INSERT INTO sequence_counters (company_id, series, last_value)
  VALUES (v_company_id, 'VNT-' || v_year, 1)
  ON CONFLICT (company_id, series)
  DO UPDATE SET last_value = sequence_counters.last_value + 1
  RETURNING last_value INTO v_seq;

  v_sale_number := 'VNT-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');

  UPDATE sales
  SET    status      = 'confirmed',
         sale_number = v_sale_number
  WHERE  id = p_sale_id;

  -- Reserve stock atomically — rolls back everything if insufficient
  IF NOT reserve_sale_items(p_sale_id) THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK';
  END IF;

  -- Create the warehouse order (set_order_number trigger assigns CMD number)
  INSERT INTO orders (sale_id, order_number, status, company_id)
  VALUES (p_sale_id, '', 'confirmed', v_company_id);

  RETURN v_sale_number;
END;
$$;

-- ── 3. create_confirmed_sale() ────────────────────────────────────────────────
-- Wraps direct sale creation in a single DB transaction:
--   a. INSERT into sales   → set_sale_number trigger assigns VNT-YYYY-NNNN
--   b. INSERT into sale_items (from JSONB array)
--   c. reserve_sale_items()  — raises INSUFFICIENT_STOCK on failure
--   d. INSERT into orders  → set_order_number trigger assigns CMD-YYYY-NNNN
--
-- Returns JSONB { sale_id, sale_number } so the caller can proceed with
-- payment recording and audit logging.
--
-- p_items schema (each element):
--   product_id, quantity_tiles, unit_price_per_m2, total_price,
--   floor_price_snapshot, reference_price_snapshot, purchase_price_snapshot,
--   tile_area_m2_snapshot (nullable), tiles_per_carton_snapshot (nullable)

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
  p_items          JSONB
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
  -- Step a: insert sale header.
  -- The set_sale_number BEFORE INSERT trigger fires here and assigns the
  -- VNT-YYYY-NNNN number using the atomic sequence_counters table.
  INSERT INTO sales (
    boutique_id,     vendor_id,       customer_name,
    customer_phone,  customer_cni,    total_amount,
    amount_paid,     payment_status,  notes,
    status,          sale_number,     company_id
  )
  VALUES (
    p_boutique_id,   p_vendor_id,     p_customer_name,
    p_customer_phone, p_customer_cni, p_total_amount,
    p_amount_paid,   p_payment_status, p_notes,
    'confirmed',     '',              p_company_id
  )
  RETURNING id, sale_number INTO v_sale_id, v_sale_number;

  -- Step b: insert all sale items from the JSONB array.
  -- JSON null values cast to NUMERIC produce SQL NULL — correct for nullable
  -- snapshot columns (tile_area_m2_snapshot, tiles_per_carton_snapshot).
  INSERT INTO sale_items (
    sale_id,
    product_id,
    company_id,
    quantity_tiles,
    unit_price_per_m2,
    total_price,
    floor_price_snapshot,
    reference_price_snapshot,
    purchase_price_snapshot,
    tile_area_m2_snapshot,
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

  -- Step c: reserve stock atomically for all items.
  -- Returns FALSE if any product has insufficient available stock.
  -- The exception causes the entire transaction to roll back — no orphaned
  -- sale, no partial reservation, no wasted sequence number.
  IF NOT reserve_sale_items(v_sale_id) THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK';
  END IF;

  -- Step d: create the warehouse order.
  -- The set_order_number BEFORE INSERT trigger fires and assigns CMD-YYYY-NNNN.
  INSERT INTO orders (sale_id, order_number, status, company_id)
  VALUES (v_sale_id, '', 'confirmed', p_company_id);

  RETURN jsonb_build_object('sale_id', v_sale_id, 'sale_number', v_sale_number);
END;
$$;

GRANT EXECUTE ON FUNCTION create_confirmed_sale(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, UUID, JSONB) TO service_role;

COMMIT;
