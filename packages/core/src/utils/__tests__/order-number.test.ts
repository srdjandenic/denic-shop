import { describe, it, expect } from 'vitest'
import { generateOrderNumber, parseOrderSequence } from '../order-number'

describe('generateOrderNumber', () => {
  it('formatira broj porudzbine sa prefiksom, godinom i rednim brojem', () => {
    const year = new Date().getFullYear()
    expect(generateOrderNumber('DS', 1)).toBe(`DS-${year}-00001`)
    expect(generateOrderNumber('DS', 42)).toBe(`DS-${year}-00042`)
    expect(generateOrderNumber('DS', 99999)).toBe(`DS-${year}-99999`)
  })

  it('koristi razlicite prefikse', () => {
    const year = new Date().getFullYear()
    expect(generateOrderNumber('ABC', 1)).toBe(`ABC-${year}-00001`)
  })

  it('pad na 5 cifara', () => {
    const result = generateOrderNumber('DS', 7)
    expect(result.split('-')[2]).toBe('00007')
  })
})

describe('parseOrderSequence', () => {
  it('parsira redni broj iz broja porudzbine', () => {
    expect(parseOrderSequence('DS-2026-00001')).toBe(1)
    expect(parseOrderSequence('DS-2026-00042')).toBe(42)
    expect(parseOrderSequence('DS-2026-99999')).toBe(99999)
  })

  it('vraca 0 za neispravni format', () => {
    expect(parseOrderSequence('invalid')).toBe(0)
  })
})
