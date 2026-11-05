import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { eq } from 'drizzle-orm'
import { createDb } from '../lib/db'
import { authMiddleware, requireRole } from '../middleware/auth'
import { productCategories } from '@denic-shop/core/schema'
import type { Env } from '../lib/env'
import type { AuthVariables } from '../middleware/auth'

const CategorySchema = z.object({
  parentId: z.string().uuid().optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.number().int().default(0),
})

const IdParam = z.object({ id: z.string().uuid() })
const ErrorSchema = z.object({ error: z.string() })
const OkSchema = z.object({ data: z.object({ ok: z.boolean() }) })

const app = new OpenAPIHono<{ Bindings: Env; Variables: AuthVariables }>()
app.use('*', authMiddleware)

const listRoute = createRoute({
  method: 'get', path: '/', tags: ['Categories'],
  responses: { 200: { description: 'Kategorije', content: { 'application/json': { schema: z.object({ data: z.array(z.any()) }) } } } },
})
app.openapi(listRoute, async (c) => {
  const db = createDb(c.env.DB)
  const rows = await db.query.productCategories.findMany({
    with: { children: true },
    orderBy: (t) => t.sortOrder,
  })
  return c.json({ data: rows } as never)
})

const createRoute_ = createRoute({
  method: 'post', path: '/', tags: ['Categories'],
  middleware: [requireRole('owner', 'admin')] as const,
  request: { body: { content: { 'application/json': { schema: CategorySchema } } } },
  responses: {
    201: { description: 'Kreirana', content: { 'application/json': { schema: z.object({ data: z.any() }) } } },
  },
})
app.openapi(createRoute_, async (c) => {
  const db = createDb(c.env.DB)
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  await db.insert(productCategories).values({ id, ...data })
  return c.json({ data: { id, ...data } }, 201)
})

const patchRoute = createRoute({
  method: 'patch', path: '/{id}', tags: ['Categories'],
  middleware: [requireRole('owner', 'admin')] as const,
  request: {
    params: IdParam,
    body: { content: { 'application/json': { schema: CategorySchema.partial() } } },
  },
  responses: {
    200: { description: 'Ažurirana', content: { 'application/json': { schema: OkSchema } } },
    404: { description: 'Nije pronađena', content: { 'application/json': { schema: ErrorSchema } } },
  },
})
app.openapi(patchRoute, async (c) => {
  const db = createDb(c.env.DB)
  const { id } = c.req.valid('param')
  const existing = await db.query.productCategories.findFirst({ where: eq(productCategories.id, id) })
  if (!existing) return c.json({ error: 'Nije pronađena' }, 404)
  await db.update(productCategories).set(c.req.valid('json')).where(eq(productCategories.id, id))
  return c.json({ data: { ok: true as const } }, 200)
})

const deleteRoute = createRoute({
  method: 'delete', path: '/{id}', tags: ['Categories'],
  middleware: [requireRole('owner', 'admin')] as const,
  request: { params: IdParam },
  responses: {
    200: { description: 'Obrisana', content: { 'application/json': { schema: OkSchema } } },
    404: { description: 'Nije pronađena', content: { 'application/json': { schema: ErrorSchema } } },
  },
})
app.openapi(deleteRoute, async (c) => {
  const db = createDb(c.env.DB)
  const { id } = c.req.valid('param')
  const existing = await db.query.productCategories.findFirst({ where: eq(productCategories.id, id) })
  if (!existing) return c.json({ error: 'Nije pronađena' }, 404)
  await db.delete(productCategories).where(eq(productCategories.id, id))
  return c.json({ data: { ok: true as const } }, 200)
})

export { app as categoryRoutes }
