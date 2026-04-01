# UCA SGI — Système de Gestion Interne

**UCA (Univers de Carreaux et Ameublement)** — système de gestion interne pour
une entreprise d'import et de vente de carreaux basée à Yaoundé, Cameroun.

Développé par **Majestor Kepseu**.

---

## 1. Contexte métier

L'entreprise exploite :
- Plusieurs boutiques de vente
- 1 entrepôt central
- Devise : FCFA (XAF)
- Langue : Français partout

Ce système remplace des opérations entièrement manuelles. C'est un **outil
interne uniquement** — aucune fonctionnalité n'est orientée client.

Le système est aujourd'hui une **plateforme SaaS multi-tenant** : plusieurs
entreprises indépendantes coexistent dans la même base de données, isolées par
RLS via `company_id`.

---

## 2. Stack technique

| Couche          | Technologie                                                |
|-----------------|------------------------------------------------------------|
| Framework       | Next.js 16.1.6 (App Router, Turbopack)                     |
| Base de données | Supabase (PostgreSQL) — projet : xqucalengkzdogghvhca      |
| Auth            | Supabase Auth (GoTrue) — email/mot de passe uniquement     |
| Temps réel      | Supabase Realtime (postgres_changes sur `sales`, `stock_requests`) |
| Push            | Web Push API + VAPID (package npm `web-push`)              |
| PWA             | Service Worker (`public/sw.js`), Web App Manifest          |
| Styles          | Styles inline (pas de Tailwind, pas de CSS modules)        |
| Graphiques      | Recharts                                                   |
| Hébergement     | Vercel — https://uca-sgi.vercel.app                        |
| Police          | `system-ui, -apple-system, 'Segoe UI', sans-serif`         |

> **Note :** Georgia serif est utilisé UNIQUEMENT pour le logo UCA dans la
> barre latérale.

**Contrainte clé :** Next.js 16.1.6 utilise `proxy.ts` et non `middleware.ts`.
La fonction exportée doit s'appeler `proxy`, pas `middleware`.

---

## 3. Variables d'environnement

Fichier : `.env.local` à la racine du projet.

