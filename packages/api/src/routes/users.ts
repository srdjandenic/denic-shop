import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import { createDb } from '../lib/db'
import { authMiddleware, requireRole } from '../middleware/auth'
import { users } from '@denic-shop/core/schema'
import type { Env } from '../lib/env'
import type { JwtPayload } from '../lib/auth'

type Variables = { user: JwtPayload }

export const userRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

userRoutes.use('*', authMiddleware)

userRoutes.get('/', requireRole('owner', 'admin'), async (c) => {
  const { tenantId } = c.get('user')
  const db = createDb(c.env.DB)
  const rows = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.tenantId, tenantId))
  return c.json({ data: rows })
})

// Pozivnica — kreira korisnika sa privremenom lozinkom
userRoutes.post('/invite', requireRole('owner', 'admin'), async (c) => {
  const { tenantId } = c.get('user')
  const body = await c.req.json()
  if (!body.email || !body.name) return c.json({ error: 'email i name su obavezni' }, 400)

  const db = createDb(c.env.DB)

  const existing = await db.select().from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.email, body.email)))
  if (existing[0]) return c.json({ error: 'Korisnik sa tim emailom već postoji' }, 409)

  // Privremena lozinka — u produkciji slati email sa linkom
  const tempPassword = crypto.randomUUID().slice(0, 12)
  const encoder = new TextEncoder()
  const data = encoder.encode(tempPassword)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)))

  const id = crypto.randomUUID()
  await db.insert(users).values({
    id,
    tenantId,
    email: body.email,
    name: body.name,
    role: body.role ?? 'staff',
    passwordHash: hashB64,
  })

  // U produkciji: slati email sa privremenom lozinkom
  return c.json({ data: { id, email: body.email, tempPassword } }, 201)
})

userRoutes.patch('/:id/role', requireRole('owner'), async (c) => {
  const { tenantId, sub: currentUserId } = c.get('user')
  const db = createDb(c.env.DB)
  const body = await c.req.json()
  const targetId = c.req.param('id')

  if (targetId === currentUserId) return c.json({ error: 'Ne možeš menjati svoju ulogu' }, 400)

  const existing = await db.select().from(users)
    .where(and(eq(users.id, targetId), eq(users.tenantId, tenantId)))
  if (!existing[0]) return c.json({ error: 'Korisnik nije pronađen' }, 404)

  await db.update(users).set({ role: body.role }).where(eq(users.id, targetId))
  return c.json({ data: { ok: true } })
})

userRoutes.delete('/:id', requireRole('owner'), async (c) => {
  const { tenantId, sub: currentUserId } = c.get('user')
  const db = createDb(c.env.DB)
  const targetId = c.req.param('id')

  if (targetId === currentUserId) return c.json({ error: 'Ne možeš ukloniti sebe' }, 400)

  const existing = await db.select().from(users)
    .where(and(eq(users.id, targetId), eq(users.tenantId, tenantId)))
  if (!existing[0]) return c.json({ error: 'Korisnik nije pronađen' }, 404)

  await db.update(users).set({ role: 'staff' }).where(eq(users.id, targetId))
  await db.delete(users).where(eq(users.id, targetId))
  return c.json({ data: { ok: true } })
})
