-- ─────────────────────────────────────────────────────────────────────────────
-- REFONTE RLS — Phase 2 : réécriture complète des policies pour les 8 rôles
--
-- Rôles : owner | manager | seller | cashier | warehouse | delivery | accountant | field_agent
--
-- Principe : DROP IF EXISTS + CREATE — idempotent, safe à rejouer
-- Tables optionnelles (peuvent ne pas exister) : enveloppées dans DO $$ avec
-- EXCEPTION WHEN undefined_table pour ignorer gracieusement.
-- ─────────────────────────────────────────────────────────────────────────────

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE : sales
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS sales_select ON sales;
DROP POLICY IF EXISTS sales_insert ON sales;
DROP POLICY IF EXISTS sales_update ON sales;
DROP POLICY IF EXISTS sales_delete ON sales;

-- SELECT : direction + comptable voient tout le tenant
--          seller/field_agent voient leurs propres ventes
--          cashier voit les ventes avec paiement en attente
CREATE POLICY sales_select ON sales FOR SELECT USING (
  company_id = get_my_company_id()
  AND (
    get_my_role() IN ('owner', 'manager', 'accountant')
    OR vendor_id = auth.uid()
    OR (
      get_my_role() = 'cashier'
      AND payment_status IN ('unpaid', 'partial')
      AND status IN ('confirmed', 'preparing', 'ready', 'delivered')
    )
  )
);

CREATE POLICY sales_insert ON sales FOR INSERT WITH CHECK (
  company_id = get_my_company_id()
  AND get_my_role() IN ('owner', 'manager', 'seller', 'field_agent')
);

CREATE POLICY sales_update ON sales FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (
    get_my_role() IN ('owner', 'manager')
    OR (
      get_my_role() = 'seller'
      AND vendor_id = auth.uid()
      AND status = 'draft'
    )
  )
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE : sale_items
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS sale_items_select ON sale_items;
DROP POLICY IF EXISTS sale_items_insert ON sale_items;
DROP POLICY IF EXISTS sale_items_update ON sale_items;

CREATE POLICY sale_items_select ON sale_items FOR SELECT USING (
  company_id = get_my_company_id()
  AND (
    get_my_role() IN ('owner', 'manager', 'accountant')
    OR EXISTS (
      SELECT 1 FROM sales s
      WHERE s.id = sale_id
        AND (
          s.vendor_id = auth.uid()
          OR (
            get_my_role() = 'cashier'
            AND s.payment_status IN ('unpaid', 'partial')
          )
        )
    )
  )
);

