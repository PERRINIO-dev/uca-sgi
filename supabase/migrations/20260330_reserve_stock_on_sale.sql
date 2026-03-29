-- ═══════════════════════════════════════════════════════════════════════════════
-- UCA SGI — Atomic stock reservation for new sales
--
-- Replaces the read-then-write pattern in sales/actions.ts with a single
-- transactional UPDATE that holds a row-level lock.
-- Returns TRUE  if reservation succeeded (enough stock available).
-- Returns FALSE if stock was insufficient (caller must rollback the sale).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION reserve_stock_on_sale(
  p_product_id UUID,
  p_quantity    INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available INTEGER;
BEGIN
  -- Lock the row for the duration of this transaction to prevent concurrent
  -- reservations from both reading the same available count.
  SELECT total_tiles - reserved_tiles
  INTO   v_available
  FROM   stock
  WHERE  product_id = p_product_id
  FOR    UPDATE;

  IF v_available IS NULL OR v_available < p_quantity THEN
    RETURN FALSE;
  END IF;

  UPDATE stock
  SET    reserved_tiles = reserved_tiles + p_quantity
  WHERE  product_id = p_product_id;

  RETURN TRUE;
END;
$$;
