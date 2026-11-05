import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { eq } from 'drizzle-orm'
import { createDb } from '../lib/db'
import { authMiddleware, requireRole } from '../middleware/auth'
import { settings } from '@denic-shop/core/schema'
import type { Env } from '../lib/env'
import type { AuthVariables } from '../middleware/auth'

const ErrorSchema = z.object({ error: z.string() })
const KeyParam = z.object({ key: z.string().min(1) })

const app = new OpenAPIHono<{ Bindings: Env; Variables: AuthVariables }>()
app.use('*', authMiddleware)

const listRoute = createRoute({
  method: 'get', path: '/', tags: ['Settings'],
  responses: { 200: { description: 'Sva podešavanja', content: { 'application/json': { schema: z.object({ data: z.record(z.string(), z.string()) }) } } } },
})
app.openapi(listRoute, async (c) => {
  const db = createDb(c.env.DB)
  const rows = await db.select().from(settings).all()
  return c.json({ data: Object.fromEntries(rows.map(r => [r.key, r.value])) }, 200)
})

const putRoute = createRoute({
  method: 'put', path: '/{key}', tags: ['Settings'],
  middleware: [requireRole('owner', 'admin')] as const,
  request: {
    params: KeyParam,
    body: { content: { 'application/json': { schema: z.object({ value: z.string() }) } } },
  },
  responses: {
    200: { description: 'Sačuvano', content: { 'application/json': { schema: z.object({ data: z.object({ ok: z.boolean() }) }) } } },
  },
})
app.openapi(putRoute, async (c) => {
  const db = createDb(c.env.DB)
  const { key } = c.req.valid('param')
  const { value } = c.req.valid('json')
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } })
  return c.json({ data: { ok: true as const } }, 200)
})

export { app as settingsRoutes }
