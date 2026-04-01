/**
 * Basic French pluralization for product unit labels stored in the DB.
 * Labels are typically stored in singular form (e.g., "sac", "pièce", "litre").
 *
 * Rules applied (in order):
 *   1. count ≤ 1  → return singular unchanged
 *   2. ends in s / x / z → already invariant, no change
 *   3. ends in -eau → add 'x'  (carreau→carreaux, plateau→plateaux)
 *   4. ends in -al  → replace with '-aux'  (canal→canaux — rare for units)
 *   5. default → append 's'
 */
export function pluralize(word: string, count: number): string {
  if (!word) return word
  if (count <= 1) return word

  const w     = word.trim()
  const lower = w.toLowerCase()

  if (/[sxz]$/.test(lower)) return w        // already plural-compatible
  if (lower.endsWith('eau')) return w + 'x'  // carreau → carreaux
  if (lower.endsWith('al'))  return w.slice(0, -2) + 'aux' // canal → canaux

  return w + 's'
}
