import { Hono } from 'hono'
import { createAuth } from '../lib/auth'
import type { Env } from '../lib/env'

const app = new Hono<{ Bindings: Env }>()

// Better Auth hvata sve /auth/* rute
app.all('/*', async (c) => {
  const auth = createAuth(c.env.DB, c.env.BETTER_AUTH_SECRET)
  return auth.handler(c.req.raw)
})

export { app as authRoutes }
