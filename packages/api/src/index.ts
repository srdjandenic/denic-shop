import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes } from './routes/auth'
import { productRoutes } from './routes/products'
import { orderRoutes } from './routes/orders'
import { checkoutRoutes } from './routes/checkout'
import { categoryRoutes } from './routes/categories'
import { mediaRoutes } from './routes/media'
import { settingsRoutes } from './routes/settings'
import type { Env } from './lib/env'

const app = new OpenAPIHono<{ Bindings: Env }>()

app.use('*', logger())
app.use('*', cors({
  origin: (origin) => origin,
  credentials: true,
}))

app.get('/health', (c) => c.json({ ok: true, version: '0.2.0' }))

// Better Auth handles all /api/auth/* routes
app.route('/api/auth', authRoutes)

app.route('/api/v1/products', productRoutes)
app.route('/api/v1/orders', orderRoutes)
app.route('/api/v1/checkout', checkoutRoutes)
app.route('/api/v1/categories', categoryRoutes)
app.route('/api/v1/media', mediaRoutes)
app.route('/api/v1/settings', settingsRoutes)

// OpenAPI dokumentacija
app.doc('/doc', {
  openapi: '3.0.0',
  info: { title: 'denic-shop API', version: '0.2.0' },
})

app.notFound((c) => c.json({ error: 'Ruta nije pronađena' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Interna greška servera' }, 500)
})

export default app
