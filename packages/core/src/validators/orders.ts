import { z } from 'zod'
import { ORDER_STATUSES, PAYMENT_STATUSES, FULFILLMENT_STATUSES, PAYMENT_METHODS } from '../schema/orders'

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  fulfillmentStatus: z.enum(FULFILLMENT_STATUSES).optional(),
  note: z.string().optional(),
})

export const AddTrackingSchema = z.object({
  fulfillmentId: z.string().uuid(),
  trackingNumber: z.string().min(1),
  trackingUrl: z.string().url().optional(),
})

export const OrderFilterSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  fulfillmentStatus: z.enum(FULFILLMENT_STATUSES).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>
export type OrderFilterInput = z.infer<typeof OrderFilterSchema>
