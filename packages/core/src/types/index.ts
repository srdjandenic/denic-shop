export type { UserRole } from '../schema/users'
export type {
  OrderStatus,
  PaymentStatus,
  FulfillmentStatus,
  PaymentMethod,
} from '../schema/orders'
export type { IpsQrConfig, CodConfig } from '../schema/payment-config'
export type { CurrencyCode } from '../schema/products'

export type Pagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type ApiResponse<T> = {
  data: T
  pagination?: Pagination
}

export type ApiError = {
  error: string
  details?: unknown
}
