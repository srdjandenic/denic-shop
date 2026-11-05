import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { createDb } from '../lib/db'
import { authMiddleware, requireRole } from '../middleware/auth'
import { settings } from '@denic-shop/core/schema'
import type { Env } from '../lib/env'
import type { AuthVariables } from '../middleware/auth'

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

app.use('*', authMiddleware)

app.get('/', async (c) => {
  const db = createDb(c.env.DB)
  const rows = await db.select().from(settings).all()
  const result = Object.fromEntries(rows.map(r => [r.key, r.value]))
  return c.json({ data: result })
})

app.put('/:key', requireRole('owner', 'admin'), async (c) => {
    const db = createDb(c.env.DB)
    const key = c.req.param('key')
    const parsed = z.object({ value: z.string() }).safeParse(await c.req.json())
    if (!parsed.success) return c.json({ error: 'Validacija neuspešna' }, 422)
    const { value } = parsed.data
    await db.insert(settings).values({ key, value }).onConflictDoUpdate({
      target: settings.key,
      set: { value },
    })
    return c.json({ data: { ok: true } })
  })

export { app as settingsRoutes }
