import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { eq } from 'drizzle-orm'
import { createDb } from '../lib/db'
import { signToken, verifyPassword } from '../lib/auth'
import { authMiddleware } from '../middleware/auth'
import { LoginSchema } from '@denic-shop/core/validators'
import { users } from '@denic-shop/core/schema'
import type { Env } from '../lib/env'
import type { JwtPayload } from '../lib/auth'

type Variables = { user: JwtPayload }

export const authRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

authRoutes.post('/login', async (c) => {
  const body = await c.req.json()
  const result = LoginSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Nevalidni podaci' }, 400)
  }

  const db = createDb(c.env.DB)
  const user = await db.query.users.findFirst({
    where: eq(users.email, result.data.email),
  })

  if (!user || !(await verifyPassword(result.data.password, user.passwordHash))) {
    return c.json({ error: 'Pogrešan email ili lozinka' }, 401)
  }

  const token = await signToken(
    { sub: user.id, tenantId: user.tenantId, role: user.role },
    c.env.JWT_SECRET
  )

  const isLocal = c.req.header('host')?.startsWith('localhost') ?? false
  setCookie(c, 'session', token, {
    httpOnly: true,
    secure: !isLocal,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })

  return c.json({
    data: { id: user.id, email: user.email, name: user.name, role: user.role },
  })
})

authRoutes.post('/logout', (c) => {
  deleteCookie(c, 'session', { path: '/' })
  return c.json({ data: { ok: true } })
})

authRoutes.get('/me', authMiddleware, (c) => {
  const user = c.get('user')
  return c.json({ data: user })
})
