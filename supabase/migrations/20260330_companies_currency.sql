-- ═══════════════════════════════════════════════════════════════════════════════
-- UCA SGI — Add currency column to companies
--
-- Each company can define its own currency code (e.g. FCFA, EUR, USD, XAF).
-- Existing companies default to FCFA (the original platform currency).
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'FCFA';
