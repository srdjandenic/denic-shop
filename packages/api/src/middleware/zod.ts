import { createMiddleware } from 'hono/factory'
import type { ZodSchema } from 'zod'

export function validate<T>(schema: ZodSchema<T>, source: 'json' | 'query' = 'json') {
  return createMiddleware(async (c, next) => {
    const data = source === 'json' ? await c.req.json() : c.req.query()
    const result = schema.safeParse(data)

    if (!result.success) {
      return c.json({ error: 'Nevalidni podaci', details: result.error.flatten() }, 400)
    }

    c.set('validated', result.data)
    await next()
  })
}
