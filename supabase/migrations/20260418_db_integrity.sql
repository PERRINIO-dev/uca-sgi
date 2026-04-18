-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260418_db_integrity
--
-- Addresses 10 structural findings from a full-database audit.
-- Applied BEFORE 20260418_rename_stock_columns — functions here still use
-- the old column names (total_tiles / reserved_tiles); the rename migration
-- will rebuild them with the final names.
--
-- Findings addressed:
--   1. audit_logs.company_id — nullable for platform-level events
--   2. audit_logs_select RLS — platform admin can read NULL-company_id rows
--   3. audit_action_type enum — add every value used in application code
--   4. Security trigger — DB-level audit of role / privilege escalations
--   5. sales.status CHECK constraint
--   6. sales.vendor_id FK RESTRICT
--   7. products tile-column completeness CHECK
--   8. reserve_stock_on_sale   INTEGER → NUMERIC
--   9. release_stock_on_cancel INTEGER → NUMERIC
--  10. DROP dead code: generate_sale_number()
--  11. RLS optimisation: short-circuit EXISTS for owner / admin on
--      sale_items and sale_payments
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. audit_logs.company_id — allow NULL for platform events ────────────────
-- Platform admin actions (company creation, cross-company user management)
-- have no meaningful company_id.  NULL FK is valid in PostgreSQL: NULL simply
-- means "no referenced row" and never violates the constraint.

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_company_id_fk;
ALTER TABLE audit_logs ALTER COLUMN company_id DROP NOT NULL;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_company_id_fk
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

-- Allow NULL user_id as well (security trigger fires from service-role context
-- where auth.uid() returns NULL).
ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL;

-- ── 2. audit_logs_select RLS ──────────────────────────────────────────────────
-- Previous policy: company_id = get_my_company_id() AND role IN ('owner','admin')
-- Gap: platform admins could not read NULL-company_id rows from platform events.

DROP POLICY IF EXISTS audit_logs_select ON audit_logs;

CREATE POLICY audit_logs_select ON audit_logs
  FOR SELECT TO authenticated
  USING (
    -- Tenant-scoped events (company events, sales, products…)
    (
      company_id IS NOT NULL
      AND company_id = get_my_company_id()
      AND get_my_role() IN ('owner', 'admin')
    )
    OR
    -- Platform-level events (NULL company_id: company creation, cross-tenant
    -- user management…) — readable by platform admins only.
    (company_id IS NULL AND is_platform_admin())
  );

-- ── 3. audit_action_type — comprehensive enum coverage ────────────────────────
-- ADD VALUE IF NOT EXISTS is idempotent; safe if a value already exists.
-- Any action_type string used in TypeScript but absent from the enum silently
-- makes the INSERT fail (error code 22P02) with no visible error to the caller.

ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'SALE_CREATED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'SALE_CANCELLED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'PRODUCT_CREATED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'PRODUCT_UPDATED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'PRODUCT_DELETED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'ORDER_PREPARING';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'ORDER_READY';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'ORDER_DELIVERED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'STOCK_REQUEST_APPROVED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'STOCK_REQUEST_REJECTED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'STOCK_REQUEST_SUBMITTED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'USER_CREATED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'USER_UPDATED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'USER_ACTIVATED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'USER_DEACTIVATED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'BOUTIQUE_CREATED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'BOUTIQUE_ACTIVATED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'BOUTIQUE_DEACTIVATED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'PASSWORD_RESET';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'FLOOR_PRICE_VIOLATION_ATTEMPT';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'QUOTE_CREATED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'QUOTE_CONVERTED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'QUOTE_CANCELLED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'USER_ROLE_CHANGED';

-- ── 4. Security trigger — detect privilege escalation ─────────────────────────
-- Fires on every UPDATE that changes users.role or users.is_platform_admin.
-- Provides a second line of defense beyond application-level audit logging;
-- catches out-of-band changes (e.g. direct SQL, compromised service key).
-- The insert is best-effort (EXCEPTION block) — the trigger never blocks the
-- underlying UPDATE even if the audit write fails.
--
-- Limitation: changes performed via the service role have auth.uid() = NULL,
-- so user_id will be NULL in those audit rows.  That is intentional: a NULL
-- user_id in USER_ROLE_CHANGED rows indicates a system-level or OOB change
-- and is itself a signal worth investigating.

