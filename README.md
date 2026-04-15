# MERAM — Retail Management Platform

**MERAM** is a multi-tenant SaaS platform for retail businesses managing
inventory, sales, and warehouse operations. Each company operates in a fully
isolated environment; the platform supports multiple currencies and is designed
for teams worldwide.

Developed by **Majestor Kepseu**.

---

## 1. Overview

### What it does
- Multi-outlet sales management (confirmed sales + draft quotations)
- Warehouse order fulfilment workflow (confirmed → preparing → ready → delivered)
- Inventory tracking with stock reservations and approval-gated replenishment
- Role-based access control across five user roles
- Push notifications for real-time operational alerts
- Multi-tenant admin panel for platform operators

### Architecture
- **Multi-tenant**: each `company` is an isolated tenant — all operational data
  is scoped by `company_id` enforced via PostgreSQL RLS
- **Multi-currency**: currency stored per company (`companies.currency`);
  formatted via `fmtCurrency(amount, currency)` throughout the UI
- **Internal tool** — no customer-facing features

---

## 2. Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Database | Supabase (PostgreSQL) + Auth (GoTrue) |
| Auth | Email / password, session via `proxy.ts` |
| Realtime | Supabase Realtime (`sales`, `stock_requests`) |
| Push | Web Push API + VAPID (`web-push` npm package) |
| PWA | Service Worker `public/sw.js` v7, Web App Manifest |
| Styles | Inline React styles — no CSS framework |
| Charts | Recharts |
| Hosting | Vercel |
| Fonts | Fraunces (display/headings) · DM Sans (body) · IBM Plex Mono (codes) |

> **Key constraint:** Next.js 16 uses `proxy.ts`, not `middleware.ts`.
> The exported function must be named `proxy`.

---

## 3. Environment variables

File: `.env.local` at the project root.

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_CONTACT=mailto:admin@meram.app   (optional — defaults to admin@meram.app)
```

> `SUPABASE_SERVICE_ROLE_KEY` and `VAPID_PRIVATE_KEY` must NEVER be exposed
> client-side. They are used only in server actions (`'use server'` files).

All variables must also be set in the **Vercel dashboard** under
Settings → Environment Variables.

---

## 4. File structure

```
src/
├── proxy.ts                          ← Auth proxy (replaces middleware.ts)
├── lib/
│   ├── design-system/
│   │   └── tokens.ts                 ← Single source of truth: C, F, SP, R, SH, TR, Z, L
│   ├── types.ts                      ← UserRole, ProductType, Product, Sale…
│   ├── constants.ts                  ← LOW_STOCK_CARTONS/UNITS thresholds
│   ├── format.ts                     ← fmtCurrency(amount, currency)
│   ├── pluralize.ts                  ← French pluralisation (sac→sacs, eau→eaux…)
│   ├── push/send.ts                  ← sendPushToRoles() / sendPushToUser()
│   └── supabase/
│       ├── client.ts · server.ts · admin.ts
│       ├── badge-counts.ts
│       └── queries.ts
├── components/
│   ├── Sidebar.tsx                   ← 240px dark espresso nav, cognac accent
│   ├── PageLayout.tsx                ← Auth wrapper + mobile header + SW registration
│   ├── CategoryCombobox.tsx          ← Free-text + inline category creation
│   ├── PushSubscription.tsx          ← Opt-in notification banner
│   ├── PwaInstallPrompt.tsx          ← "Add to home screen" prompt
│   └── NetworkStatusBanner.tsx       ← Offline banner
├── hooks/
│   └── useIsMobile.ts                ← SSR-safe (breakpoint 768px)
└── app/
    ├── layout.tsx / manifest.ts / icon.tsx / apple-icon.tsx
    ├── login/page.tsx                ← Split-screen branding
    ├── auth/callback/route.ts        ← Session exchange + role-based redirect
    ├── api/push/subscribe/route.ts   ← POST/DELETE push subscription endpoint
    ├── admin/                        ← Platform operator panel (is_platform_admin)
    ├── dashboard/                    ← KPIs, stock request approvals, Realtime
    ├── sales/                        ← Sales list + new sale form (VendorSaleForm)
    ├── quotes/                       ← Draft quotations (DEV-YYYY-NNNN) + conversion
    ├── warehouse/                    ← Order fulfilment queue + stock requests
    ├── products/                     ← Product catalogue (5 types) + stock display
    ├── users/                        ← Team management + boutique management
    └── reports/                      ← Revenue, products, vendors + CSV export
