-- ─────────────────────────────────────────────────────────────────────────────
-- REFONTE RÔLES — Phase 0 : extension de l'enum user_role
-- À appliquer EN PREMIER, SEUL, avant les migrations phase1 et phase2.
-- PostgreSQL ne peut pas utiliser une nouvelle valeur d'enum dans la même
-- transaction où elle a été créée — cette migration doit donc être commitée
-- avant de lancer la phase1.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'seller';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'cashier';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'delivery';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'accountant';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'field_agent';
