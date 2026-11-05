import { Hono } from 'hono'
import { eq, and, desc, inArray, notInArray } from 'drizzle-orm'
import { createDb } from '../lib/db'
import { authMiddleware, requireRole } from '../middleware/auth'
import { CreateProductSchema, UpdateProductSchema } from '@denic-shop/core/validators'
import { products, productVariants, productMedia } from '@denic-shop/core/schema'
import { slugify } from '@denic-shop/core/utils'
import type { Env } from '../lib/env'
import type { JwtPayload } from '../lib/auth'

type Variables = { user: JwtPayload }

export const productRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

productRoutes.use('*', authMiddleware)

productRoutes.get('/', async (c) => {
  const { tenantId } = c.get('user')
  const db = createDb(c.env.DB)

  const rows = await db.query.products.findMany({
    where: eq(products.tenantId, tenantId),
    with: { productVariants: true, productMedia: { where: eq(productMedia.isCover, true) } },
    orderBy: [desc(products.createdAt)],
  })

  return c.json({ data: rows })
})

productRoutes.get('/:id', async (c) => {
  const { tenantId } = c.get('user')
  const db = createDb(c.env.DB)

  const product = await db.query.products.findFirst({
    where: and(eq(products.id, c.req.param('id')), eq(products.tenantId, tenantId)),
    with: { productVariants: true, productMedia: true },
  })

  if (!product) return c.json({ error: 'Nije pronađen' }, 404)
  return c.json({ data: product })
})

productRoutes.post('/', requireRole('owner', 'admin'), async (c) => {
  const { tenantId } = c.get('user')
  const body = await c.req.json()
  const result = CreateProductSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Nevalidni podaci', details: result.error.flatten() }, 400)
  }

  const db = createDb(c.env.DB)
  const { variants, ...productData } = result.data

  const productId = crypto.randomUUID()
  await db.insert(products).values({
    id: productId,
    tenantId,
    ...productData,
    slug: productData.slug || slugify(productData.name),
  })

  const variantRows = variants.map((v, i) => ({
    ...v,
    productId,
    // Ako nema varijanti (has_variants=false), generišemo default SKU
    sku: v.sku || `${productData.slug}-${i + 1}`,
    name: v.name || productData.name,
  }))

  await db.insert(productVariants).values(variantRows)

  const created = await db.query.products.findFirst({
    where: eq(products.id, productId),
    with: { productVariants: true },
  })

  return c.json({ data: created }, 201)
})

productRoutes.patch('/:id', requireRole('owner', 'admin'), async (c) => {
  const { tenantId } = c.get('user')
  const body = await c.req.json()
  const result = UpdateProductSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Nevalidni podaci', details: result.error.flatten() }, 400)
  }

  const db = createDb(c.env.DB)
  const existing = await db.query.products.findFirst({
    where: and(eq(products.id, c.req.param('id')), eq(products.tenantId, tenantId)),
  })
  if (!existing) return c.json({ error: 'Nije pronađen' }, 404)

  const { variants, ...productData } = result.data
  await db.update(products)
    .set({ ...productData, updatedAt: new Date().toISOString() })
    .where(eq(products.id, existing.id))

  if (variants && variants.length > 0) {
    const slug = productData.slug || existing.slug
    const productName = productData.name || existing.name

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i]
      const sku = v.sku || `${slug}-${i + 1}`
      const name = v.name || productName

      if (v.id) {
        const variantExists = await db.query.productVariants.findFirst({ where: eq(productVariants.id, v.id) })
        if (variantExists) {
          await db.update(productVariants)
            .set({ sku, name, priceRsd: v.priceRsd, compareAtPriceRsd: v.compareAtPriceRsd ?? null, stock: v.stock, attributes: v.attributes, active: v.active })
            .where(eq(productVariants.id, v.id))
          continue
        }
      }
      await db.insert(productVariants).values({ productId: existing.id, sku, name, priceRsd: v.priceRsd, compareAtPriceRsd: v.compareAtPriceRsd ?? null, stock: v.stock, attributes: v.attributes, active: v.active })
    }

    const keptIds = variants.filter(v => v.id).map(v => v.id as string)
    if (keptIds.length > 0) {
      await db.delete(productVariants).where(and(eq(productVariants.productId, existing.id), notInArray(productVariants.id, keptIds)))
    }
  }

  return c.json({ data: { ok: true } })
})

productRoutes.delete('/:id', requireRole('owner', 'admin'), async (c) => {
  const { tenantId } = c.get('user')
  const db = createDb(c.env.DB)

  const existing = await db.query.products.findFirst({
    where: and(eq(products.id, c.req.param('id')), eq(products.tenantId, tenantId)),
  })
  if (!existing) return c.json({ error: 'Nije pronađen' }, 404)

  await db.delete(products).where(eq(products.id, existing.id))
  return c.json({ data: { ok: true } })
})

// Upload slike na R2
productRoutes.post('/:id/media', requireRole('owner', 'admin'), async (c) => {
  const { tenantId } = c.get('user')
  const db = createDb(c.env.DB)
  const productId = c.req.param('id')

  const existing = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.tenantId, tenantId)),
  })
  if (!existing) return c.json({ error: 'Nije pronađen' }, 404)

  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  if (!file) return c.json({ error: 'Fajl nije prosleđen' }, 400)

  const ext = file.name.split('.').pop() ?? 'jpg'
  const r2Key = `${tenantId}/products/${productId}/${crypto.randomUUID()}.${ext}`

  await c.env.MEDIA.put(r2Key, file.stream(), {
    httpMetadata: { contentType: file.type },
  })

  const isCover = formData.get('isCover') === 'true'
  const mediaId = crypto.randomUUID()

  await db.insert(productMedia).values({
    id: mediaId,
    productId,
    r2Key,
    alt: formData.get('alt') as string | null ?? '',
    isCover,
  })

  return c.json({
    data: {
      id: mediaId,
      url: `/api/v1/media/${r2Key}`,
      r2Key,
    },
  }, 201)
})
