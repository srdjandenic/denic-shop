import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

export const shippingZones = sqliteTable('shipping_zones', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  countries: text('countries', { mode: 'json' }).$type<string[]>().notNull().default([]),
})

export const shippingZoneRates = sqliteTable('shipping_zone_rates', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  zoneId: text('zone_id').notNull().references(() => shippingZones.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  currencyCode: text('currency_code', { enum: ['RSD', 'EUR'] }).notNull().default('RSD'),
  amount: integer('amount').notNull(),
  freeAboveAmount: integer('free_above_amount'),
  minWeight: integer('min_weight'),
  maxWeight: integer('max_weight'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
})

export const shippingZonesRelations = relations(shippingZones, ({ many }) => ({
  rates: many(shippingZoneRates),
}))

export const shippingZoneRatesRelations = relations(shippingZoneRates, ({ one }) => ({
  zone: one(shippingZones, { fields: [shippingZoneRates.zoneId], references: [shippingZones.id] }),
}))
