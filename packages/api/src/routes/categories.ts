import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { createDb } from '../lib/db'
import { authMiddleware, requireRole } from '../middleware/auth'
import { categories } from '@denic-shop/core/schema'
import type { Env } from '../lib/env'
import type { JwtPayload } from '../lib/auth'

type Variables = { user: JwtPayload }

export const categoryRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

categoryRoutes.use('*', authMiddleware)

categoryRoutes.get('/', async (c) => {
  const { tenantId } = c.get('user')
  const db = createDb(c.env.DB)
  const rows = await db.select().from(categories).where(eq(categories.tenantId, tenantId))
  return c.json({ data: rows })
})

categoryRoutes.post('/', requireRole('owner', 'admin'), async (c) => {
  const { tenantId } = c.get('user')
  const body = await c.req.json()
  if (!body.name || !body.slug) return c.json({ error: 'name i slug su obavezni' }, 400)

  const db = createDb(c.env.DB)
  const id = crypto.randomUUID()
  await db.insert(categories).values({ id, tenantId, name: body.name, slug: body.slug, parentId: body.parentId ?? null })

  const created = await db.select().from(categories).where(eq(categories.id, id))
  return c.json({ data: created[0] }, 201)
})

categoryRoutes.patch('/:id', requireRole('owner', 'admin'), async (c) => {
  const { tenantId } = c.get('user')
  const db = createDb(c.env.DB)

  const existing = await db.select().from(categories)
    .where(and(eq(categories.id, c.req.param('id')), eq(categories.tenantId, tenantId)))

  if (!existing[0]) return c.json({ error: 'Nije pronađena' }, 404)

  const body = await c.req.json()
  await db.update(categories)
    .set({ name: body.name ?? existing[0].name, slug: body.slug ?? existing[0].slug })
    .where(eq(categories.id, existing[0].id))

  return c.json({ data: { ok: true } })
})

categoryRoutes.delete('/:id', requireRole('owner', 'admin'), async (c) => {
  const { tenantId } = c.get('user')
  const db = createDb(c.env.DB)

  const existing = await db.select().from(categories)
    .where(and(eq(categories.id, c.req.param('id')), eq(categories.tenantId, tenantId)))

  if (!existing[0]) return c.json({ error: 'Nije pronađena' }, 404)

  await db.delete(categories).where(eq(categories.id, existing[0].id))
  return c.json({ data: { ok: true } })
})
