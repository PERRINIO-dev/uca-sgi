-- ─────────────────────────────────────────────────────────────────────────────
-- T3.2 + T3.3 — Supplier catalog + Purchase orders
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Suppliers ─────────────────────────────────────────────────────────────────

CREATE TABLE suppliers (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id   UUID        NOT NULL REFERENCES companies(id),
  name         TEXT        NOT NULL CHECK (char_length(trim(name)) >= 2),
  contact_name TEXT,
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  notes        TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suppliers_company ON suppliers (company_id);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_tenant_select" ON suppliers
  FOR SELECT USING (company_id = get_my_company_id());

CREATE POLICY "suppliers_tenant_insert" ON suppliers
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "suppliers_tenant_update" ON suppliers
  FOR UPDATE USING (company_id = get_my_company_id());

-- ── Purchase orders ───────────────────────────────────────────────────────────

CREATE TABLE purchase_orders (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id     UUID        NOT NULL REFERENCES companies(id),
  supplier_id    UUID        NOT NULL REFERENCES suppliers(id),
  order_number   TEXT        NOT NULL DEFAULT '',
  status         TEXT        NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft', 'ordered', 'partial', 'received', 'cancelled')),
  expected_date  DATE,
  notes          TEXT,
  total_amount   NUMERIC(14,0) NOT NULL DEFAULT 0,
  created_by     UUID        NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at    TIMESTAMPTZ,
  UNIQUE (company_id, order_number)
);

CREATE INDEX idx_po_company  ON purchase_orders (company_id, created_at DESC);
CREATE INDEX idx_po_supplier ON purchase_orders (supplier_id);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po_tenant_select" ON purchase_orders
  FOR SELECT USING (company_id = get_my_company_id());

CREATE POLICY "po_tenant_insert" ON purchase_orders
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "po_tenant_update" ON purchase_orders
  FOR UPDATE USING (company_id = get_my_company_id());

-- ── Purchase order items ──────────────────────────────────────────────────────

CREATE TABLE purchase_order_items (
  id            UUID           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id    UUID           NOT NULL REFERENCES companies(id),
  order_id      UUID           NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id    UUID           NOT NULL REFERENCES products(id),
  qty_ordered   NUMERIC(10,2)  NOT NULL CHECK (qty_ordered > 0),
  unit_price    NUMERIC(12,0)  NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  qty_received  NUMERIC(10,2)  NOT NULL DEFAULT 0 CHECK (qty_received >= 0)
);

CREATE INDEX idx_poi_order ON purchase_order_items (order_id);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "poi_tenant_select" ON purchase_order_items
  FOR SELECT USING (company_id = get_my_company_id());

CREATE POLICY "poi_tenant_insert" ON purchase_order_items
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "poi_tenant_update" ON purchase_order_items
  FOR UPDATE USING (company_id = get_my_company_id());

-- ── PO number trigger (PO-YYYY-NNNN via sequence_counters) ───────────────────

CREATE OR REPLACE FUNCTION set_po_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year   TEXT;
  v_series TEXT;
  v_next   INTEGER;
BEGIN
  v_year   := to_char(now() AT TIME ZONE 'Africa/Douala', 'YYYY');
  v_series := 'PO-' || v_year;

  INSERT INTO sequence_counters (company_id, series, last_value)
  VALUES (NEW.company_id, v_series, 1)
  ON CONFLICT (company_id, series)
  DO UPDATE SET last_value = sequence_counters.last_value + 1
  RETURNING last_value INTO v_next;

  NEW.order_number := 'PO-' || v_year || '-' || lpad(v_next::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_po_insert
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW
  WHEN (NEW.order_number = '' OR NEW.order_number IS NULL)
  EXECUTE FUNCTION set_po_number();

-- ── receive_po_items(order_id, receipts JSONB) ────────────────────────────────
-- Atomically increments qty_received on items and updates stock.total_qty.
-- receipts = [{"item_id": "...", "qty": 5}, ...]
-- Returns the new order status ('partial' | 'received').

CREATE OR REPLACE FUNCTION receive_po_items(
  p_order_id UUID,
  p_receipts JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt        JSONB;
  v_item           RECORD;
  v_company_id     UUID;
  v_new_qty        NUMERIC;
  v_total_ordered  NUMERIC;
  v_total_received NUMERIC;
BEGIN
  SELECT company_id INTO v_company_id
  FROM purchase_orders
  WHERE id = p_order_id AND status IN ('ordered', 'partial');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or not in a receivable status.';
  END IF;

  FOR v_receipt IN SELECT * FROM jsonb_array_elements(p_receipts)
  LOOP
    v_new_qty := COALESCE((v_receipt->>'qty')::NUMERIC, 0);
    IF v_new_qty <= 0 THEN CONTINUE; END IF;

    SELECT * INTO v_item
    FROM purchase_order_items
    WHERE id = (v_receipt->>'item_id')::UUID
      AND order_id = p_order_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item not found: %', (v_receipt->>'item_id');
    END IF;

    -- Cap at ordered quantity
    v_new_qty := LEAST(v_new_qty, v_item.qty_ordered - v_item.qty_received);
    IF v_new_qty <= 0 THEN CONTINUE; END IF;

    UPDATE purchase_order_items
    SET qty_received = qty_received + v_new_qty
    WHERE id = v_item.id;

    -- Update stock — the stock row must exist (created by product creation trigger)
    UPDATE stock
    SET total_qty = total_qty + v_new_qty
    WHERE product_id = v_item.product_id
      AND company_id  = v_company_id;
  END LOOP;

  -- Recompute order status
  SELECT SUM(qty_ordered), SUM(qty_received)
  INTO v_total_ordered, v_total_received
  FROM purchase_order_items
  WHERE order_id = p_order_id;

  IF v_total_received >= v_total_ordered THEN
    UPDATE purchase_orders
    SET status = 'received', received_at = now()
    WHERE id = p_order_id;
    RETURN 'received';
  ELSE
    UPDATE purchase_orders
    SET status = 'partial'
    WHERE id = p_order_id;
    RETURN 'partial';
  END IF;
END;
$$;
