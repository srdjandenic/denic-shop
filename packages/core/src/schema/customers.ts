import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'

export const customers = sqliteTable('customers', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  companyName: text('company_name'),
  pib: text('pib'),
  mb: text('mb'),
  acceptsMarketing: integer('accepts_marketing', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const customerAddresses = sqliteTable('customer_addresses', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  company: text('company'),
  street: text('street').notNull(),
  city: text('city').notNull(),
  postalCode: text('postal_code').notNull(),
  country: text('country').notNull().default('RS'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
})

export const customersRelations = relations(customers, ({ many }) => ({
  addresses: many(customerAddresses),
}))

export const customerAddressesRelations = relations(customerAddresses, ({ one }) => ({
  customer: one(customers, { fields: [customerAddresses.customerId], references: [customers.id] }),
}))
