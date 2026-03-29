-- ═══════════════════════════════════════════════════════════════════════════════
-- UCA SGI — Product categories table
--
-- Replaces hardcoded category lists with a per-company, per-type category
-- system. Each company defines its own categories, scoped by product_type.
--
-- Design decisions:
--   - `name`  : display label, user-provided casing (e.g. "Carreaux Sol")
--   - `slug`  : normalized form for uniqueness (e.g. "carreaux sol")
--              lowercase + unaccented + trimmed + collapsed spaces
--   - `usage_count` : materialized counter, incremented by server actions
--              (avoids expensive COUNT(*) on every combobox fetch)
--   - products.category_id FK → product_categories.id
--              (replaces free-text products.category column)
--   - Uniqueness constraint on (company_id, product_type, slug)
--              prevents "Carreaux Sol" / "carreaux sol" duplicates
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Extension for accent-insensitive normalization ────────────────────────────

CREATE EXTENSION IF NOT EXISTS unaccent;

-- ── Normalization function ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION normalize_category_slug(input TEXT)
RETURNS TEXT AS $$
  SELECT lower(trim(regexp_replace(unaccent(input), '\s+', ' ', 'g')))
$$ LANGUAGE sql IMMUTABLE;

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE product_categories (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_type TEXT        NOT NULL
    CHECK (product_type IN ('tile', 'unit', 'linear_m', 'bag', 'liter')),
  name         TEXT        NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  slug         TEXT        NOT NULL,
  usage_count  INTEGER     NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (company_id, product_type, slug)
);

-- Ensure slug is always derived from name on insert/update
CREATE OR REPLACE FUNCTION set_category_slug()
RETURNS TRIGGER AS $$
BEGIN
  NEW.slug := normalize_category_slug(NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_category_slug
  BEFORE INSERT OR UPDATE OF name ON product_categories
  FOR EACH ROW EXECUTE FUNCTION set_category_slug();

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_product_categories_company_type
  ON product_categories (company_id, product_type);

CREATE INDEX idx_product_categories_usage
  ON product_categories (company_id, product_type, usage_count DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- Tenants: read own categories
CREATE POLICY "categories_select" ON product_categories
  FOR SELECT USING (company_id = get_my_company_id());

-- Tenants: owner/admin can insert
CREATE POLICY "categories_insert" ON product_categories
  FOR INSERT WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin')
  );

-- Tenants: owner/admin can update (rename)
CREATE POLICY "categories_update" ON product_categories
  FOR UPDATE USING (company_id = get_my_company_id())
  WITH CHECK (get_my_role() IN ('owner', 'admin'));

-- ── Add category_id FK to products ───────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL;

-- ── Backfill: create categories from existing products (UCA company) ──────────
-- For each distinct (company_id, product_type, category) combination,
-- create a product_categories row and link products back to it.

-- Step 1: insert distinct categories from existing products
INSERT INTO product_categories (company_id, product_type, name, slug, usage_count)
SELECT
  p.company_id,
  COALESCE(p.product_type, 'tile'),
  p.category,
  normalize_category_slug(p.category),
  COUNT(*) AS usage_count
FROM products p
WHERE p.category IS NOT NULL AND trim(p.category) <> ''
GROUP BY p.company_id, COALESCE(p.product_type, 'tile'), p.category
ON CONFLICT (company_id, product_type, slug) DO UPDATE
  SET usage_count = product_categories.usage_count + EXCLUDED.usage_count;

-- Step 2: link products to their category row
UPDATE products p
SET category_id = pc.id
FROM product_categories pc
WHERE pc.company_id = p.company_id
  AND pc.product_type = COALESCE(p.product_type, 'tile')
  AND pc.slug = normalize_category_slug(p.category);

COMMIT;
