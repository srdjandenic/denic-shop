import { describe, it, expect } from 'vitest'
import { canTransition, getAllowedTransitions, assertTransition } from '../order-status'

describe('canTransition', () => {
  it('dozvoljava ispravne tranzicije', () => {
    expect(canTransition('pending', 'confirmed')).toBe(true)
    expect(canTransition('pending', 'cancelled')).toBe(true)
    expect(canTransition('confirmed', 'processing')).toBe(true)
    expect(canTransition('confirmed', 'cancelled')).toBe(true)
    expect(canTransition('processing', 'shipped')).toBe(true)
    expect(canTransition('processing', 'cancelled')).toBe(true)
    expect(canTransition('shipped', 'delivered')).toBe(true)
    expect(canTransition('delivered', 'refunded')).toBe(true)
  })

  it('odbija neispravne tranzicije', () => {
    expect(canTransition('pending', 'shipped')).toBe(false)
    expect(canTransition('pending', 'delivered')).toBe(false)
    expect(canTransition('delivered', 'cancelled')).toBe(false)
    expect(canTransition('cancelled', 'confirmed')).toBe(false)
    expect(canTransition('refunded', 'pending')).toBe(false)
    expect(canTransition('shipped', 'processing')).toBe(false)
  })

  it('terminalni statusi nemaju dozvoljene tranzicije', () => {
    expect(canTransition('cancelled', 'pending')).toBe(false)
    expect(canTransition('refunded', 'delivered')).toBe(false)
  })
})

describe('getAllowedTransitions', () => {
  it('vraca sve dozvoljene sledece statuse', () => {
    expect(getAllowedTransitions('pending')).toEqual(['confirmed', 'cancelled'])
    expect(getAllowedTransitions('cancelled')).toEqual([])
    expect(getAllowedTransitions('refunded')).toEqual([])
  })
})

describe('assertTransition', () => {
  it('ne baca gresku za dozvoljenu tranziciju', () => {
    expect(() => assertTransition('pending', 'confirmed')).not.toThrow()
  })

  it('baca gresku za nedozvoljenu tranziciju', () => {
    expect(() => assertTransition('pending', 'shipped')).toThrow()
    expect(() => assertTransition('cancelled', 'confirmed')).toThrow()
  })
})
