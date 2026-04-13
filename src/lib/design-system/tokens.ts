/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MERAM — Papier Design System
 * Single source of truth for every visual value in the application.
 *
 * Identity: Warm cream surfaces, dark espresso sidebar, cognac accent.
 *           Fraunces serif for display authority. DM Sans for interface clarity.
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
// Papier palette: aged-paper warm cream canvas, dark espresso sidebar,
// cognac accent — the color of fine leather and aged spirits.
//
// Surface hierarchy (always respect this order — never invert):
//   bg < surfaceSub < surface < surfaceEl ← light cream scale
//   sidebarBg < sidebarEl < sidebarHov   ← dark espresso scale (sidebar only)
//
// Cognac is RESERVED for: primary CTAs, active nav, key numerical callouts.
// Status colors are RESERVED for operational states only — never decoration.
// ─────────────────────────────────────────────────────────────────────────────
export const C = {

  // ── Light Canvas (page & components) ────────────────────────────────────────
  bg:         '#F5EFE6',  // Page canvas — aged cream paper
  bgDeep:     '#EDE5D8',  // Deeper tint (sunken areas, muted backgrounds)
  surface:    '#FDFAF5',  // Cards, panels — warm near-white
  surfaceEl:  '#FFFFFF',  // Elevated: modals, dropdowns, popovers
  surfaceHov: '#F8F3EB',  // Hover on interactive cards
  surfaceSub: '#EDE6D9',  // Slightly sunken (table stripes, section dividers)

  // ── Borders (warm, never cool) ─────────────────────────────────────────────
  border:    '#DDD4C5',   // Structural edge — defines element boundaries
  borderSub: '#EDE6D9',   // Atmospheric separator — rows, sections

  // ── Text (on light surfaces) ──────────────────────────────────────────────
  // Four levels: ink → text → muted → dim. Never use more than these four.
  // dim (#A8906E) is readable at large sizes; use only for footnotes/placeholders.
  ink:        '#1A0F06',  // Primary: headings, key values, active labels
  text:       '#3C2715',  // Body: standard paragraph and table content
  muted:      '#7A6248',  // Secondary: metadata, descriptions, secondary labels
  dim:        '#A8906E',  // Tertiary: placeholders, footnotes, disabled

  // ── Cognac — the Papier accent ────────────────────────────────────────────
  // The single brand color. Warm amber-brown like aged cognac spirit or fine
  // leather — authoritative, not loud. Think of it as a spotlight:
  // use it to say "this matters" — no more than one focal point per view.
  //
  // NOTE: Token names keep "amber" prefix for compatibility with all components.
  amber:      '#A0531A',  // Primary cognac — CTAs, active indicators, key data
  amberHov:   '#844416',  // Hover state of cognac elements
  amberActive:'#6A3610',  // Pressed / active
  amberDim:   '#C87B45',  // Lighter cognac tint (icon glow, subtle wash)
  amberGlow:  'rgba(160,83,26,0.12)',  // Focus ring / glow wash

  // ── Status triplets (on light surfaces) ──────────────────────────────────
  // Text is deep saturated (high contrast on cream bg).
  // Backgrounds are very pale tints — readable without dominating.
  // Borders frame without boxing in.
  green:      '#166534',  greenBg:  '#F0FDF4',  greenBd:  '#BBF7D0',
  orange:     '#9A3412',  orangeBg: '#FFF7ED',  orangeBd: '#FED7AA',
  red:        '#991B1B',  redBg:    '#FEF2F2',  redBd:    '#FECACA',
  blue:       '#1E40AF',  blueBg:   '#EFF6FF',  blueBd:   '#BFDBFE',
  gold:       '#78350F',  goldBg:   '#FFFBEB',  goldBd:   '#FDE68A',
  purple:     '#5B21B6',  purpleBg: '#F5F3FF',  purpleBd: '#DDD6FE',

  // ── Sidebar — dark espresso (strong visual contrast with cream canvas) ─────
  // These tokens are ONLY used inside Sidebar.tsx.
  // All other components use the light canvas tokens above.
  sidebarBg:    '#1B0F07',  // Deep espresso — the sidebar panel background
  sidebarEl:    '#271608',  // Slightly lifted: user card, active item wash
  sidebarHov:   '#321E0E',  // Hover on nav items
  sidebarBd:    '#3E2618',  // Internal borders and separators
  sidebarInk:   '#FAF5EE',  // Primary text: brand name, user name
  sidebarText:  '#D8C8B0',  // Secondary text: nav labels
  sidebarMuted: '#8A7260',  // Tertiary: section labels, metadata
  sidebarDim:   '#5C4838',  // Disabled / footnote text in sidebar

  // ── Utilities ─────────────────────────────────────────────────────────────
  white:       '#FFFFFF',
  black:       '#000000',
  transparent: 'transparent',
} as const

