# MEREM — UX/UI Standards
## The Minerals Design Language · Reference Document v1.0

> This document is the single authority on how every screen in MEREM is designed
> and built. It is not a set of suggestions. Every rule here applies without exception
> unless explicitly superseded in writing. When in doubt, return here.

---

## I. Founding Philosophy

MEREM is a professional tool. The people who use it — boutique owners, warehouse
managers, sales vendors — spend hours inside it every day. The standard for this
product is not "clean and modern." The standard is: **does this screen make someone
better at their job?**

Three principles govern every design decision:

**1. Clarity before beauty.** If a screen is beautiful but a user takes an extra
second to understand it, it has failed. Clarity and beauty are not in conflict —
but when they are, clarity wins.

**2. The interface should recede.** The data is the product. The interface is the
frame. A great frame draws your eyes to the painting, not to itself. Every
decorative decision must justify its existence against this principle.

**3. Earn the amber.** Amber is the brand signal. Every time it appears, it carries
weight. Use it recklessly and it becomes noise. Use it precisely and it becomes
a beacon. The discipline of restraint is what makes the palette feel premium.

---

## II. Color — Usage with Intention

### The surface hierarchy

There are exactly five background values, each one step lighter than the last.
**They must never be inverted or skipped.**

```
bg          #1C1917   Page canvas — the floor
surface     #242120   Cards, panels, table bodies
surfaceEl   #2E2B28   Modals, dropdowns, hover-elevated cards
surfaceHov  #353230   Interactive surface hover state
surfaceSub  #1F1D1B   Recessed areas — sidebar track, alternating rows
```

Rule: A child element must always be on an equal or lighter surface than its parent.
A modal lives on `surfaceEl` because it floats above `surface` cards.
A dropdown lives on `surfaceEl` because it floats above `bg`.
Never place a `surface` card directly on another `surface` card without a border.

### Amber: the reserved signal

Amber (`#F59E0B`) is the only chromatic color in Minerals that is not a status.
It carries one meaning: **"this is the thing you should act on right now."**

**Amber is allowed for:**
- The primary action button on any given screen (one per view hierarchy)
- The active/selected state of navigation items
- Key numerical callouts that anchor the visual gravity of a KPI card
- Focus rings and interactive input borders
- Critical data values the user must not miss (overdue, urgent)

**Amber is never allowed for:**
- Decorative borders or backgrounds with no interactive meaning
- Section dividers or spacers
- Icon color without an accompanying interactive purpose
- More than one primary action per screen
- Anything in a print context (the printed document is neutral)

### Status semantics — the four operational states

These four colors describe the operational world. Every status in the app
maps to exactly one of them. They are never used outside their semantic role.

| Color  | Tokens         | Meaning                                |
|--------|----------------|----------------------------------------|
| Green  | `C.green`      | Completed, paid, confirmed, in stock   |
| Orange | `C.orange`     | Pending, partial, low stock, attention |
| Red    | `C.red`        | Cancelled, unpaid, error, critical     |
| Blue   | `C.blue`       | Informational, draft, neutral-pending  |

Each status color must always appear with its semantic background and border
(e.g., `C.green` text on `C.greenBg` background with `C.greenBd` border).
Never use a status text color alone on a generic dark background — the
tinted background is what makes the status readable at a glance.

### Contrast reference table

Every text/background combination used in MEREM must meet these minimums:

| Text               | On Background | Ratio  | Usage                        |
|--------------------|--------------|--------|------------------------------|
| `#FAFAF9` (ink)    | `#1C1917`    | ~16:1  | Primary text, headings       |
| `#E7E5E4` (text)   | `#1C1917`    | ~13:1  | Body content                 |
| `#A9A49D` (muted)  | `#1C1917`    | ~5.8:1 | Secondary labels (AA ✓)      |
| `#78716C` (dim)    | `#1C1917`    | ~3.7:1 | Large/bold only — never body |
| `#F59E0B` (amber)  | `#1C1917`    | ~9:1   | Actions, active states       |
| `#1C1917` (ink-inv)| `#F59E0B`    | ~9:1   | Text on amber buttons        |

