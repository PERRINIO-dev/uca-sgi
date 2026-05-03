# MERAM SGI — Product Architecture
## Role-Based Interface Design · Single Source of Truth

**Version:** 1.0  
**Status:** Authoritative — all implementation must conform to this document  
**Stack:** Next.js 16 App Router · Supabase (PostgreSQL + Auth + RLS) · Papier design system

---

## 0. Design Philosophy

This is a **professional business tool**, not a generic admin panel. Every role must feel like a product built specifically for them — not a filtered view of a universal interface.

Three standards govern every decision:

1. **Zero cognitive overhead** — a user should never wonder what to do next. The primary action is always obvious.
2. **Role fidelity** — the interface mirrors the real-world job. A delivery driver's screen looks nothing like an accountant's screen.
3. **Premium SaaS bar** — layout density, motion, and interaction quality comparable to Shopify, Linear, or Notion. Functional is not enough. It must feel crafted.

---

## 1. Navigation Families

Roles are grouped into three navigation families. Each family has a distinct layout paradigm.

### Family A — Direction (owner · manager · accountant)

**Paradigm:** Desktop-first sidebar navigation.  
**Layout:** 240px dark espresso sidebar (existing `Sidebar.tsx`) + main content area.  
**Usage context:** Office workstation or tablet in landscape. Analytical, data-dense.  
**Characteristics:** Full navigation visible at all times. Multi-section exploration. Data dashboards.

### Family B — Comptoir (seller · cashier)

**Paradigm:** Counter / POS-style. Minimal chrome, maximum action surface.  
**Layout:** No sidebar. Compact top bar (boutique name + user avatar + logout) + full-height action area.  
**Usage context:** Boutique counter. Tablet or desktop in portrait. Fast, repetitive transactions.  
**Characteristics:** One primary task per screen. Keyboard-friendly inputs. No navigation menus — a small top icon bar with 2–4 items max. Large tap targets.

### Family C — Terrain (warehouse · delivery · field_agent)

**Paradigm:** Mobile-first full-screen cards.  
**Layout:** No sidebar. Sticky header with role + name + notification badge. Content fills the screen. Bottom action bar for primary CTA where relevant.  
**Usage context:** Warehouse floor, delivery truck, customer site. Phone in portrait. On the move.  
**Characteristics:** Large typography. Maximum 3 items in any list row. Actions are buttons, not dropdowns. Works with one thumb. Critical paths complete in ≤ 3 taps.

---

## 2. Roles

---

### 2.1 OWNER (`owner`)

#### Purpose
The business owner has full visibility and control over every aspect of the company — people, products, money, and operations. They are the only user who can manage the platform's structure (users, boutiques, pricing floors).

#### Navigation Family
**Direction** — full sidebar.

#### Landing Page
`/dashboard`

#### Sidebar Navigation (12 items)
```
Tableau de bord      /dashboard          badge: pendingApprovals
Ventes               /sales
Devis                /quotes
Caisse               /caisse
Entrepôt             /warehouse          badge: confirmedOrders
Livraisons           /deliveries
Retours              /returns
Clients              /customers
Fournisseurs         /suppliers
Catalogue            /products
Rapports             /reports
Utilisateurs         /users
```

#### Main Screens

| Screen | Purpose |
|--------|---------|
| `/dashboard` | KPI overview: today's revenue, MTD revenue, active orders, créances total, stock alerts, boutique breakdown chart |
| `/sales` | All sales across all boutiques. Filter by boutique, date, status, vendor. Export. |
| `/quotes` | All devis pipeline. Filter by agent, status, date. |
| `/caisse` | Multi-boutique daily cash view. Boutique selector. Closings history. |
| `/warehouse` | Order preparation queue + stock levels + stock requests. |
| `/deliveries` | All deliveries. Assign livreurs. Track status. |
| `/returns` | Return requests. Validate or reject. |
| `/customers` | Customer directory. Search, filter, view history, credit limit. |
| `/suppliers` | Supplier directory + purchase orders. |
| `/products` | Full product catalog. Create, edit, deactivate. Manage categories. |
| `/reports` | Financial reports: revenue, margins, créances, stock valuation, per-boutique breakdown. |
| `/users` | Create employees, assign roles and boutiques, reset passwords, deactivate. |

