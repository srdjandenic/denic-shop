import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'
import { customers } from './customers'
import { productVariants } from './products'
import { shippingZoneRates } from './shipping'

export const carts = sqliteTable('carts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  token: text('token').notNull().unique(),
  customerId: text('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  email: text('email'),
  phone: text('phone'),
  currencyCode: text('currency_code', { enum: ['RSD', 'EUR'] }).notNull().default('RSD'),
  subtotal: integer('subtotal').notNull().default(0),
  discountTotal: integer('discount_total').notNull().default(0),
  shippingTotal: integer('shipping_total').notNull().default(0),
  taxTotal: integer('tax_total').notNull().default(0),
  total: integer('total').notNull().default(0),
  shippingZoneRateId: text('shipping_zone_rate_id').references(() => shippingZoneRates.id, { onDelete: 'set null' }),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const cartItems = sqliteTable('cart_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  cartId: text('cart_id').notNull().references(() => carts.id, { onDelete: 'cascade' }),
  variantId: text('variant_id').notNull().references(() => productVariants.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: integer('unit_price').notNull(),
  totalPrice: integer('total_price').notNull(),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const cartsRelations = relations(carts, ({ one, many }) => ({
  customer: one(customers, { fields: [carts.customerId], references: [customers.id] }),
  items: many(cartItems),
  shippingRate: one(shippingZoneRates, { fields: [carts.shippingZoneRateId], references: [shippingZoneRates.id] }),
}))

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  variant: one(productVariants, { fields: [cartItems.variantId], references: [productVariants.id] }),
}))