---

## III. Typography in Practice

### The two fonts and when each appears

**Sora** is the voice. It speaks for MEREM when something needs weight — page
titles, KPI numbers, modal headings, the number that tells the owner how much
they sold today. Sora is set tighter than its default tracking (−0.03em for titles,
−0.04em for hero numbers) because it carries authority better when compact.

**IBM Plex Sans** is the worker. It does everything else: form labels, table rows,
dropdown items, description text, notification messages. Its optical clarity at
12–14px is unmatched. Its tabular numerals (`font-feature-settings: "tnum"`) ensure
that columns of financial figures align precisely without monospace spacing.

**IBM Plex Mono** is reserved exclusively for: sale numbers (VNT-2026-0042),
quote numbers (DEV-2026-0012), stock request IDs, and any reference code the
user or system must copy, compare, or search. Never use it decoratively.

### The four hierarchy levels of any screen

Every screen in MEREM uses exactly four typographic levels. No more, no fewer.

| Level   | Font      | Size   | Weight | Color     | Usage                          |
|---------|-----------|--------|--------|-----------|--------------------------------|
| L1      | Sora      | 24px   | 800    | `ink`     | Page title (one per page)      |
| L2      | IBM Plex  | 15–17px| 600    | `text`    | Card titles, section headings  |
| L3      | IBM Plex  | 14px   | 400–500| `text`    | Body, table content, inputs    |
| L4      | IBM Plex  | 11px   | 700    | `dim`     | Section labels (UPPERCASE)     |

**Section labels (L4)** are always: uppercase, 11px, 700 weight, `C.dim`,
letter-spacing `0.10em`. They never appear below 11px. They describe the content
that follows — they do not repeat the page title.

**L1 appears once per page** — in the page header. Never inside a card.
If a card needs a large title, that is L2 (17–20px), not L1.

### Numbers and financial figures

Numbers are data. They must be treated as instruments, not text.

- All numbers in tables, KPI cards, and forms use `font-variant-numeric: tabular-nums`
  and `font-feature-settings: "tnum"` (class `.num` in globals.css)
- Currency amounts use IBM Plex Sans (the tabular variant), never Sora
- KPI headline figures use Sora, 30–48px, 800 weight, tracking −0.04em
- Negative/zero values are never shown as blank — always as "—" or "0 F"
- CFA format: `1 450 000 F` (space as thousands separator, F suffix, no decimal)

### What we never do with type

- Never use italic in this UI — it signals fragility, not precision
- Never set body text below 13px (use `C.muted` instead of going smaller)
- Never use the Sora font for table content, form inputs, or labels
- Never mix font weights within a single sentence or label
- Never use the same visual weight for both a label and its value — the label
  is always lighter (muted/dim) than the value (text/ink)

---

## IV. Spatial Rhythm

### The 4px grid contract

Every dimension in the app is a multiple of 4px. This is not optional.
If a value feels "close" to a multiple of 4 but isn't, change the design, not the rule.

Allowed: 4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96
Not allowed: 5, 7, 9, 10 (except as border widths), 15, 25, 30 (unless explicitly justified)

### Page anatomy

