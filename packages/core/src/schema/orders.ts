import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'
import { customers } from './customers'
import { productVariants } from './products'
import { shippingZoneRates } from './shipping'
import { taxRates } from './tax'
import { users } from './users'

export const ORDER_STATUSES = ['open', 'completed', 'cancelled'] as const
export type OrderStatus = typeof ORDER_STATUSES[number]

export const PAYMENT_STATUSES = [
  'pending', 'awaiting', 'cod_pending',
  'paid', 'partially_refunded', 'refunded', 'voided', 'failed',
] as const
export type PaymentStatus = typeof PAYMENT_STATUSES[number]

export const FULFILLMENT_STATUSES = [
  'unfulfilled', 'fulfillment_created', 'partial', 'shipped', 'fulfilled', 'returned',
] as const
export type FulfillmentStatus = typeof FULFILLMENT_STATUSES[number]

export const PAYMENT_METHODS = ['ips_qr', 'cod', 'nestpay', 'stripe'] as const
export type PaymentMethod = typeof PAYMENT_METHODS[number]

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderNumber: text('order_number').notNull().unique(),
  customerId: text('customer_id').references(() => customers.id, { onDelete: 'set null' }),

  status: text('status', { enum: ORDER_STATUSES }).notNull().default('open'),
  paymentStatus: text('payment_status', { enum: PAYMENT_STATUSES }).notNull().default('pending'),
  fulfillmentStatus: text('fulfillment_status', { enum: FULFILLMENT_STATUSES }).notNull().default('unfulfilled'),

  currencyCode: text('currency_code', { enum: ['RSD', 'EUR'] }).notNull().default('RSD'),
  subtotal: integer('subtotal').notNull(),
  discountTotal: integer('discount_total').notNull().default(0),
  shippingTotal: integer('shipping_total').notNull().default(0),
  taxTotal: integer('tax_total').notNull().default(0),
  total: integer('total').notNull(),

  taxRateId: text('tax_rate_id').references(() => taxRates.id, { onDelete: 'set null' }),
  paymentMethod: text('payment_method', { enum: PAYMENT_METHODS }).notNull(),
  shippingZoneRateId: text('shipping_zone_rate_id').references(() => shippingZoneRates.id, { onDelete: 'set null' }),

  notes: text('notes'),
  cancelReason: text('cancel_reason'),
  cancelledAt: text('cancelled_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// Shipping/billing address snapshots
export const orderShippingAddresses = sqliteTable('order_shipping_addresses', {
  orderId: text('order_id').primaryKey().references(() => orders.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  company: text('company'),
  street: text('street').notNull(),
  city: text('city').notNull(),
  postalCode: text('postal_code').notNull(),
  country: text('country').notNull().default('RS'),
  phone: text('phone'),
  email: text('email').notNull(),
})

export const orderBillingAddresses = sqliteTable('order_billing_addresses', {
  orderId: text('order_id').primaryKey().references(() => orders.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  companyName: text('company_name'),
  pib: text('pib'),
  mb: text('mb'),
  street: text('street').notNull(),
  city: text('city').notNull(),
  postalCode: text('postal_code').notNull(),
  country: text('country').notNull().default('RS'),
})

export const orderLineItems = sqliteTable('order_line_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  variantId: text('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
  productName: text('product_name').notNull(),
  variantName: text('variant_name').notNull(),
  sku: text('sku').notNull(),
  unitPrice: integer('unit_price').notNull(),
  quantity: integer('quantity').notNull(),
  totalPrice: integer('total_price').notNull(),
  taxRate: integer('tax_rate'),
  requiresShipping: integer('requires_shipping', { mode: 'boolean' }).notNull().default(true),
  fulfillmentStatus: text('fulfillment_status', { enum: FULFILLMENT_STATUSES }).notNull().default('unfulfilled'),
})

export const orderTransactions = sqliteTable('order_transactions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['authorization', 'capture', 'refund', 'void'] }).notNull(),
  amount: integer('amount').notNull(),
  currencyCode: text('currency_code', { enum: ['RSD', 'EUR'] }).notNull(),
  provider: text('provider', { enum: PAYMENT_METHODS }).notNull(),
  externalId: text('external_id'),
  status: text('status', { enum: ['pending', 'success', 'failure'] }).notNull().default('pending'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const orderTimeline = sqliteTable('order_timeline', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  event: text('event').notNull(),
  body: text('body'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const fulfillments = sqliteTable('fulfillments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['pending', 'shipped', 'delivered', 'failed'] }).notNull().default('pending'),
  trackingNumber: text('tracking_number'),
  trackingUrl: text('tracking_url'),
  shippedAt: text('shipped_at'),
  deliveredAt: text('delivered_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const fulfillmentItems = sqliteTable('fulfillment_items', {
  fulfillmentId: text('fulfillment_id').notNull().references(() => fulfillments.id, { onDelete: 'cascade' }),
  lineItemId: text('line_item_id').notNull().references(() => orderLineItems.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull(),
})

// Relations
export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  shippingAddress: one(orderShippingAddresses, { fields: [orders.id], references: [orderShippingAddresses.orderId] }),
  billingAddress: one(orderBillingAddresses, { fields: [orders.id], references: [orderBillingAddresses.orderId] }),
  lineItems: many(orderLineItems),
  transactions: many(orderTransactions),
  timeline: many(orderTimeline),
  fulfillments: many(fulfillments),
}))

export const orderLineItemsRelations = relations(orderLineItems, ({ one }) => ({
  order: one(orders, { fields: [orderLineItems.orderId], references: [orders.id] }),
  variant: one(productVariants, { fields: [orderLineItems.variantId], references: [productVariants.id] }),
}))

export const fulfillmentsRelations = relations(fulfillments, ({ one, many }) => ({
  order: one(orders, { fields: [fulfillments.orderId], references: [orders.id] }),
  items: many(fulfillmentItems),
}))

export const fulfillmentItemsRelations = relations(fulfillmentItems, ({ one }) => ({
  fulfillment: one(fulfillments, { fields: [fulfillmentItems.fulfillmentId], references: [fulfillments.id] }),
  lineItem: one(orderLineItems, { fields: [fulfillmentItems.lineItemId], references: [orderLineItems.id] }),
}))
