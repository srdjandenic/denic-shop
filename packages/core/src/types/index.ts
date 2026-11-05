export type { TenantSettings } from '../schema/tenants'
export type { UserRole } from '../schema/users'
export type {
  OrderStatus,
  PaymentMethodType,
  PaymentStatus,
  PaymentMethodConfig,
  IpsQrConfig,
  CodConfig,
  BankTransferConfig,
} from '../schema/orders'

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
