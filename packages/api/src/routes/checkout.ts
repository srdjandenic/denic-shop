import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { createDb } from '../lib/db'
import { CheckoutSchema } from '@denic-shop/core/validators'
import {
  orders,
  orderLineItems,
  orderShippingAddresses,
  orderBillingAddresses,
  orderTimeline,
  orderTransactions,
  productVariants,
  variantPrices,
  inventoryItems,
  inventoryLevels,
  carts,
  idempotencyKeys,
  settings,
} from '@denic-shop/core/schema'
import { buildIpsQrString } from '@denic-shop/core/utils'
import type { Env } from '../lib/env'

const app = new Hono<{ Bindings: Env }>()

// POST /checkout
app.post('/', async (c) => {
  const db = createDb(c.env.DB)
  const parsed = CheckoutSchema.safeParse(await c.req.json())
  if (!parsed.success) return c.json({ error: 'Validacija neuspešna', details: parsed.error.flatten() }, 422)
  const body = parsed.data

  // Idempotency check
  const idempotencyKey = c.req.header('Idempotency-Key')
  if (idempotencyKey) {
    const existing = await db.query.idempotencyKeys.findFirst({
      where: eq(idempotencyKeys.key, idempotencyKey),
    })
    if (existing) {
      return c.json(JSON.parse(existing.responseBody), existing.responseStatus as any)
    }
  }

  // Validacija i cene varijanti
  const lineItemsData: Array<{
    variantId: string
    quantity: number
    productName: string
    variantName: string
    sku: string
    unitPrice: number
    totalPrice: number
    requiresShipping: boolean
  }> = []

  for (const item of body.items) {
    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.id, item.variantId),
      with: {
        prices: true,
        product: true,
      },
    })
    if (!variant) return c.json({ error: `Varijanta nije pronađena: ${item.variantId}` }, 400)

    const price = variant.prices.find(p => p.currencyCode === body.currencyCode)
    if (!price) return c.json({ error: `Nema cene za ${body.currencyCode}: ${item.variantId}` }, 400)

    // Provjera zaliha (bez backorder)
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
      variantId: variant.id,
      quantity: item.quantity,
      productName: (variant as any).product?.name ?? '',
      variantName: variant.name,
      sku: variant.sku,
      unitPrice: price.amount,
      totalPrice: price.amount * item.quantity,
      requiresShipping: variant.requiresShipping,
    })
  }

  const subtotal = lineItemsData.reduce((s, i) => s + i.totalPrice, 0)

  // Generisanje broja porudžbine (prefix iz settings)
  const prefixRow = await db.query.settings.findFirst({ where: eq(settings.key, 'order_number_prefix') })
  const prefix = prefixRow?.value ?? ''
  const countRow = await db.select().from(orders).all()
  const nextNum = String(1001 + countRow.length).padStart(prefix ? 5 : 4, '0')
  const orderNumber = prefix ? `${prefix}-${nextNum}` : nextNum

  const orderId = crypto.randomUUID()

  // Inicijalni payment status zavisi od metode
  const initialPaymentStatus = body.paymentMethod === 'cod' ? 'cod_pending' : 'pending'

  await db.insert(orders).values({
    id: orderId,
    orderNumber,
    currencyCode: body.currencyCode,
    subtotal,
    shippingTotal: 0,
    taxTotal: 0,
    discountTotal: 0,
    total: subtotal,
    paymentMethod: body.paymentMethod,
    paymentStatus: initialPaymentStatus,
    status: 'open',
    fulfillmentStatus: 'unfulfilled',
    notes: body.note,
  })

  // Shipping address
  await db.insert(orderShippingAddresses).values({
    orderId,
    ...body.shippingAddress,
  })

  // Billing address (kopira shipping ako nije prosleđena)
  const billing = body.billingAddress ?? {
    firstName: body.shippingAddress.firstName,
    lastName: body.shippingAddress.lastName,
    street: body.shippingAddress.street,
    city: body.shippingAddress.city,
    postalCode: body.shippingAddress.postalCode,
    country: body.shippingAddress.country,
  }
  await db.insert(orderBillingAddresses).values({ orderId, ...billing })

  // Line items + rezervacija zaliha
  for (const item of lineItemsData) {
    const lineItemId = crypto.randomUUID()
    await db.insert(orderLineItems).values({ id: lineItemId, orderId, ...item })

    // Rezervacija zaliha
    const invItem = await db.query.inventoryItems.findFirst({
      where: eq(inventoryItems.variantId, item.variantId),
      with: { levels: true },
    })
    if (invItem?.levels?.[0]) {
      const lvl = invItem.levels[0]
      await db.update(inventoryLevels)
        .set({ reserved: lvl.reserved + item.quantity })
        .where(eq(inventoryLevels.id, lvl.id))
    }
  }

  await db.insert(orderTimeline).values({
    orderId,
    event: 'order.created',
    body: `Metoda: ${body.paymentMethod}`,
  })

  // IPS QR string za ips_qr metodu
  let ipsQrString: string | undefined
  if (body.paymentMethod === 'ips_qr') {
    ipsQrString = buildIpsQrString({
      config: {
        recipientName: c.env.IPS_RECIPIENT_NAME,
        accountNumber: c.env.IPS_ACCOUNT_NUMBER,
        pib: c.env.IPS_PIB,
        model: c.env.IPS_MODEL,
        referencePrefix: c.env.IPS_REFERENCE_PREFIX,
        bankCode: '',
      },
      amount: Math.round(subtotal / 100),
      orderNumber,
    })

    await db.insert(orderTransactions).values({
      orderId,
      type: 'authorization',
      amount: subtotal,
      currencyCode: body.currencyCode,
      provider: 'ips_qr',
      status: 'pending',
    })

    // Prelaz u awaiting
    await db.update(orders)
      .set({ paymentStatus: 'awaiting' })
      .where(eq(orders.id, orderId))
  }

  const responseData = { orderId, orderNumber, ipsQrString }
  const responseStatus = 201

  if (idempotencyKey) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await db.insert(idempotencyKeys).values({
      key: idempotencyKey,
      requestHash: '',
      responseStatus,
      responseBody: JSON.stringify({ data: responseData }),
      expiresAt,
    }).onConflictDoNothing()
  }

  return c.json({ data: responseData }, responseStatus)
})

export { app as checkoutRoutes }
