import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'

export const productCategories = sqliteTable('product_categories', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  parentId: text('parent_id'),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const productCategoriesRelations = relations(productCategories, ({ one, many }) => ({
  parent: one(productCategories, {
    fields: [productCategories.parentId],
    references: [productCategories.id],
    relationName: 'parent',
  }),
  children: many(productCategories, { relationName: 'parent' }),
}))