CREATE POLICY sale_items_insert ON sale_items FOR INSERT WITH CHECK (
  company_id = get_my_company_id()
  AND get_my_role() IN ('owner', 'manager', 'seller', 'field_agent')
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE : sale_payments
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS sale_payments_select ON sale_payments;
DROP POLICY IF EXISTS sale_payments_insert ON sale_payments;

CREATE POLICY sale_payments_select ON sale_payments FOR SELECT USING (
  company_id = get_my_company_id()
  AND get_my_role() IN ('owner', 'manager', 'cashier', 'accountant')
);

CREATE POLICY sale_payments_insert ON sale_payments FOR INSERT WITH CHECK (
  company_id = get_my_company_id()
  AND get_my_role() IN ('owner', 'manager', 'cashier')
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE : orders
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS orders_select ON orders;
DROP POLICY IF EXISTS orders_insert ON orders;
DROP POLICY IF EXISTS orders_update ON orders;

CREATE POLICY orders_select ON orders FOR SELECT USING (
  company_id = get_my_company_id()
  AND (
    get_my_role() IN ('owner', 'manager', 'warehouse', 'accountant')
    OR (
      get_my_role() = 'delivery'
      AND assigned_delivery_id = auth.uid()
    )
  )
);

CREATE POLICY orders_insert ON orders FOR INSERT WITH CHECK (
  company_id = get_my_company_id()
  AND get_my_role() IN ('owner', 'manager', 'seller', 'field_agent')
);

CREATE POLICY orders_update ON orders FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (
    get_my_role() IN ('owner', 'manager', 'warehouse')
    OR (
      get_my_role() = 'delivery'
      AND assigned_delivery_id = auth.uid()
    )
  )
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE : products
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS products_select ON products;
DROP POLICY IF EXISTS products_insert ON products;
DROP POLICY IF EXISTS products_update ON products;
DROP POLICY IF EXISTS products_delete ON products;

CREATE POLICY products_select ON products FOR SELECT USING (
  company_id = get_my_company_id()
  AND get_my_role() IN (
    'owner', 'manager', 'seller', 'cashier',
    'warehouse', 'accountant', 'field_agent'
  )
);

CREATE POLICY products_insert ON products FOR INSERT WITH CHECK (
  company_id = get_my_company_id()
  AND get_my_role() IN ('owner', 'manager')
);

CREATE POLICY products_update ON products FOR UPDATE USING (
  company_id = get_my_company_id()
  AND get_my_role() IN ('owner', 'manager')
);

CREATE POLICY products_delete ON products FOR DELETE USING (
  company_id = get_my_company_id()
  AND get_my_role() IN ('owner', 'manager')
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE : stock
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS stock_select ON stock;
DROP POLICY IF EXISTS stock_update ON stock;
DROP POLICY IF EXISTS stock_insert ON stock;

CREATE POLICY stock_select ON stock FOR SELECT USING (
  company_id = get_my_company_id()
  AND get_my_role() IN (
    'owner', 'manager', 'warehouse', 'seller', 'field_agent', 'accountant'
  )
);

CREATE POLICY stock_insert ON stock FOR INSERT WITH CHECK (
  company_id = get_my_company_id()
);

CREATE POLICY stock_update ON stock FOR UPDATE USING (
  company_id = get_my_company_id()
  AND get_my_role() IN ('owner', 'manager', 'warehouse')
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE : stock_requests
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS stock_requests_select ON stock_requests;
DROP POLICY IF EXISTS stock_requests_insert ON stock_requests;
DROP POLICY IF EXISTS stock_requests_update ON stock_requests;

CREATE POLICY stock_requests_select ON stock_requests FOR SELECT USING (
  company_id = get_my_company_id()
  AND get_my_role() IN ('owner', 'manager', 'warehouse')
);

CREATE POLICY stock_requests_insert ON stock_requests FOR INSERT WITH CHECK (
  company_id = get_my_company_id()
  AND get_my_role() IN ('owner', 'manager', 'warehouse')
);

CREATE POLICY stock_requests_update ON stock_requests FOR UPDATE USING (
  company_id = get_my_company_id()
  AND get_my_role() IN ('owner', 'manager')
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE : audit_logs
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS audit_logs_select ON audit_logs;

CREATE POLICY audit_logs_select ON audit_logs FOR SELECT USING (
  (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'accountant'))
  OR (company_id IS NULL AND is_platform_admin())
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE : users
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS users_select         ON users;
DROP POLICY IF EXISTS users_update_manager ON users;
DROP POLICY IF EXISTS users_update_own     ON users;

CREATE POLICY users_select ON users FOR SELECT USING (
  id = auth.uid()
  OR (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager')
  )
);

CREATE POLICY users_update_manager ON users FOR UPDATE USING (
  company_id = get_my_company_id()
  AND get_my_role() = 'owner'
);

CREATE POLICY users_update_own ON users FOR UPDATE USING (
  id = auth.uid()
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLE : boutiques
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS boutiques_select ON boutiques;
DROP POLICY IF EXISTS boutiques_insert ON boutiques;
DROP POLICY IF EXISTS boutiques_update ON boutiques;

CREATE POLICY boutiques_select ON boutiques FOR SELECT USING (
  company_id = get_my_company_id()
);

CREATE POLICY boutiques_insert ON boutiques FOR INSERT WITH CHECK (
  company_id = get_my_company_id()
  AND get_my_role() IN ('owner', 'manager')
);

CREATE POLICY boutiques_update ON boutiques FOR UPDATE USING (
  company_id = get_my_company_id()
  AND get_my_role() IN ('owner', 'manager')
);

-- ════════════════════════════════════════════════════════════════════════════
-- TABLES OPTIONNELLES — enveloppées dans DO $$ avec gestion d'erreur
-- Ces tables peuvent ne pas exister dans certaines instances.
-- La migration s'exécute proprement même si elles sont absentes.
-- ════════════════════════════════════════════════════════════════════════════

-- ── customers ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS customers_select ON customers;
  DROP POLICY IF EXISTS customers_insert ON customers;
  DROP POLICY IF EXISTS customers_update ON customers;
  DROP POLICY IF EXISTS customers_delete ON customers;

  CREATE POLICY customers_select ON customers FOR SELECT TO authenticated USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager', 'seller', 'field_agent', 'accountant')
  );

  CREATE POLICY customers_insert ON customers FOR INSERT TO authenticated WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager', 'seller', 'field_agent')
  );

  CREATE POLICY customers_update ON customers FOR UPDATE TO authenticated USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager')
  );

  CREATE POLICY customers_delete ON customers FOR DELETE TO authenticated USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager')
  );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table customers introuvable — policies ignorées.';
END $$;

-- ── suppliers ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS suppliers_tenant_select ON suppliers;
  DROP POLICY IF EXISTS suppliers_tenant_insert ON suppliers;
  DROP POLICY IF EXISTS suppliers_tenant_update ON suppliers;

  CREATE POLICY suppliers_tenant_select ON suppliers FOR SELECT USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager', 'warehouse', 'accountant')
  );

  CREATE POLICY suppliers_tenant_insert ON suppliers FOR INSERT WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager')
  );

  CREATE POLICY suppliers_tenant_update ON suppliers FOR UPDATE USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager')
  );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table suppliers introuvable — policies ignorées.';
