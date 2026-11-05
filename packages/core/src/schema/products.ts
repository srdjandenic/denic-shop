import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql, relations } from 'drizzle-orm'
import { productCategories } from './categories'

export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const
export type ProductStatus = typeof PRODUCT_STATUSES[number]

export const PRODUCT_TYPES = ['physical', 'digital', 'service'] as const
export type ProductType = typeof PRODUCT_TYPES[number]

export const CURRENCY_CODES = ['RSD', 'EUR'] as const
export type CurrencyCode = typeof CURRENCY_CODES[number]

export const products = sqliteTable('products', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  categoryId: text('category_id').references(() => productCategories.id, { onDelete: 'set null' }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { enum: PRODUCT_STATUSES }).notNull().default('draft'),
  productType: text('product_type', { enum: PRODUCT_TYPES }).notNull().default('physical'),
  hasVariants: integer('has_variants', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const productVariants = sqliteTable('product_variants', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  requiresShipping: integer('requires_shipping', { mode: 'boolean' }).notNull().default(true),
  allowBackorder: integer('allow_backorder', { mode: 'boolean' }).notNull().default(false),
  weight: integer('weight'),
  weightUnit: text('weight_unit', { enum: ['g', 'kg'] }).default('g'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// One price per variant per currency
export const variantPrices = sqliteTable('variant_prices', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  variantId: text('variant_id').notNull().references(() => productVariants.id, { onDelete: 'cascade' }),
  currencyCode: text('currency_code', { enum: CURRENCY_CODES }).notNull(),
  amount: integer('amount').notNull(),
  compareAtAmount: integer('compare_at_amount'),
}, (t) => [
  uniqueIndex('variant_prices_variant_currency_idx').on(t.variantId, t.currencyCode),
])

export const productOptions = sqliteTable('product_options', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const productOptionValues = sqliteTable('product_option_values', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  optionId: text('option_id').notNull().references(() => productOptions.id, { onDelete: 'cascade' }),
  value: text('value').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const productVariantOptions = sqliteTable('product_variant_options', {
  variantId: text('variant_id').notNull().references(() => productVariants.id, { onDelete: 'cascade' }),
  optionValueId: text('option_value_id').notNull().references(() => productOptionValues.id, { onDelete: 'cascade' }),
}, (t) => [
  uniqueIndex('product_variant_options_pkey').on(t.variantId, t.optionValueId),
])

export const productMedia = sqliteTable('product_media', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  productId: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantId: text('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
  r2Key: text('r2_key').notNull(),
  url: text('url'),
  alt: text('alt'),
  mimeType: text('mime_type'),
  isCover: integer('is_cover', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

// Relations
export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(productCategories, { fields: [products.categoryId], references: [productCategories.id] }),
  variants: many(productVariants),
  media: many(productMedia),
  options: many(productOptions),
}))

export const productVariantsRelations = relations(productVariants, ({ one, many }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
  prices: many(variantPrices),
  media: many(productMedia),
  variantOptions: many(productVariantOptions),
}))

export const variantPricesRelations = relations(variantPrices, ({ one }) => ({
  variant: one(productVariants, { fields: [variantPrices.variantId], references: [productVariants.id] }),
}))

export const productOptionsRelations = relations(productOptions, ({ one, many }) => ({
  product: one(products, { fields: [productOptions.productId], references: [products.id] }),
  values: many(productOptionValues),
}))

export const productOptionValuesRelations = relations(productOptionValues, ({ one, many }) => ({
  option: one(productOptions, { fields: [productOptionValues.optionId], references: [productOptions.id] }),
  variantOptions: many(productVariantOptions),
}))

export const productVariantOptionsRelations = relations(productVariantOptions, ({ one }) => ({
  variant: one(productVariants, { fields: [productVariantOptions.variantId], references: [productVariants.id] }),
  optionValue: one(productOptionValues, { fields: [productVariantOptions.optionValueId], references: [productOptionValues.id] }),
}))

export const productMediaRelations = relations(productMedia, ({ one }) => ({
  product: one(products, { fields: [productMedia.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [productMedia.variantId], references: [productVariants.id] }),
}))