```
NEXT_PUBLIC_SUPABASE_URL=https://xqucalengkzdogghvhca.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

> `SUPABASE_SERVICE_ROLE_KEY` et `VAPID_PRIVATE_KEY` ne doivent JAMAIS être
> exposés côté client. Ils sont utilisés uniquement dans les server actions
> (fichiers `'use server'`).

Ces cinq variables doivent également être définies dans le **dashboard Vercel**
sous Paramètres → Variables d'environnement.

---

## 4. Structure des fichiers

```
src/
├── proxy.ts                          ← Proxy d'auth (remplace middleware.ts)
├── components/
│   ├── Sidebar.tsx                   ← Barre latérale (240px, navy, SVG icons)
│   ├── PageLayout.tsx                ← Wrapper auth + en-tête mobile + enregistrement SW
│   ├── PwaInstallPrompt.tsx          ← Bannière "Ajouter à l'écran d'accueil"
│   ├── NetworkStatusBanner.tsx       ← Bandeau hors ligne
│   ├── OnboardingTour.tsx            ← Tour guidé premier lancement
│   └── PushSubscription.tsx          ← Carte opt-in notifications (après connexion)
├── hooks/
│   └── useIsMobile.ts                ← Hook SSR-safe (breakpoint 768px)
├── lib/
│   ├── types.ts                      ← UserRole, ProductType, Product, Sale, etc.
│   ├── constants.ts                  ← Seuils stock (LOW_STOCK_CARTONS/UNITS…)
│   ├── format.ts                     ← fmtCurrency
│   ├── pluralize.ts                  ← Pluralisation française (sac→sacs, eau→eaux…)
│   ├── signature-b64.ts
│   ├── push/
│   │   └── send.ts                   ← sendPushToRoles() / sendPushToUser()
│   └── supabase/
│       ├── client.ts
│       ├── server.ts
│       ├── admin.ts                  ← Client service-role (actions serveur uniquement)
│       ├── badge-counts.ts
│       └── queries.ts
├── app/
│   ├── layout.tsx                    ← Métadonnées PWA + export viewport
│   ├── page.tsx                      ← Redirect / vers /login ou /dashboard
│   ├── manifest.ts                   ← Web App Manifest (route Next.js)
│   ├── icon.tsx                      ← Icône PWA 512×512 (ImageResponse)
│   ├── apple-icon.tsx                ← Apple touch icon 180×180
│   ├── error.tsx / global-error.tsx  ← Gestion erreurs globale
│   ├── not-found.tsx
│   ├── login/page.tsx                ← Écran divisé, crédit auteur
│   ├── auth/callback/route.ts        ← Échange de session + redirect par rôle
│   ├── api/push/subscribe/route.ts   ← POST/DELETE endpoint abonnement push
│   ├── admin/
│   │   ├── page.tsx                  ← Accès réservé is_platform_admin
│   │   ├── AdminClient.tsx           ← Gestion entreprises, utilisateurs, logs
│   │   └── actions.ts                ← toggleCompanyActive, resetPassword, suspendUser…
│   ├── dashboard/
│   │   ├── page.tsx
│   │   ├── DashboardClient.tsx       ← Abonnement Realtime sur stock_requests
│   │   └── actions.ts                ← approveStockRequest, rejectStockRequest + push
│   ├── sales/
│   │   ├── page.tsx                  ← Pagination + filtres côté serveur
│   │   ├── loading.tsx               ← Squelette chargement (évite le flash)
│   │   ├── SalesListClient.tsx       ← Abonnement Realtime sur sales
│   │   ├── actions.ts                ← createSale, cancelSale, addPayment + push
│   │   └── new/
│   │       ├── page.tsx
│   │       └── VendorSaleForm.tsx    ← Liste produits recherchable, impression reçu
│   ├── warehouse/
│   │   ├── page.tsx
│   │   ├── WarehouseClient.tsx       ← Realtime sales + stock_requests ; combobox produit
│   │   └── actions.ts                ← updateOrderStatus, submitStockRequest + push
│   ├── products/
│   │   ├── page.tsx
│   │   ├── ProductsClient.tsx        ← Formulaire dynamique par type, filtre type, alertes
│   │   └── actions.ts                ← CRUD produits, getProductCategories (filtre company_id)
│   ├── users/
│   │   ├── page.tsx
│   │   ├── UsersClient.tsx
│   │   └── actions.ts
│   └── reports/
│       ├── page.tsx
│       └── ReportsClient.tsx         ← Vue d'ensemble / ventes / produits / vendeurs + CSV
public/
├── sw.js                             ← Service Worker v2 (cache statique + fallback offline)
└── offline.html                      ← Page hors ligne de secours
```

---

## 5. Architecture multi-tenant

### Principe
- La table `companies` est l'entité racine de chaque tenant
- Toutes les tables opérationnelles ont une colonne `company_id UUID NOT NULL`
- L'isolation est assurée par **Row Level Security (RLS)** via deux fonctions
  `SECURITY DEFINER` :
  - `get_my_company_id()` — lit `users.company_id` pour `auth.uid()`
  - `get_my_role()` — lit `users.role` pour `auth.uid()`

### Tables tenant
`boutiques`, `users`, `products`, `product_categories`, `stock`,
`stock_requests`, `sales`, `sale_items`, `sale_payments`, `orders`,
`audit_logs`

### Client côté serveur
Les requêtes du client authentifié **n'ont pas besoin de filtre `company_id`
explicite** — RLS le gère de façon transparente. Les actions qui utilisent le
client service-role ajoutent `.eq('company_id', ...)` en défense en profondeur.

### Admin plateforme
- Un compte avec `is_platform_admin = true` et `company_id = NULL` est
  l'**opérateur plateforme**
- Il accède à `/admin` (interdit à tous les autres rôles)
- Il voit toutes les entreprises, peut les activer/désactiver, réinitialiser les
  mots de passe et suspendre des utilisateurs
- La suspension d'une entreprise déclenche un ban Auth sur **tous** ses
  utilisateurs via `admin.auth.admin.updateUserById({ ban_duration: '876000h' })`

---

## 6. Schéma de base de données

### ENUMs
```sql
user_role:             owner | admin | vendor | warehouse
product_type:          tile | unit | linear_m | bag | liter
stock_request_type:    stock_in | correction
stock_request_status:  pending | approved | rejected
sale_status:           draft | confirmed | preparing | ready | delivered | cancelled
audit_action_type:     USER_* | PRODUCT_* | STOCK_REQUEST_* | SALE_* | ORDER_*
                       FLOOR_PRICE_VIOLATION_ATTEMPT | LOGIN_* | PASSWORD_RESET
                       PAYMENT_RECORDED | BOUTIQUE_* | COMPANY_CREATED
                       COMPANY_ACTIVATED | COMPANY_DEACTIVATED
                       PLATFORM_USER_SUSPENDED | PLATFORM_USER_REACTIVATED
                       PLATFORM_USER_PASSWORD_RESET