#### Primary Actions
- Approve / reject stock requests
- Create and deactivate users
- Create boutiques
- Set and modify products + pricing
- View all financial reports
- Export any data set
- Record payments on any sale

#### Data Visibility Scope
**ALL data** — all boutiques, all users, all sales, all payments, all time periods. No filter by default.

#### Key Workflows

**Morning Operations Review (3 min)**
1. `/dashboard` → check today's pending orders badge
2. Click badge → `/warehouse` filtered to `confirmed` orders
3. Check créances banner → `/sales?payment_status=unpaid`
4. Check stock alerts → click alert → `/products` filtered to low stock

**Approve Stock Request**
1. Receive push notification (badge on dashboard)
2. `/warehouse` → "Demandes" tab
3. Review request: product, quantity, justification, current stock
4. "Approuver" or "Rejeter avec commentaire"
5. System auto-updates stock and notifies warehouse

**Hire New Employee**
1. `/users` → "Nouvel employé"
2. Fill: name, email, role, boutique(s), password
3. System creates auth account + profile
4. New user receives login credentials

**Monthly Financial Review**
1. `/reports` → select month range
2. Review: revenue by boutique, payment methods breakdown, créances aging, margins by product category
3. Export to PDF or CSV

#### UX Expectations
- Dashboard KPIs load in < 1 second (SSR + cache)
- Badge counts update in real-time (Supabase realtime subscription)
- All lists are filterable + sortable + exportable
- Bulk actions on lists where relevant (e.g. mark multiple payments)
- Keyboard-navigable (power user)

---

### 2.2 MANAGER (`manager`)

#### Purpose
Manages day-to-day operations for one or multiple boutiques. Is accountable for boutique-level sales targets, stock, and team performance. Does NOT manage platform-level settings (no user creation, no product creation, no pricing floors).

#### Navigation Family
**Direction** — full sidebar.

#### Landing Page
`/dashboard`

#### Sidebar Navigation (11 items)
```
Tableau de bord      /dashboard          badge: pendingApprovals
Ventes               /sales
Devis                /quotes
Caisse               /caisse
Entrepôt             /warehouse          badge: confirmedOrders
Livraisons           /deliveries
Retours              /returns
Clients              /customers
Fournisseurs         /suppliers
Catalogue            /products           (read-only)
Rapports             /reports
```
_No `/users` — managers cannot create or deactivate accounts._

#### Data Visibility Scope
**Only boutiques they are assigned to** — enforced by RLS at database level. They see no data from boutiques outside their assignment.

#### Key Workflows

**Dispatch Deliveries (morning)**
1. `/warehouse` → "Commandes" tab → filter to `ready`
2. For each ready order: assign a livreur from dropdown → "Assigner"
3. Livreur receives the order in their `/deliveries` list

**Approve Stock Requests**
Same flow as owner but scoped to their boutiques only.

**Monitor Boutique Performance**
1. `/dashboard` → boutique selector (if managing multiple)
2. Compare revenue today vs yesterday, vs same day last week
3. Drill into `/reports` → by boutique

**Handle Cash Discrepancy**
1. `/caisse` → select boutique + date of discrepancy
2. Review entries vs expected vs declared
3. Add corrective note or contact cashier

#### UX Expectations
- Boutique selector is always visible in dashboard and caisse
- Pending approvals badge is the primary attention-getter on landing
- Same quality as owner interface, just with scoped data

---

### 2.3 SELLER (`seller`)

#### Purpose
Serves customers at the boutique counter. Creates sales and devis. Looks up products and pricing. Does not process payment — that is the cashier's job.

#### Navigation Family
**Comptoir** — no sidebar, compact top bar + minimal bottom navigation.

#### Landing Page
`/sales/new` — directly in the sale creation form, ready to type.