public/
├── sw.js                             ← Service Worker v7
└── offline.html
```

---

## 5. Multi-tenant architecture

### Principle
- `companies` is the root tenant entity
- Every operational table has `company_id UUID NOT NULL FK → companies(id)`
- Isolation is enforced by **Row Level Security** via two `SECURITY DEFINER` helpers:
  - `get_my_company_id()` — reads `users.company_id` for `auth.uid()`
  - `get_my_role()` — reads `users.role` for `auth.uid()`

### Tenant tables
`boutiques`, `users`, `products`, `product_categories`, `stock`,
`stock_requests`, `sales`, `sale_items`, `sale_payments`, `orders`,
`audit_logs`

### Client-side queries
Authenticated client queries need **no explicit `company_id` filter** — RLS
handles it transparently. Admin-client queries add `.eq('company_id', ...)` for
defence-in-depth.

### Platform operator
- Account with `is_platform_admin = true` accesses `/admin` only
- Can activate/deactivate companies, reset passwords, suspend users
- Suspending a company bans all its users via
  `admin.auth.admin.updateUserById({ ban_duration: '876000h' })`

---

## 6. Database schema

### ENUMs
```sql
user_role:             owner | admin | vendor | warehouse
product_type:          tile | unit | linear_m | bag | liter
stock_request_status:  pending | approved | rejected
sale_status:           draft | confirmed | preparing | ready | delivered | cancelled
payment_status:        unpaid | partial | paid
```

### Key tables

**companies**
```
id, name, slug (UNIQUE), currency, is_active, created_at
```

**users** — extends auth.users
```
id (FK auth.users), company_id (FK companies, nullable for platform_admin),
email, full_name, role, boutique_id (nullable),
is_active, is_platform_admin, created_at
```

**products**
```
id, company_id, reference_code (UNIQUE per company), name,
category_id (FK product_categories, nullable),
product_type (DEFAULT 'tile'), unit_label, package_label,
-- tile-specific (nullable for other types)
width_cm, height_cm, tiles_per_carton,
tile_area_m2 (GENERATED), carton_area_m2 (GENERATED),
floor_price_per_m2, reference_price_per_m2,
-- generic type fields
floor_price_per_unit, reference_price_per_unit, purchase_price,
piece_length_m, container_volume_l, bag_weight_kg, pieces_per_package,
is_active, created_at
```

**stock** — one row per product
```
id, product_id (UNIQUE FK), company_id,
total_tiles, reserved_tiles, last_updated_at
```

**stock_view** — computed view (`security_invoker = on`, inherits caller's RLS)
```
product_id, company_id, product_name, reference_code, product_type, unit_label,
tiles_per_carton, tile_area_m2, total_tiles, reserved_tiles, available_tiles,
available_full_cartons, loose_tiles, available_m2, full_cartons
```

**sales**
```
id, company_id,
sale_number  (auto: VNT-YYYY-NNNN per company × year, empty for drafts),
quote_number (auto: DEV-YYYY-NNNN per company × year, drafts only),
boutique_id, vendor_id, customer_name, customer_phone, customer_cni,
total_amount, amount_paid, payment_status, status, notes, created_at
```

**sale_items** — price snapshots at time of sale
```
id, sale_id, company_id, product_id,
quantity_tiles, unit_price_per_m2, total_price,
floor_price_snapshot, reference_price_snapshot, purchase_price_snapshot,
tile_area_m2_snapshot, tiles_per_carton_snapshot
```

**sale_payments** — multi-tranche payment history
```
id, sale_id, company_id, amount, notes, created_by, created_at
```
> `sales.amount_paid` and `payment_status` are synced by trigger
> `sync_sale_payment_totals` on every `sale_payments` insert.

**orders** — 1:1 with sales, warehouse workflow
```
id, company_id (inherited from parent sale via trigger),
sale_id (UNIQUE FK),
order_number (auto: CMD-YYYY-NNNN per company × year),
status, assigned_to,
preparation_started_at, preparation_confirmed_at,
delivery_confirmed_by, delivery_confirmed_at
```

**push_subscriptions**
```
id (uuid PK), user_id (FK auth.users ON DELETE CASCADE),
endpoint (UNIQUE), subscription (jsonb), created_at
```

---

## 7. Functions and triggers

### Active triggers

| Trigger | Table | Notes |
|---------|-------|-------|
| `on_product_created` | products | Creates stock row at 0, inherits `company_id` |
| `set_sale_number` | sales BEFORE INSERT | DEV-YYYY-NNNN for drafts; VNT-YYYY-NNNN for confirmed |
| `set_order_number` | orders BEFORE INSERT | CMD-YYYY-NNNN + inherits `company_id` from parent sale |
| `trg_set_category_slug` | product_categories | Normalises slug via `unaccent + lowercase` |
| `sync_sale_payment_totals` | sale_payments | Updates `sales.amount_paid` + `payment_status` |

### Key RPCs
```sql
reserve_stock_on_sale(p_product_id UUID, p_quantity INTEGER) RETURNS BOOLEAN
-- SECURITY DEFINER — SELECT FOR UPDATE then UPDATE reserved_tiles atomically

