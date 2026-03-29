/**
 * Format a monetary amount with the company's currency.
 * Uses French locale formatting (space as thousands separator).
 */
export function fmtCurrency(n: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + '\u00a0' + currency
}