#### Navigation (4 items, bottom bar or compact top icons)
```
+ Nouvelle vente     /sales/new          (always highlighted as primary)
Mes ventes           /sales
Devis                /quotes
Clients              /customers
```
_No caisse, no warehouse, no reports, no users, no products (read-only via sale form)._

#### Main Screens

| Screen | Purpose |
|--------|---------|
| `/sales/new` | POS-style sale creation form |
| `/sales` | Their own sales history. Filter by date, status. |
| `/quotes` | Their own devis. Create, view status, convert. |
| `/customers` | Customer lookup and creation |

#### Primary Actions
- Create a sale (VNT)
- Create a quote (DEV)
- Look up a customer (autocomplete, or create inline)
- Search products by name or reference code

#### Data Visibility Scope
- Their **own sales and quotes** only
- **Full product catalog** of their company (read-only, for lookup)
- **Customers** of their company (for autocomplete + creation)
- **Their boutique** only — cannot see other boutiques' data
- **No financial data** — no totals, no payment status of other sellers

#### Key Workflows

**Complete a Sale (primary, must be < 2 minutes)**
1. Land on `/sales/new` — cursor in customer name field
2. Type customer name → autocomplete suggests existing → select or create new
3. "Ajouter un produit" → search by name or reference → select
4. Enter quantity:
   - Tiles: input in cartons (+ loose tiles optional) OR in m²
   - Other types: simple numeric + unit label
5. Price shows instantly (catalog price, floor-price enforced)
6. Repeat products as needed
7. Add notes (optional, shown to warehouse)
8. Select payment method (recorded but cashier will process)
9. "Confirmer la vente" → VNT number generated → success state
10. Button: "Nouvelle vente" to immediately start next

**Create a Quote (for field customers or large orders)**
1. Same flow as sale but "Enregistrer comme devis"
2. DEV number generated
3. Quote appears in pipeline

**Find a Previous Sale**
1. `/sales` → customer name search or date filter
2. View sale details → can add note or initiate return

#### UX Expectations
- **Sale form must be the fastest possible interaction** — no modals, no page navigation during product search
- Product search: instant results as-you-type, show stock level next to each result
- Customer autocomplete: shows name + phone
- Tile quantity: visual carton/loose breakdown (e.g. "3 cartons + 4 loose = 4.76 m²")
- Floor price violation: immediate inline error, no form submission
- Success state: large VNT number, prominent "Nouvelle vente" button
- Should work on a 10" tablet at the counter
- Never full-page reload during a sale — all product/customer lookups are client-side after initial load

---

### 2.4 CASHIER (`cashier`)

#### Purpose
Processes customer payments for confirmed sales. Manages the physical cash register: opening fund, expenses, withdrawals, end-of-day closing. Does NOT create sales — that is the seller's job.

#### Navigation Family
**Comptoir** — no sidebar, single-purpose interface.

#### Landing Page
`/caisse` with "À encaisser" tab as default — the payment queue.

#### Navigation (1 item — single-purpose)
```
Caisse               /caisse
```
_That is all. No sales creation, no warehouse, no reports, no users._

#### Main Screens

The `/caisse` page has three tabs:

| Tab | Purpose |
|-----|---------|
| À encaisser | Queue of confirmed sales with outstanding balance. **Primary tab. Default on load.** |
| Caisse du jour | Cash register summary: espèces received, entries (opening/expenses/withdrawals), expected balance. |
| Historique | Previous closing records. |

#### Primary Actions
- Record a payment against a sale (amount + method + optional reference)
- Add cash entry (opening fund, expense, withdrawal)
- Close the register at end of day (declare physical cash, compare with expected)

#### Data Visibility Scope
- **Only their boutique's** sales with outstanding balance (payment_status ≠ 'paid')
- **Only their boutique's** cash register (entries + closings)
- **No other boutiques' data**
- **No product catalog, no warehouse, no delivery information**

#### Key Workflows

