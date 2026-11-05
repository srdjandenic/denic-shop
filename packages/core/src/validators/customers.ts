import { z } from 'zod'

export const AddressSchema = z.object({
  fullName: z.string().min(1),
  street: z.string().min(1),
  city: z.string().min(1),
  postalCode: z.string().min(4),
  country: z.string().length(2).default('RS'),
})

export const CheckoutSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().optional(),
  address: AddressSchema,
  paymentMethod: z.enum(['ips_qr', 'cod', 'bank_transfer']),
  note: z.string().optional(),
  items: z.array(z.object({
    variantId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
})

export type CheckoutInput = z.infer<typeof CheckoutSchema>
export type AddressInput = z.infer<typeof AddressSchema>
