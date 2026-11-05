import { describe, it, expect } from 'vitest'
import { CheckoutSchema } from '../customers'

const validCheckout = {
  items: [{ variantId: '00000000-0000-0000-0000-000000000001', quantity: 2 }],
  email: 'petar@example.com',
  name: 'Petar Petrovic',
  phone: '+381641234567',
  address: {
    fullName: 'Petar Petrovic',
    street: 'Knez Mihailova 1',
    city: 'Beograd',
    postalCode: '11000',
    country: 'RS',
  },
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
    const r1 = CheckoutSchema.safeParse({
      ...validCheckout,
      items: [{ variantId: '00000000-0000-0000-0000-000000000001', quantity: 0 }],
    })
    const r2 = CheckoutSchema.safeParse({
      ...validCheckout,
      items: [{ variantId: '00000000-0000-0000-0000-000000000001', quantity: -1 }],
    })
    expect(r1.success).toBe(false)
    expect(r2.success).toBe(false)
  })

  it('odbija neispravni email', () => {
    const result = CheckoutSchema.safeParse({ ...validCheckout, email: 'nije-email' })
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

  it('address.country default je RS', () => {
    const input = { ...validCheckout, address: { ...validCheckout.address, country: undefined } }
    const result = CheckoutSchema.safeParse(input)
    expect(result.success && result.data.address.country).toBe('RS')
  })

  it('odbija ime krrace od 1 karaktera', () => {
    const result = CheckoutSchema.safeParse({ ...validCheckout, name: '' })
    expect(result.success).toBe(false)
  })

  it('phone je opcionalno', () => {
    const result = CheckoutSchema.safeParse({ ...validCheckout, phone: undefined })
    expect(result.success).toBe(true)
  })

  it('note je opcionalno', () => {
    const result = CheckoutSchema.safeParse({ ...validCheckout, note: undefined })
    expect(result.success).toBe(true)
  })
})
