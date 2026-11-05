import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { createDb } from './db'
import { users, sessions, accounts, verifications } from '@denic-shop/core/schema'
import type { D1Database } from '@cloudflare/workers-types'

export function createAuth(d1: D1Database, secret: string) {
  const db = createDb(d1)

  return betterAuth({
    secret,
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: { users, sessions, accounts, verifications },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 dana
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minuta cache
      },
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          defaultValue: 'staff',
          input: false, // staff ne može da menja svoju ulogu
        },
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
