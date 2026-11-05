import type { OrderStatus, PaymentStatus, FulfillmentStatus } from '../schema/orders'

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  open:      ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pending:             ['awaiting', 'cod_pending', 'failed'],
  awaiting:            ['paid', 'failed', 'voided'],
  cod_pending:         ['paid', 'failed'],
  paid:                ['partially_refunded', 'refunded', 'voided'],
  partially_refunded:  ['refunded'],
  refunded:            [],
  voided:              [],
  failed:              ['awaiting', 'cod_pending'],
}

const FULFILLMENT_TRANSITIONS: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  unfulfilled:         ['fulfillment_created'],
  fulfillment_created: ['partial', 'shipped'],
  partial:             ['shipped'],
  shipped:             ['fulfilled', 'returned'],
  fulfilled:           ['returned'],
  returned:            [],
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to)
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to)
}

export function canTransitionFulfillment(from: FulfillmentStatus, to: FulfillmentStatus): boolean {
  return FULFILLMENT_TRANSITIONS[from].includes(to)
}

export function getAllowedOrderTransitions(from: OrderStatus): OrderStatus[] {
  return ORDER_TRANSITIONS[from]
}

export function getAllowedPaymentTransitions(from: PaymentStatus): PaymentStatus[] {
  return PAYMENT_TRANSITIONS[from]
}

export function getAllowedFulfillmentTransitions(from: FulfillmentStatus): FulfillmentStatus[] {
  return FULFILLMENT_TRANSITIONS[from]
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) {
    throw new Error(`Nije moguća tranzicija order statusa: ${from} → ${to}`)
  }
}

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransitionPayment(from, to)) {
    throw new Error(`Nije moguća tranzicija payment statusa: ${from} → ${to}`)
  }
}

export function assertFulfillmentTransition(from: FulfillmentStatus, to: FulfillmentStatus): void {
  if (!canTransitionFulfillment(from, to)) {
    throw new Error(`Nije moguća tranzicija fulfillment statusa: ${from} → ${to}`)
  }
}
