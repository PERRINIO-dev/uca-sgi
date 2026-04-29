-- Per-product minimum stock threshold.
-- NULL = use the global application default (LOW_STOCK_CARTONS / LOW_STOCK_UNITS).
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS min_stock_qty NUMERIC(12, 2) NULL
    CONSTRAINT products_min_stock_qty_positive CHECK (min_stock_qty IS NULL OR min_stock_qty >= 0);
