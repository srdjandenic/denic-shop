import { describe, it, expect } from 'vitest'
import {
  canTransitionOrder,
  canTransitionPayment,
  canTransitionFulfillment,
  getAllowedPaymentTransitions,
  assertPaymentTransition,
  assertOrderTransition,
} from '../order-status'

describe('canTransitionOrder', () => {
  it('dozvoljava ispravne tranzicije', () => {
    expect(canTransitionOrder('open', 'completed')).toBe(true)
    expect(canTransitionOrder('open', 'cancelled')).toBe(true)
  })

  it('odbija neispravne tranzicije', () => {
    expect(canTransitionOrder('completed', 'open')).toBe(false)
    expect(canTransitionOrder('cancelled', 'open')).toBe(false)
    expect(canTransitionOrder('completed', 'cancelled')).toBe(false)
  })

  it('terminalni statusi nemaju dozvoljene tranzicije', () => {
    expect(canTransitionOrder('completed', 'cancelled')).toBe(false)
    expect(canTransitionOrder('cancelled', 'completed')).toBe(false)
  })
})

describe('canTransitionPayment', () => {
  it('dozvoljava ispravne tranzicije', () => {
    expect(canTransitionPayment('pending', 'awaiting')).toBe(true)
    expect(canTransitionPayment('pending', 'cod_pending')).toBe(true)
    expect(canTransitionPayment('awaiting', 'paid')).toBe(true)
    expect(canTransitionPayment('cod_pending', 'paid')).toBe(true)
    expect(canTransitionPayment('paid', 'refunded')).toBe(true)
    expect(canTransitionPayment('paid', 'partially_refunded')).toBe(true)
    expect(canTransitionPayment('awaiting', 'failed')).toBe(true)
    expect(canTransitionPayment('failed', 'awaiting')).toBe(true)
  })

  it('odbija neispravne tranzicije', () => {
    expect(canTransitionPayment('pending', 'paid')).toBe(false)
    expect(canTransitionPayment('refunded', 'paid')).toBe(false)
    expect(canTransitionPayment('voided', 'paid')).toBe(false)
    expect(canTransitionPayment('paid', 'pending')).toBe(false)
  })

  it('terminalni statusi nemaju dozvoljene tranzicije', () => {
    expect(getAllowedPaymentTransitions('refunded')).toEqual([])
    expect(getAllowedPaymentTransitions('voided')).toEqual([])
  })
})

describe('canTransitionFulfillment', () => {
  it('dozvoljava ispravne tranzicije', () => {
    expect(canTransitionFulfillment('unfulfilled', 'fulfillment_created')).toBe(true)
    expect(canTransitionFulfillment('fulfillment_created', 'shipped')).toBe(true)
    expect(canTransitionFulfillment('shipped', 'fulfilled')).toBe(true)
    expect(canTransitionFulfillment('shipped', 'returned')).toBe(true)
  })

  it('odbija neispravne tranzicije', () => {
    expect(canTransitionFulfillment('unfulfilled', 'shipped')).toBe(false)
    expect(canTransitionFulfillment('fulfilled', 'unfulfilled')).toBe(false)
    expect(canTransitionFulfillment('returned', 'shipped')).toBe(false)
  })
})

describe('assertOrderTransition', () => {
  it('ne baca grešku za dozvoljenu tranziciju', () => {
    expect(() => assertOrderTransition('open', 'completed')).not.toThrow()
    expect(() => assertOrderTransition('open', 'cancelled')).not.toThrow()
  })

  it('baca grešku za nedozvoljenu tranziciju', () => {
    expect(() => assertOrderTransition('completed', 'open')).toThrow()
    expect(() => assertOrderTransition('cancelled', 'completed')).toThrow()
  })
})

describe('assertPaymentTransition', () => {
  it('ne baca grešku za dozvoljenu tranziciju', () => {
    expect(() => assertPaymentTransition('pending', 'awaiting')).not.toThrow()
    expect(() => assertPaymentTransition('awaiting', 'paid')).not.toThrow()
  })

  it('baca grešku za nedozvoljenu tranziciju', () => {
    expect(() => assertPaymentTransition('pending', 'paid')).toThrow()
    expect(() => assertPaymentTransition('refunded', 'paid')).toThrow()
  })
})
