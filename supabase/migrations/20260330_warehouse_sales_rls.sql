-- Allow warehouse role to read sales and sale_items.
-- Without this, orders fetched by warehouse users have empty nested sale data.
--
-- Previous policies only allowed: owner, admin, or vendor_id = auth.uid()
-- Warehouse workers need read access to prepare orders (picking lists).

-- ── sales ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS sales_select ON sales;

CREATE POLICY sales_select ON sales
  FOR SELECT TO authenticated
  USING (
    company_id = get_my_company_id()
    AND (
      get_my_role() IN ('owner', 'admin', 'warehouse')
      OR vendor_id = auth.uid()
    )
  );

-- ── sale_items ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS sale_items_select ON sale_items;

CREATE POLICY sale_items_select ON sale_items
  FOR SELECT TO authenticated
  USING (
    company_id = get_my_company_id()
    AND EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_items.sale_id
        AND (
          get_my_role() IN ('owner', 'admin', 'warehouse')
          OR s.vendor_id = auth.uid()
        )
    )
  );