```

### companies
```
id, name, slug (UNIQUE), is_active, created_at
```
> UUID de UCA : `00000000-0000-0000-0000-000000000001`

### boutiques
```
id, company_id, name, address, phone, is_active, created_at
```

### users — étend auth.users
```
id (FK auth.users), company_id (FK companies, nullable pour platform_admin),
email, full_name, role (user_role), boutique_id (FK boutiques, nullable),
is_active, is_platform_admin, created_at
CONTRAINTE: vendor_requires_boutique — les vendeurs doivent avoir boutique_id
```

### products
```
id, company_id, reference_code (UNIQUE par company), name, category,
category_id (FK product_categories, nullable), supplier,
product_type (DEFAULT 'tile'), unit_label, package_label,
-- Champs tile (nullable pour les autres types)
width_cm, height_cm, tiles_per_carton,
tile_area_m2 (GENERATED), carton_area_m2 (GENERATED),
floor_price_per_m2, reference_price_per_m2,
-- Champs types génériques
floor_price_per_unit, reference_price_per_unit, purchase_price,
-- Attributs physiques par type
piece_length_m,     -- linear_m : longueur d'une barre/pièce (m)
container_volume_l, -- liter    : volume par contenant (L)
bag_weight_kg,      -- bag      : poids par sac (kg)
pieces_per_package, -- unit/bag/liter : unités par lot/boîte (optionnel)
is_active, created_at, updated_at
```

### product_categories
```
id, company_id, product_type, name,
slug (normalisé via unaccent + lowercase, UNIQUE par company+type),
usage_count, created_at
```

### stock — une ligne par produit
```
id, product_id (UNIQUE FK), company_id,
total_tiles, reserved_tiles,
last_updated_at, last_updated_by
```

### stock_view — vue calculée (ne pas modifier directement)
```
product_id, company_id, product_name, reference_code,
tiles_per_carton, tile_area_m2,
total_tiles, reserved_tiles, available_tiles,
available_full_cartons, loose_tiles, available_m2, full_cartons
```
> Vue déclarée avec `security_invoker = on` — hérite automatiquement du RLS
> de l'appelant.

### stock_requests — workflow d'approbation
```
id, company_id, created_at, requested_by (FK users), product_id (FK products),
request_type, quantity_tiles_delta, justification, status,
reviewed_by, reviewed_at, review_comment,
stock_before_tiles, stock_after_tiles
```

### sales
```
id, company_id, created_at,
sale_number (auto: VNT-YYYY-NNNN par company × année),
boutique_id, vendor_id, customer_name, customer_phone, customer_cni,
total_amount, amount_paid,
payment_status (unpaid | partial | paid),
status (sale_status), notes, updated_at
```

> `amount_paid` et `payment_status` sont synchronisés par le trigger
> `sync_sale_payment_totals` à chaque insertion dans `sale_payments`.

### sale_payments — paiements partiels / multiples
```
id, sale_id (FK sales), amount, notes, created_by (FK users), created_at
```

### sale_items — snapshots au moment de la vente
```
id, sale_id, product_id,
quantity_tiles, unit_price_per_m2, total_price,
floor_price_snapshot, reference_price_snapshot,
tile_area_m2_snapshot, tiles_per_carton_snapshot
```

### orders — 1:1 avec sales, workflow entrepôt
```
id, company_id (hérité de la vente via trigger),
sale_id (UNIQUE FK),
order_number (auto: CMD-YYYY-NNNN par company × année),
status, assigned_to, expected_delivery_date,
preparation_started_at, preparation_confirmed_at,
delivery_confirmed_by, delivery_confirmed_at
```

### audit_logs — INSERT uniquement (immuable)
```
id, created_at, user_id, company_id, user_role_snapshot,
action_type, entity_type, entity_id,
data_before, data_after, ip_address
```

### push_subscriptions
```sql
id (uuid PK), user_id (FK auth.users ON DELETE CASCADE),
endpoint (UNIQUE), subscription (jsonb), created_at
RLS : chaque utilisateur gère uniquement ses propres lignes
```

---

## 7. Fonctions et triggers

### Triggers actifs

| Trigger | Table | Fonction | Notes |
|---------|-------|----------|-------|
| `on_auth_user_created` | auth.users | `handle_new_auth_user()` | NO-OP — `public.users` inséré manuellement via client admin |
| `on_product_created` | products | `create_stock_entry_for_product()` | SECURITY DEFINER — crée la ligne stock à 0, inclut `company_id` |
| `on_sale_status_change` | sales | `reserve_stock_on_sale_insert()` | Ceinture-bretelles ; `createSale` gère `reserved_tiles` explicitement |
| `on_order_delivered` | orders | `deduct_stock_on_delivery()` | SECURITY DEFINER — déduit `total_tiles` + `reserved_tiles` |
| `set_sale_number` | sales | Auto-numérotation | VNT-YYYY-NNNN par company × année |
| `set_order_number` | orders | Auto-numérotation | CMD-YYYY-NNNN + hérite `company_id` de la vente |
| `set_product_category_slug` | product_categories | Normalisation slug | `unaccent + lowercase` |

### Fonctions RPC clés
```sql
apply_approved_stock_request(request_id UUID)
-- SECURITY DEFINER
-- Appelée depuis dashboard/actions.ts → approveStockRequest()
-- Met à jour stock.total_tiles, enregistre stock_after_tiles