END $$;

-- ── purchase_orders + purchase_order_items ────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS po_tenant_select  ON purchase_orders;
  DROP POLICY IF EXISTS po_tenant_insert  ON purchase_orders;
  DROP POLICY IF EXISTS po_tenant_update  ON purchase_orders;

  CREATE POLICY po_tenant_select ON purchase_orders FOR SELECT USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager', 'warehouse', 'accountant')
  );

  CREATE POLICY po_tenant_insert ON purchase_orders FOR INSERT WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager')
  );

  CREATE POLICY po_tenant_update ON purchase_orders FOR UPDATE USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager', 'warehouse')
  );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table purchase_orders introuvable — policies ignorées.';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS poi_tenant_select ON purchase_order_items;
  DROP POLICY IF EXISTS poi_tenant_insert ON purchase_order_items;
  DROP POLICY IF EXISTS poi_tenant_update ON purchase_order_items;

  CREATE POLICY poi_tenant_select ON purchase_order_items FOR SELECT USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager', 'warehouse', 'accountant')
  );

  CREATE POLICY poi_tenant_insert ON purchase_order_items FOR INSERT WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager')
  );

  CREATE POLICY poi_tenant_update ON purchase_order_items FOR UPDATE USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager', 'warehouse')
  );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table purchase_order_items introuvable — policies ignorées.';
END $$;

-- ── cash_entries ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS cash_entries_tenant_select ON cash_entries;
  DROP POLICY IF EXISTS cash_entries_tenant_insert ON cash_entries;

  CREATE POLICY cash_entries_tenant_select ON cash_entries FOR SELECT USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager', 'cashier', 'accountant')
  );

  CREATE POLICY cash_entries_tenant_insert ON cash_entries FOR INSERT WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager', 'cashier')
  );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table cash_entries introuvable — policies ignorées.';
