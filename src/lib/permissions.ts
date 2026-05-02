import type { UserRole } from './types'

/**
 * Matrice de permissions centralisée.
 * Source de vérité unique pour les guards pages et actions.
 * Utilisé avec : if (!can(profile.role, 'sales.create')) return { error: 'Accès refusé.' }
 */
const MATRIX: Record<string, UserRole[]> = {
  // ── Ventes ──────────────────────────────────────────────────────────────────
  'sales.create':              ['owner', 'manager', 'seller'],
  'sales.view_all':            ['owner', 'manager', 'accountant'],
  'sales.view_own':            ['seller', 'field_agent'],
  'sales.cancel':              ['owner', 'manager'],
  'sales.confirm_draft':       ['owner', 'manager'],

  // ── Paiements ────────────────────────────────────────────────────────────────
  'payments.record':           ['owner', 'manager', 'cashier'],
  'payments.view':             ['owner', 'manager', 'cashier', 'accountant'],
  'payments.schedule.manage':  ['owner', 'manager'],

  // ── Devis ────────────────────────────────────────────────────────────────────
  'quotes.create':             ['owner', 'manager', 'seller', 'field_agent'],
  'quotes.confirm':            ['owner', 'manager'],
  'quotes.cancel':             ['owner', 'manager'],

  // ── Stock ────────────────────────────────────────────────────────────────────
  'stock.view':                ['owner', 'manager', 'warehouse', 'seller', 'field_agent', 'accountant'],
  'stock.adjust':              ['owner', 'manager', 'warehouse'],
  'stock.request.create':      ['owner', 'manager', 'warehouse'],
  'stock.request.approve':     ['owner', 'manager'],

  // ── Produits ─────────────────────────────────────────────────────────────────
  'products.view':             ['owner', 'manager', 'seller', 'cashier', 'warehouse', 'field_agent', 'accountant'],
  'products.manage':           ['owner', 'manager'],
  'products.view_purchase_price': ['owner', 'accountant'],

  // ── Livraisons ───────────────────────────────────────────────────────────────
  'deliveries.view_all':       ['owner', 'manager', 'warehouse'],
  'deliveries.view_assigned':  ['delivery'],
  'deliveries.manage':         ['owner', 'manager', 'warehouse'],
  'deliveries.confirm':        ['owner', 'manager', 'warehouse', 'delivery'],
  'deliveries.assign':         ['owner', 'manager', 'warehouse'],

  // ── Clients ──────────────────────────────────────────────────────────────────
  'customers.view':            ['owner', 'manager', 'seller', 'field_agent', 'accountant'],
  'customers.create':          ['owner', 'manager', 'seller', 'field_agent'],
  'customers.manage':          ['owner', 'manager'],

  // ── Caisse ───────────────────────────────────────────────────────────────────
  'caisse.manage':             ['owner', 'manager'],
  'caisse.session':            ['owner', 'manager', 'cashier'],
  'caisse.view':               ['owner', 'manager', 'cashier', 'accountant'],

  // ── Fournisseurs & achats ─────────────────────────────────────────────────────
  'suppliers.view':            ['owner', 'manager', 'warehouse', 'accountant'],
  'suppliers.manage':          ['owner', 'manager'],
  'purchase_orders.create':    ['owner', 'manager'],
  'purchase_orders.receive':   ['owner', 'manager', 'warehouse'],
  'purchase_orders.view':      ['owner', 'manager', 'warehouse', 'accountant'],

  // ── Rapports ─────────────────────────────────────────────────────────────────
  'reports.commercial':        ['owner', 'manager'],
  'reports.financial':         ['owner', 'accountant'],
  'reports.view':              ['owner', 'manager', 'accountant'],

  // ── Retours ──────────────────────────────────────────────────────────────────
  'returns.create':            ['owner', 'manager', 'seller'],
  'returns.validate':          ['owner', 'manager'],
  'returns.view':              ['owner', 'manager', 'seller', 'warehouse', 'accountant'],

  // ── Pipeline (field_agent) ────────────────────────────────────────────────────
  'pipeline.submit':           ['owner', 'manager', 'field_agent'],
  'pipeline.validate':         ['owner', 'manager'],
  'pipeline.view_own':         ['field_agent'],
  'pipeline.view_all':         ['owner', 'manager'],

  // ── Administration ───────────────────────────────────────────────────────────
  'admin.users':               ['owner'],
  'admin.boutiques':           ['owner'],
  'admin.settings':            ['owner'],
  'admin.audit':               ['owner', 'accountant'],
}

export function can(role: UserRole, permission: string): boolean {
  return MATRIX[permission]?.includes(role) ?? false
}

export function canAny(role: UserRole, permissions: string[]): boolean {
  return permissions.some(p => can(role, p))
}

export function canAll(role: UserRole, permissions: string[]): boolean {
  return permissions.every(p => can(role, p))
}
