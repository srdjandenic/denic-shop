import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const idempotencyKeys = sqliteTable('idempotency_keys', {
  key: text('key').primaryKey(),
  requestHash: text('request_hash').notNull(),
  responseStatus: integer('response_status').notNull(),
  responseBody: text('response_body').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  expiresAt: text('expires_at').notNull(),
})