decrement_stock_on_delivery(p_product_id UUID, p_quantity INTEGER)
-- SECURITY DEFINER
-- Appelée depuis warehouse/actions.ts → updateOrderStatus() à la livraison
-- UPDATE atomique : total_tiles et reserved_tiles décrémentés en une seule
-- instruction (aucune race condition)

get_my_company_id() RETURNS UUID  -- SECURITY DEFINER, utilisée par les politiques RLS
get_my_role() RETURNS TEXT        -- SECURITY DEFINER, utilisée par les politiques RLS
```

### Supabase Realtime
Les tables `sales` et `stock_requests` doivent être dans la publication
`supabase_realtime` :
**Dashboard Supabase → Database → Publications → supabase_realtime**
→ activer `sales` et `stock_requests`.

---

## 8. Résumé des politiques RLS

> `stock.UPDATE` est bloqué pour tous les rôles sauf via triggers SECURITY
> DEFINER et opérations service-role.
> `audit_logs` : INSERT uniquement — pas d'UPDATE ni de DELETE.
> `orders.UPDATE` est bloqué pour les vendeurs.

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| companies | — | service-role | service-role | — |
| boutiques | authentifié | — | owner/admin | — |
| users | soi-même OU owner/admin | — (client admin) | owner/admin | — |
| products | authentifié | owner/admin | owner/admin | — |
| product_categories | authentifié (même company) | authentifié | owner/admin | owner/admin |
| stock | authentifié | owner/admin | owner/admin + trigger | — |
| stock_requests | propres OU owner/admin | authentifié | owner/admin | — |
| sales | vendor → ses ventes ; owner/admin → toutes | vendor/admin/owner | owner/admin | — |
| sale_items | via jointure sales | vendor/admin/owner | — | — |
| orders | warehouse/admin/owner | vendor/admin/owner | warehouse/admin/owner | — |
| audit_logs | owner/admin | authentifié | JAMAIS | JAMAIS |
| push_subscriptions | propres lignes | propres lignes | propres lignes | propres lignes |

---

## 9. Rôles et contrôle d'accès

| Rôle | Route d'accueil | Accès |
|------|----------------|-------|
| `owner` | `/dashboard` | Tout |
| `admin` | `/dashboard` | Tout sauf actions réservées owner |
| `vendor` | `/sales` | `/sales`, `/sales/new` |
| `warehouse` | `/warehouse` | `/warehouse` |
| `platform_admin` | `/admin` | `/admin` uniquement — isolé des données tenant |

**Visibilité barre latérale :**
```
owner/admin :      Dashboard, Ventes, Entrepôt, Catalogue, Utilisateurs, Rapports
vendor :           Ventes uniquement
warehouse :        Entrepôt uniquement
platform_admin :   Aucune navigation normale — interface /admin dédiée
```

**Contrôle `is_active` :**
- Chaque `page.tsx` protégé vérifie `profile.is_active` et redirige vers
  `/login?error=account_suspended` si faux
- `proxy.ts` vérifie également `is_active` à chaque requête et déconnecte la
  session via `supabase.auth.signOut()` si le compte est suspendu

---

## 10. Modèle produit multi-type

Cinq types de produits, chacun avec sa logique de stock et d'affichage :

| Type | Description | Unité typique | Logique stock |
|------|-------------|---------------|---------------|
| `tile` | Carreaux / revêtements m² | `m²` / carton | Carreaux → cartons + m² |
| `unit` | Pièce (sanitaire, accessoire…) | `pièce` | Nombre de pièces |
| `linear_m` | Profilé, plinthe, seuil | `m` | Mètres linéaires |
| `bag` | Colle, joint, ciment | `sac` | Nombre de sacs |
| `liter` | Peinture, étanchéité | `L` | Litres |

### Seuils d'alerte (`src/lib/constants.ts`)
```ts
LOW_STOCK_CARTONS      = 50  // tiles — avertissement + push notification
CRITICAL_STOCK_CARTONS = 20  // tiles — indicateur rouge

