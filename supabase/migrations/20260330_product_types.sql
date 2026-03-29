-- ═══════════════════════════════════════════════════════════════════════════════
-- UCA SGI — Multi-type product model
--
-- Extends the products table to support product types beyond tiles:
--   tile       — carreaux, revêtements m² (logique existante inchangée)
--   unit       — pièce (sanitaires, robinetterie, meubles, accessoires)
--   linear_m   — mètre linéaire (profilés, plinthes, seuils, cornières)
--   bag        — sac/conditionnement pondéral (colle, joint, ciment)
--   liter      — volume (peinture, étanchéité, produits liquides)
--
-- PRINCIPE : la logique tile existante est intouchable.
-- Tous les nouveaux champs sont additifs et nullable pour les produits tile.
-- product_type = 'tile' par défaut → aucune rupture sur les données existantes.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Type ─────────────────────────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN product_type TEXT NOT NULL DEFAULT 'tile'
    CHECK (product_type IN ('tile', 'unit', 'linear_m', 'bag', 'liter'));

-- ── Display labels ────────────────────────────────────────────────────────────
-- unit_label    : unité d'affichage du produit ('m²', 'pièce', 'm', 'sac', 'L')
-- package_label : unité de conditionnement ('carton', 'boîte', 'palette', 'lot')

ALTER TABLE products
  ADD COLUMN unit_label    TEXT NOT NULL DEFAULT 'm²',
  ADD COLUMN package_label TEXT NOT NULL DEFAULT 'carton';

-- ── Generic pricing (non-tile types) ─────────────────────────────────────────
-- Les produits tile continuent d'utiliser floor_price_per_m2 / reference_price_per_m2.
-- Les autres types utilisent ces deux colonnes (prix par unit_label).

ALTER TABLE products
  ADD COLUMN floor_price_per_unit     NUMERIC CHECK (floor_price_per_unit     >= 0),
  ADD COLUMN reference_price_per_unit NUMERIC CHECK (reference_price_per_unit >= 0);

-- ── Type-specific physical attributes ────────────────────────────────────────

ALTER TABLE products
  -- linear_m : longueur d'une barre/pièce en mètres (ex: 2.5 pour un profilé 2.5m)
  ADD COLUMN piece_length_m     NUMERIC CHECK (piece_length_m     > 0),

  -- liter : volume d'un contenant en litres (ex: 5, 10, 20)
  ADD COLUMN container_volume_l NUMERIC CHECK (container_volume_l > 0),

  -- bag : poids d'un sac en kg (ex: 25, 50) — optionnel pour le calcul du poids total
  ADD COLUMN bag_weight_kg      NUMERIC CHECK (bag_weight_kg      > 0),

  -- unit/bag/liter : unités par conditionnement (lot/boîte) — optionnel
  ADD COLUMN pieces_per_package INTEGER CHECK (pieces_per_package > 0);

-- ── Backfill existing products ────────────────────────────────────────────────
-- Déjà couvert par DEFAULT 'tile', 'm²', 'carton' sur les colonnes ci-dessus.
-- Mise à jour explicite pour cohérence des données.

UPDATE products SET
  product_type  = 'tile',
  unit_label    = 'm²',
  package_label = 'carton'
WHERE product_type = 'tile';

-- ── Index ─────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_products_type ON products (company_id, product_type);

COMMIT;
