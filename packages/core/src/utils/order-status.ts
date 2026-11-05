import type { OrderStatus } from '../schema/orders'

// Dozvoljene tranzicije statusa porudzbine
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped:    ['delivered'],
  delivered:  ['refunded'],
  cancelled:  [],
  refunded:   [],
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export function getAllowedTransitions(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from]
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Nije moguca tranzicija: ${from} -> ${to}`)
  }
}