LOW_STOCK_UNITS        = 10  // autres types — avertissement
CRITICAL_STOCK_UNITS   =  3  // autres types — critique
```

### Logique de conversion (tiles uniquement)
```
tile_area_m2 = (width_cm / 100) * (height_cm / 100)  ← colonne GENERATED
quantity_m2  = quantity_tiles * tile_area_m2
full_cartons = Math.floor(quantity_tiles / tiles_per_carton)
loose_tiles  = quantity_tiles % tiles_per_carton
```
Modes de saisie dans le formulaire vendeur : **m²** ou **Cartons + carreaux libres**

---

## 11. Catégories dynamiques

- Table `product_categories` : UNIQUE sur `(company_id, product_type, slug)`
- Le slug est normalisé automatiquement via trigger (`unaccent + lowercase`)
- Le combobox dans l'interface permet la saisie libre avec suggestions et la
  création de nouvelles catégories à la volée
- `getProductCategories()` filtre explicitement par `company_id` en plus du
  RLS — défense en profondeur contre les fuites inter-tenant

---

## 12. Règles métier critiques

### Application du prix plancher
- Tile : `floor_price_per_m2` ; autres types : `floor_price_per_unit`
- Vérification **côté client** dans `VendorSaleForm.tsx` (bloque l'UI)
- Vérification **côté serveur** dans `sales/actions.ts createSale()` — lit les
  valeurs depuis la DB, ne fait jamais confiance aux données client
- Violations enregistrées dans `audit_logs` : `FLOOR_PRICE_VIOLATION_ATTEMPT`

### Cycle de vie du stock
```
1. Produit créé → ligne stock créée automatiquement à 0 (trigger)
2. Demande de stock soumise → statut: pending
3. Owner approuve → apply_approved_stock_request() ajoute les unités
4. Vente confirmée → reserved_tiles incrémenté via client admin
5. Vente annulée → reserved_tiles décrémenté via client admin
6. Livraison confirmée → total_tiles et reserved_tiles décrémentés
                         (trigger deduct_stock_on_delivery, opération atomique)
