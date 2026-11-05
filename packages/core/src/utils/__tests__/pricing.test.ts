import { describe, it, expect } from 'vitest'
import { calcSubtotal, calcShipping, calcTotal, applyPercentDiscount } from '../pricing'

const shippingConfig = { flatRsd: 490, freeAboveRsd: 5000 }

describe('calcSubtotal', () => {
  it('mnozi cenu sa kolicinom i sabira', () => {
    expect(calcSubtotal([
      { priceRsd: 1990, quantity: 2 },
      { priceRsd: 500, quantity: 1 },
    ])).toBe(4480)
  })

  it('vraca 0 za praznu korpu', () => {
    expect(calcSubtotal([])).toBe(0)
  })

  it('jedan artikal, kolicina 1', () => {
    expect(calcSubtotal([{ priceRsd: 2990, quantity: 1 }])).toBe(2990)
  })
})

describe('calcShipping', () => {
  it('placa dostavu ispod praga', () => {
    expect(calcShipping(4999, shippingConfig)).toBe(490)
    expect(calcShipping(0, shippingConfig)).toBe(490)
  })

  it('besplatna dostava na pragu i iznad', () => {
    expect(calcShipping(5000, shippingConfig)).toBe(0)
    expect(calcShipping(10000, shippingConfig)).toBe(0)
  })
})

describe('calcTotal', () => {
  it('sabira subtotal i dostavu', () => {
    expect(calcTotal(4480, 490)).toBe(4970)
    expect(calcTotal(5000, 0)).toBe(5000)
  })
})

describe('applyPercentDiscount', () => {
  it('primenjuje procentualni popust', () => {
    expect(applyPercentDiscount(1000, 10)).toBe(900)
    expect(applyPercentDiscount(1000, 50)).toBe(500)
    expect(applyPercentDiscount(1000, 0)).toBe(1000)
    expect(applyPercentDiscount(1000, 100)).toBe(0)
  })

  it('zaokruzuje na ceo broj', () => {
    // 1990 * 0.85 = 1691.5 -> 1692
    expect(applyPercentDiscount(1990, 15)).toBe(1692)
  })

  it('baca gresku za popust izvan opsega', () => {
    expect(() => applyPercentDiscount(1000, -1)).toThrow()
    expect(() => applyPercentDiscount(1000, 101)).toThrow()
  })
})
