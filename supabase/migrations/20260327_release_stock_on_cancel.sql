-- Atomically releases reserved_tiles when a sale is cancelled.
-- Only decrements reserved_tiles (NOT total_tiles) because the physical
-- tiles never left the warehouse on cancellation.
-- Floors at 0 via GREATEST to prevent negative reserved counts.
--
-- Run this in the Supabase SQL editor or via `supabase db push`.

CREATE OR REPLACE FUNCTION release_stock_on_cancel(
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
  SET reserved_tiles = GREATEST(0, reserved_tiles - p_quantity)
  WHERE product_id = p_product_id;
END;
$$;

-- Grant execute to the service role (used by the admin client in sales/actions.ts)
GRANT EXECUTE ON FUNCTION release_stock_on_cancel(UUID, INTEGER) TO service_role;
