import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { tenants } from './tenants'
import { customers } from './customers'
import { products, productVariants } from './products'

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const
export type OrderStatus = typeof ORDER_STATUSES[number]

export const PAYMENT_METHOD_TYPES = ['ips_qr', 'cod', 'bank_transfer'] as const
export type PaymentMethodType = typeof PAYMENT_METHOD_TYPES[number]

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const
export type PaymentStatus = typeof PAYMENT_STATUSES[number]

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  orderNumber: text('order_number').notNull().unique(),
  status: text('status', { enum: ORDER_STATUSES }).notNull().default('pending'),
  // Shipping snapshot (ne FK jer adresa može biti izmenjena naknadno)
  shippingName: text('shipping_name').notNull(),
  shippingStreet: text('shipping_street').notNull(),
  shippingCity: text('shipping_city').notNull(),
  shippingPostalCode: text('shipping_postal_code').notNull(),
  shippingCountry: text('shipping_country').notNull().default('RS'),
  shippingPhone: text('shipping_phone'),
  shippingEmail: text('shipping_email').notNull(),
  subtotalRsd: integer('subtotal_rsd').notNull(),
  shippingRsd: integer('shipping_rsd').notNull().default(0),
  totalRsd: integer('total_rsd').notNull(),
  paymentMethod: text('payment_method', { enum: PAYMENT_METHOD_TYPES }).notNull(),
  paymentStatus: text('payment_status', { enum: PAYMENT_STATUSES }).notNull().default('pending'),
  note: text('note'),
  trackingNumber: text('tracking_number'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const orderItems = sqliteTable('order_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull(),
  variantId: text('variant_id').notNull(),
  // Snapshot naziva u trenutku porudžbine
  productName: text('product_name').notNull(),
  variantName: text('variant_name').notNull(),
  sku: text('sku').notNull(),
  unitPriceRsd: integer('unit_price_rsd').notNull(),
  quantity: integer('quantity').notNull(),
  totalRsd: integer('total_rsd').notNull(),
})

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  type: text('type', { enum: PAYMENT_METHOD_TYPES }).notNull(),
  status: text('status', { enum: PAYMENT_STATUSES }).notNull().default('pending'),
  amountRsd: integer('amount_rsd').notNull(),
  reference: text('reference'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const paymentMethods = sqliteTable('payment_methods', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  type: text('type', { enum: PAYMENT_METHOD_TYPES }).notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  config: text('config', { mode: 'json' }).$type<PaymentMethodConfig>().notNull().default({}),
  sortOrder: integer('sort_order').notNull().default(0),
})

export type PaymentMethodConfig =
  | IpsQrConfig
  | CodConfig
  | BankTransferConfig
  | Record<string, never>

export type IpsQrConfig = {
  recipientName: string
  accountNumber: string   // RS35 format
  bankCode: string
  pib: string
  model: string           // npr. "97"
  referencePrefix: string // npr. "11"
}

export type CodConfig = {
  maxAmountRsd?: number
}

export type BankTransferConfig = {
  recipientName: string
  accountNumber: string
  bankName: string
  swiftCode?: string
}
