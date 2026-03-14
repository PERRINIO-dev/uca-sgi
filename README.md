# UCA SGI — Système de Gestion Interne

**UCA (Univers de Carreaux et Ameublement)** — internal management system for a
tile import and retail company based in Yaoundé, Cameroon.

---

## 1. Business Context

The business operates:
- 3 boutiques: Bastos, Omnisport, Melen
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
| Styling      | Inline styles (no Tailwind, no CSS modules)     |
| Charts       | Recharts                                        |
| Hosting      | Vercel (not yet deployed — still on localhost)  |
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
```

> `SUPABASE_SERVICE_ROLE_KEY` must NEVER be exposed to the client. It is only
> used in server actions (`'use server'` files) via `getAdminClient()`.

---

## 4. Project File Structure

```
src/
├── proxy.ts                          ← Auth proxy (replaces middleware.ts)
├── components/
│   ├── Sidebar.tsx                   ← Shared role-aware sidebar (220px, navy)
│   └── PageLayout.tsx                ← Auth page wrapper + mobile header
├── hooks/
│   └── useIsMobile.ts                ← SSR-safe breakpoint hook (768px)
├── lib/
│   ├── types.ts
│   └── supabase/
│       ├── client.ts
│       ├── server.ts
│       └── queries.ts
├── app/
│   ├── login/
│   │   └── page.tsx                  ← Login (checks is_active before redirect)
│   ├── auth/callback/route.ts        ← Session exchange + role-based redirect
│   ├── dashboard/
│   │   ├── page.tsx
│   │   ├── DashboardClient.tsx
│   │   └── actions.ts                ← approveStockRequest, rejectStockRequest
│   ├── sales/
│   │   ├── page.tsx
│   │   ├── SalesListClient.tsx
│   │   ├── actions.ts                ← createSale, cancelSale
│   │   └── new/
│   │       ├── page.tsx              ← Filters inactive products before passing down
│   │       └── VendorSaleForm.tsx    ← Searchable scrollable product list
│   ├── warehouse/
│   │   ├── page.tsx                  ← Filters stock_view to active products only
│   │   ├── WarehouseClient.tsx
│   │   └── actions.ts                ← updateOrderStatus, submitStockRequest
│   ├── products/
│   │   ├── page.tsx
│   │   ├── ProductsClient.tsx
│   │   └── actions.ts                ← createProduct (upsert for stock init), updateProduct
│   ├── users/
│   │   ├── page.tsx                  ← Fetches all boutiques (including inactive)
│   │   ├── UsersClient.tsx           ← User table + MDP reset + boutique grid modal
│   │   └── actions.ts                ← createEmployee, toggleUserActive,
│   │                                    updateEmployee, createBoutique,
│   │                                    resetPassword, toggleBoutiqueActive
│   └── reports/
│       ├── page.tsx
│       └── ReportsClient.tsx         ← Overview/sales/products/vendors + CSV export
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
                       PASSWORD_RESET | BOUTIQUE_ACTIVATED | BOUTIQUE_DEACTIVATED
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
boutique_id, vendor_id, customer_name, customer_phone,
total_amount, status (sale_status), notes, updated_at
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

---

## 6. Database Functions & Triggers

### Active Triggers

| Trigger | Table | Function | Notes |
|---------|-------|----------|-------|
| `on_auth_user_created` | auth.users | `handle_new_auth_user()` | **NO-OP** — public.users inserted manually via admin client |
| `on_product_created` | products | `create_stock_entry_for_product()` | SECURITY DEFINER — creates stock row at 0 |
| `on_sale_status_change` | sales | `reserve_stock_on_sale_insert()` | May not fire reliably (see note below) |
| `on_order_delivered` | orders | `deduct_stock_on_delivery()` | SECURITY DEFINER — deducts total_tiles on delivery |
| `set_sale_number` | sales | Auto-numbering | VNT-YYYY-NNNN |
| `set_order_number` | orders | Auto-numbering | CMD-YYYY-NNNN |

> **Important:** The `reserve_stock_on_sale_insert` trigger fires on `sales`
> AFTER UPDATE, but `sale_items` are inserted separately in a later step.
> `createSale` and `cancelSale` therefore manage `reserved_tiles` explicitly
> via the admin client — the trigger is a belt-and-suspenders fallback only.

### Key RPC Function
```sql
apply_approved_stock_request(request_id UUID)
-- SECURITY DEFINER
-- Called from dashboard/actions.ts approveStockRequest()
-- Updates stock.total_tiles and records stock_after_tiles
```

---

## 7. RLS Policy Summary

> `stock.UPDATE` is blocked for all roles except via SECURITY DEFINER triggers
> and operations that use the service role key.
> `audit_logs` has no UPDATE or DELETE — INSERT only.
> `orders.UPDATE` is blocked for vendors — cancellation uses admin client.

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| boutiques | authenticated | — | owner/admin | — |
| users | self OR owner/admin | — (admin client) | owner/admin | — |
| products | authenticated | owner/admin | owner/admin | — |
| stock | authenticated | owner/admin | owner/admin + trigger | — |
| stock_requests | own OR owner/admin | authenticated | owner/admin | — |
| sales | vendor sees own boutique; owner/admin all | vendor/admin/owner | owner/admin | — |
| sale_items | via sales join | vendor/admin/owner | — | — |
| orders | warehouse/admin/owner | vendor/admin/owner | warehouse/admin/owner | — |
| audit_logs | owner/admin | authenticated | ❌ NEVER | ❌ NEVER |

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
    → Warehouse sees order in Commandes tab
    → Warehouse clicks "Commencer" → order: preparing, sale: preparing
    → Warehouse clicks "Marquer prête" → order: ready, sale: ready
    → Warehouse confirms delivery → order: delivered, sale: delivered (via trigger)
    → TRIGGER deducts stock.total_tiles and reserved_tiles

