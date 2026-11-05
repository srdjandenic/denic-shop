import { Hono } from 'hono'
import { eq, desc, and } from 'drizzle-orm'
import { createDb } from '../lib/db'
import { authMiddleware, requireRole } from '../middleware/auth'
import { UpdateOrderStatusSchema, OrderFilterSchema } from '@denic-shop/core/validators'
import {
  orders,
  orderTransactions,
  orderTimeline,
  fulfillments,
  fulfillmentItems,
} from '@denic-shop/core/schema'
import type { Env } from '../lib/env'
import type { AuthVariables } from '../middleware/auth'

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

app.use('*', authMiddleware)

app.get('/', async (c) => {
  const db = createDb(c.env.DB)
  const parsed = OrderFilterSchema.safeParse(c.req.query())
  if (!parsed.success) return c.json({ error: 'Validacija neuspešna', details: parsed.error.flatten() }, 422)
  const { status, paymentStatus, fulfillmentStatus, page, limit } = parsed.data

  const conditions = []
  if (status) conditions.push(eq(orders.status, status))
  if (paymentStatus) conditions.push(eq(orders.paymentStatus, paymentStatus))
  if (fulfillmentStatus) conditions.push(eq(orders.fulfillmentStatus, fulfillmentStatus))

  const rows = await db.query.orders.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    with: {
      lineItems: true,
      shippingAddress: true,
    },
    orderBy: [desc(orders.createdAt)],
    limit,
    offset: (page - 1) * limit,
  })
  return c.json({ data: rows })
})

app.get('/:id', async (c) => {
  const db = createDb(c.env.DB)
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, c.req.param('id')),
    with: {
      lineItems: true,
      shippingAddress: true,
      billingAddress: true,
      transactions: true,
      timeline: true,
      fulfillments: { with: { items: true } },
    },
  })
  if (!order) return c.json({ error: 'Nije pronađena' }, 404)
  return c.json({ data: order })
})

app.patch('/:id/status', requireRole('owner', 'admin'), async (c) => {
    const db = createDb(c.env.DB)
    const id = c.req.param('id')
    const existing = await db.query.orders.findFirst({ where: eq(orders.id, id) })
    if (!existing) return c.json({ error: 'Nije pronađena' }, 404)

    const parsed = UpdateOrderStatusSchema.safeParse(await c.req.json())
    if (!parsed.success) return c.json({ error: 'Validacija neuspešna', details: parsed.error.flatten() }, 422)
    const { status, paymentStatus, fulfillmentStatus, note } = parsed.data
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() }
    if (status) update.status = status
    if (paymentStatus) update.paymentStatus = paymentStatus
    if (fulfillmentStatus) update.fulfillmentStatus = fulfillmentStatus

    await db.update(orders).set(update).where(eq(orders.id, id))

    // Dodaj u timeline
    const events: string[] = []
    if (status) events.push(`order.status.${status}`)
    if (paymentStatus) events.push(`payment.status.${paymentStatus}`)
    if (fulfillmentStatus) events.push(`fulfillment.status.${fulfillmentStatus}`)

    for (const event of events) {
      await db.insert(orderTimeline).values({
        orderId: id,
        userId: c.get('userId'),
        event,
        body: note,
      })
    }

    return c.json({ data: { ok: true } })
  })

// POST /:id/fulfillments — kreira fulfillment za odabrane stavke
app.post('/:id/fulfillments', requireRole('owner', 'admin'), async (c) => {
  const db = createDb(c.env.DB)
  const id = c.req.param('id')
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, id) })
  if (!existing) return c.json({ error: 'Nije pronađena' }, 404)

  const body = await c.req.json()
  const fulfillmentId = crypto.randomUUID()
  await db.insert(fulfillments).values({ id: fulfillmentId, orderId: id, status: 'pending' })

  if (body.items?.length) {
    for (const item of body.items) {
      await db.insert(fulfillmentItems).values({
        fulfillmentId,
        lineItemId: item.lineItemId,
        quantity: item.quantity,
      })
    }
  }

  await db.update(orders)
    .set({ fulfillmentStatus: 'fulfillment_created', updatedAt: new Date().toISOString() })
    .where(eq(orders.id, id))

  await db.insert(orderTimeline).values({
    orderId: id,
    userId: c.get('userId'),
    event: 'fulfillment.created',
  })

  return c.json({ data: { id: fulfillmentId } }, 201)
})

// PATCH /:id/fulfillments/:fulfillmentId/ship — dodaje tracking
app.patch('/:id/fulfillments/:fulfillmentId/ship', requireRole('owner', 'admin'), async (c) => {
  const db = createDb(c.env.DB)
  const { id, fulfillmentId } = c.req.param()
  const { trackingNumber, trackingUrl } = await c.req.json()

  await db.update(fulfillments)
    .set({ status: 'shipped', trackingNumber, trackingUrl, shippedAt: new Date().toISOString() })
    .where(eq(fulfillments.id, fulfillmentId))

  await db.update(orders)
    .set({ fulfillmentStatus: 'shipped', updatedAt: new Date().toISOString() })
    .where(eq(orders.id, id))

  await db.insert(orderTimeline).values({
    orderId: id,
    userId: c.get('userId'),
    event: 'fulfillment.shipped',
    body: trackingNumber,
  })

  return c.json({ data: { ok: true } })
})

export { app as orderRoutes }