// ─────────────────────────────────────────────────────────────────────────────
// F — TYPOGRAPHY TOKENS
// ─────────────────────────────────────────────────────────────────────────────
//
// Fraunces for display/headings: an optical-size serif that commands authority
// at large weights (700–900). Its warmth and editorial quality signal trust
// instantly to business owners reading KPI figures and page titles.
// Use font-optical-sizing: auto for best rendering at all sizes.
//
// DM Sans for body/UI: clean geometric sans designed for screens. Excellent
// legibility at 12–14px, built-in tabular numerals, designed for interfaces.
//
// IBM Plex Mono for reference codes, IDs, sale numbers.
//
// Size scale: major third (×1.25), snapped to whole pixels.
// Smallest used in the app: 11px (section labels). Never below that.
// ─────────────────────────────────────────────────────────────────────────────
export const F = {

  // ── Font families ─────────────────────────────────────────────────────────
  display: "var(--font-fraunces), 'Fraunces', Georgia, 'Times New Roman', serif",
  body:    "var(--font-dm), 'DM Sans', system-ui, sans-serif",
  mono:    "var(--font-plex-mono), 'IBM Plex Mono', 'Fira Code', monospace",

  // ── Size scale ────────────────────────────────────────────────────────────
  xs:    '11px',   // Section labels, micro tags
  sm:    '12px',   // Captions, helper text, footnotes
  base:  '14px',   // Standard body, table content, inputs — the default
  md:    '15px',   // Slightly prominent body, subheadings
  lg:    '17px',   // Card section titles, prominent labels
  xl:    '20px',   // Card headings, modal titles
  '2xl': '24px',   // Page titles
  '3xl': '30px',   // KPI figures (medium)
  '4xl': '38px',   // KPI figures (large) — Fraunces looks exceptional here
  '5xl': '52px',   // Hero KPI callout

  // ── Weights ───────────────────────────────────────────────────────────────
  regular:  400,
  medium:   500,
  semibold: 600,
  bold:     700,
  xbold:    800,
  black:    900,

  // ── Line heights ──────────────────────────────────────────────────────────
  lhNone:    1,
  lhTight:   1.2,    // Display headings
  lhSnug:    1.35,   // Subheadings, card titles
  lhNormal:  1.5,    // Body text default
  lhRelaxed: 1.65,   // Long-form descriptions
  lhLoose:   1.8,    // Spacious labels

  // ── Letter spacing ────────────────────────────────────────────────────────
  // Fraunces reads better with slightly tighter tracking at display sizes.
  // DM Sans section labels need air to distinguish uppercase structure.
  lsTightest: '-0.04em',  // Hero headings, large KPI numbers (Fraunces)
  lsTighter:  '-0.03em',  // Page titles (Fraunces)
  lsTight:    '-0.02em',  // Card headings (Fraunces)
  lsZero:     '0em',
  lsWide:     '0.04em',
  lsWider:    '0.08em',   // Section labels, uppercase short strings (DM Sans)
  lsWidest:   '0.15em',   // Badge text, step indicators
} as const

// ─────────────────────────────────────────────────────────────────────────────
// SP — SPACING TOKENS (base-4 grid)
// ─────────────────────────────────────────────────────────────────────────────
//
// Every layout dimension must be a multiple of 4px.
// Papier uses generous spacing — the reference showed breathing room
// is the single largest differentiator between premium and commodity UI.
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
  11:   '44px',
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
// Papier uses moderate radius — editorial quality, not a consumer app.
// Over-rounding signals immaturity in a B2B context.
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
  '2xl':'16px',   // Large hero cards
  full: '9999px', // Pills, circular elements
} as const

// ─────────────────────────────────────────────────────────────────────────────
// SH — SHADOW TOKENS (warm drops on cream surfaces)
// ─────────────────────────────────────────────────────────────────────────────
//
// On light backgrounds, shadows are warm brown drops (not cold grays).
// The warmth of the shadow reinforces the cream paper identity.
//
// inset: top-light highlight on raised cards — enhances depth perception.
// amber / amberSm: cognac glow reserved for cognac interactive elements.
// ─────────────────────────────────────────────────────────────────────────────
export const SH = {
  none:    'none',
  xs:      '0 1px 3px rgba(60,30,10,0.07), 0 1px 2px rgba(60,30,10,0.05)',
  sm:      '0 2px 8px rgba(60,30,10,0.09), 0 1px 3px rgba(60,30,10,0.06)',
  md:      '0 4px 16px rgba(60,30,10,0.11), 0 2px 6px rgba(60,30,10,0.07)',
  lg:      '0 8px 28px rgba(60,30,10,0.13), 0 3px 10px rgba(60,30,10,0.07)',
  xl:      '0 16px 48px rgba(60,30,10,0.15), 0 6px 16px rgba(60,30,10,0.09)',
  amber:   '0 4px 20px rgba(160,83,26,0.30)',    // Cognac glow — CTA buttons
  amberSm: '0 2px 10px rgba(160,83,26,0.22)',    // Cognac glow — small elements
  inset:   'inset 0 1px 0 rgba(255,255,255,0.80)',    // Card top highlight
  insetBd: 'inset 0 0 0 1px rgba(255,255,255,0.60)',  // Subtle rim on raised elements
} as const

// ─────────────────────────────────────────────────────────────────────────────
// TR — TRANSITION TOKENS
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
export const L = {
  sidebarW:    '240px',  // Left nav — fixed, never collapses on desktop
  mobileBarH:  '56px',   // Top bar on mobile (3px accent + 53px content)
  contentMax:  '1280px', // Max-width of page content
  pageP:       '36px',   // Desktop horizontal page padding (generous — Papier)
  pagePTablet: '24px',   // Tablet
  pagePMobile: '16px',   // Mobile
  cardP:       '24px',   // Standard card internal padding
  cardPSm:     '16px',   // Compact card (tables, dense lists)
  rowH:        '52px',   // Standard table row height
  rowHSm:      '44px',   // Compact table row
  inputH:      '40px',   // Standard input / select height
  btnH:        '40px',   // Standard button height
  btnHSm:      '34px',   // Small button
  btnHLg:      '48px',   // Large button (primary CTA in forms)
  sectionGap:  '24px',   // Gap between cards on the same row
  blockGap:    '40px',   // Gap between distinct visual sections
} as const
