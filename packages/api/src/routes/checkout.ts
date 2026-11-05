import { Hono } from 'hono'
import { eq, and, inArray } from 'drizzle-orm'
import { createDb } from '../lib/db'
import { CheckoutSchema } from '@denic-shop/core/validators'
import { buildIpsQrString, getIpsQrImageUrl, generateOrderNumber } from '@denic-shop/core/utils'
import {
  orders, orderItems, payments, paymentMethods,
  customers, productVariants, products,
} from '@denic-shop/core/schema'
import type { Env } from '../lib/env'
import type { IpsQrConfig } from '@denic-shop/core/types'

export const checkoutRoutes = new Hono<{ Bindings: Env }>()

checkoutRoutes.post('/', async (c) => {
  // Tenant se identifikuje po domenu (hostname)
  const host = c.req.header('host') ?? ''
  const db = createDb(c.env.DB)

  const { tenants } = await import('@denic-shop/core/schema')
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.domain, host),
  })
  if (!tenant) return c.json({ error: 'Prodavnica nije pronađena' }, 404)

  const body = await c.req.json()
  const result = CheckoutSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Nevalidni podaci', details: result.error.flatten() }, 400)
  }

  const { email, name, phone, address, paymentMethod, note, items } = result.data

  // Validacija i cena varijanti
  const variantIds = items.map(i => i.variantId)
  const variantRows = await db.query.productVariants.findMany({
    where: and(
      inArray(productVariants.id, variantIds),
      eq(productVariants.active, true)
    ),
    with: { products: true },
  })

  if (variantRows.length !== items.length) {
    return c.json({ error: 'Jedan ili više proizvoda nije dostupno' }, 400)
  }

  // Proverava zalihe i gradi order items
  const orderItemData: typeof orderItems.$inferInsert[] = []
  let subtotal = 0

  for (const item of items) {
    const variant = variantRows.find(v => v.id === item.variantId)!
    if (variant.stock < item.quantity) {
      return c.json({ error: `Nema dovoljno na stanju: ${variant.name}` }, 400)
    }
    const lineTotal = variant.priceRsd * item.quantity
    subtotal += lineTotal
    orderItemData.push({
      orderId: '',
      productId: variant.productId,
      variantId: variant.id,
      productName: variant.products.name,
      variantName: variant.name,
      sku: variant.sku,
      unitPriceRsd: variant.priceRsd,
      quantity: item.quantity,
      totalRsd: lineTotal,
    })
  }

  const settings = tenant.settings as import('@denic-shop/core/schema').TenantSettings
  const shippingRsd = settings.freeShippingAboveRsd && subtotal >= settings.freeShippingAboveRsd
    ? 0
    : settings.shippingFlatRsd
  const totalRsd = subtotal + shippingRsd

  // Generiši order number (broj porudžbina + 1)
  const [{ cnt }] = await db.select({ cnt: orders.id }).from(orders)
    .where(eq(orders.tenantId, tenant.id))
  const sequence = (Array.isArray(cnt) ? cnt.length : 0) + 1
  const orderNumber = generateOrderNumber('DS', sequence)

  // Upsert customer
  let customer = await db.query.customers.findFirst({
    where: and(eq(customers.email, email), eq(customers.tenantId, tenant.id)),
  })
  if (!customer) {
    const customerId = crypto.randomUUID()
    await db.insert(customers).values({
      id: customerId,
      tenantId: tenant.id,
      email,
      name,
      phone,
    })
    customer = await db.query.customers.findFirst({ where: eq(customers.id, customerId) })
  }

  const orderId = crypto.randomUUID()

  await db.insert(orders).values({
    id: orderId,
    tenantId: tenant.id,
    customerId: customer!.id,
    orderNumber,
    paymentMethod,
    subtotalRsd: subtotal,
    shippingRsd,
    totalRsd,
    shippingName: address.fullName,
    shippingStreet: address.street,
    shippingCity: address.city,
    shippingPostalCode: address.postalCode,
    shippingCountry: address.country,
    shippingPhone: phone,
    shippingEmail: email,
    note,
  })

  await db.insert(orderItems).values(
    orderItemData.map(item => ({ ...item, orderId }))
  )

  await db.insert(payments).values({
    orderId,
    type: paymentMethod,
    status: paymentMethod === 'cod' ? 'pending' : 'pending',
    amountRsd: totalRsd,
  })

  // Smanji zalihe
  for (const item of items) {
    const variant = variantRows.find(v => v.id === item.variantId)!
    await db.update(productVariants)
      .set({ stock: variant.stock - item.quantity })
      .where(eq(productVariants.id, variant.id))
  }

  // IPS QR za odgovor (ako je metoda ips_qr)
  let ipsQr: { qrString: string; imageUrl: string } | null = null
  if (paymentMethod === 'ips_qr') {
    const method = await db.query.paymentMethods.findFirst({
      where: and(
        eq(paymentMethods.tenantId, tenant.id),
        eq(paymentMethods.type, 'ips_qr'),
        eq(paymentMethods.active, true)
      ),
    })
    if (method) {
      const config = method.config as IpsQrConfig
      const qrString = buildIpsQrString({ config, amount: totalRsd, orderNumber })
      ipsQr = { qrString, imageUrl: getIpsQrImageUrl(qrString) }
    }
  }

  return c.json({
    data: {
      orderId,
      orderNumber,
      totalRsd,
      paymentMethod,
      ipsQr,
    },
  }, 201)
})
