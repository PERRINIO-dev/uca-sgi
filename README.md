# UCA SGI — Système de Gestion Interne

**UCA (Univers de Carreaux et Ameublement)** — internal management system for a
tile import and retail company based in Yaoundé, Cameroon.

Developed by **Majestor Kepseu**.

---

## 1. Business Context

The business operates:
- boutiques
- 1 central warehouse
- Currency: FCFA (XAF)
- Language: French throughout

This system replaces fully manual operations. It is an **internal tool only**
— no customer-facing features.

---

## 2. Tech Stack

| Layer        | Technology                                      |
|--------------|-------------------------------------------------|
| Framework    | Next.js 16.1.6 (App Router, Turbopack)          |
| Database     | Supabase (PostgreSQL) — project: xqucalengkzdogghvhca |
| Auth         | Supabase Auth (GoTrue) — email/password only    |
| Realtime     | Supabase Realtime (postgres_changes on `sales`, `stock_requests`) |
| Push         | Web Push API + VAPID (`web-push` npm package)   |
| PWA          | Service Worker (`public/sw.js`), Web App Manifest |
| Styling      | Inline styles (no Tailwind, no CSS modules)     |
| Charts       | Recharts                                        |
| Hosting      | Vercel — https://uca-sgi.vercel.app             |
| Font         | `system-ui, -apple-system, 'Segoe UI', sans-serif` |

> **Note:** Georgia serif is used ONLY for the UCA brand logo in the sidebar.

**Key constraint:** Next.js 16.1.6 uses `proxy.ts` not `middleware.ts`.
The exported function must be named `proxy`, not `middleware`.

---

## 3. Environment Variables

File: `.env.local` at project root.

```
NEXT_PUBLIC_SUPABASE_URL=https://xqucalengkzdogghvhca.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

> `SUPABASE_SERVICE_ROLE_KEY` and `VAPID_PRIVATE_KEY` must NEVER be exposed to
> the client. They are only used in server actions (`'use server'` files).

All five variables must also be set in the **Vercel dashboard** under
Settings → Environment Variables.

---

## 4. Project File Structure

```
src/
├── proxy.ts                          ← Auth proxy (replaces middleware.ts)
├── components/
│   ├── Sidebar.tsx                   ← Role-aware sidebar (240px, navy)
│   ├── PageLayout.tsx                ← Auth wrapper + mobile header + SW registration
│   ├── PwaInstallPrompt.tsx          ← Bottom banner "Add to home screen"
│   └── PushSubscription.tsx          ← Notification opt-in card (appears after login)
├── hooks/
│   └── useIsMobile.ts                ← SSR-safe breakpoint hook (768px, useLayoutEffect)
├── lib/
│   ├── types.ts
│   ├── constants.ts                  ← LOW_STOCK_CARTONS, CRITICAL_STOCK_CARTONS
│   ├── push/
│   │   └── send.ts                   ← sendPushToRoles() / sendPushToUser() utilities
│   └── supabase/
│       ├── client.ts
│       ├── server.ts
│       ├── badge-counts.ts
│       └── queries.ts
├── app/
│   ├── layout.tsx                    ← PWA metadata + viewport export
│   ├── manifest.ts                   ← Web App Manifest (Next.js route)
│   ├── icon.tsx                      ← 512×512 PWA icon (ImageResponse)
│   ├── apple-icon.tsx                ← 180×180 Apple touch icon
│   ├── login/page.tsx                ← Split-screen login, author credit
│   ├── auth/callback/route.ts        ← Session exchange + role-based redirect
│   ├── api/push/subscribe/route.ts   ← POST/DELETE push subscription endpoint
│   ├── dashboard/
│   │   ├── page.tsx
│   │   ├── DashboardClient.tsx       ← Realtime subscription on stock_requests
│   │   └── actions.ts                ← approveStockRequest, rejectStockRequest + push
│   ├── sales/
│   │   ├── page.tsx                  ← Vendor filter: vendor_id = user.id
│   │   ├── SalesListClient.tsx       ← Realtime subscription on sales
│   │   ├── actions.ts                ← createSale, cancelSale + push on create
│   │   └── new/
│   │       ├── page.tsx
│   │       └── VendorSaleForm.tsx    ← Searchable product list, print receipt
│   ├── warehouse/
│   │   ├── page.tsx
│   │   ├── WarehouseClient.tsx       ← Realtime subscription on sales + stock_requests
│   │   └── actions.ts                ← updateOrderStatus, submitStockRequest + push
│   ├── products/
│   │   ├── page.tsx
│   │   ├── ProductsClient.tsx        ← Reference code read-only, carton-based alerts
│   │   └── actions.ts
│   ├── users/
│   │   ├── page.tsx
│   │   ├── UsersClient.tsx
│   │   └── actions.ts
│   └── reports/
│       ├── page.tsx
│       └── ReportsClient.tsx         ← Overview/sales/products/vendors + CSV export
public/
├── sw.js                             ← Service worker v2 (cache-first static, network-first HTML)
└── offline.html                      ← Branded offline fallback page
```

---

## 5. Database Schema

### ENUMs
```sql
user_role:             owner | admin | vendor | warehouse
stock_request_type:    stock_in | correction
stock_request_status:  pending | approved | rejected
sale_status:           draft | confirmed | preparing | ready | delivered | cancelled
audit_action_type:     USER_* | PRODUCT_* | STOCK_REQUEST_* | SALE_* |
                       ORDER_* | FLOOR_PRICE_VIOLATION_ATTEMPT | LOGIN_* |
                       PASSWORD_RESET | PAYMENT_RECORDED |
                       BOUTIQUE_CREATED | BOUTIQUE_ACTIVATED | BOUTIQUE_DEACTIVATED
