import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { createDb } from '../lib/db'
import { products, productVariants, productMedia, categories, tenants } from '@denic-shop/core/schema'

export const storefrontRoutes = new Hono<{ Bindings: { DB: D1Database; R2_PUBLIC_URL: string } }>()

// Helper: tenant po hostu
async function getTenant(c: Parameters<typeof storefrontRoutes.get>[1], db: ReturnType<typeof createDb>) {
  const host = c.req.header('host') ?? ''
  return db.query.tenants.findFirst({ where: eq(tenants.domain, host) })
}

storefrontRoutes.get('/catalog', async (c) => {
  const db = createDb(c.env.DB)
  const tenant = await getTenant(c, db)
  if (!tenant) return c.json({ error: 'Nije pronađeno' }, 404)

  const rows = await db.query.products.findMany({
    where: and(eq(products.tenantId, tenant.id), eq(products.published, true)),
    with: {
      productVariants: { where: eq(productVariants.active, true) },
      productMedia: { where: eq(productMedia.isCover, true) },
      categories: true,
    },
  })

  return c.json({ data: rows })
})

storefrontRoutes.get('/products/:slug', async (c) => {
  const db = createDb(c.env.DB)
  const tenant = await getTenant(c, db)
  if (!tenant) return c.json({ error: 'Nije pronađeno' }, 404)

  const product = await db.query.products.findFirst({
    where: and(
      eq(products.tenantId, tenant.id),
      eq(products.slug, c.req.param('slug')),
      eq(products.published, true)
    ),
    with: {
      productVariants: { where: eq(productVariants.active, true) },
      productMedia: true,
      categories: true,
    },
  })

  if (!product) return c.json({ error: 'Nije pronađen' }, 404)
  return c.json({ data: product })
})

storefrontRoutes.get('/categories', async (c) => {
  const db = createDb(c.env.DB)
  const tenant = await getTenant(c, db)
  if (!tenant) return c.json({ error: 'Nije pronađeno' }, 404)

  const rows = await db.query.categories.findMany({
    where: eq(categories.tenantId, tenant.id),
  })
  return c.json({ data: rows })
})