END $$;

-- ── cash_closings ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS cash_closings_tenant_select ON cash_closings;
  DROP POLICY IF EXISTS cash_closings_tenant_insert ON cash_closings;
  DROP POLICY IF EXISTS cash_closings_tenant_update ON cash_closings;

  CREATE POLICY cash_closings_tenant_select ON cash_closings FOR SELECT USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager', 'cashier', 'accountant')
  );

  CREATE POLICY cash_closings_tenant_insert ON cash_closings FOR INSERT WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager', 'cashier')
  );

  CREATE POLICY cash_closings_tenant_update ON cash_closings FOR UPDATE USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager', 'cashier')
  );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table cash_closings introuvable — policies ignorées.';
END $$;

-- ── sale_returns + sale_return_items ──────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "sale_returns_select" ON sale_returns;
  DROP POLICY IF EXISTS "sale_returns_insert" ON sale_returns;
  DROP POLICY IF EXISTS "sale_returns_update" ON sale_returns;

  CREATE POLICY "sale_returns_select" ON sale_returns FOR SELECT USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager', 'seller', 'warehouse', 'accountant')
  );

  CREATE POLICY "sale_returns_insert" ON sale_returns FOR INSERT WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager', 'seller')
  );

  CREATE POLICY "sale_returns_update" ON sale_returns FOR UPDATE USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager')
  );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table sale_returns introuvable — policies ignorées.';
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "sale_return_items_select" ON sale_return_items;
  DROP POLICY IF EXISTS "sale_return_items_insert" ON sale_return_items;

  CREATE POLICY "sale_return_items_select" ON sale_return_items FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sale_returns sr
      WHERE sr.id = return_id
        AND sr.company_id = get_my_company_id()
        AND get_my_role() IN ('owner', 'manager', 'seller', 'warehouse', 'accountant')
    )
  );

  CREATE POLICY "sale_return_items_insert" ON sale_return_items FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sale_returns sr
      WHERE sr.id = return_id
        AND sr.company_id = get_my_company_id()
        AND get_my_role() IN ('owner', 'manager', 'seller')
    )
  );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table sale_return_items introuvable — policies ignorées.';
END $$;

-- ── sale_payment_schedules ────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS sps_select ON sale_payment_schedules;
  DROP POLICY IF EXISTS sps_insert ON sale_payment_schedules;
  DROP POLICY IF EXISTS sps_update ON sale_payment_schedules;
  DROP POLICY IF EXISTS sps_delete ON sale_payment_schedules;

  CREATE POLICY "sps_select" ON sale_payment_schedules FOR SELECT USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager', 'cashier', 'accountant')
  );

  CREATE POLICY "sps_insert" ON sale_payment_schedules FOR INSERT WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager')
  );

  CREATE POLICY "sps_update" ON sale_payment_schedules FOR UPDATE USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager', 'cashier')
  );

  CREATE POLICY "sps_delete" ON sale_payment_schedules FOR DELETE USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager')
  );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table sale_payment_schedules introuvable — policies ignorées.';
END $$;

-- ── product_categories ────────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "categories_select" ON product_categories;
  DROP POLICY IF EXISTS "categories_insert" ON product_categories;
  DROP POLICY IF EXISTS "categories_update" ON product_categories;

  CREATE POLICY "categories_select" ON product_categories FOR SELECT USING (
    company_id = get_my_company_id()
    AND get_my_role() IN (
      'owner', 'manager', 'seller', 'warehouse', 'accountant', 'field_agent'
    )
  );

  CREATE POLICY "categories_insert" ON product_categories FOR INSERT WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager', 'seller', 'field_agent')
  );

  CREATE POLICY "categories_update" ON product_categories FOR UPDATE USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'manager')
  );
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Table product_categories introuvable — policies ignorées.';
END $$;
