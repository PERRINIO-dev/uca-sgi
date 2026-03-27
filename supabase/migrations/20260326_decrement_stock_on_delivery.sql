-- Atomically decrements total_tiles and reserved_tiles in a single UPDATE,
-- avoiding the read-then-write race condition present in the JS client approach.
-- Both columns are floored at 0 via GREATEST.
--
-- Run this in the Supabase SQL editor or via `supabase db push`.

CREATE OR REPLACE FUNCTION decrement_stock_on_delivery(
  p_product_id UUID,
  p_quantity   INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE stock
  SET
    total_tiles    = GREATEST(0, total_tiles    - p_quantity),
    reserved_tiles = GREATEST(0, reserved_tiles - p_quantity)
  WHERE product_id = p_product_id;
END;
$$;

-- Grant execute to the service role (used by the admin client in warehouse/actions.ts)
GRANT EXECUTE ON FUNCTION decrement_stock_on_delivery(UUID, INTEGER) TO service_role;
