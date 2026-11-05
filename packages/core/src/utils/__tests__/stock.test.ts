import { describe, it, expect } from 'vitest'
import { checkStock, decrementStock, incrementStock } from '../stock'

describe('checkStock', () => {
  it('vraca prazno kada ima dovoljno zaliha', () => {
    expect(checkStock([
      { variantId: 'v1', quantity: 2, stock: 10 },
      { variantId: 'v2', quantity: 1, stock: 5 },
    ])).toEqual([])
  })

  it('vraca greske za artikle bez zaliha', () => {
    const errors = checkStock([
      { variantId: 'v1', quantity: 5, stock: 3 },
      { variantId: 'v2', quantity: 1, stock: 1 },
    ])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ variantId: 'v1', requested: 5, available: 3 })
  })

  it('tacno kolicina jednaka zalihama je OK', () => {
    expect(checkStock([{ variantId: 'v1', quantity: 5, stock: 5 }])).toEqual([])
  })

  it('vraca vise gresaka ako vise artikala nema zaliha', () => {
    const errors = checkStock([
      { variantId: 'v1', quantity: 10, stock: 3 },
      { variantId: 'v2', quantity: 10, stock: 1 },
    ])
    expect(errors).toHaveLength(2)
  })
})

describe('decrementStock', () => {
  it('smanjuje zalihe', () => {
    expect(decrementStock(10, 3)).toBe(7)
    expect(decrementStock(5, 5)).toBe(0)
  })

  it('baca gresku ako nema dovoljno zaliha', () => {
    expect(() => decrementStock(3, 5)).toThrow()
  })

  it('baca gresku za nultu ili negativnu kolicinu', () => {
    expect(() => decrementStock(10, 0)).toThrow()
    expect(() => decrementStock(10, -1)).toThrow()
  })
})

describe('incrementStock', () => {
  it('povecava zalihe (povrat, korekcija)', () => {
    expect(incrementStock(5, 3)).toBe(8)
    expect(incrementStock(0, 10)).toBe(10)
  })

  it('baca gresku za nultu ili negativnu kolicinu', () => {
    expect(() => incrementStock(5, 0)).toThrow()
    expect(() => incrementStock(5, -1)).toThrow()
  })
})
