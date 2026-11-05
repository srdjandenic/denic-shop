import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { verifyToken, type JwtPayload } from '../lib/auth'
import type { Env } from '../lib/env'
import type { UserRole } from '@denic-shop/core/types'

type Variables = {
  user: JwtPayload
}

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const token = getCookie(c, 'session') ?? c.req.header('Authorization')?.replace('Bearer ', '')

    if (!token) {
      return c.json({ error: 'Nije autorizovano' }, 401)
    }

    try {
      const payload = await verifyToken(token, c.env.JWT_SECRET)
      c.set('user', payload)
      await next()
    } catch {
      return c.json({ error: 'Nevažeći token' }, 401)
    }
  }
)

export function requireRole(...roles: UserRole[]) {
  return createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
    const user = c.get('user')
    if (!user || !roles.includes(user.role)) {
      return c.json({ error: 'Nedovoljne privilegije' }, 403)
    }
    await next()
  })
}
