/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MEREM — Minerals Design System
 * Single source of truth for every visual value in the application.
 *
 * Rule: No component file may hardcode a color, spacing value, radius,
 * shadow, or transition. Every value must trace back to a token here.
 *
 * Usage:
 *   import { C, F, SP, R, SH, TR, Z, L } from '@/lib/design-system/tokens'
 *   style={{ background: C.surface, padding: SP[6], borderRadius: R.lg }}
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// C — COLOR TOKENS
// ─────────────────────────────────────────────────────────────────────────────
//
// Minerals palette: volcanic-stone dark base, amber accent, softened status.
//
// Surface hierarchy (always respect this order — never invert):
//   bg < surface < surfaceEl < surfaceHov
//
// Amber is RESERVED for: primary CTAs, active states, key numerical callouts.
// Status colors are RESERVED for operational states only — never decoration.
// ─────────────────────────────────────────────────────────────────────────────
export const C = {

  // ── Backgrounds ─────────────────────────────────────────────────────────────
  // Each step is a perceptible but not jarring lift from the one below.
  bg:         '#1C1917',  // Page canvas — volcanic stone
  bgDeep:     '#131110',  // Below-canvas (print areas, full overlays)
  surface:    '#242120',  // Cards, panels, table rows — primary work surface
  surfaceEl:  '#2E2B28',  // Elevated: modals, dropdowns, popovers
  surfaceHov: '#353230',  // Hover on interactive surfaces
  surfaceSub: '#1F1D1B',  // Slightly sunken (sidebar track, table stripe alt)

  // ── Borders ──────────────────────────────────────────────────────────────────
  // Use border for structure; borderSub for breathing-room separators.
  border:     '#3C3835',  // Structural edge — defines element boundaries
  borderSub:  '#2A2826',  // Atmospheric separator — rows, sections, lists

  // ── Text ─────────────────────────────────────────────────────────────────────
  // Four levels: ink → text → muted → dim. Never use more than these four.
  // dim (#78716C) fails WCAG AA at body size — use only for placeholder/footnote.
  ink:        '#FAFAF9',  // Primary: headings, key values, active labels
  text:       '#E7E5E4',  // Body: standard paragraph and table content
  muted:      '#A9A49D',  // Secondary: metadata, secondary labels, descriptions
  dim:        '#78716C',  // Tertiary: placeholders, footnotes, disabled labels

  // ── Amber — the Minerals accent ──────────────────────────────────────────────
  // The single brand color. Think of it as a spotlight: use it to say
  // "this matters" — no more. Every other use cheapens it.
  amber:      '#F59E0B',  // Primary accent — actions, active indicators, key data
  amberHov:   '#D97706',  // Hover state of amber elements
  amberActive:'#B45309',  // Pressed / active
  amberDim:   '#92400E',  // Subtle amber tint (badge backgrounds, inactive rings)
  amberGlow:  'rgba(245,158,11,0.18)',  // Focus ring / shadow wash

  // ── Status — tuned for legibility on dark surfaces ────────────────────────────
  // Text colors are soft pastels (high contrast on dark bg).
  // Backgrounds are very deep saturated darks (still clearly tinted).
  // Borders provide structural definition without harshness.
  green:      '#86EFAC',  greenBg:  '#052E16',  greenBd:  '#14532D',
  orange:     '#FED7AA',  orangeBg: '#431407',  orangeBd: '#7C2D12',
  red:        '#FCA5A5',  redBg:    '#2D0A0A',  redBd:    '#7F1D1D',
  blue:       '#93C5FD',  blueBg:   '#0C1A3B',  blueBd:   '#1E3A5F',
  gold:       '#FDE68A',  goldBg:   '#451A03',  goldBd:   '#92400E',
  purple:     '#C4B5FD',  purpleBg: '#1E0A4A',  purpleBd: '#3B1F8C',

  // ── Utilities ────────────────────────────────────────────────────────────────
  white:       '#FFFFFF',
  black:       '#000000',
  transparent: 'transparent',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// F — TYPOGRAPHY TOKENS
// ─────────────────────────────────────────────────────────────────────────────
//
// Sora for display/headings: warm geometric, authoritative at large weights,
// excellent at -0.03em tracking for titles and KPI figures.
//
// IBM Plex Sans for body/UI: designed for interfaces, optical clarity at 12–14px,
// built-in tabular numerals, perfect for tables and labels.
//
// IBM Plex Mono for reference codes, IDs, sale numbers.
//
// Size scale: major third (×1.25), snapped to whole pixels.
// Smallest used in the app: 11px (section labels). Never below that.
// ─────────────────────────────────────────────────────────────────────────────
export const F = {

  // ── Font families ─────────────────────────────────────────────────────────────
  display: "var(--font-sora), 'Sora', system-ui, sans-serif",
  body:    "var(--font-plex), 'IBM Plex Sans', system-ui, sans-serif",
  mono:    "var(--font-plex-mono), 'IBM Plex Mono', 'Fira Code', monospace",

  // ── Size scale ────────────────────────────────────────────────────────────────
  // xs    → section labels, micro tags
  // sm    → captions, helper text, footnotes
  // base  → standard body, table content, inputs — the default
  // md    → slightly prominent body, subheadings
  // lg    → card section titles, prominent labels
  // xl    → card headings, modal titles
  // 2xl   → page titles
  // 3xl   → KPI figures (medium)
  // 4xl   → KPI figures (large)
  // 5xl   → hero KPI callout (full-page spotlight)
  xs:    '11px',
  sm:    '12px',
  base:  '14px',
  md:    '15px',
  lg:    '17px',
  xl:    '20px',
  '2xl': '24px',
  '3xl': '30px',
  '4xl': '36px',
  '5xl': '48px',

  // ── Weights ───────────────────────────────────────────────────────────────────
  // Regular for body. Semibold for interactive labels. Bold/xbold for headings.
  // Black (900) reserved for hero KPI numbers only.
  regular:   400,
  medium:    500,
  semibold:  600,
  bold:      700,
  xbold:     800,
  black:     900,

  // ── Line heights ──────────────────────────────────────────────────────────────
  lhNone:    1,
  lhTight:   1.2,    // Display headings
  lhSnug:    1.35,   // Subheadings, card titles
  lhNormal:  1.5,    // Body text default
  lhRelaxed: 1.65,   // Long-form descriptions
  lhLoose:   1.8,    // Spacious labels

  // ── Letter spacing ────────────────────────────────────────────────────────────
  // Tight spacing on display text (Sora reads better tight).
  // Wide spacing on uppercase labels (SECTION LABELS need air).
  lsTightest: '-0.04em',  // Hero headings, large KPI numbers
  lsTighter:  '-0.03em',  // Page titles
  lsTight:    '-0.015em', // Card headings
  lsZero:     '0em',
  lsWide:     '0.04em',
  lsWider:    '0.08em',   // Section labels, uppercase short strings
  lsWidest:   '0.15em',   // Badge text, step indicators
} as const

// ─────────────────────────────────────────────────────────────────────────────
// SP — SPACING TOKENS (base-4 grid)
// ─────────────────────────────────────────────────────────────────────────────
//
// Every layout dimension must be a multiple of 4px.
// Fractional units (0.5, 1.5) exist only for micro-adjustments
// inside components — not for page-level layout.
// ─────────────────────────────────────────────────────────────────────────────
export const SP = {
  0:    '0px',
  0.5:  '2px',
  1:    '4px',
  1.5:  '6px',
  2:    '8px',
  2.5:  '10px',
  3:    '12px',
  3.5:  '14px',
  4:    '16px',
  5:    '20px',
  6:    '24px',
  7:    '28px',
  8:    '32px',
  9:    '36px',
  10:   '40px',
  12:   '48px',
  14:   '56px',
  16:   '64px',
  20:   '80px',
  24:   '96px',
  28:   '112px',
  32:   '128px',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// R — RADIUS TOKENS
// ─────────────────────────────────────────────────────────────────────────────
//
// Minerals uses restrained radius — these are tools for a professional,
// not a consumer app. Over-rounding signals immaturity.
//
// md (8px) is the standard for inputs, buttons, and most cards.
// lg/xl (10–12px) for cards and modal panels only.
// full (9999px) for pills, avatars, and circular icon buttons.
// ─────────────────────────────────────────────────────────────────────────────
export const R = {
  none: '0px',
  xs:   '4px',    // Tiny tags, compact badges
  sm:   '6px',    // Chips, secondary elements
  md:   '8px',    // Buttons, inputs, table cells
  lg:   '10px',   // Cards, panel sections
  xl:   '12px',   // Modal panels, drawer headers
  '2xl':'16px',   // Large hero cards, feature banners
  full: '9999px', // Pills, circular elements
} as const

// ─────────────────────────────────────────────────────────────────────────────
// SH — SHADOW TOKENS (elevation on dark surfaces)
// ─────────────────────────────────────────────────────────────────────────────
//
// On dark backgrounds, shadows are deep black drops — not light grays.
// The shadow creates the illusion of the element lifting off the canvas.
//
// inset: simulates a subtle top-light source on raised surfaces.
// amber / amberSm: reserved exclusively for amber interactive elements.
// Never use amber glow on neutral elements — it would corrupt the accent signal.
// ─────────────────────────────────────────────────────────────────────────────
export const SH = {
  none:    'none',
  xs:      '0 1px 3px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.40)',
  sm:      '0 2px 8px rgba(0,0,0,0.60), 0 1px 3px rgba(0,0,0,0.45)',
  md:      '0 4px 16px rgba(0,0,0,0.65), 0 2px 6px rgba(0,0,0,0.45)',
  lg:      '0 8px 28px rgba(0,0,0,0.70), 0 3px 10px rgba(0,0,0,0.45)',
  xl:      '0 16px 48px rgba(0,0,0,0.75), 0 6px 16px rgba(0,0,0,0.45)',
  amber:   '0 4px 20px rgba(245,158,11,0.35)',
  amberSm: '0 2px 10px rgba(245,158,11,0.25)',
  inset:   'inset 0 1px 0 rgba(255,255,255,0.05)',   // Raised surface top highlight
  insetBd: 'inset 0 0 0 1px rgba(255,255,255,0.07)', // Raised element subtle rim
} as const

// ─────────────────────────────────────────────────────────────────────────────
// TR — TRANSITION TOKENS
// ─────────────────────────────────────────────────────────────────────────────
//
// fast:   hover state color changes (< 150ms feels instant)
// base:   standard UI transitions — feels responsive, not abrupt
// slow:   large layout changes (sidebar open, drawer expand)
// spring: elements entering with energy — success states, tooltips
// smooth: panels sliding in from off-screen (drawer, modal)
// ─────────────────────────────────────────────────────────────────────────────
export const TR = {
  fast:   '0.12s ease',
  base:   '0.18s ease',
  slow:   '0.28s ease',
  spring: '0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
  smooth: '0.26s cubic-bezier(0.32, 0.72, 0, 1)',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Z — Z-INDEX LAYERS
// ─────────────────────────────────────────────────────────────────────────────
//
// Explicit stacking contract — no z-index arbitrage (z: 9999, z: 99998, etc.)
// Every element knows where it lives in the stack.
// ─────────────────────────────────────────────────────────────────────────────
export const Z = {
  base:     0,
  raised:   1,
  float:    10,
  dropdown: 100,
  sticky:   200,
  overlay:  300,
  modal:    400,
  toast:    500,
  tooltip:  600,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// L — LAYOUT CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
//
// Fixed structural dimensions used across the entire app.
// These never change per-component — they define the spatial contract.
// ─────────────────────────────────────────────────────────────────────────────
export const L = {
  sidebarW:    '240px',  // Left nav — fixed, never collapses on desktop
  mobileBarH:  '56px',   // Top bar on mobile (3px accent + 53px content)
  contentMax:  '1280px', // Max-width of page content (centered within remaining space)
  pageP:       '32px',   // Desktop horizontal page padding
  pagePTablet: '20px',   // Tablet
  pagePMobile: '16px',   // Mobile
  cardP:       '24px',   // Standard card internal padding
  cardPSm:     '16px',   // Compact card (tables, dense lists)
  rowH:        '52px',   // Standard table row height (comfortable + touch-capable)
  rowHSm:      '44px',   // Compact table row (dense data views)
  inputH:      '40px',   // Standard input / select height
  btnH:        '40px',   // Standard button height
  btnHSm:      '34px',   // Small button (inline actions)
  btnHLg:      '48px',   // Large button (primary CTA in forms)
  sectionGap:  '24px',   // Gap between cards on the same layout row
  blockGap:    '40px',   // Gap between distinct visual sections on a page
} as const