```

### Tables

**boutiques**
```
id, name, address, phone, is_active, created_at
```

**users** — extends auth.users
```
id (FK auth.users), email, full_name, role (user_role),
boutique_id (FK boutiques, nullable), is_active, created_at
CONSTRAINT: vendor_requires_boutique — vendors must have boutique_id
```

**products**
```
id, reference_code (UNIQUE), name, category, supplier,
width_cm, height_cm, tiles_per_carton,
tile_area_m2 (GENERATED: width_cm/100 * height_cm/100),
carton_area_m2 (GENERATED: tile_area_m2 * tiles_per_carton),
purchase_price, floor_price_per_m2, reference_price_per_m2,
is_active, created_at, updated_at
```

**stock** — one row per product, single source of truth
```
id, product_id (UNIQUE FK), total_tiles, reserved_tiles,
last_updated_at, last_updated_by
```

**stock_view** — computed view (DO NOT modify directly)
```
Provides: available_tiles, available_m2, available_full_cartons,
full_cartons, loose_tiles, total_m2
```

**stock_requests** — approval workflow
```
id, created_at, requested_by (FK users), product_id (FK products),
request_type, quantity_tiles_delta, justification, status,
reviewed_by, reviewed_at, review_comment,
stock_before_tiles, stock_after_tiles
```

**sales**
```
id, created_at, sale_number (auto: VNT-YYYY-NNNN),
boutique_id, vendor_id, customer_name, customer_phone, customer_cni,
total_amount, amount_paid, payment_status (unpaid | partial | paid),
status (sale_status), notes, updated_at
```

> `amount_paid` and `payment_status` are kept in sync by the
> `sync_sale_payment_totals` trigger whenever a row is inserted into
> `sale_payments`.

**sale_payments** — partial / split payment records
```
id, sale_id (FK sales), amount, notes, created_by (FK users), created_at
```

**sale_items** — snapshots at time of sale
```
id, sale_id, product_id,
quantity_tiles, unit_price_per_m2, total_price,
floor_price_snapshot, reference_price_snapshot,
tile_area_m2_snapshot, tiles_per_carton_snapshot
```

**orders** — 1:1 with sales, warehouse workflow
```
id, sale_id (UNIQUE FK), order_number (auto: CMD-YYYY-NNNN),
status, assigned_to, expected_delivery_date,
preparation_started_at, preparation_confirmed_at,
delivery_confirmed_by, delivery_confirmed_at
```

**order_status_history** — auto-logged on status change

**audit_logs** — immutable INSERT-only
```
id, created_at, user_id, user_role_snapshot,
action_type, entity_type, entity_id,
data_before, data_after, ip_address
```

**push_subscriptions** — Web Push opt-in storage
```sql
CREATE TABLE push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  endpoint    text NOT NULL UNIQUE,
  subscription jsonb NOT NULL,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);
```

---

## 6. Database Functions & Triggers

### Active Triggers

| Trigger | Table | Function | Notes |
|---------|-------|----------|-------|
| `on_auth_user_created` | auth.users | `handle_new_auth_user()` | NO-OP — public.users inserted manually via admin client |
| `on_product_created` | products | `create_stock_entry_for_product()` | SECURITY DEFINER — creates stock row at 0 |
| `on_sale_status_change` | sales | `reserve_stock_on_sale_insert()` | Belt-and-suspenders; createSale manages reserved_tiles explicitly |
| `on_order_delivered` | orders | `deduct_stock_on_delivery()` | SECURITY DEFINER — deducts total_tiles + reserved_tiles on delivery |
| `set_sale_number` | sales | Auto-numbering | VNT-YYYY-NNNN |
| `set_order_number` | orders | Auto-numbering | CMD-YYYY-NNNN |

### Key RPC Functions
```sql
apply_approved_stock_request(request_id UUID)
-- SECURITY DEFINER
-- Called from dashboard/actions.ts approveStockRequest()
-- Updates stock.total_tiles and records stock_after_tiles

