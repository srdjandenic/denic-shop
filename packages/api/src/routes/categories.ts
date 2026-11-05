import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { createDb } from '../lib/db'
import { authMiddleware, requireRole } from '../middleware/auth'
import { productCategories } from '@denic-shop/core/schema'
import type { Env } from '../lib/env'
import type { AuthVariables } from '../middleware/auth'

const CategorySchema = z.object({
  parentId: z.string().uuid().optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.number().int().default(0),
})

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

app.use('*', authMiddleware)

app.get('/', async (c) => {
  const db = createDb(c.env.DB)
  const rows = await db.query.productCategories.findMany({
    with: { children: true },
    orderBy: (t) => t.sortOrder,
  })
  return c.json({ data: rows })
})

app.post('/', requireRole('owner', 'admin'), async (c) => {
  const db = createDb(c.env.DB)
  const parsed = CategorySchema.safeParse(await c.req.json())
  if (!parsed.success) return c.json({ error: 'Validacija neuspešna', details: parsed.error.flatten() }, 422)
  const data = parsed.data
  const id = crypto.randomUUID()
  await db.insert(productCategories).values({ id, ...data })
  return c.json({ data: { id, ...data } }, 201)
})

app.patch('/:id', requireRole('owner', 'admin'), async (c) => {
  const db = createDb(c.env.DB)
  const existing = await db.query.productCategories.findFirst({ where: eq(productCategories.id, c.req.param('id')) })
  if (!existing) return c.json({ error: 'Nije pronađena' }, 404)
  const parsed = CategorySchema.partial().safeParse(await c.req.json())
  if (!parsed.success) return c.json({ error: 'Validacija neuspešna', details: parsed.error.flatten() }, 422)
  await db.update(productCategories).set(parsed.data).where(eq(productCategories.id, existing.id))
  return c.json({ data: { ok: true } })
})

app.delete('/:id', requireRole('owner', 'admin'), async (c) => {
  const db = createDb(c.env.DB)
  const existing = await db.query.productCategories.findFirst({ where: eq(productCategories.id, c.req.param('id')) })
  if (!existing) return c.json({ error: 'Nije pronađena' }, 404)
  await db.delete(productCategories).where(eq(productCategories.id, existing.id))
  return c.json({ data: { ok: true } })
})

export { app as categoryRoutes }