**Process a Payment (primary task, must be < 30 seconds)**
1. Land on `/caisse` → "À encaisser" tab
2. See list: VNT number, customer name, total, balance due (sorted by oldest first)
3. Tap "Encaisser" on a sale → inline form expands below the row
4. Enter amount (pre-filled with full balance)
5. Select payment method: Espèces / Virement / Mobile Money / Chèque
6. Optional: reference number or note
7. "Confirmer" → sale disappears from queue if fully paid, updates balance if partial
8. Next sale in queue is now top

**End-of-Day Register Closing**
1. "Caisse du jour" tab → verify all entries look correct
2. Button "Clôturer la caisse"
3. Count physical cash → enter declared amount
4. System shows expected vs declared → difference flagged
5. Add note if discrepancy
6. "Confirmer la clôture" → register locked for the day

**Record a Cash Entry**
1. "Caisse du jour" tab → "Ajouter une entrée"
2. Type: Dépense / Retrait / Fonds de caisse
3. Amount + description
4. "Enregistrer"

#### UX Expectations
- **The payment queue must be scannable in < 5 seconds** — customer name, balance, and "Encaisser" button visible without any expansion
- Payment form is inline (no modal) — opens below the row, closes on confirm
- Amount input is numeric and auto-selects on focus
- After payment confirmation: smooth removal from queue (not full page reload)
- Register summary shows running total in real-time as entries are added
- Closing form shows the math explicitly: espèces + fonds − expenses − withdrawals = expected
- Should work on the counter's desktop or tablet (landscape)

---

### 2.5 WAREHOUSE (`warehouse`)

#### Purpose
Physically prepares orders at the warehouse. Monitors and requests stock. Assigns completed orders to delivery personnel.

#### Navigation Family
**Terrain** — mobile-friendly, action-card layout, but also comfortable on desktop.

#### Landing Page
`/warehouse` → "Commandes" tab — the order preparation queue.

#### Navigation (2 items)
```
Entrepôt             /warehouse          badge: confirmedOrders
Fournisseurs         /suppliers
```
_No sales, no caisse, no reports, no users._

#### Main Screens

The `/warehouse` page has three tabs:

| Tab | Purpose |
|-----|---------|
| Commandes | Active orders: confirmed → preparing → ready → assign livreur |
| Stock | Current stock levels per product. Low-stock alerts. |
| Demandes | Their own stock requests and status. |

#### Primary Actions
- Mark order as "En préparation" (start picking)
- Mark order as "Prête" (picking complete)
- Assign a livreur to a ready order
- Print preparation sheet (picking list)
- Download bon de livraison (BL) PDF
- Submit a stock request (restock or correction)

