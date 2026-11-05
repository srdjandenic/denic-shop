import { z } from 'zod'
import { ORDER_STATUSES, PAYMENT_METHOD_TYPES } from '../schema/orders'

export const CheckoutItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().positive(),
})

export const CheckoutSchema = z.object({
  items: z.array(CheckoutItemSchema).min(1, 'Korpa ne moze biti prazna'),
  shippingName: z.string().min(2).max(100),
  shippingEmail: z.string().email(),
  shippingPhone: z.string().optional(),
  shippingStreet: z.string().min(2).max(200),
  shippingCity: z.string().min(2).max(100),
  shippingPostalCode: z.string().min(4).max(10),
  shippingCountry: z.string().length(2).default('RS'),
  paymentMethod: z.enum(PAYMENT_METHOD_TYPES),
  note: z.string().max(500).optional(),
})

export type CheckoutInput = z.infer<typeof CheckoutSchema>
export type CheckoutItemInput = z.infer<typeof CheckoutItemSchema>

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  trackingNumber: z.string().optional(),
  note: z.string().optional(),
})

export const OrderFilterSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  paymentMethod: z.enum(['ips_qr', 'cod', 'bank_transfer']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>
export type OrderFilterInput = z.infer<typeof OrderFilterSchema>
