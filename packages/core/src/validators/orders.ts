import { z } from 'zod'
import { ORDER_STATUSES } from '../schema/orders'

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
