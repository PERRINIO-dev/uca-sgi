-- Fix the auto-create-stock trigger to inherit company_id from the parent product.
--
-- When a product is inserted, a BEFORE/AFTER INSERT trigger automatically creates
-- a corresponding row in stock.  That trigger predates the multi-tenancy migration
-- and therefore never sets company_id, causing a NOT NULL violation.
--
-- This migration replaces the trigger function so it copies company_id from
-- the newly inserted product row.
--
-- Run in the Supabase SQL editor immediately after 20260329_multi_tenancy_phase1.sql.

CREATE OR REPLACE FUNCTION create_stock_on_product_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO stock (product_id, company_id, total_tiles, reserved_tiles)
  VALUES (NEW.id, NEW.company_id, 0, 0)
  ON CONFLICT (product_id) DO NOTHING;
  RETURN NEW;
END;
$$;
