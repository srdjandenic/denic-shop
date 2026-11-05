import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { eq } from 'drizzle-orm'
import { createDb } from '../lib/db'
import { PAYMENT_METHODS } from '@denic-shop/core/schema'
import {
  orders, orderLineItems, orderShippingAddresses, orderBillingAddresses,
  orderTimeline, orderTransactions, productVariants, variantPrices,
  inventoryItems, inventoryLevels, idempotencyKeys, settings,
} from '@denic-shop/core/schema'
import { buildIpsQrString } from '@denic-shop/core/utils'
import type { Env } from '../lib/env'

const ShippingAddressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  company: z.string().optional(),
  street: z.string().min(1),
  city: z.string().min(1),
  postalCode: z.string().min(4),
  country: z.string().length(2).default('RS'),
  phone: z.string().optional(),
  email: z.string().email(),
})

const BillingAddressSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  companyName: z.string().optional(),
  pib: z.string().optional(),
  mb: z.string().optional(),
  street: z.string().min(1),
  city: z.string().min(1),
  postalCode: z.string().min(4),
  country: z.string().length(2).default('RS'),
})

const CheckoutBodySchema = z.object({
  currencyCode: z.enum(['RSD', 'EUR']).default('RSD'),
  shippingAddress: ShippingAddressSchema,
  billingAddress: BillingAddressSchema.optional(),
  shippingZoneRateId: z.string().uuid().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  note: z.string().optional(),
  items: z.array(z.object({
    variantId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
})

const ErrorSchema = z.object({ error: z.string() })

const app = new OpenAPIHono<{ Bindings: Env }>()

const checkoutRoute = createRoute({
  method: 'post', path: '/', tags: ['Checkout'],
  request: { body: { content: { 'application/json': { schema: CheckoutBodySchema } } } },
  responses: {
    201: { description: 'Porudžbina kreirana', content: { 'application/json': { schema: z.object({ data: z.object({ orderId: z.string(), orderNumber: z.string(), ipsQrString: z.string().optional() }) }) } } },
    400: { description: 'Greška', content: { 'application/json': { schema: ErrorSchema } } },
    422: { description: 'Validacija', content: { 'application/json': { schema: ErrorSchema } } },
  },
})
app.openapi(checkoutRoute, async (c) => {
  const db = createDb(c.env.DB)
  const body = c.req.valid('json')

  // Idempotency check
  const idempotencyKey = c.req.header('Idempotency-Key')
  if (idempotencyKey) {
    const existing = await db.query.idempotencyKeys.findFirst({ where: eq(idempotencyKeys.key, idempotencyKey) })
    if (existing) {
      return c.json(JSON.parse(existing.responseBody), existing.responseStatus as any)
    }
  }

  // Validacija varijanti i cena
  const lineItemsData: Array<{
    variantId: string; quantity: number; productName: string; variantName: string
    sku: string; unitPrice: number; totalPrice: number; requiresShipping: boolean
  }> = []

  for (const item of body.items) {
    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.id, item.variantId),
      with: { prices: true, product: true },
    })
    if (!variant) return c.json({ error: `Varijanta nije pronađena: ${item.variantId}` }, 400)

    const price = variant.prices.find(p => p.currencyCode === body.currencyCode)
    if (!price) return c.json({ error: `Nema cene za ${body.currencyCode}: ${item.variantId}` }, 400)

    if (!variant.allowBackorder) {
      const invItem = await db.query.inventoryItems.findFirst({
        where: eq(inventoryItems.variantId, variant.id),
        with: { levels: true },
      })
      const available = invItem?.levels.reduce((sum, l) => sum + l.onHand - l.reserved, 0) ?? 0
      if (available < item.quantity) {
        return c.json({ error: `Nedovoljne zalihe: ${variant.sku}` }, 400)
      }
    }

    lineItemsData.push({
      variantId: variant.id, quantity: item.quantity,
      productName: (variant as any).product?.name ?? '',
      variantName: variant.name, sku: variant.sku,
      unitPrice: price.amount, totalPrice: price.amount * item.quantity,
      requiresShipping: variant.requiresShipping,
    })
  }

  const subtotal = lineItemsData.reduce((s, i) => s + i.totalPrice, 0)

  // Broj porudžbine
  const prefixRow = await db.query.settings.findFirst({ where: eq(settings.key, 'order_number_prefix') })
  const prefix = prefixRow?.value ?? ''
  const countRow = await db.select().from(orders).all()
  const nextNum = String(1001 + countRow.length).padStart(prefix ? 5 : 4, '0')
  const orderNumber = prefix ? `${prefix}-${nextNum}` : nextNum

  const orderId = crypto.randomUUID()
  const initialPaymentStatus = body.paymentMethod === 'cod' ? 'cod_pending' : 'pending'

  await db.insert(orders).values({
    id: orderId, orderNumber, currencyCode: body.currencyCode,
    subtotal, shippingTotal: 0, taxTotal: 0, discountTotal: 0, total: subtotal,
    paymentMethod: body.paymentMethod, paymentStatus: initialPaymentStatus,
    status: 'open', fulfillmentStatus: 'unfulfilled', notes: body.note,
  })

  await db.insert(orderShippingAddresses).values({ orderId, ...body.shippingAddress })

  const billing = body.billingAddress ?? {
    firstName: body.shippingAddress.firstName, lastName: body.shippingAddress.lastName,
    street: body.shippingAddress.street, city: body.shippingAddress.city,
    postalCode: body.shippingAddress.postalCode, country: body.shippingAddress.country,
  }
  await db.insert(orderBillingAddresses).values({ orderId, ...billing })

  for (const item of lineItemsData) {
    await db.insert(orderLineItems).values({ id: crypto.randomUUID(), orderId, ...item })

    const invItem = await db.query.inventoryItems.findFirst({
      where: eq(inventoryItems.variantId, item.variantId),
      with: { levels: true },
    })
    if (invItem?.levels?.[0]) {
      const lvl = invItem.levels[0]!
      await db.update(inventoryLevels)
        .set({ reserved: lvl.reserved + item.quantity })
        .where(eq(inventoryLevels.id, lvl.id))
    }
  }

  await db.insert(orderTimeline).values({ orderId, event: 'order.created', body: `Metoda: ${body.paymentMethod}` })

  let ipsQrString: string | undefined
  if (body.paymentMethod === 'ips_qr') {
    ipsQrString = buildIpsQrString({
      config: {
        recipientName: c.env.IPS_RECIPIENT_NAME, accountNumber: c.env.IPS_ACCOUNT_NUMBER,
        pib: c.env.IPS_PIB, model: c.env.IPS_MODEL, referencePrefix: c.env.IPS_REFERENCE_PREFIX,
        bankCode: '',
      },
      amount: Math.round(subtotal / 100), orderNumber,
    })

    await db.insert(orderTransactions).values({
      orderId, type: 'authorization', amount: subtotal,
      currencyCode: body.currencyCode, provider: 'ips_qr', status: 'pending',
    })
    await db.update(orders).set({ paymentStatus: 'awaiting' }).where(eq(orders.id, orderId))
  }

  const responseData = { orderId, orderNumber, ipsQrString }

  if (idempotencyKey) {
    await db.insert(idempotencyKeys).values({
      key: idempotencyKey, requestHash: '', responseStatus: 201,
      responseBody: JSON.stringify({ data: responseData }),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }).onConflictDoNothing()
  }

  return c.json({ data: responseData }, 201)
})

export { app as checkoutRoutes }