decrement_stock_on_delivery(p_product_id UUID, p_quantity INTEGER)
-- SECURITY DEFINER
-- Called from warehouse/actions.ts updateOrderStatus() on delivery
-- Single atomic UPDATE: total_tiles and reserved_tiles decremented in one statement,
-- avoiding any read-then-write race condition
-- Migration: supabase/migrations/20260326_decrement_stock_on_delivery.sql
```

### Supabase Realtime
The `sales` and `stock_requests` tables must be present in the
`supabase_realtime` publication. Enable in:
**Supabase Dashboard → Database → Publications → supabase_realtime**
→ toggle ON for `sales` and `stock_requests`.

---

## 7. RLS Policy Summary

> `stock.UPDATE` is blocked for all roles except via SECURITY DEFINER triggers
> and service role key operations.
> `audit_logs` has no UPDATE or DELETE — INSERT only.
> `orders.UPDATE` is blocked for vendors — cancellation uses admin client.

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| boutiques | authenticated | — | owner/admin | — |
| users | self OR owner/admin | — (admin client) | owner/admin | — |
| products | authenticated | owner/admin | owner/admin | — |
| stock | authenticated | owner/admin | owner/admin + trigger | — |
| stock_requests | own OR owner/admin | authenticated | owner/admin | — |
| sales | vendor sees own sales (vendor_id); owner/admin all | vendor/admin/owner | owner/admin | — |
| sale_items | via sales join | vendor/admin/owner | — | — |
| orders | warehouse/admin/owner | vendor/admin/owner | warehouse/admin/owner | — |
| audit_logs | owner/admin | authenticated | NEVER | NEVER |
| push_subscriptions | own rows only | own rows only | own rows only | own rows only |

---

## 8. User Roles & Access Control

| Role | Home Route | Can Access |
|------|-----------|------------|
| `owner` | `/dashboard` | Everything |
| `admin` | `/dashboard` | Everything except owner-only actions |
| `vendor` | `/sales` | `/sales`, `/sales/new` |
| `warehouse` | `/warehouse` | `/warehouse` |

**Sidebar visibility:**
```
owner/admin:    Dashboard, Ventes, Entrepôt, Catalogue, Utilisateurs, Rapports
vendor:         Ventes only
warehouse:      Entrepôt only
```

---

## 9. Critical Business Rules

### Floor Price Enforcement
- Every product has `floor_price_per_m2` — the absolute minimum selling price
- Enforced **client-side** in `VendorSaleForm.tsx` (blocks UI)
- Enforced **server-side** in `sales/actions.ts` `createSale()` — fetches live
  DB values, never trusts client-provided snapshots
- Violations are logged to `audit_logs` with `FLOOR_PRICE_VIOLATION_ATTEMPT`

### Unit Conversion Logic
```
tile_area_m2 = (width_cm / 100) * (height_cm / 100)   ← GENERATED column
quantity_m2  = quantity_tiles * tile_area_m2
full_cartons = Math.floor(quantity_tiles / tiles_per_carton)
loose_tiles  = quantity_tiles % tiles_per_carton
```
Input modes: m² or Cartons + carreaux (free loose tiles)

### Stock Alert Thresholds
Defined in `src/lib/constants.ts` — single source of truth:
```ts
LOW_STOCK_CARTONS      = 50  // orange warning on dashboard, products page, and push notification
CRITICAL_STOCK_CARTONS = 20  // red indicator on product cards
```
- Push notification sent to admin/owner when any product drops below **50 cartons** after delivery

### Stock Lifecycle
```
1. Product created → stock row auto-created at 0 tiles (trigger + upsert fallback)
2. Stock request submitted → pending
3. Owner approves → apply_approved_stock_request() RPC adds tiles
4. Sale confirmed → reserved_tiles incremented explicitly via admin client
5. Sale cancelled → reserved_tiles decremented explicitly via admin client
6. Order delivered → total_tiles decremented by trigger (deduct_stock_on_delivery)
                   + reserved_tiles decremented by same trigger
7. Stock correction approved → total_tiles adjusted (can be negative delta)
```

### Sale → Order Flow
```
Vendor creates sale (status: confirmed)
    → Order auto-created (status: confirmed)
    → reserved_tiles incremented via admin client
    → Push notification sent to warehouse/admin/owner
    → Warehouse sees order in Commandes tab (Realtime update)
    → Warehouse clicks "Commencer" → order: preparing, sale: preparing
    → Warehouse clicks "Marquer prête" → order: ready, sale: ready
    → Warehouse confirms delivery → order: delivered, sale: delivered (via trigger)
    → decrement_stock_on_delivery() RPC atomically decrements total_tiles and reserved_tiles
    → Push sent to admin/owner if any product drops below 50 cartons