7. Correction approuvée → total_tiles ajusté (delta peut être négatif)
```

### Flux Vente → Commande
```
Vendeur crée vente (statut: confirmed)
    → Commande créée automatiquement (statut: confirmed)
    → reserved_tiles incrémenté via client admin
    → Push envoyé à warehouse/admin/owner
    → Entrepôt voit la commande en temps réel (Realtime)
    → Entrepôt clique "Commencer"      → order: preparing, sale: preparing
    → Entrepôt clique "Marquer prête"  → order: ready, sale: ready
    → Entrepôt confirme livraison      → order: delivered, sale: delivered (trigger)
    → decrement_stock_on_delivery() : UPDATE atomique total_tiles + reserved_tiles
    → Push envoyé à admin/owner si un produit passe sous le seuil d'alerte
```

### Visibilité des ventes
- Vendeurs : uniquement leurs propres ventes (`vendor_id = auth.uid()`)
- Admin / Owner : toutes les ventes de toutes les boutiques

### Données réservées au propriétaire
`purchase_price` n'est jamais exposé aux rôles admin/vendor :
- Masqué dans les formulaires de produit pour les non-owner
- Colonne "Marge brute" dans Rapports → onglet Produits visible uniquement owner

---

## 13. Notifications push

| Événement | Destinataires |
|-----------|---------------|
| Nouvelle vente confirmée | warehouse, admin, owner |
| Demande de stock soumise | admin, owner |
| Demande de stock approuvée | demandeur (agent entrepôt) |
| Demande de stock rejetée | demandeur (agent entrepôt) |
| Produit sous seuil après livraison | admin, owner |

`sendPushToRoles()` accepte un paramètre `companyId` — filtre les abonnés par
entreprise (le client admin contourne le RLS, ce filtre est obligatoire).

---

## 14. Mises à jour en temps réel

Toutes les pages authentifiées se rafraîchissent automatiquement :

1. **Supabase Realtime** — abonnement WebSocket sur `sales` et `stock_requests`
   → déclenche `router.refresh()` immédiatement
2. **`visibilitychange`** — quand l'utilisateur revient dans l'app (ex: après
   avoir tapé une notification push), `router.refresh()` se déclenche
3. **Broadcast SW** — à la réception d'un push, le SW envoie un message à toutes
   les fenêtres ouvertes ; `PageLayout` écoute et appelle `router.refresh()`

---

## 15. PWA & Offline

- Service Worker enregistré dans `PageLayout.tsx` (utilisateurs authentifiés uniquement)
- Stratégie cache : cache-first pour `/_next/static/` et assets images ;
  network-first pour la navigation HTML avec fallback `public/offline.html`
- Invite d'installation : `PwaInstallPrompt.tsx` écoute `beforeinstallprompt`
- Abonnement push : `PushSubscription.tsx` apparaît 2,5 s après la première
  connexion ; préférence stockée dans `localStorage` clé `uca-push-dismissed`
- Version SW : incrémenter `CACHE_NAME` dans `public/sw.js` pour invalider le
  cache au déploiement

---

## 16. Système de design

### Palette de couleurs
```typescript
const C = {
  ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F8FAFC', surface: '#FFFFFF',
  navy: '#1B3A6B', navyDark: '#0C1A35', blue: '#2563EB', blueL: '#EFF6FF',
  green: '#059669', greenL: '#ECFDF5',
  orange: '#D97706', orangeL: '#FFFBEB',
  red: '#DC2626', redL: '#FEF2F2',
  gold: '#B45309', goldL: '#FFFBEB',
}
```

### Typographie
- Police : `system-ui, -apple-system, 'Segoe UI', sans-serif` — partout
- Exception : logo UCA dans la barre latérale → `Georgia, serif`
- Titres de page : 22px, weight 700, letterSpacing -0.02em
- Libellés de section : 11px, weight 700, majuscules, letterSpacing 0.08em
- Corps : 13px

### Mise en page
- Barre latérale : fixe, 240px, fond `#0C1A35`
- Contenu principal : `marginLeft: 240px`, padding `32px 36px`
- Mobile : barre haute 56px + hamburger, barre latérale via `translateX`
- Cartes : blanc, borderRadius 12, border `1px solid #E2E8F0`,
  `boxShadow: '0 1px 3px rgba(0,0,0,0.05)'`
