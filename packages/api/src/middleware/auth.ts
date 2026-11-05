import { createMiddleware } from 'hono/factory'
import { createAuth } from '../lib/auth'
import type { Env } from '../lib/env'

export type AuthVariables = {
  userId: string
  userRole: 'owner' | 'admin' | 'staff'
  sessionId: string
}

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: AuthVariables }>(
  async (c, next) => {
    const auth = createAuth(c.env.DB, c.env.BETTER_AUTH_SECRET)
    const session = await auth.api.getSession({ headers: c.req.raw.headers })

    if (!session?.user) {
      c.res = c.json({ error: 'Nije autentifikovano' }, 401)
      return
    }

    c.set('userId', session.user.id)
    c.set('userRole', (session.user as any).role ?? 'staff')
    c.set('sessionId', session.session.id)
    return next()
  },
)

export const requireRole = (...roles: Array<'owner' | 'admin' | 'staff'>) =>
  createMiddleware<{ Bindings: Env; Variables: AuthVariables }>(async (c, next) => {
    const role = c.get('userRole')
    if (!roles.includes(role)) {
      c.res = c.json({ error: 'Nedovoljne privilegije' }, 403)
      return
    }
    return next()
  })