Sale cancellation:
    → Sale status → cancelled
    → Order status → cancelled (via admin client — RLS blocks vendor writes)
    → reserved_tiles released via admin client
```

### Push Notification Triggers
| Event | Recipient |
|-------|-----------|
| New sale confirmed | warehouse, admin, owner |
| Stock request submitted | admin, owner |
| Stock request approved | requester (warehouse user) |
| Stock request rejected | requester (warehouse user) |
| Product below 50 cartons after delivery | admin, owner |

### Vendor Sales Visibility
Vendors only see their own sales (`vendor_id = auth.uid()`).
Admin and owner see all sales across all boutiques.

### Owner-Only Data
`purchase_price` is never exposed to admin or vendor roles:
- Hidden in product create/edit forms for non-owner users
- "Marge brute" column in Reports → Produits tab visible to owner only
- `purchase_price` field is owner-only in the products page

---

## 10. PWA & Offline

- Service worker registered in `PageLayout.tsx` (authenticated users only)
- Cache strategy: cache-first for `/_next/static/` and image assets;
  network-first for HTML navigation with offline fallback to `public/offline.html`
- Install prompt: `PwaInstallPrompt.tsx` listens for `beforeinstallprompt`
- Push subscription: `PushSubscription.tsx` appears 2.5s after first login;
  preference stored in `localStorage` key `uca-push-dismissed`
- SW version: bump `CACHE_NAME` in `public/sw.js` to invalidate cache on deploy

---

## 11. Real-time Updates

All authenticated pages refresh automatically when data changes:

1. **Supabase Realtime** — WebSocket subscription on `sales` and
   `stock_requests` tables triggers `router.refresh()` immediately
2. **`visibilitychange`** — when the user returns to the app (e.g., after
   tapping a push notification), `router.refresh()` fires automatically
3. **SW broadcast** — on push received, SW posts a message to all open windows;
   `PageLayout` listens and calls `router.refresh()`

> Supabase Realtime must be enabled for `sales` and `stock_requests` in
> Database → Publications → supabase_realtime.

---

## 12. Design System

### Color Palette
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

### Typography
- Font: `system-ui, -apple-system, 'Segoe UI', sans-serif` — everywhere
- Exception: UCA brand logo in sidebar uses `Georgia, serif`
- Page titles: 22px, weight 700, letterSpacing -0.02em
- Section labels: 11px, weight 700, uppercase, letterSpacing 0.08em
- Body: 13px

### Layout
- Sidebar: fixed, 240px wide, `#0C1A35` background
- Main content: `marginLeft: 240px`, padding `32px 36px`
- Mobile: 56px top bar + hamburger, sidebar slides via `translateX`
- Cards: white, borderRadius 12, border `1px solid #E2E8F0`
- Modals: fixed overlay, white card, maxWidth 480px, borderRadius 14, navy header

---

## 13. Formatting Conventions

```typescript
const fmtCFA = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'

const fmtNum = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(n)

const fmtM2 = (n: number) =>
  new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n) + ' m²'

// Dates — fr-FR locale
new Date(x).toLocaleDateString('fr-FR', {
  day: '2-digit', month: 'short', year: 'numeric'
})
```

---

## 14. Running the Project

```bash
# Development
cd C:\Users\majes\uca-sgi
npm run dev
# Runs on http://localhost:3000 with Turbopack

# Build check (run before deploying)
npm run build

# Production preview
npm run start
```

---

## 15. Deployment Checklist

- [ ] All 5 env vars set in Vercel dashboard (including VAPID keys)
- [ ] Supabase Auth → Site URL set to `https://uca-sgi.vercel.app`
- [ ] Supabase Auth → Redirect URLs includes `https://uca-sgi.vercel.app/auth/callback`
- [ ] Supabase Realtime enabled for `sales` and `stock_requests` tables
- [ ] `push_subscriptions` table created with RLS policy
- [ ] Run migration in Supabase SQL editor: `supabase/migrations/20260326_decrement_stock_on_delivery.sql`
- [ ] `npm run build` locally — zero errors
- [ ] Smoke test: vendor login → new sale → warehouse receives realtime update
- [ ] Smoke test: warehouse confirms delivery → stock levels update
- [ ] Smoke test: stock request → admin approve → warehouse sees approval
- [ ] PWA: add to home screen on iOS → offline fallback works
- [ ] Push: subscribe → confirm sale → notification arrives on mobile

