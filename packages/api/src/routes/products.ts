import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import { createDb } from '../lib/db'
import { authMiddleware, requireRole } from '../middleware/auth'
import {
  CreateProductSchema,
  UpdateProductSchema,
} from '@denic-shop/core/validators'
import {
  products,
  productVariants,
  variantPrices,
  productMedia,
  productOptions,
  productOptionValues,
  productVariantOptions,
  inventoryItems,
  inventoryLevels,
} from '@denic-shop/core/schema'
import { slugify } from '@denic-shop/core/utils'
import type { Env } from '../lib/env'
import type { AuthVariables } from '../middleware/auth'

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>()

app.use('*', authMiddleware)

// GET /products
app.get('/', async (c) => {
  const db = createDb(c.env.DB)
  const rows = await db.query.products.findMany({
    with: {
      variants: { with: { prices: true }, orderBy: (v) => v.sortOrder },
      media: { where: eq(productMedia.isCover, true) },
    },
    orderBy: [desc(products.createdAt)],
  })
  return c.json({ data: rows })
})

// GET /products/:id
app.get('/:id', async (c) => {
  const db = createDb(c.env.DB)
  const product = await db.query.products.findFirst({
    where: eq(products.id, c.req.param('id')),
    with: {
      variants: { with: { prices: true, variantOptions: { with: { optionValue: true } } } },
      media: true,
      options: { with: { values: true } },
    },
  })
  if (!product) return c.json({ error: 'Nije pronađen' }, 404)
  return c.json({ data: product })
})

// POST /products
app.post('/', requireRole('owner', 'admin'), async (c) => {
  const db = createDb(c.env.DB)
  const parsed = CreateProductSchema.safeParse(await c.req.json())
  if (!parsed.success) return c.json({ error: 'Validacija neuspešna', details: parsed.error.flatten() }, 422)
  const { variants, options, ...productData } = parsed.data

  const productId = crypto.randomUUID()
  const slug = productData.slug || slugify(productData.name)

  await db.insert(products).values({
    id: productId,
    ...productData,
    slug,
  })

  // Insert options + values
  for (const opt of options) {
    const optId = opt.id ?? crypto.randomUUID()
    await db.insert(productOptions).values({ id: optId, productId, name: opt.name, sortOrder: opt.sortOrder })
    for (const val of opt.values) {
      await db.insert(productOptionValues).values({
        id: val.id ?? crypto.randomUUID(),
        optionId: optId,
        value: val.value,
        sortOrder: val.sortOrder,
      })
    }
  }

  // Insert variants, prices, inventory
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i]!
    const variantId = v.id ?? crypto.randomUUID()
    await db.insert(productVariants).values({
      id: variantId,
      productId,
      sku: v.sku || `${slug}-${i + 1}`,
      name: v.name || productData.name,
      requiresShipping: v.requiresShipping,
      allowBackorder: v.allowBackorder,
      weight: v.weight,
      weightUnit: v.weightUnit,
      active: v.active,
      sortOrder: v.sortOrder,
    })
    for (const price of v.prices) {
      await db.insert(variantPrices).values({
        variantId,
        currencyCode: price.currencyCode,
        amount: price.amount,
        compareAtAmount: price.compareAtAmount,
      })
    }
    // Inicijalni inventory item (zalihe = 0)
    const invItemId = crypto.randomUUID()
    await db.insert(inventoryItems).values({ id: invItemId, variantId, sku: v.sku || `${slug}-${i + 1}` })
  }

  const created = await db.query.products.findFirst({
    where: eq(products.id, productId),
    with: { variants: { with: { prices: true } }, media: true },
  })
  return c.json({ data: created }, 201)
})

// PATCH /products/:id
app.patch('/:id', requireRole('owner', 'admin'), async (c) => {
  const db = createDb(c.env.DB)
  const id = c.req.param('id')
  const existing = await db.query.products.findFirst({ where: eq(products.id, id) })
  if (!existing) return c.json({ error: 'Nije pronađen' }, 404)

  const parsed = UpdateProductSchema.safeParse(await c.req.json())
  if (!parsed.success) return c.json({ error: 'Validacija neuspešna', details: parsed.error.flatten() }, 422)
  const { variants, options, ...productData } = parsed.data

  if (Object.keys(productData).length > 0) {
    await db.update(products)
      .set({ ...productData, updatedAt: new Date().toISOString() })
      .where(eq(products.id, id))
  }

  if (variants !== undefined) {
    const slug = productData.slug || existing.slug
    // delete+insert za varijante
    const existingVariantIds = (await db.query.productVariants.findMany({
      where: eq(productVariants.productId, id),
      columns: { id: true },
    })).map(v => v.id)

    await db.delete(productVariants).where(eq(productVariants.productId, id))

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i]!
      const variantId = v.id ?? (existingVariantIds[i] ?? crypto.randomUUID())
      await db.insert(productVariants).values({
        id: variantId,
        productId: id,
        sku: v.sku || `${slug}-${i + 1}`,
        name: v.name || (productData.name || existing.name),
        requiresShipping: v.requiresShipping ?? true,
        allowBackorder: v.allowBackorder ?? false,
        weight: v.weight,
        weightUnit: v.weightUnit ?? 'g',
        active: v.active ?? true,
        sortOrder: v.sortOrder ?? i,
      })
      for (const price of v.prices ?? []) {
        await db.insert(variantPrices).values({
          variantId,
          currencyCode: price.currencyCode,
          amount: price.amount,
          compareAtAmount: price.compareAtAmount,
        })
      }
    }
  }

  return c.json({ data: { ok: true } })
})

// DELETE /products/:id
app.delete('/:id', requireRole('owner', 'admin'), async (c) => {
  const db = createDb(c.env.DB)
  const existing = await db.query.products.findFirst({ where: eq(products.id, c.req.param('id')) })
  if (!existing) return c.json({ error: 'Nije pronađen' }, 404)
  await db.delete(products).where(eq(products.id, existing.id))
  return c.json({ data: { ok: true } })
})

// POST /products/:id/media
app.post('/:id/media', requireRole('owner', 'admin'), async (c) => {
  const db = createDb(c.env.DB)
  const productId = c.req.param('id')

  const existing = await db.query.products.findFirst({ where: eq(products.id, productId) })
  if (!existing) return c.json({ error: 'Nije pronađen' }, 404)

  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  if (!file) return c.json({ error: 'Fajl nije prosleđen' }, 400)

  const ext = file.name.split('.').pop() ?? 'jpg'
  const r2Key = `products/${productId}/${crypto.randomUUID()}.${ext}`

  await c.env.MEDIA.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type },
  })

  const isCover = formData.get('isCover') === 'true'
  const mediaId = crypto.randomUUID()
  const url = `/api/v1/media/${r2Key}`

  await db.insert(productMedia).values({
    id: mediaId,
    productId,
    r2Key,
    url,
    alt: (formData.get('alt') as string) || '',
    mimeType: file.type,
    isCover,
  })

  return c.json({ data: { id: mediaId, url, r2Key } }, 201)
})

export { app as productRoutes }
