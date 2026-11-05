import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'
import { productVariants } from './products'

export const LOCATION_TYPES = ['warehouse', 'store', 'virtual'] as const

export const locations = sqliteTable('locations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  type: text('type', { enum: LOCATION_TYPES }).notNull().default('warehouse'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  street: text('street'),
  city: text('city'),
  postalCode: text('postal_code'),
  country: text('country').default('RS'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const inventoryItems = sqliteTable('inventory_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  variantId: text('variant_id').notNull().unique().references(() => productVariants.id, { onDelete: 'cascade' }),
  sku: text('sku').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const inventoryLevels = sqliteTable('inventory_levels', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  inventoryItemId: text('inventory_item_id').notNull().references(() => inventoryItems.id, { onDelete: 'cascade' }),
  locationId: text('location_id').notNull().references(() => locations.id, { onDelete: 'cascade' }),
  onHand: integer('on_hand').notNull().default(0),
  reserved: integer('reserved').notNull().default(0),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const inventoryItemsRelations = relations(inventoryItems, ({ one, many }) => ({
  variant: one(productVariants, { fields: [inventoryItems.variantId], references: [productVariants.id] }),
  levels: many(inventoryLevels),
}))

export const inventoryLevelsRelations = relations(inventoryLevels, ({ one }) => ({
  item: one(inventoryItems, { fields: [inventoryLevels.inventoryItemId], references: [inventoryItems.id] }),
  location: one(locations, { fields: [inventoryLevels.locationId], references: [locations.id] }),
}))
