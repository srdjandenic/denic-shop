/**
 * Generiše human-readable broj porudžbine: DS-2026-00042
 * Prefix se može konfigurisati per-tenant.
 */
export function generateOrderNumber(prefix: string, sequence: number): string {
  const year = new Date().getFullYear()
  const seq = String(sequence).padStart(5, '0')
  return `${prefix}-${year}-${seq}`
}

export function parseOrderSequence(orderNumber: string): number {
  const parts = orderNumber.split('-')
  const last = parts[parts.length - 1]
  const n = last ? parseInt(last, 10) : NaN
  return Number.isNaN(n) ? 0 : n
}
