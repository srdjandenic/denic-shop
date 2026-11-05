import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const tenants = sqliteTable('tenants', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  domain: text('domain'),
  settings: text('settings', { mode: 'json' }).$type<TenantSettings>().notNull().default({
    currency: 'RSD',
    emailFrom: '',
    logoR2Key: null,
    primaryColor: '#1a1a1a',
    shippingFlatRsd: 0,
    freeShippingAboveRsd: null,
  }),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export type TenantSettings = {
  currency: 'RSD'
  emailFrom: string
  logoR2Key: string | null
  primaryColor: string
  shippingFlatRsd: number
  freeShippingAboveRsd: number | null
}