#### Data Visibility Scope
- **All active orders** for their company (not boutique-filtered — warehouse serves all boutiques)
- **Full stock** of their company
- **Their own stock requests** only (not others')
- **Delivery users list** (to assign orders)
- **No financial data** — no sale amounts, no payment status

#### Key Workflows

**Process an Order (primary, must feel fast)**
1. Land on `/warehouse` → order card visible immediately
2. Card shows: order number, customer, boutique origin, item count, creation date
3. "Commencer" button visible without expanding → tap
4. Status changes to "En préparation" (amber indicator)
5. Expand card to see full picking list (products + quantities)
6. Optionally print preparation sheet
7. Pick all items physically
8. "Marquer prête" → status changes to "Prête" (green indicator)
9. Delivery assignment strip appears: select livreur from dropdown → "Assigner"
10. Order disappears from active queue and appears in delivery list

**Submit a Stock Request**
1. "Stock" tab → see current levels → identify low/zero items
2. "Demandes" tab → "Nouvelle demande"
3. Select product → type (entrée stock / correction)
4. Enter quantity + justification
5. Submit → goes to manager/owner for approval
6. Status visible in "Demandes" tab

#### UX Expectations
- Order cards must show action buttons **without expanding** — confirmed orders show "Commencer", preparing orders show "Marquer prête", ready orders show the livreur assignment strip
- Stock table: sortable by level (ascending by default = lowest first), color-coded (red = critical, amber = low)
- Real-time updates via Supabase channel (new orders appear automatically)
- Print sheet must open in new tab and auto-print
- Mobile-friendly: large tap targets, single-column layout on phones

---

### 2.6 DELIVERY (`delivery`)

#### Purpose
Picks up ready orders from the warehouse and delivers them to customers. Confirms successful delivery or reports issues.

#### Navigation Family
**Terrain** — pure mobile. Single-purpose.

#### Landing Page
`/deliveries` — their assigned orders only.

#### Navigation (1 item)
```
Mes livraisons       /deliveries         badge: pendingDeliveries
```
_Nothing else. This role has exactly one job._

#### Main Screens

`/deliveries` — a single list of orders assigned to them, sorted by creation date (oldest first = most urgent).

Each order card shows:
- Order number + status badge
- Customer name + phone (tappable → calls)
- Address (if available)
- Item count + total
- **Always-visible action strip** (not behind expand)

The card action strip contains:
- Primary: **"Confirmer la livraison"** (large, amber, full-width)
- Secondary: **"Signaler un problème"** (small, red-outlined)

Expandable detail (behind tap): item list + seller notes.

#### Primary Actions
- Confirm delivery (marks order as delivered, decrements stock)
- Report delivery issue (reason + notes → audit log → notifies management)

#### Data Visibility Scope
- **ONLY orders assigned to them** (`assigned_delivery_id = their id`)
- **Customer name + phone** of their assigned orders
- **Item list** of their assigned orders
- **No financial data** — no sale amounts, no payment information
- **No stock, no other users' deliveries, no warehouse data**

#### Key Workflows

**Confirm a Delivery**
1. Land on `/deliveries` → see their assigned orders
2. Card shows customer + confirm button immediately visible
3. Tap confirm button → inline confirmation strip expands
4. "Oui, livraison confirmée" → order disappears from list
5. Stock decremented automatically, sale marked delivered

**Report a Problem**
1. Tap "Signaler un problème" on an order card
2. Select reason: Client absent / Refus de réception / Mauvaise adresse / Article endommagé / Paiement refusé / Autre
3. Add details (optional text)
4. "Envoyer le signalement" → audit log written, manager notified
5. Order stays in list (not confirmed) — management decides next step

#### UX Expectations
- **This interface must work perfectly with one hand on a phone**
- Confirm button: full-width, minimum 52px height, positioned where thumb naturally rests
- Phone number must be a tap-to-call link
- No sidebar — sticky minimal header only
- Empty state must be congratulatory, not technical
- Issue reporting: chip-based reason selection (no dropdowns)
- After confirm: satisfying success animation, order removed from list
- If list is empty: "Toutes vos livraisons sont terminées" + motivational sub-copy

---

### 2.7 ACCOUNTANT (`accountant`)

#### Purpose
Financial oversight of the entire company. Read-only access to all financial data. Produces reports. Cannot create sales, approve requests, or perform any operational action.

#### Navigation Family
**Direction** — full sidebar, but **all action buttons are hidden**.

#### Landing Page
`/reports` — directly on the financial reports page.

#### Sidebar Navigation (7 items)
```
Tableau de bord      /dashboard          (financial KPIs only, no operational widgets)
Rapports             /reports
Ventes               /sales              (read-only)
Caisse               /caisse             (read-only, all boutiques)
Clients              /customers          (read-only)
Fournisseurs         /suppliers          (read-only)
Catalogue            /products           (read-only)
```
_No warehouse, no deliveries, no users, no stock requests._

#### Main Screens

| Screen | Purpose |
|--------|---------|
| `/dashboard` | Financial-only dashboard: MTD revenue, créances total, payment method breakdown, margin %, cash balance. No pending orders widget, no stock alerts. |
| `/reports` | Full report suite: revenue by period, by boutique, by product category. Créances aging. Payment methods. Stock valuation. Export to PDF/CSV. |
| `/sales` | All sales. Read-only. Payment status, amounts, methods. No "Annuler" or "Modifier" buttons. |
| `/caisse` | All boutiques' cash closings. Read-only. Discrepancy history. |
| `/customers` | Customer credit exposure. Outstanding balances. |
| `/suppliers` | Supplier invoices and purchase order history. |
| `/products` | Product catalog + cost/price data. Read-only. |

#### Primary Actions
- View and filter any financial report
- Export reports to PDF and CSV
- **No write operations of any kind**

#### Data Visibility Scope
- **ALL financial data** — all boutiques, all time periods
- Amounts, margins, payment methods, créances
- **No operational data** — no order prep status, no delivery assignments, no stock requests
- **No user management data**

#### Key Workflows

**Monthly Financial Close (primary use case)**
1. `/reports` → select month range
2. Revenue by boutique: verify vs targets
3. Créances aging: identify customers with overdue balance > 30 days
4. Payment methods breakdown: cash vs transfer vs mobile money
5. Margins by product category
6. Export consolidated report as PDF → send to owner

**Créances Review**
1. `/customers` → sort by "Solde dû" descending
2. Filter by "Solde > 0"
3. View each customer's payment history
4. Flag for collection

**Cash Audit**
1. `/caisse` → select boutique + date range
2. Review each day's closing: expected vs declared
3. Identify discrepancies
4. Cross-reference with sales for that day

#### UX Expectations
- Reports page must have powerful filters (date range picker, boutique multi-select, product category multi-select)
- All data tables must be sortable and exportable
- Charts are informational, not decorative — use them where they convey more than a number
- No action buttons anywhere in the interface — read-only state is enforced visually (no hover effects on rows that would suggest clickability for action)
- Page density: high. This user is comfortable with data.

---

### 2.8 FIELD_AGENT (`field_agent`)

#### Purpose
Outside sales representative. Creates quotes (devis) for prospects and customers in the field. Tracks their own pipeline. Does not process payments or manage stock.

#### Navigation Family
**Terrain** — mobile-first. Fast quote creation is the entire job.

#### Landing Page
`/quotes/new` — immediately in the quote creation form, ready to enter a customer name.

#### Navigation (3 items)
```
+ Nouveau devis      /quotes/new         (always highlighted as primary CTA)
Mon pipeline         /pipeline
Mes clients          /customers
```
_No caisse, no warehouse, no deliveries, no reports, no products management._

#### Main Screens

| Screen | Purpose |
|--------|---------|
| `/quotes/new` | Quote creation form — identical to sale form but saves as DEV |
| `/pipeline` | Their own quote pipeline, filtered by status. Kanban-style or list. |
| `/customers` | Their customer list + contact details |

#### Primary Actions
- Create a new quote
- View pipeline status of their quotes
- Convert a quote to a sale (if they have the role — or request conversion)
- Cancel a quote
- Call a customer (tap-to-call)

#### Data Visibility Scope
- **Only their own quotes**
- **Full product catalog** (read-only, for building quotes)
- **Customers they've created** + shared customer directory (read-only)
- **No financial data** — no payment information, no cash register
- **No warehouse or delivery data**

#### Key Workflows

**Create a Quote in the Field**
1. Land on `/quotes/new` — cursor ready in customer name field
2. Type customer name → autocomplete → select or create new (name + phone mandatory)
3. "Ajouter un produit" → search by name → select
4. Enter quantity (tile logic: cartons/m² or simple qty for other types)
5. Price shows (catalog price)
6. Repeat for all products
7. Add notes (site conditions, delivery constraints, etc.)
8. "Enregistrer le devis" → DEV number generated
9. Share button: WhatsApp or PDF → send quote to customer on the spot

**Follow Up on a Quote**
1. `/pipeline` → filter to "draft" or "En attente de réponse"
2. Tap a quote → see details → call customer (tap phone)
3. If accepted: "Convertir en vente" (if permitted) or note "Accord verbal"
4. If refused: "Annuler le devis"

**Review Pipeline Health**
1. `/pipeline` → filter by status
2. See total quote value by status
3. Identify quotes older than 7 days with no update → prioritize follow-up

#### UX Expectations
- **Quote creation must complete in < 3 minutes** even on a slow mobile connection
- Customer creation inline (not a separate page — modal or expandable section)
- Product search works client-side after initial load (no network request per keystroke)
- Pipeline must show quote value + customer + date at a glance without expanding
- PDF/WhatsApp share available directly from quote creation success screen
- Works on 4G or WiFi — no hard dependency on real-time features
- Pipeline filter tabs use chips, not a dropdown

---

## 3. Screen Inventory

Every screen in the application and who can access it.

| Route | owner | manager | seller | cashier | warehouse | delivery | accountant | field_agent |
|-------|:-----:|:-------:|:------:|:-------:|:---------:|:--------:|:----------:|:-----------:|
| `/dashboard` | ✓ | ✓ | — | — | — | — | ✓ | — |
| `/sales` | ✓ | ✓ | ✓ own | — | — | — | ✓ RO | — |
| `/sales/new` | ✓ | ✓ | ✓ | — | — | — | — | — |
| `/quotes` | ✓ | ✓ | ✓ own | — | — | — | — | ✓ own |
| `/quotes/new` | ✓ | ✓ | ✓ | — | — | — | — | ✓ |
| `/pipeline` | ✓ | ✓ | — | — | — | — | — | ✓ own |
| `/caisse` | ✓ | ✓ | — | ✓ own boutique | — | — | ✓ RO | — |
| `/warehouse` | ✓ | ✓ | — | — | ✓ | — | — | — |
| `/deliveries` | ✓ | ✓ | — | — | ✓ | ✓ assigned | — | — |
| `/returns` | ✓ | ✓ | ✓ | — | — | — | — | — |
| `/customers` | ✓ | ✓ | ✓ | — | — | — | ✓ RO | ✓ own |
| `/products` | ✓ | ✓ RO | — | — | — | — | ✓ RO | — |
| `/suppliers` | ✓ | ✓ | — | — | ✓ | — | ✓ RO | — |
| `/reports` | ✓ | ✓ scoped | — | — | — | — | ✓ | — |
| `/users` | ✓ | — | — | — | — | — | — | — |

_RO = read-only, own = only their own records, scoped = their boutiques only_

---

## 4. Role-to-Page Redirect Map

When a user logs in, they are redirected immediately to their primary working screen:

| Role | Redirect Target | Rationale |
|------|----------------|-----------|
| `owner` | `/dashboard` | Needs the full picture on arrival |
| `manager` | `/dashboard` | Needs boutique KPIs on arrival |
| `seller` | `/sales/new` | Their job is to sell — start selling immediately |
| `cashier` | `/caisse` | À encaisser tab is default — payment queue is their job |
| `warehouse` | `/warehouse` | Order queue is their job |
| `delivery` | `/deliveries` | Assigned orders are their entire job |
| `accountant` | `/reports` | Financial reports are their primary task |
| `field_agent` | `/quotes/new` | Quote creation is their primary task |

---

## 5. Permission Matrix

### What each role can WRITE (create/modify/delete)

| Action | owner | manager | seller | cashier | warehouse | delivery | accountant | field_agent |
|--------|:-----:|:-------:|:------:|:-------:|:---------:|:--------:|:----------:|:-----------:|
| Create sale | ✓ | ✓ | ✓ | — | — | — | — | — |
| Create quote | ✓ | ✓ | ✓ | — | — | — | — | ✓ |
| Record payment | ✓ | ✓ | — | ✓ | — | — | — | — |
| Close caisse | ✓ | ✓ | — | ✓ | — | — | — | — |
| Manage orders | ✓ | ✓ | — | — | ✓ | — | — | — |
| Assign livreur | ✓ | ✓ | — | — | ✓ | — | — | — |
| Confirm delivery | ✓ | ✓ | — | — | — | ✓ own | — | — |
| Report issue | ✓ | ✓ | — | — | — | ✓ | — | — |
| Submit stock request | ✓ | ✓ | — | — | ✓ | — | — | — |
| Approve stock request | ✓ | ✓ | — | — | — | — | — | — |
| Create/edit product | ✓ | — | — | — | — | — | — | — |
| Manage users | ✓ | — | — | — | — | — | — | — |
| Create boutique | ✓ | — | — | — | — | — | — | — |
| Cancel sale | ✓ | ✓ | — | — | — | — | — | — |
| Create return | ✓ | ✓ | ✓ | — | — | — | — | — |

---

## 6. Data Scoping Rules

### By Role
- **owner + accountant:** All data across all boutiques and time periods
- **manager:** Only boutiques in their `user_boutique_assignments`
- **seller:** Only their `boutique_id` + their own sales
- **cashier:** Only their `boutique_id`
- **warehouse:** All company orders + all company stock (warehouse serves all boutiques)
- **delivery:** Only orders where `assigned_delivery_id = user.id`
- **field_agent:** Only their own quotes + shared customer directory

### Enforcement
- RLS policies enforce all scoping at the database level
- No front-end-only filtering — even if a UI bug exists, the database returns nothing
- `get_my_company_id()` + `get_my_role()` are SECURITY DEFINER functions — cannot be spoofed by RLS bypass

---

## 7. Badge / Notification System

| Badge Key | Appears for | Meaning |
|-----------|------------|---------|
| `pendingApprovals` | owner, manager | Stock requests awaiting approval |
| `confirmedOrders` | owner, manager, warehouse | Orders with status `confirmed` (not yet started) |
| `pendingPayments` | cashier | Sales in their boutique with outstanding balance |
| `pendingDeliveries` | delivery | Orders assigned to them with status `ready` |

Real-time: all badges update via Supabase `postgres_changes` subscription without page refresh.

---

## 8. Mobile vs Desktop Expectations

| Role | Primary Device | Min Screen | Key Constraint |
|------|---------------|-----------|----------------|
| owner | Desktop / tablet | 1024px | None — data-dense layout |
| manager | Desktop / tablet | 1024px | None |
| seller | Tablet counter (landscape) | 768px | Fast input, no scroll during sale |
| cashier | Desktop counter | 768px | Single-screen, no scroll |
| warehouse | Mobile + desktop | 360px | One-column, large tap targets |
| delivery | Mobile (portrait) | 360px | One thumb operation, large CTA |
| accountant | Desktop | 1024px | Data tables, export |
| field_agent | Mobile (portrait) | 360px | Offline-tolerant, fast form |

---

## 9. Critical Interaction Standards

These interaction standards apply across all role interfaces without exception.

### 9.1 Action Buttons
- Every screen has a clear **primary action** — one button, highest contrast, above the fold
- Secondary actions are visually subordinate (outlined or ghost)
- Destructive actions (cancel, delete) are red and require a confirmation step
- Loading states: show spinner + disabled state — never leave a button clickable during async

### 9.2 Forms
- No full-page navigation during a form (use inline expansion, not modals for sub-tasks)
- Validation is inline, real-time for critical fields (email, phone format, amount > 0)
- Required fields are marked — but keep required fields to the true minimum
- Numeric inputs use `inputMode="numeric"` for mobile keyboard

### 9.3 Lists
- Empty states are never blank — always explain why empty + offer the next action
- Lists refresh in real-time for operational roles (seller, cashier, warehouse, delivery)
- Pagination or infinite scroll for historical lists (sales history, reports)
- Search is instant (client-side filter where dataset fits in memory)

### 9.4 Feedback
- Success: toast notification or inline success state — never navigate away from context
- Error: inline, near the failed field/action — never a generic page error
- Every mutation has an optimistic UI update where safe, with rollback on error

### 9.5 Navigation
- The active route is always highlighted in the navigation
- Back navigation is always available (never a dead end)
- Role-based navigation is static — a user never sees navigation items they cannot use

---

## 10. What This Document Is Not

This document defines **product design and role architecture**. It does not specify:
- Component implementation details (use the existing Papier design tokens)
- Database schema (see `supabase/migrations/`)
- Specific API contracts (see `actions.ts` files per page)
- Sprint or release planning

When in doubt about whether something belongs in this document vs code: if it affects what a user sees or can do based on their role, it belongs here. If it affects how the database stores it, it belongs in a migration.

---

_Last updated: 2026-05-03_  
_Maintained by: PERRINIO-dev_