```
┌─────────────────────────────────────────────────────────────┐
│ Sidebar (240px fixed)  │  Page area                         │
│                        │  ┌──────────────────────────────┐  │
│                        │  │ Page header (title + actions)│  │
│                        │  │ padding: 32px top/sides       │  │
│                        │  ├──────────────────────────────┤  │
│                        │  │ KPI row (if applicable)      │  │
│                        │  │ gap: 16px between cards      │  │
│                        │  ├──────────────────────────────┤  │
│                        │  │ Main content                 │  │
│                        │  │ padding: 0 32px 32px         │  │
│                        │  └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

- Page padding: 32px horizontal (desktop), 20px (tablet), 16px (mobile)
- Page header: title (L1) left, primary action(s) right — always top of page
- Vertical rhythm between sections: 24px between related blocks, 40px between
  distinct sections (e.g., KPI row → table section)
- Content max-width: 1280px, centered when the page area is wide enough

### Card anatomy

```
┌─────────────────────────────────────────────┐
│  Card header (optional)                     │  ← 24px padding
│  ─────────────────────────────────────────  │  ← 1px border (borderSub)
│  Card content                               │  ← 24px padding
│                                             │
│  Card footer (optional)                     │  ← 24px padding top
└─────────────────────────────────────────────┘
  border: 1px solid C.border
  background: C.surface
  border-radius: R.lg (10px)
  box-shadow: SH.sm
