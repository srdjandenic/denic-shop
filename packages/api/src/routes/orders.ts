import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { eq, desc, and } from 'drizzle-orm'
import { createDb } from '../lib/db'
import { authMiddleware, requireRole } from '../middleware/auth'
import { ORDER_STATUSES, PAYMENT_STATUSES, FULFILLMENT_STATUSES } from '@denic-shop/core/schema'
import { orders, orderTimeline, fulfillments, fulfillmentItems } from '@denic-shop/core/schema'
import type { Env } from '../lib/env'
import type { AuthVariables } from '../middleware/auth'

const ErrorSchema = z.object({ error: z.string() })
const OkSchema = z.object({ data: z.object({ ok: z.boolean() }) })
const IdParam = z.object({ id: z.string().uuid() })

const OrderFilterSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  fulfillmentStatus: z.enum(FULFILLMENT_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

const UpdateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  fulfillmentStatus: z.enum(FULFILLMENT_STATUSES).optional(),
  note: z.string().optional(),
}).refine(d => d.status || d.paymentStatus || d.fulfillmentStatus, {
  message: 'Potreban je bar jedan status polje',
})

const app = new OpenAPIHono<{ Bindings: Env; Variables: AuthVariables }>()
app.use('*', authMiddleware)

const listRoute = createRoute({
  method: 'get', path: '/', tags: ['Orders'],
  request: { query: OrderFilterSchema },
  responses: { 200: { description: 'Lista porudžbina', content: { 'application/json': { schema: z.object({ data: z.array(z.any()) }) } } } },
})
app.openapi(listRoute, async (c) => {
  const db = createDb(c.env.DB)
  const { status, paymentStatus, fulfillmentStatus, page, limit } = c.req.valid('query')

  const conditions = []
  if (status) conditions.push(eq(orders.status, status))
  if (paymentStatus) conditions.push(eq(orders.paymentStatus, paymentStatus))
  if (fulfillmentStatus) conditions.push(eq(orders.fulfillmentStatus, fulfillmentStatus))

  const rows = await db.query.orders.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    with: { lineItems: true, shippingAddress: true },
    orderBy: [desc(orders.createdAt)],
    limit,
    offset: (page - 1) * limit,
  })
  return c.json({ data: rows } as never)
})

const getRoute = createRoute({
  method: 'get', path: '/{id}', tags: ['Orders'],
  request: { params: IdParam },
  responses: {
    200: { description: 'Porudžbina', content: { 'application/json': { schema: z.object({ data: z.any() }) } } },
    404: { description: 'Nije pronađena', content: { 'application/json': { schema: ErrorSchema } } },
  },
})
app.openapi(getRoute, async (c) => {
  const db = createDb(c.env.DB)
  const { id } = c.req.valid('param')
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      lineItems: true, shippingAddress: true, billingAddress: true,
      transactions: true, timeline: true,
      fulfillments: { with: { items: true } },
    },
  })
  if (!order) return c.json({ error: 'Nije pronađena' }, 404)
  return c.json({ data: order } as never)
})

const statusRoute = createRoute({
  method: 'patch', path: '/{id}/status', tags: ['Orders'],
  middleware: [requireRole('owner', 'admin')] as const,
  request: {
    params: IdParam,
    body: { content: { 'application/json': { schema: UpdateOrderStatusSchema } } },
  },
  responses: {
    200: { description: 'Ažuriran', content: { 'application/json': { schema: OkSchema } } },
    404: { description: 'Nije pronađena', content: { 'application/json': { schema: ErrorSchema } } },
  },
})
app.openapi(statusRoute, async (c) => {
  const db = createDb(c.env.DB)
  const { id } = c.req.valid('param')
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, id) })
  if (!existing) return c.json({ error: 'Nije pronađena' }, 404)

  const { status, paymentStatus, fulfillmentStatus, note } = c.req.valid('json')
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (status) update.status = status
  if (paymentStatus) update.paymentStatus = paymentStatus
  if (fulfillmentStatus) update.fulfillmentStatus = fulfillmentStatus

  await db.update(orders).set(update).where(eq(orders.id, id))

  const events: string[] = []
  if (status) events.push(`order.status.${status}`)
  if (paymentStatus) events.push(`payment.status.${paymentStatus}`)
  if (fulfillmentStatus) events.push(`fulfillment.status.${fulfillmentStatus}`)

  for (const event of events) {
    await db.insert(orderTimeline).values({ orderId: id, userId: c.get('userId'), event, body: note })
  }

  return c.json({ data: { ok: true as const } }, 200)
})