release_stock_on_cancel(p_product_id UUID, p_quantity INTEGER) RETURNS void
-- SECURITY DEFINER — decrements reserved_tiles (not total_tiles)

decrement_stock_on_delivery(p_product_id UUID, p_quantity INTEGER) RETURNS void
-- SECURITY DEFINER — decrements both total_tiles and reserved_tiles

confirm_quote(p_sale_id UUID) RETURNS TEXT
-- SECURITY DEFINER — atomically assigns VNT number and sets status=confirmed

apply_approved_stock_request(request_id UUID)
-- SECURITY DEFINER — updates total_tiles, records stock_after_tiles

get_my_company_id() RETURNS UUID  -- used by RLS policies
get_my_role() RETURNS TEXT        -- used by RLS policies
```

### Supabase Realtime
Tables `sales` and `stock_requests` must be in the `supabase_realtime`
publication:
**Supabase Dashboard → Database → Publications → supabase_realtime**
→ enable `sales` and `stock_requests`.

---

## 8. RLS policy summary

> `audit_logs`: INSERT only — no UPDATE or DELETE ever.
> Stock writes go through SECURITY DEFINER RPCs or the service-role client.

| Table | SELECT | INSERT | UPDATE |
|-------|--------|--------|--------|
| companies | own company | service-role | service-role |
| boutiques | authenticated | — | owner/admin |
| users | same company | — (admin client) | owner/admin or self |
| products | authenticated | owner/admin | owner/admin |
| product_categories | authenticated | authenticated | owner/admin |
| stock | authenticated | — | via RPC / service-role |
| stock_requests | own or owner/admin | authenticated | owner/admin |
| sales | vendor → own; owner/admin → all | vendor/admin/owner | owner/admin |
| sale_items | via sales join | vendor/admin/owner | — |
| sale_payments | via sales join | owner/admin/vendor (server action) | — |
| orders | warehouse/admin/owner | vendor/admin/owner | warehouse/admin/owner |
| audit_logs | owner/admin | authenticated | never |
| push_subscriptions | own rows | own rows | own rows |

---

## 9. Roles and access

| Role | Home route | Access |
|------|------------|--------|
| `owner` | `/dashboard` | Full access |
| `admin` | `/dashboard` | Full access (no owner-only fields) |
| `vendor` | `/sales` | `/sales`, `/sales/new`, `/quotes` |
| `warehouse` | `/warehouse` | `/warehouse` |
| `platform_admin` | `/admin` | `/admin` only |

**Sidebar visibility:**
```
owner/admin:     Dashboard, Sales, Warehouse, Products, Users, Reports
vendor:          Sales, Quotes
warehouse:       Warehouse
platform_admin:  Dedicated /admin interface — no standard nav
```

---

## 10. Quotation (devis) module

Draft quotations allow a vendor to build a priced cart and share it with a
customer before committing stock.

```
1. Vendor creates quote (createQuote) → status: draft, quote_number: DEV-YYYY-NNNN
   No stock is reserved at this stage.

