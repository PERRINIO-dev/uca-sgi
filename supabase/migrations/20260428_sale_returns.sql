-- ─────────────────────────────────────────────────────────────────────────────
-- Retours clients / Avoirs
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Main return header
CREATE TABLE sale_returns (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sale_id        UUID NOT NULL REFERENCES sales(id),
  return_number  TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CONSTRAINT sale_returns_status_check
                   CHECK (status IN ('pending', 'validated', 'cancelled')),
  resolution     TEXT NOT NULL DEFAULT 'credit_note'
                   CONSTRAINT sale_returns_resolution_check
                   CHECK (resolution IN ('refund', 'credit_note')),
  total_amount   NUMERIC(12, 0) NOT NULL DEFAULT 0
                   CONSTRAINT sale_returns_amount_positive CHECK (total_amount >= 0),
  notes          TEXT,
  created_by     UUID REFERENCES auth.users(id),
  validated_by   UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  validated_at   TIMESTAMPTZ,
  CONSTRAINT sale_returns_number_unique UNIQUE (company_id, return_number)
);

-- 2. Return line items
CREATE TABLE sale_return_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id           UUID NOT NULL REFERENCES sale_returns(id) ON DELETE CASCADE,
  sale_item_id        UUID NOT NULL REFERENCES sale_items(id),
  product_id          UUID NOT NULL REFERENCES products(id),
  qty_returned        NUMERIC(12, 4) NOT NULL
                        CONSTRAINT sale_return_items_qty_positive CHECK (qty_returned > 0),
  unit_price          NUMERIC(12, 0) NOT NULL DEFAULT 0,
  tile_area_m2        NUMERIC(8, 4),
  total_price         NUMERIC(12, 0) NOT NULL DEFAULT 0
);

-- 3. RLS
ALTER TABLE sale_returns      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sale_returns_select"
  ON sale_returns FOR SELECT
  USING (company_id = get_my_company_id());

CREATE POLICY "sale_returns_insert"
  ON sale_returns FOR INSERT
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "sale_returns_update"
  ON sale_returns FOR UPDATE
  USING (company_id = get_my_company_id());

-- Items inherit company scope through the parent return
CREATE POLICY "sale_return_items_select"
  ON sale_return_items FOR SELECT
  USING (
    return_id IN (
      SELECT id FROM sale_returns WHERE company_id = get_my_company_id()
    )
  );

CREATE POLICY "sale_return_items_insert"
  ON sale_return_items FOR INSERT
  WITH CHECK (
    return_id IN (
      SELECT id FROM sale_returns WHERE company_id = get_my_company_id()
    )
  );

-- 4. Auto-generate return number: RET-YYYY-NNNN
CREATE OR REPLACE FUNCTION set_return_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year   TEXT   := to_char(now(), 'YYYY');
  v_series TEXT   := 'RET-' || v_year;
  v_seq    BIGINT;
BEGIN
  INSERT INTO sequence_counters (company_id, series, last_value)
    VALUES (NEW.company_id, v_series, 1)
    ON CONFLICT (company_id, series) DO UPDATE
      SET last_value = sequence_counters.last_value + 1
    RETURNING last_value INTO v_seq;

  NEW.return_number := 'RET-' || v_year || '-' || lpad(v_seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_return_number
  BEFORE INSERT ON sale_returns
  FOR EACH ROW EXECUTE FUNCTION set_return_number();

-- 5. validate_sale_return — SECURITY DEFINER so it can update stock across tables.
--    Restores stock (total_qty only — reserved_qty is untouched since goods
--    are being returned after delivery, not cancelling a reservation).
CREATE OR REPLACE FUNCTION validate_sale_return(
  p_return_id    UUID,
  p_validated_by UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_return sale_returns%ROWTYPE;
  v_item   sale_return_items%ROWTYPE;
BEGIN
  SELECT * INTO v_return
    FROM sale_returns
    WHERE id = p_return_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Return % not found', p_return_id;
  END IF;

  IF v_return.status <> 'pending' THEN
    RAISE EXCEPTION 'Return % is not in pending state (current: %)',
      p_return_id, v_return.status;
  END IF;

  -- Restore stock for each returned item
  FOR v_item IN
    SELECT * FROM sale_return_items WHERE return_id = p_return_id
  LOOP
    UPDATE stock
      SET total_qty       = total_qty + v_item.qty_returned,
          last_updated_at = now()
      WHERE product_id = v_item.product_id
        AND company_id = v_return.company_id;
  END LOOP;

  -- Mark return validated
  UPDATE sale_returns
    SET status       = 'validated',
        validated_at = now(),
        validated_by = p_validated_by
    WHERE id = p_return_id;

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION validate_sale_return(UUID, UUID) TO service_role;
