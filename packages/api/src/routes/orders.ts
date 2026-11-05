import { Hono } from 'hono'
import { eq, and, desc, like, or, count } from 'drizzle-orm'
import { createDb } from '../lib/db'
import { authMiddleware } from '../middleware/auth'
import { UpdateOrderStatusSchema, OrderFilterSchema } from '@denic-shop/core/validators'
import { orders, orderItems, payments } from '@denic-shop/core/schema'
import { buildIpsQrString, getIpsQrImageUrl } from '@denic-shop/core/utils'
import type { Env } from '../lib/env'
import type { JwtPayload } from '../lib/auth'

type Variables = { user: JwtPayload }

export const orderRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

orderRoutes.use('*', authMiddleware)

orderRoutes.get('/', async (c) => {
  const { tenantId } = c.get('user')
  const query = OrderFilterSchema.safeParse(c.req.query())
  if (!query.success) return c.json({ error: 'Nevalidni parametri' }, 400)

  const { page, limit, status, search } = query.data
  const offset = (page - 1) * limit
  const db = createDb(c.env.DB)

  const conditions = [eq(orders.tenantId, tenantId)]
  if (status) conditions.push(eq(orders.status, status))
  if (search) {
    conditions.push(
      or(
        like(orders.orderNumber, `%${search}%`),
        like(orders.shippingEmail, `%${search}%`),
        like(orders.shippingName, `%${search}%`)
      )!
    )
  }

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(orders).where(and(...conditions)),
  ])

  return c.json({
    data: rows,
    pagination: { page, limit, total: total ?? 0, totalPages: Math.ceil((total ?? 0) / limit) },
  })
})

orderRoutes.get('/:id', async (c) => {
  const { tenantId } = c.get('user')
  const db = createDb(c.env.DB)

  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, c.req.param('id')), eq(orders.tenantId, tenantId)),
    with: { orderItems: true, payments: true },
  })

  if (!order) return c.json({ error: 'Nije pronađena' }, 404)
  return c.json({ data: order })
})

orderRoutes.patch('/:id/status', async (c) => {
  const { tenantId } = c.get('user')
  const body = await c.req.json()
  const result = UpdateOrderStatusSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Nevalidni podaci', details: result.error.flatten() }, 400)
  }

  const db = createDb(c.env.DB)
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, c.req.param('id')), eq(orders.tenantId, tenantId)),
  })
  if (!order) return c.json({ error: 'Nije pronađena' }, 404)

  await db.update(orders)
    .set({
      status: result.data.status,
      trackingNumber: result.data.trackingNumber ?? order.trackingNumber,
      note: result.data.note ?? order.note,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(orders.id, order.id))

  return c.json({ data: { ok: true } })
})

// Generiše IPS QR string i URL slike za porudžbinu
orderRoutes.get('/:id/ips-qr', async (c) => {
  const { tenantId } = c.get('user')
  const db = createDb(c.env.DB)

  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, c.req.param('id')), eq(orders.tenantId, tenantId)),
  })
  if (!order) return c.json({ error: 'Nije pronađena' }, 404)
  if (order.paymentMethod !== 'ips_qr') {
    return c.json({ error: 'Porudžbina nema IPS QR plaćanje' }, 400)
  }

  // Učitaj konfiguraciju plaćanja tenanta
  const { paymentMethods } = await import('@denic-shop/core/schema')
  const method = await db.query.paymentMethods.findFirst({
    where: and(
      eq(paymentMethods.tenantId, tenantId),
      eq(paymentMethods.type, 'ips_qr'),
      eq(paymentMethods.active, true)
    ),
  })

  if (!method) return c.json({ error: 'IPS QR nije konfigurisan' }, 400)

  const config = method.config as import('@denic-shop/core/types').IpsQrConfig

  const qrString = buildIpsQrString({
    config,
    amount: order.totalRsd,
    orderNumber: order.orderNumber,
  })

  return c.json({
    data: {
      qrString,
      imageUrl: getIpsQrImageUrl(qrString),
      orderNumber: order.orderNumber,
      amount: order.totalRsd,
    },
  })
})

// CSV export
orderRoutes.get('/export/csv', async (c) => {
  const { tenantId } = c.get('user')
  const db = createDb(c.env.DB)

  const rows = await db.select().from(orders)
    .where(eq(orders.tenantId, tenantId))
    .orderBy(desc(orders.createdAt))

  const header = 'Broj,Status,Kupac,Email,Grad,Iznos,Metoda plaćanja,Datum\n'
  const csv = rows.map(o =>
    `"${o.orderNumber}","${o.status}","${o.shippingName}","${o.shippingEmail}","${o.shippingCity}","${o.totalRsd}","${o.paymentMethod}","${o.createdAt}"`
  ).join('\n')

  return new Response(header + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="porudzbine.csv"',
    },
  })
})