- Modales : overlay fixe, carte blanche, maxWidth 480px, borderRadius 14,
  en-tête navy

### Pluralisation française
Utilitaire `src/lib/pluralize.ts` appliqué partout où une quantité est affichée
avec son unité :
```ts
pluralize('sac', 3)     // → 'sacs'
pluralize('carreau', 1) // → 'carreau'
pluralize('carreau', 2) // → 'carreaux'  (-eau → -eaux)
pluralize('carton', 0)  // → 'carton'   (count ≤ 1 → invariant)
```

---

## 17. Conventions de formatage

```typescript
const fmtCFA = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'

const fmtNum = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(n)

const fmtM2 = (n: number) =>
  new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n) + ' m²'

// Dates — locale fr-FR
new Date(x).toLocaleDateString('fr-FR', {
  day: '2-digit', month: 'short', year: 'numeric'
})
```

---

## 18. Lancer le projet

```bash
# Développement
cd C:\Users\majes\uca-sgi
npm run dev
# Tourne sur http://localhost:3000 avec Turbopack

# Vérification build (à lancer avant de déployer)
npm run build

# Aperçu production
npm run start
```

---

## 19. Checklist de déploiement

- [ ] Les 5 variables d'env définies dans le dashboard Vercel (VAPID inclus)
- [ ] Supabase Auth → Site URL : `https://uca-sgi.vercel.app`
- [ ] Supabase Auth → Redirect URLs inclut `https://uca-sgi.vercel.app/auth/callback`
- [ ] Supabase Realtime activé pour les tables `sales` et `stock_requests`
- [ ] Table `push_subscriptions` créée avec politique RLS
- [ ] Migrations appliquées dans l'éditeur SQL Supabase :
  - `20260326_decrement_stock_on_delivery.sql`
  - `20260329_product_types_fix.sql`
  - `20260329_product_categories.sql`
  - `20260329_product_tile_columns_nullable.sql`
  - `20260329_product_price_columns_nullable.sql`
  - `20260330_company_audit_types.sql`
- [ ] `npm run build` en local — zéro erreur
- [ ] Test fonctionnel : connexion vendeur → nouvelle vente → entrepôt reçoit update Realtime
- [ ] Test fonctionnel : entrepôt confirme livraison → niveaux stock mis à jour
- [ ] Test fonctionnel : demande de stock → admin approuve → entrepôt voit l'approbation
- [ ] Test fonctionnel : suspension entreprise → tous les utilisateurs déconnectés
- [ ] PWA : ajout à l'écran d'accueil sur iOS → fallback offline fonctionne
- [ ] Push : abonnement → confirmation vente → notification reçue sur mobile
