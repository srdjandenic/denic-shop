import { describe, it, expect } from 'vitest'
import { CheckoutSchema } from '../customers'

const validCheckout = {
  items: [{ variantId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', quantity: 2 }],
  paymentMethod: 'ips_qr' as const,
  shippingAddress: {
    firstName: 'Petar',
    lastName: 'Petrović',
    street: 'Knez Mihailova 1',
    city: 'Beograd',
    postalCode: '11000',
    country: 'RS',
    email: 'petar@example.com',
    phone: '+381641234567',
  },
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
      items: [{ variantId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', quantity: 0 }],
    })
    const r2 = CheckoutSchema.safeParse({
      ...validCheckout,
      items: [{ variantId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', quantity: -1 }],
    })
    expect(r1.success).toBe(false)
    expect(r2.success).toBe(false)
  })

  it('odbija neispravni email u shipping adresi', () => {
    const result = CheckoutSchema.safeParse({
      ...validCheckout,
      shippingAddress: { ...validCheckout.shippingAddress, email: 'nije-email' },
    })
    expect(result.success).toBe(false)
  })

  it('odbija nepoznatu metodu placanja', () => {
    const result = CheckoutSchema.safeParse({ ...validCheckout, paymentMethod: 'bitcoin' })
    expect(result.success).toBe(false)
  })

  it('prihvata sve dozvoljene metode placanja', () => {
    for (const method of ['ips_qr', 'cod'] as const) {
      const result = CheckoutSchema.safeParse({ ...validCheckout, paymentMethod: method })
      expect(result.success).toBe(true)
    }
  })

  it('shippingAddress.country default je RS', () => {
    const input = {
      ...validCheckout,
      shippingAddress: { ...validCheckout.shippingAddress, country: undefined },
    }
    const result = CheckoutSchema.safeParse(input)
    expect(result.success && result.data.shippingAddress.country).toBe('RS')
  })

  it('phone je opcionalno', () => {
    const input = {
      ...validCheckout,
      shippingAddress: { ...validCheckout.shippingAddress, phone: undefined },
    }
    const result = CheckoutSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('note je opcionalno', () => {
    const result = CheckoutSchema.safeParse({ ...validCheckout, note: undefined })
    expect(result.success).toBe(true)
  })

  it('currencyCode default je RSD', () => {
    const result = CheckoutSchema.safeParse(validCheckout)
    expect(result.success && result.data.currencyCode).toBe('RSD')
  })
})