2. From /quotes, vendor converts to sale (convertQuote):
   - confirm_quote RPC assigns VNT number and sets status=confirmed
   - reserve_stock_on_sale called per product
   - Warehouse order created
   - Push sent to warehouse/admin/owner

3. Or vendor cancels (cancelQuote) → status: cancelled, no stock impact
```

---

## 11. Multi-type product model

| Type | Description | Stock unit | Form input |
|------|-------------|------------|------------|
| `tile` | Floor / wall tiles | tiles (→ cartons + m²) | m², cartons+loose, or tiles |
| `unit` | Sanitary ware, accessories | pieces | quantity |
| `linear_m` | Profiles, skirting boards | linear metres | quantity (m) |
| `bag` | Adhesive, grout, cement | bags | quantity (kg total or bags) |
| `liter` | Paint, sealant | litres | quantity (containers or litres) |

### Stock thresholds (`src/lib/constants.ts`)
```ts
LOW_STOCK_CARTONS      = 50   // tile — warning + push notification
CRITICAL_STOCK_CARTONS = 20   // tile — red indicator
LOW_STOCK_UNITS        = 10   // other types — warning
CRITICAL_STOCK_UNITS   =  3   // other types — critical
```

---

## 12. Business rules

### Floor price enforcement
- Tiles: `floor_price_per_m2`; other types: `floor_price_per_unit`
- Checked **client-side** in `VendorSaleForm` (blocks UI)
- Verified **server-side** in `createSale` / `createQuote` — reads from DB,
  never trusts client-provided snapshots
- Violations logged as `FLOOR_PRICE_VIOLATION_ATTEMPT` in `audit_logs`

### Stock lifecycle
```
1. Product created → stock row created at 0 (trigger)
2. Stock request submitted → status: pending
3. Owner approves → apply_approved_stock_request() adds units to total_tiles
4. Sale confirmed → reserve_stock_on_sale() increments reserved_tiles
5. Sale cancelled → release_stock_on_cancel() decrements reserved_tiles
6. Delivery confirmed → decrement_stock_on_delivery() decrements
                        both total_tiles and reserved_tiles atomically
7. Correction approved → total_tiles adjusted (delta can be negative)
```

### Sale → Order flow
```
Vendor confirms sale (status: confirmed)
    → Warehouse order auto-created (status: confirmed)
    → reserved_tiles incremented via reserve_stock_on_sale RPC
    → Push sent to warehouse/admin/owner
    → Warehouse sees order in real time (Realtime)
    → Warehouse: "Start" → order/sale: preparing
    → Warehouse: "Mark ready" → order/sale: ready
    → Warehouse: "Confirm delivery" → order/sale: delivered
    → decrement_stock_on_delivery() atomic UPDATE
    → Push sent to admin/owner if any product falls below threshold
```

---

## 13. Push notifications

| Event | Recipients |
|-------|------------|
| Sale confirmed (new order) | warehouse, admin, owner |
| Stock request submitted | admin, owner |
| Stock request approved | requester (warehouse agent) |
| Stock request rejected | requester (warehouse agent) |
| Product below threshold after delivery | admin, owner |

`sendPushToRoles()` requires `companyId` — filters subscribers by company.
Uses `neq('is_active', false)` to include accounts whose `is_active` is `NULL`
(created before the column was added).

---

## 14. Design system — Papier

Single source of truth: `src/lib/design-system/tokens.ts`
Import as `{ C, F, SP, R, SH, TR, Z, L }` — never hardcode values.

### Palette (light canvas hierarchy)
```
C.bg        = '#F5EFE6'   // aged cream canvas
C.surface   = '#FDFAF5'   // cards, panels
C.surfaceEl = '#FFFFFF'   // modals, dropdowns
C.ink       = '#1A0F06'   // deep espresso headings
C.text      = '#3C2715'   // body text
C.muted     = '#7A6248'   // metadata
C.amber     = '#A0531A'   // cognac accent (primary interactive)
C.border    = '#DDD4C5'   // structural borders

