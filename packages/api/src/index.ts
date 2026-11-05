import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes } from './routes/auth'
import { productRoutes } from './routes/products'
import { orderRoutes } from './routes/orders'
import { checkoutRoutes } from './routes/checkout'
import { storefrontRoutes } from './routes/storefront'
import { categoryRoutes } from './routes/categories'
import { settingsRoutes } from './routes/settings'
import { userRoutes } from './routes/users'
import type { Env } from './lib/env'

const app = new Hono<{ Bindings: Env }>()

app.use('*', logger())
app.use('*', cors({
  origin: (origin) => origin, // Per-tenant CORS — u produkciji ograniči na tenant domen
  credentials: true,
}))

app.get('/health', (c) => c.json({ ok: true, version: '0.1.0' }))

app.route('/api/v1/auth', authRoutes)
app.route('/api/v1/products', productRoutes)
app.route('/api/v1/orders', orderRoutes)
app.route('/api/v1/checkout', checkoutRoutes)
app.route('/api/v1/storefront', storefrontRoutes)
app.route('/api/v1/categories', categoryRoutes)
app.route('/api/v1/settings', settingsRoutes)
app.route('/api/v1/users', userRoutes)

app.notFound((c) => c.json({ error: 'Ruta nije pronađena' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Interna greška servera' }, 500)
})

export default app
