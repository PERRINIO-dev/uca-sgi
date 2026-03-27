-- Add purchase_price_snapshot to sale_items so historical margin reports
-- remain accurate even when a product's purchase price is later changed.
--
-- Run this in the Supabase SQL editor or via `supabase db push`.

ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS purchase_price_snapshot NUMERIC DEFAULT 0 NOT NULL;

-- Backfill existing rows from the product's current purchase_price.
-- This is a best-effort backfill; only future sales will carry the exact
-- price that was in effect at the time of the sale.
UPDATE sale_items si
SET    purchase_price_snapshot = COALESCE(p.purchase_price, 0)
FROM   products p
WHERE  si.product_id = p.id
  AND  si.purchase_price_snapshot = 0;
