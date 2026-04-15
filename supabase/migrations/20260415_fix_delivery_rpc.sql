-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260415_fix_delivery_rpc
--
-- Fix decrement_stock_on_delivery:
--   1. Change p_quantity from INTEGER to NUMERIC so decimal base-unit quantities
--      (e.g., 2.5 linear metres) are not silently truncated.
--   2. Add optional p_company_id parameter — when supplied, the UPDATE is
--      restricted to that company's stock row for defense-in-depth on a
--      multi-tenant database.  NULL means "no additional filter" so existing
--      callers that omit the argument continue to work unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

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
    total_tiles    = GREATEST(0, total_tiles    - p_quantity),
    reserved_tiles = GREATEST(0, reserved_tiles - p_quantity)
  WHERE product_id = p_product_id
    AND (p_company_id IS NULL OR company_id = p_company_id);
END;
$$;

-- Keep grant so the service-role admin client can call it
GRANT EXECUTE ON FUNCTION decrement_stock_on_delivery(UUID, NUMERIC, UUID) TO service_role;
