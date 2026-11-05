import { z } from 'zod'
import { PAYMENT_METHODS } from '../schema/orders'

export const ShippingAddressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  company: z.string().optional(),
  street: z.string().min(1),
  city: z.string().min(1),
  postalCode: z.string().min(4),
  country: z.string().length(2).default('RS'),
  phone: z.string().optional(),
  email: z.string().email(),
})

export const BillingAddressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  companyName: z.string().optional(),
  pib: z.string().optional(),
  mb: z.string().optional(),
  street: z.string().min(1),
  city: z.string().min(1),
  postalCode: z.string().min(4),
  country: z.string().length(2).default('RS'),
})

export const CheckoutSchema = z.object({
  currencyCode: z.enum(['RSD', 'EUR']).default('RSD'),
  shippingAddress: ShippingAddressSchema,
  billingAddress: BillingAddressSchema.optional(),
  shippingZoneRateId: z.string().uuid().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  note: z.string().optional(),
  items: z.array(z.object({
    variantId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
})

export type CheckoutInput = z.infer<typeof CheckoutSchema>
export type ShippingAddressInput = z.infer<typeof ShippingAddressSchema>
export type BillingAddressInput = z.infer<typeof BillingAddressSchema>
