import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { createDb } from '../lib/db'
import { authMiddleware, requireRole } from '../middleware/auth'
import { tenants, paymentMethods } from '@denic-shop/core/schema'
import type { Env } from '../lib/env'
import type { JwtPayload } from '../lib/auth'

type Variables = { user: JwtPayload }

export const settingsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

settingsRoutes.use('*', authMiddleware)

settingsRoutes.get('/', async (c) => {
  const { tenantId } = c.get('user')
  const db = createDb(c.env.DB)
  const rows = await db.select().from(tenants).where(eq(tenants.id, tenantId))
  if (!rows[0]) return c.json({ error: 'Tenant nije pronađen' }, 404)
  return c.json({ data: rows[0] })
})

settingsRoutes.patch('/', requireRole('owner'), async (c) => {
  const { tenantId } = c.get('user')
  const db = createDb(c.env.DB)
  const body = await c.req.json()

  await db.update(tenants)
    .set({
      name: body.name ?? undefined,
      settings: body.settings ?? undefined,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tenants.id, tenantId))

  return c.json({ data: { ok: true } })
})

settingsRoutes.get('/payment-methods', async (c) => {
  const { tenantId } = c.get('user')
  const db = createDb(c.env.DB)
  const rows = await db.select().from(paymentMethods).where(eq(paymentMethods.tenantId, tenantId))
  return c.json({ data: rows })
})

settingsRoutes.patch('/payment-methods/:id', requireRole('owner', 'admin'), async (c) => {
  const { tenantId } = c.get('user')
  const db = createDb(c.env.DB)
  const body = await c.req.json()

  const existing = await db.select().from(paymentMethods)
    .where(eq(paymentMethods.id, c.req.param('id')))

  if (!existing[0] || existing[0].tenantId !== tenantId) {
    return c.json({ error: 'Nije pronađen' }, 404)
  }

  await db.update(paymentMethods)
    .set({
      active: body.active ?? existing[0].active,
      config: body.config ? { ...existing[0].config as object, ...body.config } : existing[0].config,
    })
    .where(eq(paymentMethods.id, existing[0].id))

  return c.json({ data: { ok: true } })
})
