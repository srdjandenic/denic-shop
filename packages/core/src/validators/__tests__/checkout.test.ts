import { describe, it, expect } from 'vitest'
import { CheckoutSchema } from '../orders'

const validCheckout = {
  items: [{ variantId: 'var-001', quantity: 2 }],
  shippingName: 'Petar Petrovic',
  shippingEmail: 'petar@example.com',
  shippingStreet: 'Knez Mihailova 1',
  shippingCity: 'Beograd',
  shippingPostalCode: '11000',
  paymentMethod: 'ips_qr' as const,
}

describe('CheckoutSchema', () => {
  it('prihvata ispravne podatke', () => {
    const result = CheckoutSchema.safeParse(validCheckout)
    expect(result.success).toBe(true)
  })

  it('odbija praznu korpu', () => {
    const result = CheckoutSchema.safeParse({ ...validCheckout, items: [] })
    expect(result.success).toBe(false)
  })

  it('odbija kolicinu 0 ili negativnu', () => {
    const r1 = CheckoutSchema.safeParse({ ...validCheckout, items: [{ variantId: 'v1', quantity: 0 }] })
    const r2 = CheckoutSchema.safeParse({ ...validCheckout, items: [{ variantId: 'v1', quantity: -1 }] })
    expect(r1.success).toBe(false)
    expect(r2.success).toBe(false)
  })

  it('odbija neispravni email', () => {
    const result = CheckoutSchema.safeParse({ ...validCheckout, shippingEmail: 'nije-email' })
    expect(result.success).toBe(false)
  })

  it('odbija nepoznatu metodu placanja', () => {
    const result = CheckoutSchema.safeParse({ ...validCheckout, paymentMethod: 'bitcoin' })
    expect(result.success).toBe(false)
  })

  it('prihvata sve dozvoljene metode placanja', () => {
    for (const method of ['ips_qr', 'cod', 'bank_transfer'] as const) {
      const result = CheckoutSchema.safeParse({ ...validCheckout, paymentMethod: method })
      expect(result.success).toBe(true)
    }
  })

  it('shippingCountry default je RS', () => {
    const result = CheckoutSchema.safeParse(validCheckout)
    expect(result.success && result.data.shippingCountry).toBe('RS')
  })

  it('odbija ime krrace od 2 karaktera', () => {
    const result = CheckoutSchema.safeParse({ ...validCheckout, shippingName: 'A' })
    expect(result.success).toBe(false)
  })

  it('note je opcionalno', () => {
    const result = CheckoutSchema.safeParse({ ...validCheckout, note: undefined })
    expect(result.success).toBe(true)
  })

  it('odbija note duze od 500 karaktera', () => {
    const result = CheckoutSchema.safeParse({ ...validCheckout, note: 'A'.repeat(501) })
    expect(result.success).toBe(false)
  })
})