const FulfillmentBodySchema = z.object({
  items: z.array(z.object({
    lineItemId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).optional(),
})

const createFulfillmentRoute = createRoute({
  method: 'post', path: '/{id}/fulfillments', tags: ['Orders'],
  middleware: [requireRole('owner', 'admin')] as const,
  request: {
    params: IdParam,
    body: { content: { 'application/json': { schema: FulfillmentBodySchema } } },
  },
  responses: {
    201: { description: 'Kreiran fulfillment', content: { 'application/json': { schema: z.object({ data: z.object({ id: z.string() }) }) } } },
    404: { description: 'Nije pronađena', content: { 'application/json': { schema: ErrorSchema } } },
  },
})
app.openapi(createFulfillmentRoute, async (c) => {
  const db = createDb(c.env.DB)
  const { id } = c.req.valid('param')
  const existing = await db.query.orders.findFirst({ where: eq(orders.id, id) })
  if (!existing) return c.json({ error: 'Nije pronađena' }, 404)

  const { items } = c.req.valid('json')
  const fulfillmentId = crypto.randomUUID()
  await db.insert(fulfillments).values({ id: fulfillmentId, orderId: id, status: 'pending' })

  if (items?.length) {
    for (const item of items) {
      await db.insert(fulfillmentItems).values({ fulfillmentId, lineItemId: item.lineItemId, quantity: item.quantity })
    }
  }

  await db.update(orders)
    .set({ fulfillmentStatus: 'fulfillment_created', updatedAt: new Date().toISOString() })
    .where(eq(orders.id, id))

  await db.insert(orderTimeline).values({ orderId: id, userId: c.get('userId'), event: 'fulfillment.created' })

  return c.json({ data: { id: fulfillmentId } }, 201)
})

const ShipBodySchema = z.object({
  trackingNumber: z.string().min(1),
  trackingUrl: z.string().url().optional(),
})

const FulfillmentParams = z.object({ id: z.string().uuid(), fulfillmentId: z.string().uuid() })

const shipRoute = createRoute({
  method: 'patch', path: '/{id}/fulfillments/{fulfillmentId}/ship', tags: ['Orders'],
  middleware: [requireRole('owner', 'admin')] as const,
  request: {
    params: FulfillmentParams,
    body: { content: { 'application/json': { schema: ShipBodySchema } } },
  },
  responses: {
    200: { description: 'Poslato', content: { 'application/json': { schema: OkSchema } } },
  },
})
app.openapi(shipRoute, async (c) => {
  const db = createDb(c.env.DB)
  const { id, fulfillmentId } = c.req.valid('param')
  const { trackingNumber, trackingUrl } = c.req.valid('json')

  await db.update(fulfillments)
    .set({ status: 'shipped', trackingNumber, trackingUrl, shippedAt: new Date().toISOString() })
    .where(eq(fulfillments.id, fulfillmentId))

  await db.update(orders)
    .set({ fulfillmentStatus: 'shipped', updatedAt: new Date().toISOString() })
    .where(eq(orders.id, id))

  await db.insert(orderTimeline).values({ orderId: id, userId: c.get('userId'), event: 'fulfillment.shipped', body: trackingNumber })

  return c.json({ data: { ok: true as const } }, 200)
})

export { app as orderRoutes }
