import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { eq, desc } from 'drizzle-orm'
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
} from '@denic-shop/core/schema'
import { slugify } from '@denic-shop/core/utils'
import type { Env } from '../lib/env'
import type { AuthVariables } from '../middleware/auth'

const app = new OpenAPIHono<{ Bindings: Env; Variables: AuthVariables }>()

app.use('*', authMiddleware)

// ── Zod schemas za OpenAPI ──────────────────────────────────────────────────

const VariantPriceSchema = z.object({
  currencyCode: z.enum(['RSD', 'EUR']),
  amount: z.number().int(),
  compareAtAmount: z.number().int().optional(),
})

const VariantSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().optional(),
  name: z.string().optional(),
  requiresShipping: z.boolean().default(true),
  allowBackorder: z.boolean().default(false),
  weight: z.number().int().optional(),
  weightUnit: z.enum(['g', 'kg']).default('g'),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  prices: z.array(VariantPriceSchema).min(1),
})

const ProductBodySchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  productType: z.enum(['physical', 'digital', 'service']).default('physical'),
  categoryId: z.string().uuid().optional(),
  variants: z.array(VariantSchema).min(1),
  options: z.array(z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1),
    sortOrder: z.number().int().default(0),
    values: z.array(z.object({
      id: z.string().uuid().optional(),
      value: z.string().min(1),
      sortOrder: z.number().int().default(0),
    })).default([]),
  })).default([]),
})

const ProductPatchSchema = ProductBodySchema.partial()

const ProductIdParam = z.object({ id: z.string().uuid() })

const ErrorSchema = z.object({ error: z.string() })

// ── Routes ──────────────────────────────────────────────────────────────────

const listRoute = createRoute({
  method: 'get', path: '/',
  tags: ['Products'],
  responses: { 200: { description: 'Lista proizvoda', content: { 'application/json': { schema: z.object({ data: z.array(z.any()) }) } } } },
})
app.openapi(listRoute, async (c) => {
  const db = createDb(c.env.DB)
  const rows = await db.query.products.findMany({
    with: {
      variants: { with: { prices: true }, orderBy: (v) => v.sortOrder },
      media: { where: eq(productMedia.isCover, true) },
    },
    orderBy: [desc(products.createdAt)],
  })
  return c.json({ data: rows } as never)
})

const getRoute = createRoute({
  method: 'get', path: '/{id}',
  tags: ['Products'],
  request: { params: ProductIdParam },
  responses: {
    200: { description: 'Proizvod', content: { 'application/json': { schema: z.object({ data: z.any() }) } } },
    404: { description: 'Nije pronađen', content: { 'application/json': { schema: ErrorSchema } } },
  },
})
app.openapi(getRoute, async (c) => {
  const db = createDb(c.env.DB)
  const { id } = c.req.valid('param')
  const product = await db.query.products.findFirst({
    where: eq(products.id, id),
    with: {
      variants: { with: { prices: true, variantOptions: { with: { optionValue: true } } } },
      media: true,
      options: { with: { values: true } },
    },
  })
  if (!product) return c.json({ error: 'Nije pronađen' }, 404)
  return c.json({ data: product } as never)
})

const createRoute_ = createRoute({
  method: 'post', path: '/',
  tags: ['Products'],
  middleware: [requireRole('owner', 'admin')] as const,
  request: { body: { content: { 'application/json': { schema: ProductBodySchema } } } },
  responses: {
    201: { description: 'Kreiran', content: { 'application/json': { schema: z.object({ data: z.any() }) } } },
    422: { description: 'Validacija', content: { 'application/json': { schema: ErrorSchema } } },
  },
})
app.openapi(createRoute_, async (c) => {
  const db = createDb(c.env.DB)
  const { variants, options, ...productData } = c.req.valid('json')

  const productId = crypto.randomUUID()
  const slug = productData.slug || slugify(productData.name)

  await db.insert(products).values({ id: productId, ...productData, slug })

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

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i]!
    const variantId = v.id ?? crypto.randomUUID()
    await db.insert(productVariants).values({
      id: variantId, productId,
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
        variantId, currencyCode: price.currencyCode,
        amount: price.amount, compareAtAmount: price.compareAtAmount,
      })
    }
    const invItemId = crypto.randomUUID()
    await db.insert(inventoryItems).values({ id: invItemId, variantId, sku: v.sku || `${slug}-${i + 1}` })
  }

  const created = await db.query.products.findFirst({
    where: eq(products.id, productId),
    with: { variants: { with: { prices: true } }, media: true },
  })
  return c.json({ data: created } as never, 201)
})

const patchRoute = createRoute({
  method: 'patch', path: '/{id}',
  tags: ['Products'],
  middleware: [requireRole('owner', 'admin')] as const,
  request: {
    params: ProductIdParam,
    body: { content: { 'application/json': { schema: ProductPatchSchema } } },
  },
  responses: {
    200: { description: 'Ažuriran', content: { 'application/json': { schema: z.object({ data: z.object({ ok: z.boolean() }) }) } } },
    404: { description: 'Nije pronađen', content: { 'application/json': { schema: ErrorSchema } } },
  },
})
app.openapi(patchRoute, async (c) => {
  const db = createDb(c.env.DB)
  const { id } = c.req.valid('param')
  const existing = await db.query.products.findFirst({ where: eq(products.id, id) })
  if (!existing) return c.json({ error: 'Nije pronađen' }, 404)

  const { variants, options, ...productData } = c.req.valid('json')

  if (Object.keys(productData).length > 0) {
    await db.update(products)
      .set({ ...productData, updatedAt: new Date().toISOString() })
      .where(eq(products.id, id))
  }

  if (variants !== undefined) {
    const slug = productData.slug || existing.slug
    const existingVariantIds = (await db.query.productVariants.findMany({
      where: eq(productVariants.productId, id),
      columns: { id: true },
    })).map(v => v.id)

    await db.delete(productVariants).where(eq(productVariants.productId, id))

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i]!
      const variantId = v.id ?? (existingVariantIds[i] ?? crypto.randomUUID())
      await db.insert(productVariants).values({
        id: variantId, productId: id,
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
          variantId, currencyCode: price.currencyCode,
          amount: price.amount, compareAtAmount: price.compareAtAmount,
        })
      }
    }
  }

  return c.json({ data: { ok: true as const } }, 200)
})

const deleteRoute = createRoute({
  method: 'delete', path: '/{id}',
  tags: ['Products'],
  middleware: [requireRole('owner', 'admin')] as const,
  request: { params: ProductIdParam },
  responses: {
    200: { description: 'Obrisan', content: { 'application/json': { schema: z.object({ data: z.object({ ok: z.boolean() }) }) } } },
    404: { description: 'Nije pronađen', content: { 'application/json': { schema: ErrorSchema } } },
  },
})
app.openapi(deleteRoute, async (c) => {
  const db = createDb(c.env.DB)
  const { id } = c.req.valid('param')
  const existing = await db.query.products.findFirst({ where: eq(products.id, id) })
  if (!existing) return c.json({ error: 'Nije pronađen' }, 404)
  await db.delete(products).where(eq(products.id, id))
  return c.json({ data: { ok: true as const } }, 200)
})

// Media upload ostaje kao regularni Hono endpoint (multipart/form-data)
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
    id: mediaId, productId, r2Key, url,
    alt: (formData.get('alt') as string) || '',
    mimeType: file.type, isCover,
  })

  return c.json({ data: { id: mediaId, url, r2Key } }, 201)
})

export { app as productRoutes }