```

Compact cards (dense tables, list items): cardPSm = 16px padding.
Cards never have drop shadows larger than `SH.md` unless they are modals.
Modals use `SH.xl` — they float high above the page.

### Table anatomy

```
Header row: background surfaceSub, border-bottom border, 44px height
Body rows:  background surface, border-bottom borderSub, 52px height
Hover rows: background surfaceHov (CSS class .trow)
Open rows:  background surfaceEl (CSS class .trow-open)
```

- First column: product/entity name — left-aligned, IBM Plex Sans base/medium
- Numeric columns: right-aligned, tabular-nums, IBM Plex Sans
- Status column: badge (pill), center-aligned, never raw text
- Action column (if present): right-aligned, icon buttons, minimum 44px touch target
- Empty tables: centered empty state, not an empty `<tbody>`

### Section spacing rules

- Between two cards in the same row: `gap: 16px`
- Between a page section title (L4) and the content below: `margin-bottom: 8px`
- Between stacked sections (KPIs above, table below): `margin-top: 24px`
- Between the page header and the first content block: `margin-top: 24px`
- Modal content padding: 24px; modal footer padding: 16px top with a border above

---

## V. Visual Hierarchy per Screen

### The three-zone model

Every screen is composed of three zones, top to bottom:

**Zone 1 — Orientation** (always visible above the fold)
Page title, subtitle if needed, primary action button, and any active filters.
The user understands where they are and what they can do within 1 second.

**Zone 2 — At-a-glance intelligence** (KPI row, status summary)
The critical numbers that answer: "how is this going right now?"
4 KPIs max. If there are more, group them or reserve for a dedicated reports page.

**Zone 3 — Working data** (table, list, or detail panels)
The operational content. The user drills here when they need specifics.

On screens without KPIs (e.g., a form page), Zone 2 is omitted and Zones 1 and 3
connect directly with a 24px gap.

### The single focal point rule

Each screen must have exactly one element with the highest visual weight — the
primary action or the primary data point. Two things competing for visual dominance
means neither is dominant. If you have two amber buttons on a screen, one of them
is wrong.

### Primary vs secondary actions

| Role      | Style                    | Placement                            |
|-----------|--------------------------|--------------------------------------|
| Primary   | `.btn-amber`, full width in forms or right-aligned in headers | Right side of page header, or bottom of form |
| Secondary | `.btn-surface`           | Adjacent to primary, subdued         |
| Tertiary  | `.btn-ghost`             | Inline with content, icon-optional   |
| Danger    | `.btn-ghost-danger`      | Separate from the primary group, with a spacer |

Destructive actions (delete, cancel, annuler) are always separated from primary actions
by at least 12px and use `.btn-ghost-danger`. They escalate to `.btn-red` only in
confirmation modals where the user has already confirmed intent.

---

## VI. Interactive States

Every interactive element — button, input, table row, nav item, card — must
communicate four states visually: **default, hover, active/pressed, disabled.**
Focus is the fifth state, required for keyboard navigation.

### Hover
- Background surfaces: shift to `surfaceHov`
- Buttons: lift 1px + shadow increase (CSS transition `0.12s ease`)
- Links and text actions: color shifts from `muted` → `text`
- Table rows: background shifts to `surfaceHov`
- Nav items: background shifts to `surfaceHov`
- Cards (interactive): `translateY(-2px)` + shadow deepens

### Focus (keyboard navigation)
- All focusable elements: `outline: 2px solid var(--amber)` + `outline-offset: 2px`
- Never remove the focus ring via `outline: none` without providing an equivalent
- Inputs use `border-color: var(--amber)` + `box-shadow: 0 0 0 3px rgba(245,158,11,0.18)`
  on `focus-visible` — distinct from hover

### Active / Pressed
- Buttons: `translateY(1px) scale(0.98)` — satisfying physical feedback
- Duration: `0.10s ease` — fast enough to feel like a click

### Loading (button-level)
- Replace button label with `spinner-dark` + "En cours…" text immediately
- `disabled` attribute set — prevents double-submit
- Never change button dimensions during loading — text length change creates jank
- Loading state appears in < 100ms after click; if response is fast (< 300ms), skip it

### Disabled
- Opacity: `0.38` — clearly inactive without vanishing
- Cursor: `not-allowed`
- No hover effects apply
- Disabled form fields use the same background as enabled fields but with reduced opacity

---

## VII. Data Display Standards

### Currency amounts
- Format: `1 450 000 F` (narrow space as thousands separator, F suffix, no decimals)
- The `formatCFA()` utility handles this — never format currency inline
- Negative amounts: `−450 000 F` with a minus sign, text color `C.red`
- Zero amounts: `0 F` (never blank, never "—")
- In tables: right-aligned, tabular-nums, IBM Plex Sans weight 500

### Status badges
- Structure: colored dot (5px) + label text, in a pill container
- Always include text — never color-only
- Use `C.green` / `C.greenBg` / `C.greenBd` for the tinted surface
- Badge text: 11px, weight 600, `letter-spacing: 0.02em`

### Dates and times
- Less than 24h ago: "Il y a 3h" (relative)
- 1–6 days ago: "Lundi 7 avril" (day + date)
- 7+ days ago: "07/04/2026" (absolute DD/MM/YYYY)
- Never use ISO format (2026-04-07) in the UI — it reads as a code, not a date

### Reference numbers (sale IDs, quote IDs)
- Always in `.mono` class (IBM Plex Mono)
- Never truncated — they must be fully visible and selectable
- Background: subtle `surfaceEl` pill to visually distinguish from surrounding text

### Empty cells
- Numeric / amount cells with no data: "—" (em dash), centered, `C.dim`
- Never leave a cell blank — a blank reads as a rendering failure
- Never show "0" for a missing value if the distinction matters

---

## VIII. Transient States

### Loading — skeleton over spinner

Whenever a section of the page is loading data, show a skeleton that matches the
shape of the content being loaded. A full-page spinner is only acceptable on
initial auth-gated navigation.

Skeleton rules:
- Height and width match the actual content dimensions
- Use `C.surfaceEl` background with `skeletonPulse` animation (not shimmer, which
  is distracting on dark backgrounds)
- Show skeleton for any load that takes > 150ms
- Skeletons must not shift layout when content loads — dimensions are identical

### Error states

Errors come in two types: **form errors** and **system errors**.

**Form errors:** inline, below the offending field + a banner at the top of the form.
Banner: `C.red` border, `C.redBg` background, `C.red` icon + message text.
The banner uses `role="alert"` and `aria-live="assertive"`.
Never use toast for form errors — the user needs to see the error and the field together.

**System errors:** a banner at the top of the page section that failed.
If the entire page failed to load: a centered error state with a retry button.

Error messages are:
- Specific: "Stock insuffisant pour ce produit — disponible : 12 unités"
- Not technical: never show raw error messages from Supabase or the API
- Actionable: every error message includes what the user can do next

### Empty states

An empty state is a screen that has no data yet — new boutique, empty stock, no sales.
It is **not a failure state**. It is an invitation.

Structure:
- Icon (SVG, large, `C.amber` or `C.muted`, 40–48px)
- Headline: "Aucune vente pour le moment" (L2, `C.ink`)
- Subtext: "Créez votre première vente pour commencer." (L3, `C.muted`)
- Primary action button if one applies

Empty states live centered in the content area, not in a table row.

### Success confirmations

Two tiers based on the weight of the action:

**Tier 1 — Non-blocking toast** (low-stakes: note saved, status updated)
- Bottom-right corner, 320px wide
- `C.surfaceEl` background, `C.green` left border accent, green icon
- Auto-dismiss after 3500ms; fade out in 300ms
- Dismissible by click
- Never stack more than 2 toasts simultaneously

**Tier 2 — Full success screen** (high-stakes: sale created, quote converted, payment recorded)
- Replaces the form content with a completion state
- Shows the generated reference number in `.mono` style, prominently
- Two actions: "Retour à la liste" (secondary) + "Nouvelle [entité]" (primary)
- This is a moment of celebration — the amber gradient, the number, the clarity all matter

---

## IX. Navigation & Orientation

### The sidebar contract

The sidebar (240px, `C.bg` background) is the permanent spatial anchor of the app.
The user always knows where they are because the sidebar always shows them.

**Active item:** amber left border (3px, `C.amber`) + amber-washed background
(`rgba(245,158,11,0.08)`) + icon and label shift to `C.amber`

**Inactive item:** `C.muted` icon and label, no background. On hover: `surfaceHov`
background, icon and label shift to `C.text`.

Nav section labels (GROUP HEADERS) are 10px, uppercase, `C.dim`, non-interactive,
with 8px padding above. They categorize the nav items below.

The sidebar never shows a feature the current user's role cannot access.
Showing a grayed-out nav item to a vendor is noise — hide it entirely.

### Page title rule

Every page's `<h1>` (the L1 title at the top of the content area) must match exactly
the label of the active sidebar nav item. No synonyms. If the nav says "Ventes",
the page says "Ventes". This is the user's orientation anchor — any mismatch creates
doubt about whether they navigated correctly.

### Mobile navigation

On mobile (< 768px):
- Sidebar is hidden behind a drawer (slides in from left, `TR.smooth`)
- A fixed top bar (56px) replaces the sidebar: 3px amber accent stripe at the top,
  hamburger icon left, page title center, optional action right
- Backdrop (semi-transparent `bg` at 60% opacity) closes the drawer on tap
- The page title in the top bar comes from the same source as the `<h1>`

### Breadcrumbs

Breadcrumbs appear **only** when the user is more than 2 levels deep in a hierarchy.
Most pages in MEREM do not have breadcrumbs. When they do appear:
- Format: `Ventes / VNT-2026-0042`
- Style: `C.muted` for the parent links, `C.text` for the current page
- 12px, IBM Plex Sans, above the page title with 4px gap

---

## X. Responsive Design

### Breakpoints

```
Mobile:   ≤ 640px   (one column, stacked everything)
Tablet:   641–1023px (two columns where applicable)
Desktop:  ≥ 1024px  (full sidebar + multi-column content)
```

### Grid behavior

- KPI grid: 4 columns → 2 columns (tablet) → 1 column (mobile)
- Card grids: auto-fit minmax(280px, 1fr) — no JS breakpoint detection
- Form grids: 2 columns → 1 column on mobile (no side-by-side inputs on mobile)

### Tables on mobile

Tables do not work on screens narrower than 640px. The rule:
- On mobile, tables become a card list where each row is a card
- The card shows only the critical columns (name, status, amount)
- An expansion tap reveals the full row data
- Never horizontally scroll a table on mobile — it always has too many columns

### Touch targets

Minimum touch target: 44×44px for every interactive element, without exception.
Where a visual button appears smaller (e.g., an inline icon button), the hit target
is extended via padding while the visual size remains small.

### Keyboard behavior on mobile

- Use `min-height: 100dvh` (dynamic viewport height — shrinks when keyboard opens)
- Form panels: `overflow-y: auto` allows scroll when keyboard pushes content
- `env(safe-area-inset-bottom)` applied to bottom padding in full-screen views
- The primary action button must remain accessible without scrolling when the
  keyboard is open — if it would be hidden, the form layout must be restructured

---

## XI. Accessibility as Design Quality

Accessibility is not a compliance checklist. It is a measure of how well the
product serves every user. A screen that fails WCAG AA fails the design brief.

### Contrast requirements

- Body text (`C.text` on `C.bg`): minimum 4.5:1 — we achieve ~13:1 ✓
- Large/bold text (18px+ or 14px bold): minimum 3:1
- `C.dim` (#78716C on #1C1917): 3.7:1 — approved for large/bold only, never body
- UI components (borders, input rings): minimum 3:1 against adjacent background

### Focus management

- Every focusable element has a visible amber focus ring (2px, offset 2px)
- `outline: none` is never added without a custom focus style replacing it
- After a modal opens, focus moves to the first focusable element inside it
- After a modal closes, focus returns to the element that opened it
- After a form submission (success state), focus moves to the page heading

### Semantic HTML rules

- One `<h1>` per page — the page title
- `<h2>` for card/section headings
- `<h3>` for sub-sections within cards
- `<label htmlFor="id">` always paired with `<input id="id">` — no wrapping without for/id
- `<button>` for actions, `<a>` for navigation — never interchange them
- Status badges: include screen-reader text if the meaning is color-only
- Icon-only buttons always have `aria-label`
- Error messages: `role="alert"` for immediate announcement, `id` linked via `aria-describedby` on the field

### Motion and animation

- Animations serve a functional purpose: they direct attention, confirm actions,
  or communicate state change. Decorative animations that repeat indefinitely are forbidden.
- All animations respect `prefers-reduced-motion`:
  ```css
  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
  ```
- Animation duration: 150–300ms for transitions, 400–600ms for entrance animations
- Exit animations: always shorter than entrance (100–200ms)

---

## XII. The Prohibition List

These rules exist because past products failed from exactly these mistakes.
No exception requires approval — they require a better design solution.

1. **No hardcoded color values in components.** Every color references a token.
2. **No z-index values above 600.** Use the Z token hierarchy instead.
3. **No `!important` in component inline styles** — only in `globals.css` class overrides.
4. **No two amber primary buttons on the same screen.**
5. **No italic text anywhere in the UI** (excluding user-generated content).
6. **No empty table rows** as an empty state — use the dedicated empty state component.
7. **No toast for form errors** — they belong inline.
8. **No full-page spinner** for data that is below the fold.
9. **No decorative use of status colors** (green/orange/red for non-status purposes).
10. **No font smaller than 11px** in any rendered interface element.
11. **No color-only status** — every status badge includes text.
12. **No ISO date format** (2026-04-07) displayed to users.
13. **No modal that cannot be dismissed** with both a close button and the Escape key.
14. **No action that is irreversible without a confirmation modal.**
15. **No `outline: none`** without an equivalent custom focus indicator.
16. **No table that horizontally scrolls on mobile** — convert to cards instead.
17. **No input below 40px height** — touch target minimum.
18. **No Sora font in table cells or form inputs** — those belong to IBM Plex Sans.
19. **No `<div>` used for a clickable action** — use `<button>` or `<a>`.
20. **No amber used as background color** on any surface larger than a badge or icon.
    Amber is a signal, not a canvas.

---

*MEREM UX/UI Standards — last updated 2026-04-12*
*Apply to every page built after this date without exception.*