// Sidebar — dark espresso (Sidebar.tsx only)
C.sidebarBg = '#1B0F07'
```

### Typography
- `F.display` = Fraunces — headings, KPI values
- `F.body`    = DM Sans — all body text, labels, buttons
- `F.mono`    = IBM Plex Mono — reference codes, numbers

### Rules
- No emoji anywhere — SVG icons or plain text only
- Section labels: `F.xs` (11px) minimum — never below 10px
- Shadows: warm brown drops `rgba(60,30,10,...)` — not black
- Modal overlays: `rgba(26,15,6,0.50)` warm espresso — not `rgba(0,0,0,...)`
- `globals.css` body bg: `#F5EFE6`

---

## 15. Real-time updates

All authenticated pages refresh automatically via three mechanisms:

1. **Supabase Realtime** — WebSocket subscription on `sales` and
   `stock_requests` → triggers `router.refresh()` immediately
2. **`visibilitychange`** — when the user returns to the app after tapping a
   push notification, `router.refresh()` fires
3. **SW broadcast** — on push receipt the SW posts `PUSH_RECEIVED` to all open
   windows; `PageLayout` listens and calls `router.refresh()`

---

## 16. PWA & Offline

- Service Worker registered in `PageLayout.tsx` (authenticated users only)
- Cache strategy: cache-first for `/_next/static/` and images;
  network-first for HTML navigation with fallback to `public/offline.html`
- Install prompt: `PwaInstallPrompt.tsx` listens for `beforeinstallprompt`
- Push opt-in: `PushSubscription.tsx` appears 2.5 s after first login
- **To invalidate cache on deploy**: increment `CACHE_NAME` in `public/sw.js`
  (currently `meram-sgi-v7`)

---

## 17. Running the project

```bash
# Development
cd C:\Users\majes\uca-sgi
npm run dev
# Runs on http://localhost:3000 with Turbopack

# Production build check (run before deploying)
npm run build

# Production preview
npm run start
```

---

## 18. Deployment checklist

- [ ] 5 env vars set in Vercel dashboard (VAPID keys included)
- [ ] Supabase Auth → Site URL set to production domain
- [ ] Supabase Auth → Redirect URLs includes `/auth/callback`
- [ ] Supabase Realtime enabled for `sales` and `stock_requests`
- [ ] `push_subscriptions` table created with RLS policy
- [ ] All migrations applied in Supabase SQL editor (in order):
  - `20260326_decrement_stock_on_delivery.sql`
  - `20260327_purchase_price_snapshot.sql`
  - `20260327_release_stock_on_cancel.sql`
  - `20260328_audit_action_type_payment.sql`
  - `20260329_multi_tenancy_phase1.sql`
  - `20260329_fix_stock_trigger_company_id.sql`
  - `20260329_product_categories.sql`
  - `20260329_product_tile_columns_nullable.sql`
  - `20260329_product_price_columns_nullable.sql`
  - `20260329_product_types_fix.sql`
  - `20260329_sale_items_snapshots_nullable.sql`
  - `20260330_reserve_stock_on_sale.sql`
  - `20260330_platform_admin.sql`
  - `20260330_platform_operator.sql`
  - `20260330_fix_platform_operator_rls.sql`
  - `20260330_admin_audit_types.sql`
  - `20260330_company_audit_types.sql`
  - `20260330_product_types.sql`
  - `20260330_warehouse_sales_rls.sql`
  - `20260330_companies_currency.sql`
  - `20260412_quotes.sql`
  - `20260414_fixes.sql`
  - `20260415_drop_sale_reservation_trigger.sql`
  - `20260414_reserved_tiles_correction.sql`
- [ ] `npm run build` locally — zero errors
- [ ] Functional test: vendor → new sale → warehouse receives Realtime update
- [ ] Functional test: warehouse confirms delivery → stock levels updated
- [ ] Functional test: stock request → admin approves → warehouse notified (push)
- [ ] Functional test: create quote → convert to sale → stock reserved correctly
- [ ] Functional test: company suspension → all users disconnected
- [ ] PWA: add to home screen on iOS → offline fallback works
- [ ] Push: subscribe → confirm sale → notification received on mobile