Sale cancellation:
    → Sale status → cancelled
    → Order status → cancelled (via admin client — RLS blocks vendor writes)
    → reserved_tiles released via admin client
```

### Deactivated Products
- Inactive products are filtered from the new sale form (server-side, via
  `pricingMap` join on `is_active = true`)
- Inactive products are filtered from the warehouse stock view (server-side,
  using active product IDs as a filter set)

### Boutique Closure
- Closed boutiques (`is_active = false`) are hidden from vendor assignment
  dropdowns in create/edit employee forms
- All boutiques (active + closed) are visible in the boutique management modal
  with a Fermer/Réouvrir toggle

### User Creation
**Supabase dashboard "Create user" is broken** — GoTrue trigger incompatibility.
All user creation goes through `users/actions.ts` → `getAdminClient()` →
`auth.admin.createUser()` + manual `upsert` into `public.users`.

### Password Reset (admin)
Admins and owners can reset any employee's password via the Users page.
Uses `auth.admin.updateUserById()` via the service role client.
Logged to `audit_logs` as `PASSWORD_RESET`.

---

## 10. Known Issues & Technical Debt

### Medium Priority
1. **`any` types** — heavy use of `any` throughout client components
2. **Missing TypeScript interfaces** — `lib/types.ts` may not cover all entities
3. **No 404 page** — missing `app/not-found.tsx`
4. **No error boundary** — missing `app/error.tsx` and `app/global-error.tsx`
5. **Reports date range** — server fetches last 90 days; client filter only refines this
6. **No session timeout handling** — expired sessions cause silent failures

### Low Priority
7. **No confirmation modal before sale cancellation**
8. **Warehouse `updateOrderStatus`** — sale status mirror for `delivered` is
   handled by trigger but the action still runs a redundant no-op update
9. **No print/PDF receipt** — after sale confirmation
10. **CSV encoding** — BOM added for Excel but not tested on all platforms

---

## 11. Design System

### Color Palette
```typescript
const C = {
  ink: '#0F172A', slate: '#475569', muted: '#94A3B8',
  border: '#E2E8F0', bg: '#F1F5F9', surface: '#FFFFFF',
  navy: '#1B3A6B', navyDark: '#0C1A35', blue: '#2E86AB', blueL: '#EFF8FC',
  green: '#059669', greenL: '#ECFDF5',
  orange: '#D97706', orangeL: '#FFFBEB',
  red: '#DC2626', redL: '#FEF2F2',
  gold: '#B45309', goldL: '#FFFBEB',
  purple: '#7C3AED', purpleL: '#F5F3FF',
}
```

### Typography
- Font: `system-ui, -apple-system, 'Segoe UI', sans-serif` — everywhere
- Exception: UCA brand logo in sidebar uses `Georgia, serif`
- Page titles: 22px, weight 700, letterSpacing -0.02em
- Section labels: 11px, weight 700, uppercase, letterSpacing 0.08em
- Body: 13px

### Layout
- Sidebar: fixed, 220px wide, `#0C1A35` background
- Main content: `marginLeft: 220`, padding `32px 36px`
- Mobile: 56px top bar + hamburger, sidebar slides via `translateX`
- Cards: white, borderRadius 12, border `1px solid #E2E8F0`
- Modals: fixed overlay, white card, maxWidth 480px, borderRadius 14,
  navy header (#1B3A6B)

---

## 12. Formatting Conventions

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

## 13. Remaining Enhancement Priorities

### Must-have before go-live
1. Add `app/not-found.tsx` and `app/error.tsx`
2. Add session expiry handling in proxy.ts
3. Fix TypeScript `any` types throughout
4. Mobile responsiveness for vendor interface (used on phones in boutique)

### High value
5. Confirm modal before sale cancellation
6. Print/PDF receipt after sale confirmation
7. Stock alert email notification to owner

### Nice to have
8. Dark mode
9. PWA — install prompt, offline fallback
10. Keyboard shortcuts for warehouse order actions
11. Bulk product import via CSV

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

### Test Accounts
| Role | Email | Password |
|------|-------|----------|
| Owner | majestork@gmail.com | StrongPass123 |
| Admin | emmanuel@uca.cm | (set during creation) |
| Vendor | fatima@uca.cm | (set during creation) |
| Warehouse | paul@uca.cm | (set during creation) |

---

## 15. Pre-Deployment Checklist

- [ ] Verify all env vars are set in Vercel dashboard
- [ ] Add `NEXT_PUBLIC_APP_URL` env var for production URL
- [ ] Set Supabase Auth → Site URL to Vercel production URL
- [ ] Set Supabase Auth → Redirect URLs to include `/auth/callback`
- [ ] Enable Supabase Auth email confirmation for production
- [ ] Review Supabase project password policy
- [ ] Run `npm run build` locally — must be zero errors
- [ ] Test production build locally with `npm run start`
- [ ] Verify `SUPABASE_SERVICE_ROLE_KEY` is not exposed in client bundles
- [ ] Smoke test: vendor login → new sale → confirm → warehouse delivery flow
- [ ] Smoke test: admin cancel sale → order disappears from warehouse
- [ ] Smoke test: stock request submit → owner approve → stock level updates
