import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { productCategories } from './categories'

export const taxRates = sqliteTable('tax_rates', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  // 2000 = 20.00%, 1000 = 10.00%, 0 = §19 oslobođen
  rate: integer('rate').notNull().default(0),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  appliesTo: text('applies_to', { enum: ['all', 'specific_categories'] }).notNull().default('all'),
})

export const taxRateCategoryAssignments = sqliteTable('tax_rate_category_assignments', {
  taxRateId: text('tax_rate_id').notNull().references(() => taxRates.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').notNull().references(() => productCategories.id, { onDelete: 'cascade' }),
})

export const taxRatesRelations = relations(taxRates, ({ many }) => ({
  categoryAssignments: many(taxRateCategoryAssignments),
}))