CREATE OR REPLACE FUNCTION audit_user_privilege_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role
     OR OLD.is_platform_admin IS DISTINCT FROM NEW.is_platform_admin
  THEN
    BEGIN
      INSERT INTO audit_logs (
        user_id,
        user_role_snapshot,
        action_type,
        entity_type,
        entity_id,
        company_id,
        data_before,
        data_after
      ) VALUES (
        auth.uid(),
        COALESCE(get_my_role(), 'system'),
        'USER_ROLE_CHANGED',
        'users',
        NEW.id,
        NEW.company_id,
        jsonb_build_object(
          'role',              OLD.role,
          'is_platform_admin', OLD.is_platform_admin
        ),
        jsonb_build_object(
          'role',              NEW.role,
          'is_platform_admin', NEW.is_platform_admin
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_user_privilege_changes ON users;
CREATE TRIGGER audit_user_privilege_changes
  AFTER UPDATE OF role, is_platform_admin ON users
  FOR EACH ROW
  EXECUTE FUNCTION audit_user_privilege_change();

-- ── 5. sales.status CHECK ──────────────────────────────────────────────────────
-- Prevents any unrecognised status value from entering the table at the DB level.

ALTER TABLE sales ADD CONSTRAINT sales_status_check
  CHECK (status IN ('draft', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'));

-- ── 6. sales.vendor_id FK ─────────────────────────────────────────────────────
-- Ensures every sale references a real user row.  ON DELETE RESTRICT because
-- users in this system are never hard-deleted (only deactivated).

ALTER TABLE sales ADD CONSTRAINT sales_vendor_id_fk
  FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE RESTRICT;

-- ── 7. products tile-column completeness CHECK ────────────────────────────────
-- A tile product without tiles_per_carton or tile_area_m2 breaks stock
-- calculations silently (NULL propagates through arithmetic).

ALTER TABLE products ADD CONSTRAINT products_tile_columns_check
  CHECK (
    product_type != 'tile'
    OR (tiles_per_carton IS NOT NULL AND tile_area_m2 IS NOT NULL)
  );

-- ── 8. reserve_stock_on_sale — INTEGER → NUMERIC ──────────────────────────────
-- INTEGER silently truncates non-tile quantities (e.g. 2.5 linear metres → 2),
-- causing both over-reservation and incorrect availability checks.

DROP FUNCTION IF EXISTS reserve_stock_on_sale(UUID, INTEGER);

CREATE OR REPLACE FUNCTION reserve_stock_on_sale(
  p_product_id UUID,
  p_quantity    NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available NUMERIC;
BEGIN
  SELECT total_tiles - reserved_tiles
  INTO   v_available
  FROM   stock
  WHERE  product_id = p_product_id
  FOR    UPDATE;

  IF v_available IS NULL OR v_available < p_quantity THEN
    RETURN FALSE;
  END IF;

  UPDATE stock
  SET    reserved_tiles = reserved_tiles + p_quantity
  WHERE  product_id = p_product_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION reserve_stock_on_sale(UUID, NUMERIC) TO service_role;

-- ── 9. release_stock_on_cancel — INTEGER → NUMERIC ────────────────────────────

DROP FUNCTION IF EXISTS release_stock_on_cancel(UUID, INTEGER);

CREATE OR REPLACE FUNCTION release_stock_on_cancel(
  p_product_id UUID,
  p_quantity   NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE stock
  SET    reserved_tiles = GREATEST(0, reserved_tiles - p_quantity)
  WHERE  product_id = p_product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION release_stock_on_cancel(UUID, NUMERIC) TO service_role;

-- ── 10. Drop dead code ────────────────────────────────────────────────────────
-- generate_sale_number() was superseded by the set_sale_number() trigger and
-- later by sequence_counters.  All overloads dropped.

DROP FUNCTION IF EXISTS generate_sale_number();
DROP FUNCTION IF EXISTS generate_sale_number(UUID);
DROP FUNCTION IF EXISTS generate_sale_number(UUID, TEXT);
DROP FUNCTION IF EXISTS generate_sale_number(UUID, TEXT, TEXT);

-- ── 11. Optimise sale_items_select and sale_payments_select RLS ───────────────
-- The original policies wrap a correlated EXISTS(SELECT … FROM sales) on every
-- row evaluation, regardless of role.  Restructured to short-circuit for
-- owner / admin (no subquery needed) so the correlated lookup only fires for
-- vendors — significantly cheaper as sale_items / sale_payments tables grow.

DROP POLICY IF EXISTS sale_items_select ON sale_items;
CREATE POLICY sale_items_select ON sale_items
  FOR SELECT TO authenticated
  USING (
    company_id = get_my_company_id()
    AND (
      get_my_role() IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1 FROM sales
        WHERE id        = sale_items.sale_id
          AND vendor_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS sale_payments_select ON sale_payments;
CREATE POLICY sale_payments_select ON sale_payments
  FOR SELECT TO authenticated
  USING (
    company_id = get_my_company_id()
    AND (
      get_my_role() IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1 FROM sales
        WHERE id        = sale_payments.sale_id
          AND vendor_id = auth.uid()
      )
    )
  );

COMMIT;
